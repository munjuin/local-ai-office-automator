// backend/src/utils/pdf-parser.ts
import fs from 'fs';
// @ts-ignore: pdf-parse-fork는 타입 정의가 없을 수 있으므로 무시하거나 any로 처리합니다.
import pdf from 'pdf-parse-fork';

export interface ParsedPdf {
  text: string;
  metadata: {
    source: string;
    totalPages: number;
    info: any;
  };
}

export class PdfParser {
  static async parse(filePath: string): Promise<ParsedPdf> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
    }

    const dataBuffer = fs.readFileSync(filePath);
    
    try {
      // 이제 복잡한 체크 없이 바로 호출이 가능합니다.
      const data = await pdf(dataBuffer);
      
      return {
        text: data.text,
        metadata: {
          source: filePath.split(/[\\/]/).pop() || 'unknown',
          totalPages: data.numpages,
          info: data.info,
        },
      };
    } catch (error) {
      console.error('PDF Parsing Error:', error);
      throw new Error('PDF 파일을 읽는 중 오류가 발생했습니다.');
    }
  }
}