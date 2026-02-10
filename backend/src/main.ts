import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ CORS 활성화 (프론트엔드 3001번 포트 허용)
  app.enableCors({
    // origin: 'http://localhost:3001', // 프론트엔드 주소
    origin: '*', // 프론트엔드 주소
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
