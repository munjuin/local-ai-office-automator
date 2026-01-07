// backend/src/server.ts
import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { ChatMessage, ChatRequest, ChatResponse } from './types/chat.js';
import { OllamaService } from './services/ollamaService.js';
import prisma from './lib/prisma.js';

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
    res.status(500).json({ error: '내역을 불러오는데 실패했습니다.' });
  }
});

// 2. 채팅 요청 및 DB 저장 (통합 버전)
app.post('/api/chat', async (req: Request, res: Response) => {
  const { prompt, model } = req.body as ChatRequest;

  if (!prompt || prompt.trim() === '') {
    return res.status(400).json({ success: false, error: '프롬프트 내용을 입력해주세요' });
  }

  try {
    const targetModel = model || 'llama3';

    // 메시지 구성 (시스템 프롬프트 포함)
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
  res.json({ status: 'OK', message: '서버 가동 중' });
});

app.listen(PORT, () => {
  console.log(`🚀 [Server] 실행 중: http://localhost:${PORT}`);
});