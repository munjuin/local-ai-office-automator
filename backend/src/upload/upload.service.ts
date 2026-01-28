import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import { PdfDocument } from './pdf-document.entity';
import { OllamaEmbeddings } from '@langchain/ollama';

interface PDFPageItem {
  str: string;
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
      // ✅ 수정: numCtx를 최상위 레벨로 이동 (라이브러리가 더 잘 인식함)
      // (as any를 써서 타입 에러를 방지하며 강제로 주입합니다)
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
    // ✅ 수정: 안전을 위해 1000자로 줄이고 로그를 찍어봅니다.
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
}
