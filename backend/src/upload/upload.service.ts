import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import { PdfDocument } from './pdf-document.entity';
import { OllamaEmbeddings, ChatOllama } from '@langchain/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

interface PDFPageItem {
  str: string;
}

interface SearchResult {
  id: number;
  filename: string;
  originalName: string;
  content: string;
  similarity: number;
}

@Injectable()
export class UploadService {
  private embeddings: OllamaEmbeddings;
  private chatModel: ChatOllama;

  // 인메모리 대화 저장소
  private sessions: Map<string, BaseMessage[]> = new Map();

  constructor(
    @InjectRepository(PdfDocument)
    private pdfRepository: Repository<PdfDocument>,
  ) {
    // 1. 임베딩 모델
    this.embeddings = new OllamaEmbeddings({
      model: 'nomic-embed-text',
      baseUrl: 'http://localhost:11434',
      numCtx: 2048,
    } as any);

    // 2. 채팅 모델 (Llama 3)
    this.chatModel = new ChatOllama({
      model: 'llama3',
      baseUrl: 'http://localhost:11434',
      temperature: 0.3,
      numCtx: 2048,
      num_predict: 512,
    } as any);
  }

  async parsePdf(filePath: string): Promise<string> {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const dataBuffer = await fs.readFile(filePath);
    const uint8Array = new Uint8Array(dataBuffer);

    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
      standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/',
    });

    const doc = await loadingTask.promise;
    const maxPages = doc.numPages;
    const textContents: string[] = [];

    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item: unknown) => (item as PDFPageItem).str)
        .join(' ');
      textContents.push(text);
    }
    return textContents.join('\n');
  }

  async getEmbedding(text: string): Promise<number[]> {
    const safeText = text.substring(0, 2000);
    if (!safeText.trim()) {
      return new Array(768).fill(0) as number[];
    }
    const vector = await this.embeddings.embedQuery(safeText);
    return vector;
  }

  async saveFile(
    filename: string,
    originalName: string,
    content: string,
  ): Promise<number> {
    console.log(
      `🔪 청킹 시작: ${originalName} (전체 길이: ${content.length}자)`,
    );

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const chunks = await splitter.createDocuments([content]);
    console.log(`🧩 생성된 청크 개수: ${chunks.length}개`);

    let savedCount = 0;
    for (const chunk of chunks) {
      const chunkContent = chunk.pageContent;
      const embedding = await this.getEmbedding(chunkContent);

      const newDocument = this.pdfRepository.create({
        filename,
        originalName,
        content: chunkContent,
        embedding,
      });

      await this.pdfRepository.save(newDocument);
      savedCount++;
    }
    return savedCount;
  }

  async search(question: string): Promise<SearchResult[]> {
    console.log(`🔎 검색 요청: "${question}"`);
    const queryVector = await this.getEmbedding(question);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const results: SearchResult[] = await this.pdfRepository.query(
      `
      SELECT 
        id, 
        filename, 
        "originalName", 
        content, 
        1 - (embedding <=> $1) as similarity
      FROM pdf_document
      ORDER BY embedding <=> $1 ASC
      LIMIT 4 
      `,
      [`[${queryVector.join(',')}]`],
    );
    return results;
  }

  async chat(question: string, sessionId?: string): Promise<string> {
    const safeSessionId = sessionId || 'default-session';
    console.log(`💬 질문: "${question}" (Session: ${safeSessionId})`);

    // 1. 검색 (Retrieval)
    const relevantDocs = await this.search(question);
    const context =
      relevantDocs.length > 0
        ? relevantDocs.map((doc) => doc.content).join('\n\n---\n\n')
        : '관련 문서를 찾을 수 없습니다.';

    // 2. 대화 기록 불러오기 (Memory Retrieval)
    const history = this.sessions.get(safeSessionId) || [];

    // 최근 6개 메시지(3턴)만 유지
    const recentHistory = history.slice(-6);

    // 대화 내역 포맷팅 (여기서 msg.content as string 처리)
    const chatHistoryText = recentHistory
      .map((msg) => {
        const role = msg instanceof HumanMessage ? '사용자' : 'AI 비서';
        // ⚠️ msg.content가 문자열임을 명시하여 ESLint 에러 해결
        return `${role}: ${msg.content as string}`;
      })
      .join('\n');

    console.log(`📜 불러온 대화 내역:\n${chatHistoryText || '(없음)'}`);

    // 3. 프롬프트 구성
    const prompt = PromptTemplate.fromTemplate(`
      ### SYSTEM ROLE
      You are a professional AI assistant who speaks **ONLY Korean (한국어)**.
      Your task is to answer the user's question based on the [Context] and [Chat History].

      ### 🚨 CRITICAL RULES (MUST FOLLOW) 🚨
      1. **LANGUAGE:** You must answer in **Korean** language only. (절대 영어 문장으로 답하지 마십시오.)
      2. **TRANSLATION:** If the provided [Context] is in English, you MUST translate and summarize it into Korean.
      3. **TERMINOLOGY:** Use English only for specific technical terms inside parentheses. e.g., "임베딩(Embedding)".
      4. **GROUNDING:** If the answer is not in the [Context], say "문서에 해당 내용이 없습니다." in Korean.

      ### DATA SOURCE
      [Chat History]
      {chat_history}

      [Context from Documents]
      {context}

      ---------------------------------------------------

      ### USER INPUT
      [Question]
      {question}

      ### 📢 FINAL INSTRUCTION
      Answer the question above in **Korean(한국어)**. Do not explain, just answer.

      답변:
    `);

    // 4. 답변 생성
    const chain = prompt.pipe(this.chatModel).pipe(new StringOutputParser());
    const response = await chain.invoke({
      chat_history: chatHistoryText,
      context: context,
      question: question,
    });

    // 5. 대화 기록 저장
    recentHistory.push(new HumanMessage(question));
    recentHistory.push(new AIMessage(response));
    this.sessions.set(safeSessionId, recentHistory);

    console.log('✅ 답변 완료 및 기억 저장');
    return response;
  }
}
