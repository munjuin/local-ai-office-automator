import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import { PdfDocument } from './pdf-document.entity';
import {
  OllamaEmbeddings,
  ChatOllama,
  OllamaEmbeddingsParams,
  ChatOllamaInput,
} from '@langchain/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
// 👇 [변경] CACHE_MANAGER 임포트 필수
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

// 타입스크립트 안정성 확보를 위한 명세서
// pdfjs-dist가 읽어온 복잡한 PDF 객체 덩어리에서 오직 텍스트(str)만 뽑아내기 위한 타입
interface PDFPageItem {
  str: string;
}

// DB에서 벡터 유사도로 검색해온 결과물의 형태를 정의 (DTO 역할)
interface SearchResult {
  id: number;
  filename: string;
  originalName: string;
  content: string;
  similarity: number;
}

// Redis에 저장할 대화 메시지 타입 정의
// LLM이 내가 한 말과 사용자가 한 말을 헷갈리지 않게 화자(role)를 강제함
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// @Injectable() 데코레이터
// 이 클래스가 의존성 주입(DI)이 가능한 클래스(프로바이더)임을 NestJS에 선언
// 컨트롤러가 "작업해줘"라고 던지면 여기서 모든 비즈니스 로직(실제 작업)을 처리함
@Injectable()
export class UploadService {
  // 클래스 내부에서 사용할 LangChain AI 모델 객체들 선언
  private embeddings: OllamaEmbeddings; // 임베딩 시 사용할 langChain 라이브러리 객체
  private chatModel: ChatOllama; // 채팅 시 사용할 langChain 라이브러리 객체

  // 생성자를 통해 DB 접근 권한과 Redis 접근 권한을 주입받음
  constructor(
    // TypeORM을 통해 pdf_document 테이블(엔티티)을 조작할 수 있는 리포지토리 주입
    // TypeORM 프레임워크에서 테이블을 조작할 수 있는 프로그램이 리포지토리임
    @InjectRepository(PdfDocument)
    private pdfRepository: Repository<PdfDocument>,
    // Redis에 접근하여 데이터를 읽고 쓸 수 있는 캐시 매니저 주입
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    // 1. 임베딩 모델 초기화 (글자를 768개의 숫자 좌표로 바꿔주는 역할)
    const embeddingConfig: OllamaEmbeddingsParams = {
      model: 'nomic-embed-text', // 텍스트 의미 추출에 특화된 모델
      baseUrl: 'http://localhost:11434', // 로컬 Ollama 서버 주소
    };
    this.embeddings = new OllamaEmbeddings(embeddingConfig);

    // 2. 채팅 모델 초기화 (질문과 문서를 보고 최종 답변을 한국어로 만들어주는 역할)
    const chatConfig: ChatOllamaInput = {
      model: 'llama3',
      baseUrl: 'http://localhost:11434',
      temperature: 0.3, // 0에 가까울수록 딱딱하고 정확하게, 1에 가까울수록 창의적(환각 주의)으로 대답함
      numCtx: 2048, // 한번에 이해할 수 있는 최대 컨텍스트(문맥) 길이
      numPredict: 512, // 모델이 한 번에 뱉어낼 수 있는 최대 답변 길이
    };
    this.chatModel = new ChatOllama(chatConfig);
  }

  // ---------------------------------------------------------
  // 1. 문서 텍스트 추출 (parsePdf)
  // 클라이언트가 올린 이진 파일(PDF)에서 순수 텍스트만 발라내는 작업
  // ---------------------------------------------------------
  async parsePdf(filePath: string): Promise<string> {
    // pdf.js 라이브러리를 비동기로 불러옴 (npm 패키지 이름이 pdfjs-dist임)
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // 물리적인 파일을 읽어서 바이트 배열(Buffer)로 메모리에 올림
    const dataBuffer = await fs.readFile(filePath);
    // pdf.js가 이해할 수 있는 브라우저 표준 이진 데이터 규격으로 강제 변환
    const uint8Array = new Uint8Array(dataBuffer);

    // PDF 파싱 작업 시작
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array, // fs.readFile로 읽어온 로우 데이터를 uint8Array로 전달
      useSystemFonts: true, // pdf안에 숨겨진 폰트대신 컴퓨터에 있는 폰트 사용하도록 함 (자원 절약)
      disableFontFace: true, // 폰트디자인 로드하지 않음 (속도 최적화)
      standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/', // 표준 글자들 위치
    });

    const doc = await loadingTask.promise; // 위의 파싱 작업이 완료될때까지 기다림
    const maxPages = doc.numPages; // 전체 페이지 수
    const textContents: string[] = []; // 페이지 별 텍스트를 담을 빈 배열

    // 1페이지부터 끝페이지가지 반복하면서 페이지를 긁어옴
    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // 복잡합 pdf 객체들 중에서 텍스트(str)만 뽑아서 공백으로 이어붙임
      const text = content.items
        .map((item: unknown) => (item as PDFPageItem).str)
        .join(' ');
      textContents.push(text);
    }
    // 모든 페이지의 텍스트를 줄바꿈으로 합쳐서 아주 긴 하나의 문자열로 반환
    return textContents.join('\n');
  }

  // ---------------------------------------------------------
  // 1-A. 임베딩(벡터 변환) 공통 함수
  // 텍스트를 넘기면 AI가 이해하는 768차원 숫자 배열로 바꿔줌
  // ---------------------------------------------------------
  async getEmbedding(text: string): Promise<number[]> {
    // 텍스트가 너무 길면 Ollama 서버가 뻗을 수 있으므로 2000자로 안전하게 자름
    const safeText = text.substring(0, 2000);
    // 빈 텍스트면 전부 0으로 채워진 쓸모없는 벡터 반환(에러 방지용)
    if (!safeText.trim()) {
      return new Array(768).fill(0) as number[];
    }
    // 실제로 Ollama 서버를 찔러서 백터값을 받아옴
    const vector = await this.embeddings.embedQuery(safeText);
    return vector;
  }

  // ---------------------------------------------------------
  // 2. 문서 청킹 및 DB 저장 (saveFile)
  // 거대한 텍스트를 쪼개고 숫자로 바꿔서 DB에 넣는 지식 주입의 핵심 파트
  // ---------------------------------------------------------
  async saveFile(
    filename: string, // 중복 방지 처리된 서버 저장용 파일명
    originalName: string, // 클라이어트가 올리 원래 파일명
    content: string, // parsePdf에서 추출한 엄청 긴 원문 텍스트
  ): Promise<number> {
    console.log(
      `🔪 청킹 시작: ${originalName} (전체 길이: ${content.length}자)`,
    );

    // ✅ [Fix: 0x00 Null Byte 제거 로직 추가]
    // PDF에서 긁어온 텍스트 중 DB 저장을 방해하는 널 바이트(\x00)를 정규식으로 완벽히 제거합니다.
    const cleanContent = content.replace(
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u0009\u000B-\u000C\u000E-\u001F\u007F]/g,
      '',
    );

    // LangChain의 핵심: 문맥이 끊기지 않게 텍스트 자르기
    // LLM 프레임워크인 LangChain에서 제공하는 클래스임
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000, // 최대 1000자 단위로 자름
      chunkOverlap: 200, // 앞 뒤 조각이 200자씩 겹치게 잘라서 문맥 단절 방지
    });

    // 실제로 쪼개는 작업 수행
    const chunks = await splitter.createDocuments([cleanContent]); // chunk 배열 반환
    console.log(`🧩 생성된 청크 개수: ${chunks.length}개`);

    //청킹 된 파일 카운터
    let savedCount = 0;
    // 쪼개진 텍스트 조각들을 하나씩 DB에 저장
    // 🚨 [주의] 여기서 for문 돌면서 통신하므로 응답이 오래 걸림 (추후 비동기 큐 처리 포인트)
    for (const chunk of chunks) {
      const chunkContent = chunk.pageContent;
      // 텍스트 조각을 숫자 좌표(벡터)로 변환
      const embedding = await this.getEmbedding(chunkContent);

      // TypeORM으로 DB에 들어갈 엔티티(행) 하나 생성
      const newDocument = this.pdfRepository.create({
        filename,
        originalName,
        content: chunkContent,
        embedding, // pgvector 컬럼에 768 차원 숫자 배열 통째로 들어감
      });

      // DB에 INSERT 실행
      await this.pdfRepository.save(newDocument);
      savedCount++;
    }
    // 총 몇개의 조각이 저장되었는지 컨트롤러로 반환
    return savedCount;
  }

  // ---------------------------------------------------------
  // 3. 순수 문서 검색 (search)
  // 질문과 가장 뜻이 비슷한 문서 조각을 DB에서 찾아오는 로직
  // ---------------------------------------------------------
  async search(question: string): Promise<SearchResult[]> {
    console.log(`🔎 검색 요청: "${question}"`);
    // 사용자의 질문도 AI 자도상의 좌표(벡터)로 변환해야 위치 비교가 가능함
    const queryVector = await this.getEmbedding(question);

    // TypeORM의 query()를 통해 pgvector 전용 Raw SQL을 직접 실행(속도 최적화)
    const results: SearchResult[] = await this.pdfRepository.query(
      `
      SELECT 
        id, 
        filename, 
        "originalName", 
        content, 
        1 - (embedding <=> $1) as similarity
      FROM pdf_document
      ORDER BY embedding <=> $1 ASC
      LIMIT 4 
      `,
      [`[${queryVector.join(',')}]`], // SQL 인젝션 방지를 위해 파라미터로 벡터 투입
    );
    return results; // 찾은 조각들 컨트롤러(또는 chat)로 반환
  }

  // ---------------------------------------------------------
  // 4. 지능형 RAG 채팅 (chat)
  // 캐시 확인 -> 검색 -> 대화기억 호출 -> 프롬프트 조립 -> 답변 생성 -> 캐시 저장
  // ---------------------------------------------------------
  async chat(question: string, sessionId?: string): Promise<string> {
    const safeSessionId = sessionId || 'default-session';

    // Redis에 데이터를 넣고 뺄 때 쓸 고유한 이름(Key) 정의
    const historyKey = `chat_history:${safeSessionId}`;
    const responseCacheKey = `response:${safeSessionId}:${question}`;

    console.log(`💬 질문: "${question}" (Session: ${safeSessionId})`);

    // ⚡️ 0. 응답 캐싱 (Response Caching)
    // 방금 물어본 똑같은 질문을 또 물어봤다면? LLM 연산(비용/시간) 없이 Redis에서 정답만 바로 꺼내줌
    const cachedResponse =
      await this.cacheManager.get<string>(responseCacheKey);
    if (cachedResponse) {
      console.log('⚡️ Redis 캐시 히트! (LLM 연산 생략)');
      return cachedResponse;
    }

    // 1. 검색 (Retrieval)
    // AI에게 질문과 함께 던져줄 "참고 자료(Context)"를 DB에서 찾아옴
    const relevantDocs = await this.search(question);
    const context =
      relevantDocs.length > 0
        ? relevantDocs.map((doc) => doc.content).join('\n\n---\n\n') // 조각들을 보기 좋게 합침
        : '관련 문서를 찾을 수 없습니다.';

    // 2. 대화 기록 불러오기 (Redis Memory Retrieval)
    // HTTP는 상태가 없으므로(Stateless), Redis에서 과거 대화 내역을 가져와야 AI가 맥락을 이해함
    const history =
      (await this.cacheManager.get<ChatMessage[]>(historyKey)) || [];

    // 대화가 너무 길어지면 토큰 오버플로우가 나므로 가장 최근 3번의 대화(총 6개 메시지)만 짤라서 가져감
    const recentHistory = history.slice(-6);

    // AI가 읽기 편하게 JSON 데이터를 단순 텍스트 형식으로 변환
    const chatHistoryText = recentHistory
      .map((msg) => {
        const role = msg.role === 'user' ? '사용자' : 'AI 비서';
        return `${role}: ${msg.content}`;
      })
      .join('\n');

    console.log(`📜 불러온 대화 내역:\n${chatHistoryText || '(없음)'}`);

    // 3. 프롬프트 구성 (LangChain PromptTemplate)
    // AI의 자아 설정, 규칙, 과거 대화, 참고 문서, 현재 질문을 섞어 하나의 완벽한 명령서 작성
    const prompt = PromptTemplate.fromTemplate(`
      ### SYSTEM ROLE
      You are a professional AI assistant who speaks **ONLY Korean (한국어)**.
      Your task is to answer the user's question based on the provided [Context] AND [Chat History].

      ### 🚨 CRITICAL RULES (MUST FOLLOW) 🚨
      1. **SOURCE PRIORITY:** - First, check the **[Chat History]** to see if the user mentioned their name or previous topics.
         - Second, check the **[Context]** for document-related information.
      2. **LANGUAGE:** You must answer in **Korean** language only.
      3. **GROUNDING:** - If the answer is found in [Chat History], answer based on memory.
         - If the answer is found in [Context], answer based on the document.
         - If the answer is in **NEITHER**, say "문서나 이전 대화에서 관련 내용을 찾을 수 없습니다."

      ### DATA SOURCE
      [Chat History] (User's previous messages)
      {chat_history}

      [Context from Documents] (Search results)
      {context}

      ---------------------------------------------------

      ### USER INPUT
      [Question]
      {question}

      ### 📢 FINAL INSTRUCTION
      Answer the question above in **Korean(한국어)**. 
      If the user asks "What is my name?", check the [Chat History] first.

      답변:
    `);

    /// 4. 답변 생성 (Chain)
    // 조립된 프롬프트를 Llama3 모델에 던지고, 나오는 결과를 StringOutputParser로 텍스트만 깔끔하게 뽑아냄
    const chain = prompt.pipe(this.chatModel).pipe(new StringOutputParser());

    // 실제 AI 연산 실행 (시간이 가장 오래 걸리는 구간)
    const response = await chain.invoke({
      chat_history: chatHistoryText,
      context: context,
      question: question,
    });

    // 5. 대화 기록 저장 (Redis Save)
    // 지금 나눈 질문과 방금 생성된 답변을 대화 기록 배열에 추가
    recentHistory.push({ role: 'user', content: question });
    recentHistory.push({ role: 'assistant', content: response });

    // Redis에 대화 내역 업데이트 (86400초 = 24시간 동안 유지)
    await this.cacheManager.set(historyKey, recentHistory, 86400 * 1000);

    // 나중에 똑같은 질문이 들어올 때 LLM 연산을 피하기 위해 정답지를 캐시에 구워둠 (1시간 유지)
    await this.cacheManager.set(responseCacheKey, response, 3600 * 1000);

    console.log('✅ 답변 완료 및 Redis 저장 성공');
    // 컨트롤러로 최종 텍스트 반환
    return response;
  }
}
