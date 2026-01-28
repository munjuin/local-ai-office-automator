import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import { PdfDocument } from './pdf-document.entity';
import { OllamaEmbeddings } from '@langchain/ollama';

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

  constructor(
    @InjectRepository(PdfDocument)
    private pdfRepository: Repository<PdfDocument>,
  ) {
    this.embeddings = new OllamaEmbeddings({
      model: 'nomic-embed-text',
      baseUrl: 'http://localhost:11434',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      ...({ numCtx: 8192 } as any),
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
    console.log(`🔍 임베딩 시도 텍스트 길이: ${safeText.length}자`);

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
      LIMIT 5
      `,
      [`[${queryVector.join(',')}]`],
    );

    console.log(`✅ 검색 완료: ${results.length}개의 관련 문서 발견`);
    return results;
  }
}
