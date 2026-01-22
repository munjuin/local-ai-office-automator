// backend/src/app.ts
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
// 💡 [중요] app.ts가 backend/src 안에 있으므로, 경로는 바로 옆의 services를 가리킵니다.
import { EmbeddingService } from './services/embedding.service.js';
import ollama from 'ollama';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = 3000;

app.use(cors()); // 프론트엔드 접속 허용
app.use(express.json());

// API: 질문 받기
app.post('/api/chat', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      res.status(400).json({ error: '질문 내용이 없습니다.' });
      return;
    }

    console.log(`\n📩 [API 요청] 질문: "${query}"`);

    // 1. 임베딩 (질문 -> 벡터)
    const queryEmbedding = await EmbeddingService.getEmbedding(query);
    const vectorQuery = `[${queryEmbedding.join(',')}]`;

    // 2. 검색 (DB 조회)
    const results = await prisma.$queryRawUnsafe<any[]>(
      `SELECT content
       FROM "DocumentChunk"
       ORDER BY embedding <=> $1::vector
       LIMIT 3;`,
      vectorQuery
    );

    if (results.length === 0) {
      res.json({ answer: "관련된 문서를 찾지 못했습니다.", sources: [] });
      return;
    }

    // 3. 문맥 조합
    const context = results.map(r => r.content).join("\n\n");

    // 4. AI 답변 생성
    const prompt = `
    당신은 대한민국 최고의 '전기, 소방, 통신 공무 행정 전문가'입니다. 
    아래 제공되는 [참고 문서]의 내용을 바탕으로 사용자의 질문에 답변하십시오.

    [답변 원칙]
    1. **반드시 한국어(Korean)로만 답변하십시오.** (영어 사용 금지)
    2. 참고 문서의 내용이 영어라도, 반드시 한국어로 번역하여 설명하십시오.
    3. 문서에 없는 내용은 지어내지 말고, 본인의 지식을 활용하되 "문서에는 나와있지 않지만"이라고 명시하십시오.
    4. 답변은 논리적이고 정중한 존댓말(하십시오체 또는 해요체)을 사용하십시오.
    
    [문서 내용]
    ${context}

    [질문]
    ${query}
    `;

    // 모델 이름은 주인님 환경에 맞게 (llama3.1 등)
    const response = await ollama.chat({
      model: 'llama3.1', 
      messages: [{ role: 'user', content: prompt }],
    });

    const answer = response.message.content;
    console.log(`✅ 답변 생성 완료`);

    // 5. 결과 반환 (JSON)
    res.json({ answer, sources: results });

  } catch (error) {
    console.error("❌ 서버 에러:", error);
    res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`\n🚀 AI 서버가 ON 되었습니다: http://localhost:${PORT}`);
});