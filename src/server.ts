import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// 환경 변수 설정
dotenv.config();

const app = express();
const PORT: number = Number(process.env.PORT) || 3000;

//미들웨어 설정
app.use(cors()); //CORS 사용 설정
app.use(express.json()); //JSON body 파서 설정

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