//uploadservice.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import { PdfDocument } from './pdf-document.entity';
import { OllamaEmbeddings, ChatOllama } from '@langchain/ollama'; // ChatOllama 추가
import { PromptTemplate } from '@langchain/core/prompts'; // 프롬프트 템플릿 추가
import { StringOutputParser } from '@langchain/core/output_parsers'; // 출력 파서 추가

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
  private chatModel: ChatOllama; // ✅ 채팅 모델 선언

  constructor(
    @InjectRepository(PdfDocument)
    private pdfRepository: Repository<PdfDocument>,
  ) {
    // 1. 임베딩 모델 (검색용)
    this.embeddings = new OllamaEmbeddings({
      model: 'nomic-embed-text',
      baseUrl: 'http://localhost:11434',
      ...({ numCtx: 8192 } as any),
    });

    // 2. 채팅 모델 (생성용 - Llama 3) ✅
    this.chatModel = new ChatOllama({
      model: 'llama3', // ⚠️ 설치된 모델명이 다르다면 수정 필요 (예: 'llama3:8b')
      baseUrl: 'http://localhost:11434',
      temperature: 0.3, // 0에 가까울수록 사실에 입각한 답변을 합니다.
    });
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
    const safeText = text.substring(0, 1000);
    // console.log(`🔍 임베딩 시도 텍스트 길이: ${safeText.length}자`);

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
  ): Promise<PdfDocument> {
    console.log('🤖 Ollama에게 임베딩 생성을 요청 중...');
    const embedding = await this.getEmbedding(content);
    console.log(`✅ 임베딩 생성 완료! (차원수: ${embedding.length})`);

    const newDocument = this.pdfRepository.create({
      filename,
      originalName,
      content,
      embedding,
    });

    return await this.pdfRepository.save(newDocument);
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
      LIMIT 3
      `,
      [`[${queryVector.join(',')}]`],
    );

    console.log(`✅ 검색 완료: ${results.length}개의 관련 문서 발견`);
    return results;
  }

  // ✅ 3. RAG 채팅 메서드 구현
  async chat(question: string): Promise<string> {
    console.log(`💬 질문 접수: "${question}"`);

    // (1) 문서 검색 (Retrieval)
    const relevantDocs = await this.search(question);

    if (relevantDocs.length === 0) {
      return '죄송합니다. 데이터베이스에서 관련 정보를 찾을 수 없습니다.';
    }

    // (2) 문맥 구성 (Context Augmentation)
    // 검색된 문서들의 텍스트를 하나로 합칩니다.
    const context = relevantDocs.map((doc) => doc.content).join('\n\n---\n\n');

    // (3) 프롬프트 템플릿 작성 (Prompt Engineering)
    const prompt = PromptTemplate.fromTemplate(`
      당신은 친절하고 전문적인 AI 비서입니다.
      반드시 아래 제공된 [Context]에 기반하여 [Question]에 대해 한국어로 답변하세요.
      만약 [Context]에 정답이 없다면, 지어내지 말고 "제공된 문서에 해당 내용이 없습니다"라고 솔직하게 말하세요.

      [Context]
      {context}

      [Question]
      {question}

      답변:
    `);

    // (4) 체인 실행 (LangChain Pipeline)
    // Prompt -> LLM -> OutputParser(String)
    const chain = prompt.pipe(this.chatModel).pipe(new StringOutputParser());

    console.log('🤖 Llama 3 답변 생성 중...');
    const response = await chain.invoke({
      context: context,
      question: question,
    });

    console.log('✅ 답변 생성 완료!');
    return response;
  }
}
