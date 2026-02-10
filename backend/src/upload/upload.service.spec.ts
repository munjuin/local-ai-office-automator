/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from './upload.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PdfDocument } from './pdf-document.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

// ----------------------------------------------------------------
// 1. 외부 라이브러리 Mocking
// (변수를 쓰지 않고, 각 mock 함수 안에서 직접 객체를 반환하도록 수정)
// ----------------------------------------------------------------

jest.mock('@langchain/ollama', () => ({
  OllamaEmbeddings: jest.fn().mockImplementation(() => ({
    embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  })),
  ChatOllama: jest.fn().mockImplementation(() => ({
    // 여기서 직접 정의: pipe는 나 자신(this)을 반환, invoke는 문자열 반환
    pipe: jest.fn().mockReturnThis(),
    invoke: jest.fn().mockResolvedValue('AI 답변입니다.'),
  })),
}));

jest.mock('@langchain/core/output_parsers', () => ({
  StringOutputParser: jest.fn().mockImplementation(() => ({
    pipe: jest.fn().mockReturnThis(),
    invoke: jest.fn().mockResolvedValue('AI 답변입니다.'),
  })),
}));

jest.mock('@langchain/core/prompts', () => ({
  PromptTemplate: {
    fromTemplate: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnThis(),
      invoke: jest.fn().mockResolvedValue('AI 답변입니다.'), // 안전장치로 여기도 추가
    }),
  },
}));

jest.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({}), { virtual: true });

// ----------------------------------------------------------------
// 2. 테스트 스위트
// ----------------------------------------------------------------
describe('UploadService', () => {
  let service: UploadService;

  // Mock Repository & Cache 정의
  const mockPdfRepository = {
    create: jest.fn(),
    save: jest.fn(),
    query: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: getRepositoryToken(PdfDocument),
          useValue: mockPdfRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ----------------------------------------------------------------
  // 3. 핵심 테스트 케이스
  // ----------------------------------------------------------------
  describe('chat()', () => {
    it('Redis에 캐시된 답변이 있으면 LLM을 호출하지 않고 즉시 반환해야 한다 (Cache Hit)', async () => {
      // [Given]
      const question = '내 이름이 뭐지?';
      const sessionId = 'test-session-123';
      const cachedAnswer = '당신의 이름은 문주인입니다. (from Cache)';
      const responseCacheKey = `response:${sessionId}:${question}`;

      // Redis가 답을 이미 알고 있다고 가정
      mockCacheManager.get.mockImplementation((key: string) => {
        if (key === responseCacheKey) {
          return Promise.resolve(cachedAnswer);
        }
        return Promise.resolve(null);
      });

      // [When]
      const result = await service.chat(question, sessionId);

      // [Then]
      expect(result).toBe(cachedAnswer);
      expect(mockCacheManager.get).toHaveBeenCalledWith(responseCacheKey);
    });

    it('캐시가 없으면 검색 로직을 수행하고 Redis에 저장해야 한다 (Cache Miss)', async () => {
      // [Given]
      const question = '새로운 질문';
      const sessionId = 'test-session-123';
      const responseCacheKey = `response:${sessionId}:${question}`;

      // Redis: 모름 (null)
      mockCacheManager.get.mockResolvedValue(null);

      // DB: 검색 결과 있음
      mockPdfRepository.query.mockResolvedValue([
        { content: '문서 내용', similarity: 0.9 },
      ]);

      // [When]
      const result = await service.chat(question, sessionId);

      // [Then]
      expect(mockCacheManager.get).toHaveBeenCalledWith(responseCacheKey);
      expect(result).toContain('AI 답변입니다.'); // Mock된 값 확인
      expect(mockCacheManager.set).toHaveBeenCalled(); // 저장 시도 확인
    });
  });
});
