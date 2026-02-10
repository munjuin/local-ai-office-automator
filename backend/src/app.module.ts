import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UploadModule } from './upload/upload.module';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    // 1. 환경변수 설정 (.env 파일 로드)
    ConfigModule.forRoot({
      isGlobal: true, // 어디서든 ConfigService를 쓸 수 있게 함
    }),

    // 👇 [추가 2] Redis 설정 등록 (비동기로 설정 파일 읽기)
    CacheModule.registerAsync({
      isGlobal: true, // 전역 모듈로 설정 (어디서든 씀)
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
        ttl: parseInt(configService.get('REDIS_TTL') || '600'), // 기본 10분
      }),
      inject: [ConfigService],
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

    UploadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
