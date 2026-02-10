import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import { PdfDocument } from './pdf-document.entity';
import { OllamaEmbeddings, ChatOllama } from '@langchain/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
// 👇 [변경] CACHE_MANAGER 임포트 필수
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

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

// 👇 [추가] Redis에 저장할 대화 메시지 타입 정의
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class UploadService {
  private embeddings: OllamaEmbeddings;
  private chatModel: ChatOllama;

  // ❌ [삭제] 기존 인메모리 저장소(Map)는 이제 사용하지 않습니다.
  // private sessions: Map<string, BaseMessage[]> = new Map();

  constructor(
    @InjectRepository(PdfDocument)
    private pdfRepository: Repository<PdfDocument>,
    // 👇 [추가] Redis Cache Manager 주입
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
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

  // ... (parsePdf, getEmbedding, saveFile, search 메서드는 기존과 동일하므로 생략하지 않고 그대로 둡니다) ...

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

  // 👇 [수정] Redis가 적용된 채팅 로직
  async chat(question: string, sessionId?: string): Promise<string> {
    const safeSessionId = sessionId || 'default-session';
    // Redis Key 정의 (구분을 위해 prefix 사용)
    const historyKey = `chat_history:${safeSessionId}`;
    const responseCacheKey = `response:${safeSessionId}:${question}`;

    console.log(`💬 질문: "${question}" (Session: ${safeSessionId})`);

    // ---------------------------------------------------------
    // ⚡️ 0. 응답 캐싱 (Response Caching)
    // 똑같은 질문을 또 했다면, LLM 연산 없이 Redis에서 바로 반환
    // ---------------------------------------------------------
    const cachedResponse =
      await this.cacheManager.get<string>(responseCacheKey);
    if (cachedResponse) {
      console.log('⚡️ Redis 캐시 히트! (LLM 연산 생략)');
      return cachedResponse;
    }

    // ---------------------------------------------------------
    // 1. 검색 (Retrieval)
    // ---------------------------------------------------------
    const relevantDocs = await this.search(question);
    const context =
      relevantDocs.length > 0
        ? relevantDocs.map((doc) => doc.content).join('\n\n---\n\n')
        : '관련 문서를 찾을 수 없습니다.';

    // ---------------------------------------------------------
    // 2. 대화 기록 불러오기 (Redis Memory Retrieval)
    // ---------------------------------------------------------
    // Redis에서 가져오기 (없으면 빈 배열)
    const history =
      (await this.cacheManager.get<ChatMessage[]>(historyKey)) || [];

    // 최근 6개 메시지(3턴)만 유지
    const recentHistory = history.slice(-6);

    // 대화 내역 포맷팅 (JSON -> String 변환)
    const chatHistoryText = recentHistory
      .map((msg) => {
        const role = msg.role === 'user' ? '사용자' : 'AI 비서';
        return `${role}: ${msg.content}`;
      })
      .join('\n');

    console.log(`📜 불러온 대화 내역:\n${chatHistoryText || '(없음)'}`);

    // ---------------------------------------------------------
    // 3. 프롬프트 구성
    // ---------------------------------------------------------
    const prompt = PromptTemplate.fromTemplate(`
      ### SYSTEM ROLE
      You are a professional AI assistant who speaks **ONLY Korean (한국어)**.
      Your task is to answer the user's question based on the provided [Context] AND [Chat History].

      ### 🚨 CRITICAL RULES (MUST FOLLOW) 🚨
      1. **SOURCE PRIORITY:** - First, check the **[Chat History]** to see if the user mentioned their name or previous topics.
         - Second, check the **[Context]** for document-related information.
      2. **LANGUAGE:** You must answer in **Korean** language only.
      3. **GROUNDING:** - If the answer is found in [Chat History], answer based on memory.
         - If the answer is found in [Context], answer based on the document.
         - If the answer is in **NEITHER**, say "문서나 이전 대화에서 관련 내용을 찾을 수 없습니다."

      ### DATA SOURCE
      [Chat History] (User's previous messages)
      {chat_history}

      [Context from Documents] (Search results)
      {context}

      ---------------------------------------------------

      ### USER INPUT
      [Question]
      {question}

      ### 📢 FINAL INSTRUCTION
      Answer the question above in **Korean(한국어)**. 
      If the user asks "What is my name?", check the [Chat History] first.

      답변:
    `);

    // ---------------------------------------------------------
    // 4. 답변 생성
    // ---------------------------------------------------------
    const chain = prompt.pipe(this.chatModel).pipe(new StringOutputParser());
    const response = await chain.invoke({
      chat_history: chatHistoryText,
      context: context,
      question: question,
    });

    // ---------------------------------------------------------
    // 5. 대화 기록 저장 (Redis Save)
    // ---------------------------------------------------------
    // 새 대화 추가
    recentHistory.push({ role: 'user', content: question });
    recentHistory.push({ role: 'assistant', content: response });

    // Redis에 대화 내역 저장 (TTL: 24시간 유지)
    // await은 필수입니다!
    await this.cacheManager.set(historyKey, recentHistory, 86400 * 1000);

    // 현재 질문에 대한 답변도 캐싱 (TTL: 1시간 유지)
    // 다음에 똑같은 질문 하면 바로 대답함
    await this.cacheManager.set(responseCacheKey, response, 3600 * 1000);

    console.log('✅ 답변 완료 및 Redis 저장 성공');
    return response;
  }
}
