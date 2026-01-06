import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ChatMessage } from './types/chat.js';
import { OllamaService } from './services/ollamaService.js';

// 환경 변수 설정
dotenv.config();

const app = express();
const PORT: number = Number(process.env.PORT) || 3000;

//미들웨어 설정
app.use(cors()); //CORS 사용 설정
app.use(express.json()); //JSON body 파서 설정

// [Issue #2 테스트] AI 응답 테스트 엔드포인트
app.post('/api/test-chat', async (req: Request, res: Response)=>{
  const {prompt, model} = req.body; //클라이언트에서 모델명을 보낼수도 있음

  //대화 내역 배열 생성 (OllamaService.ask의 안자 형식에 맞춤
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `당신은 전기 및 소방 공무 행정 전문가입니다. 반드시 한국어로 답변해야 하며, 전문적인 용어를 사용하되 친절하게 설명해 주세요.`
    },
    {
      role: 'user',
      content: prompt
    }
  ];
  try {
    //리펙토링된 서비스 호출 (model은 undefined일수도 있음)
    const answer = await OllamaService.ask(messages, model);
    res.json({
      success: true,
      answer
    });
  } catch (error: any) {
    //서비스에서 정의한 에러 메시지가 전달됨
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

//헬스 체크 API
app.get('/health', (req: Request, res:Response)=>{
  res.json({
    status: 'OK',
    message: 'TypeScript 기반 로컬 AI 서버가 가동중입니다.',
    timestamp: new Date().toISOString()
  });
});

//서버 시작
app.listen(PORT, ()=>{
  console.log(`🚀 [Server] 실행 중: http://localhost:${PORT}`);
});