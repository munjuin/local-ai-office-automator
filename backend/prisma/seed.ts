// backend/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
// @ts-ignore
import { PdfParser } from '../src/utils/pdf-parser.js';
// @ts-ignore
import { EmbeddingService } from '../src/services/embedding.service.js';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

// Prisma 6는 인자 없이 생성해도 환경변수를 잘 읽어옵니다.
const prisma = new PrismaClient();

async function main() {
  const pdfPath = path.resolve(process.cwd(), 'backend', 'sample.pdf');
  
  console.log(`📂 파일 경로: ${pdfPath}`);
  
  console.log('📖 1. PDF 파싱...');
  const parsedData = await PdfParser.parse(pdfPath);

  console.log('📄 2. DB 저장...');
  const document = await prisma.document.create({
    data: {
      title: parsedData.metadata.source,
      content: parsedData.text,
      metadata: parsedData.metadata as any,
    }
  });

  console.log(`🧩 3. 벡터화...`);
  const chunks = await EmbeddingService.splitText(parsedData.text, parsedData.metadata.source);

  for (const chunk of chunks) {
    const embedding = await EmbeddingService.getEmbedding(chunk.content);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "DocumentChunk" ("id", "documentId", "content", "embedding", "metadata") 
       VALUES (gen_random_uuid(), $1, $2, $3::vector, $4::jsonb)`,
      document.id, chunk.content, `[${embedding.join(',')}]`, JSON.stringify(chunk.metadata)
    );
  }
  console.log('\n✨ 성공!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => await prisma.$disconnect());