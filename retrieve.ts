import { PrismaClient } from '@prisma/client';
import { EmbeddingService } from './backend/src/services/embedding.service.js';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function search(query: string) {
  console.log('��� 질문: "' + query + '"');
  const queryEmbedding = await EmbeddingService.getEmbedding(query);
  const vectorQuery = '[' + queryEmbedding.join(',') + ']';
  
  const results = await prisma.$queryRawUnsafe(
    `SELECT id, content, 1 - (embedding <=> $1::vector) as similarity
     FROM "DocumentChunk"
     ORDER BY embedding <=> $1::vector
     LIMIT 3;`,
    vectorQuery
  );

  console.log('✨ 검색 결과:');
  (results as any[]).forEach((doc, i) => {
    console.log('[' + (i + 1) + '위] 유사도: ' + (doc.similarity * 100).toFixed(2) + '%');
    console.log('내용: ' + doc.content.substring(0, 100) + '...');
  });
}

const question = "이 문서의 핵심 내용은 무엇인가요?"; 
search(question)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
