import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import cors from 'cors';

// 1. ESM 환경에서 __dirname 정의 및 환경 변수 로드 (최우선 실행)
// 이 과정이 Prisma나 다른 서비스를 불러오기 전에 완료되어야 합니다.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 루트 디렉토리(../../.env)의 설정값을 읽어옵니다.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// [디버깅] 환경 변수가 정상적으로 로드되었는지 확인
console.log("📍 DATABASE_URL 로드 상태:", process.env.DATABASE_URL ? "성공" : "실패");

// 2. 환경 변수 로드 후, DB 및 AI 서비스를 동적 임포트하여 임포트 호이스팅 문제 해결
const { default: prisma } = await import('./lib/prisma.js');
const { OllamaService } = await import('./services/ollamaService.js');

// 타입 정의 임포트 (타입은 런타임에 영향을 주지 않으므로 일반 임포트 가능)
import { ChatMessage, ChatRequest, ChatResponse } from './types/chat.js';

const app = express();
const PORT: number = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// 1. 대화 내역 불러오기
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

// 2. 채팅 요청 및 DB 저장
app.post('/api/chat', async (req: Request, res: Response) => {
  const { prompt, model } = req.body as ChatRequest;

  if (!prompt || prompt.trim() === '') {
    return res.status(400).json({ success: false, error: '프롬프트 내용을 입력해주세요' });
  }

  try {
    const targetModel = model || 'llama3';

    // 메시지 구성 시 타입을 명시하여 'role' 관련 타입 에러 방지
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `당신은 대한민국 '전기 및 소방 공무 행정 전문가'입니다. 반드시 한국어로 답변하십시오.`
      },
      {
        role: 'user',
        content: `${prompt} (응답은 반드시 한국어로 작성해줘.)`
      }
    ];

    // 1. AI 응답 생성
    const answer = await OllamaService.ask(messages, targetModel);

    // 2. DB에 대화 내역 저장 (사용자 질문 + AI 답변)
    await prisma.chatHistory.createMany({
      data: [
        { role: 'user', content: prompt, model: targetModel },
        { role: 'assistant', content: answer, model: targetModel }
      ]
    });

    const responseData: ChatResponse = {
      answer,
      timestamp: new Date().toISOString(),
      model: targetModel
    };
    
    res.json(responseData);

  } catch (error: any) {
    console.error(`[API Error] /api/chat 호출 실패:`, error.message);
    res.status(500).json({ success: false, error: 'AI 응답 생성 중 오류 발생' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: '서버 가동 중', dbConnection: !!process.env.DATABASE_URL });
});

app.listen(PORT, () => {
  console.log(`🚀 [Server] 실행 중: http://localhost:${PORT}`);
});