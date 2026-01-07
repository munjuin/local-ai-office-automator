import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ChatMessage } from './types/chat.js';
import { OllamaService } from './services/ollamaService.js';
import { ChatRequest, ChatResponse } from './types/chat.js';

// 환경 변수 설정
dotenv.config();

const app = express();
const PORT: number = Number(process.env.PORT) || 3000;

// 미들웨어 설정
app.use(cors()); //CORS 사용 설정
app.use(express.json()); //JSON body 파서 설정

app.post('/api/chat', async (req: Request, res: Response)=>{
  // 요청 데이터 추출 및 타입 캐스팅
  const { prompt, model } = req.body as ChatRequest;

  // 유효성 검사
  if(!prompt || typeof prompt !== 'string' || prompt.trim() === ''){
    return res.status(400).json({
      success: false,
      error: '프롬프트 내용을 입력해주세요'
    });
  }

  try {
    // 서비스 계층 호출을 위한 메시지 구성
    const messages: ChatMessage[] = [{
      role: 'system',
      content: `
      ### 역할
      당신은 대한민국 '전기 및 소방 공무 행정 전문가'입니다.

      ### 필수 규칙 (MUST FOLLOW)
      1. 반드시 **한국어(Korean)**로만 답변하십시오. 영어 답변은 엄격히 금지됩니다.
      2. 답변의 시작부터 끝까지 한국어 문법을 준수하십시오.
      3. 전문 용어 뒤에 괄호를 쓰고 영어를 병기하는 것은 허용되나, 전체 문장은 한국어여야 합니다.
      4. 질문자가 영어로 질문하더라도 당신은 무조건 한국어로 응답하십시오.
    `.trim()
    },
    {
      role: 'user',
      content: `${prompt} (응답은 반드시 한국어로 작성해줘.)`
    }
  ];

  // OllamaService 호출
  const answer = await OllamaService.ask(messages, model);

  // 정해진 DTO 규격에 맞춰 응답
  const responseData: ChatResponse = {
    answer,
    timestamp: new Date().toISOString(),
    model: model || process.env.OLLAMA_DEFAULT_MODEL || 'default'
  };
  res.json(responseData);

} catch (error: any) {
  // 에러 발생 시 표준화 된 에러 응답
  console.error(`[API Error] /api/chat 호출 실패:`, error.message);
  res.status(500).json({
    success: false,
    error: 'AI 응답을 생성하는 중 서버 오류가 발생했습니다.'
  });
}

// // [Issue #2 테스트] AI 응답 테스트 엔드포인트
// app.post('/api/test-chat', async (req: Request, res: Response)=>{
//   const {prompt, model} = req.body; //클라이언트에서 모델명을 보낼수도 있음

//   //대화 내역 배열 생성 (OllamaService.ask의 안자 형식에 맞춤
//   const messages: ChatMessage[] = [
//     {
//       role: 'system',
//       content: `당신은 전기 및 소방 공무 행정 전문가입니다. 반드시 한국어로 답변해야 하며, 전문적인 용어를 사용하되 친절하게 설명해 주세요.`
//     },
//     {
//       role: 'user',
//       content: prompt
//     }
//   ];
//   try {
//     //리펙토링된 서비스 호출 (model은 undefined일수도 있음)
//     const answer = await OllamaService.ask(messages, model);
//     res.json({
//       success: true,
//       answer
//     });
//   } catch (error: any) {
//     //서비스에서 정의한 에러 메시지가 전달됨
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }

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