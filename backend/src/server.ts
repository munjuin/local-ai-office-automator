// backend/src/server.ts
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import cors from 'cors';

// 1. 환경 설정 (기존 유지)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log("📍 DATABASE_URL 로드 상태:", process.env.DATABASE_URL ? "성공" : "실패");

// 2. 동적 임포트 (기존 유지 + EmbeddingService 추가)
const { default: prisma } = await import('./lib/prisma.js');
const { OllamaService } = await import('./services/ollamaService.js');
// 💡 [추가] 벡터 검색을 위해 임베딩 서비스 가져오기
const { EmbeddingService } = await import('./services/embedding.service.js');

import { ChatMessage, ChatRequest, ChatResponse } from './types/chat.js';

const app = express();
const PORT: number = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// 1. 대화 내역 불러오기 (기존 기능 유지)
app.get('/api/chat/history', async (req, res) => {
  try {
    const history = await prisma.chatHistory.findMany({
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    res.json(history);
  } catch (error) {
    console.error("[DB Error] 내역 조회 실패:", error);
    res.status(500).json({ error: '내역을 불러오는데 실패했습니다.' });
  }
});

// 2. 채팅 요청 (🔥 RAG 기능으로 대개조!)
app.post('/api/chat', async (req: Request, res: Response) => {
  const { prompt, model } = req.body as ChatRequest;

  if (!prompt || prompt.trim() === '') {
    return res.status(400).json({ success: false, error: '프롬프트 내용을 입력해주세요' });
  }

  try {
    const targetModel = model || 'llama3'; // 벡터 기능이 있는 모델 권장

    console.log(`\n🔍 사용자 질문: "${prompt}"`);

    // ---------------------------------------------------------
    // 💡 [RAG 핵심 로직 시작]
    // ---------------------------------------------------------
    
    // 1. 질문을 벡터로 변환
    const queryEmbedding = await EmbeddingService.getEmbedding(prompt);
    const vectorQuery = `[${queryEmbedding.join(',')}]`;

    // 2. DB에서 관련 문서 검색 (유사도 검색)
    // (chatHistory가 아니라 DocumentChunk 테이블을 조회합니다)
    const similarDocs = await prisma.$queryRawUnsafe<any[]>(
      `SELECT content
       FROM "DocumentChunk"
       ORDER BY embedding <=> $1::vector
       LIMIT 3;`, // 가장 관련성 높은 3개만 참조
      vectorQuery
    );

    // 3. 문맥(Context) 구성
    // 검색된 문서가 있으면 내용을 합치고, 없으면 빈 문자열
    const contextText = similarDocs.length > 0 
      ? similarDocs.map(doc => doc.content).join("\n\n") 
      : "관련된 문서 내용을 찾을 수 없습니다.";

    console.log(`✅ 관련 문서 ${similarDocs.length}개를 참조하여 답변합니다.`);

    // ---------------------------------------------------------
    // 💡 [RAG 핵심 로직 끝]
    // ---------------------------------------------------------

    // 4. 시스템 프롬프트 강화 (기존 페르소나 + 검색된 지식 주입)
    const systemPrompt = `
    당신은 대한민국 최고의 '전기, 소방, 통신 공무 행정 전문가'입니다. 
    아래 제공되는 [참고 문서]의 내용을 바탕으로 사용자의 질문에 답변하십시오.

    [답변 원칙]
    1. **반드시 한국어(Korean)로만 답변하십시오.** (영어 사용 금지)
    2. 참고 문서의 내용이 영어라도, 반드시 한국어로 번역하여 설명하십시오.
    3. 문서에 없는 내용은 지어내지 말고, 본인의 지식을 활용하되 "문서에는 나와있지 않지만"이라고 명시하십시오.
    4. 답변은 논리적이고 정중한 존댓말(하십시오체 또는 해요체)을 사용하십시오.
    
    [참고 문서]
    ${contextText}
    `;

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    // 5. AI 응답 생성
    const answer = await OllamaService.ask(messages, targetModel);

    // 6. DB에 대화 내역 저장 (기존 기능 유지 - 아주 중요!)
    await prisma.chatHistory.createMany({
      data: [
        { role: 'user', content: prompt, model: targetModel },
        { role: 'assistant', content: answer, model: targetModel }
      ]
    });

    const responseData: ChatResponse = {
      answer,
      timestamp: new Date().toISOString(),
      model: targetModel,
      // (선택사항) 프론트엔드에 참고한 문서 출처를 알려주고 싶다면 아래 줄 추가
      // sources: similarDocs 
    };
    
    res.json(responseData);

  } catch (error: any) {
    console.error(`[API Error] /api/chat 호출 실패:`, error.message);
    res.status(500).json({ success: false, error: 'AI 응답 생성 중 오류 발생' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'RAG 서버 가동 중', dbConnection: !!process.env.DATABASE_URL });
});

app.listen(PORT, () => {
  console.log(`🚀 [Server] RAG 기능이 탑재된 서버 실행 중: http://localhost:${PORT}`);
});