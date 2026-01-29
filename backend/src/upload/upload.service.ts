import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import { PdfDocument } from './pdf-document.entity';
import { OllamaEmbeddings, ChatOllama } from '@langchain/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'; // 👈 [New] 청킹 도구

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

  constructor(
    @InjectRepository(PdfDocument)
    private pdfRepository: Repository<PdfDocument>,
  ) {
    // 1. 임베딩 모델
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
    this.embeddings = new OllamaEmbeddings({
      model: 'nomic-embed-text',
      baseUrl: 'http://localhost:11434',
      numCtx: 2048,
    } as any);

    // 2. 채팅 모델 (Llama 3)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
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
    // 임베딩 생성 시 텍스트가 너무 길면 오류가 날 수 있으니 안전장치
    const safeText = text.substring(0, 2000);
    if (!safeText.trim()) {
      return new Array(768).fill(0) as number[];
    }
    const vector = await this.embeddings.embedQuery(safeText);
    return vector;
  }

  // 🚀 [핵심 변경] 파일을 쪼개서 저장하는 로직
  async saveFile(
    filename: string,
    originalName: string,
    content: string,
  ): Promise<number> {
    // 반환값 변경 (저장된 청크 개수)
    console.log(
      `🔪 청킹 시작: ${originalName} (전체 길이: ${content.length}자)`,
    );

    // 1. Text Splitter 설정
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000, // 한 조각당 약 1000자 (약 300~400 토큰)
      chunkOverlap: 200, // 조각끼리 200자씩 겹치게 (문맥 단절 방지)
    });

    // 2. 문서를 조각으로 나눔
    const chunks = await splitter.createDocuments([content]);
    console.log(`🧩 생성된 청크 개수: ${chunks.length}개`);

    // 3. 각 청크를 DB에 저장 (반복문)
    let savedCount = 0;
    for (const chunk of chunks) {
      const chunkContent = chunk.pageContent;

      // 임베딩 생성
      const embedding = await this.getEmbedding(chunkContent);

      const newDocument = this.pdfRepository.create({
        filename,
        originalName,
        content: chunkContent, // 전체가 아니라 조각만 저장
        embedding,
      });

      await this.pdfRepository.save(newDocument);
      savedCount++;
      // 진행 상황 로그 (너무 많으면 생략 가능)
      if (savedCount % 5 === 0)
        console.log(`💾 ${savedCount}번째 청크 저장 완료...`);
    }

    console.log(`✅ 모든 청크 저장 완료! (Total: ${savedCount})`);
    return savedCount; // 저장된 ID 대신 개수 반환
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
      `, // ⚠️ LIMIT를 2 -> 4로 늘림 (청크가 작아졌으므로 더 많이 가져와도 됨)
      [`[${queryVector.join(',')}]`],
    );
    return results;
  }

  async chat(question: string): Promise<string> {
    console.log(`💬 질문: "${question}" (Chunking Mode)`);

    const relevantDocs = await this.search(question);

    if (relevantDocs.length === 0) {
      return '죄송합니다. 관련 정보를 찾을 수 없습니다.';
    }

    // 청킹된 문서들을 합침
    const context = relevantDocs.map((doc) => doc.content).join('\n\n---\n\n');
    console.log(`📄 Context 길이: ${context.length}자`);

    // ✅ 주인님의 Legacy 프롬프트 스타일을 완벽하게 적용
    const prompt = PromptTemplate.fromTemplate(`
      당신은 유능한 '문서 분석 및 업무 보조 AI 전문가'입니다. 
      아래 제공되는 [참고 문서]의 내용을 바탕으로 사용자의 질문에 답변하십시오.

      [답변 원칙]
      1. **반드시 한국어(Korean)로만 답변하십시오.** (영어 사용 금지)
      2. 참고 문서의 내용이 영어라도, 반드시 한국어로 번역하여 설명하십시오.
      3. 문서에 없는 내용은 지어내지 말고, "제공된 문서에 해당 내용이 없습니다"라고 명시하십시오.
      4. 답변은 논리적이고 정중한 존댓말(하십시오체 또는 해요체)을 사용하십시오.
      
      [참고 문서]
      {context}

      [질문]
      {question}

      답변:
    `);

    const chain = prompt.pipe(this.chatModel).pipe(new StringOutputParser());

    console.log('🤖 답변 생성 시작...');
    const response = await chain.invoke({
      context: context,
      question: question,
    });
    console.log('✅ 답변 완료!');

    return response;
  }
}
