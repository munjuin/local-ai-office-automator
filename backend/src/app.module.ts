import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // 1. 환경변수 설정 (.env 파일 로드)
    ConfigModule.forRoot({
      isGlobal: true, // 어디서든 ConfigService를 쓸 수 있게 함
    }),

    // 2. TypeORM 데이터베이스 연결 설정
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'), // .env의 URL 사용
        autoLoadEntities: true, // 나중에 만들 엔티티들을 자동 로드
        synchronize: false, // 주의: 스키마 관리는 Prisma로 하므로 false로 설정!
        logging: true, // 개발 중 쿼리 로그 확인용
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
