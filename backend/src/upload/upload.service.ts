import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import { PdfDocument } from './pdf-document.entity';

// ESLint를 달래기 위한 타입 정의
interface PDFPageItem {
  str: string;
}

@Injectable()
export class UploadService {
  constructor(
    // 1. Repository 주입: 이제 DB와 대화할 수 있습니다!
    @InjectRepository(PdfDocument)
    private pdfRepository: Repository<PdfDocument>,
  ) {}

  // 2. 파싱 로직 (기존과 동일)
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

  // 3. 저장 로직 (새로 추가됨!)
  async saveFile(
    filename: string,
    originalName: string,
    content: string,
  ): Promise<PdfDocument> {
    // 엔티티 인스턴스 생성
    const newDocument = this.pdfRepository.create({
      filename,
      originalName,
      content,
    });

    // DB에 저장 (INSERT)
    return await this.pdfRepository.save(newDocument);
  }
}
