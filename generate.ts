// generate.ts
import { PrismaClient } from '@prisma/client';
import { EmbeddingService } from './backend/src/services/embedding.service.js';
import ollama from 'ollama';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function askAI(query: string) {
  console.log(`\n🤖 질문 분석 중: "${query}"...`);

  // 1. 질문을 벡터로 변환
  const queryEmbedding = await EmbeddingService.getEmbedding(query);
  const vectorQuery = `[${queryEmbedding.join(',')}]`;

  // 2. 가장 관련 있는 문서 검색 (RAG의 핵심!)
  const results = await prisma.$queryRawUnsafe<any[]>(
    `SELECT content
     FROM "DocumentChunk"
     ORDER BY embedding <=> $1::vector
     LIMIT 3;`,
    vectorQuery
  );

  if (results.length === 0) {
    console.log("❌ 관련 문서를 찾지 못했습니다.");
    return;
  }

  // 3. 검색된 문서들을 하나로 합침 (Context 생성)
  const context = results.map(r => r.content).join("\n\n");
  console.log(`✅ 관련 문서 ${results.length}개를 찾았습니다. 답변 생성 중...`);

  // 4. AI에게 "이 내용을 보고 답변해"라고 지시 (Prompt Engineering)
  const prompt = `
  당신은 유능한 AI 비서입니다. 아래 제공된 [문서 내용]을 바탕으로 사용자의 질문에 답변하세요.
  문서에 없는 내용은 지어내지 말고, "문서에 따르면"이라는 말로 시작하세요.

  [문서 내용]
  ${context}

  [사용자 질문]
  ${query}

  [답변]
  `;

  // 5. Ollama에게 요청 (Generation)
  const response = await ollama.chat({
    model: 'llama3', // 또는 사용 중인 모델명 (예: mistral, qwen2.5 등)
    messages: [{ role: 'user', content: prompt }],
  });

  console.log(`\n================= 💡 AI 답변 =================`);
  console.log(response.message.content);
  console.log(`===============================================`);
}

// 질문을 던져보세요!
const question = "이 문서의 핵심 내용은 무엇인가요?"; 

askAI(question)
  .catch(console.error)
  .finally(() => prisma.$disconnect());