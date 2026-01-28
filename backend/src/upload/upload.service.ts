import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';

interface PDFPageItem {
  str: string;
}

@Injectable()
export class UploadService {
  async parsePdf(filePath: string): Promise<string> {
    // ✅ 수정된 부분: 'legacy' 빌드를 명시적으로 가져옵니다.
    // .mjs 확장자까지 정확히 적어주어야 ESM 모듈을 제대로 인식합니다.
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const dataBuffer = await fs.readFile(filePath);

    // Uint8Array 변환 (이건 그대로)
    const uint8Array = new Uint8Array(dataBuffer);

    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
      // ✅ 추가 설정: 폰트 로딩 시 표준 폰트 데이터 경로 지정 (에러 방지용)
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
}
