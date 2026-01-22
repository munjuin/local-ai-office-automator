// backend/src/test-pdf.ts
import { PdfParser } from './utils/pdf-parser.js'; // .js 추가
import { EmbeddingService } from './services/embedding.service.js'; // .js 추가
import path from 'path';
import { fileURLToPath } from 'url';

// NodeNext(ESM) 환경에서는 __dirname이 없으므로 아래와 같이 정의해야 합니다.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function test() {
  const pdfPath = path.resolve(__dirname, '../sample.pdf');
  
  console.log('1. PDF 파싱 시작...');
  const parsedData = await PdfParser.parse(pdfPath);
  console.log(`파싱 완료! 총 페이지 수: ${parsedData.metadata.totalPages}`);

  console.log('\n2. 텍스트 청킹 시작...');
  const chunks = await EmbeddingService.splitText(parsedData.text, parsedData.metadata.source);
  
  console.log(`청킹 완료! 생성된 조각 수: ${chunks.length}`);
}

test().catch(console.error);