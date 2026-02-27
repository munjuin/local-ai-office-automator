// upload.controller.ts
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { SearchDto } from './dto/search.dto';

// uploadController
// RAG 파이프라인 HTTP API 진입점
// 클라이언트로부터 파일 업로드, 벡터 검색, AI 채팅 요청을 수신하고 Service 레이어로 라우팅
// 컨트롤러로써 /upload URL로 처리
@Controller('upload')
// 객체지향으로 코드작성을 위해 클래스로 작성
export class UploadController {
  // 생성자를 통해 객체 생성 시 속성을 주입 및 uploadService에 작업을 시킬 수 있는 권한 전달
  constructor(private readonly uploadService: UploadService) {}

  // 클라이언트 파일 업로드 post요청
  @Post()
  // 요청을 중간에 가로채서 처리
  @UseInterceptors(
    // 멀티 파트 폼 데이터 처리 (파일의 필드명 file)
    // 업로드 수행 시 라는 뜻임 (파일이 담긴 폼데이터가 오면)
    FileInterceptor('file', {
      // 업로드 파일을 디스크에 저장
      storage: diskStorage({
        // 저장 위치는 ./uploads
        destination: './uploads',
        // 디스크에 저장될 파일명을 결정하는 콜백함수
        filename: (req, file, callback) => {
          // HTTP는 오래된 latin1(ISO-8859-1)인코딩을 기본으로해서 한글이 깨져서 들어옴
          // Buffer로 바이트배열로 풀었다가 utf-8로 강제로 변환해 한글 깨짐 방지
          file.originalname = Buffer.from(file.originalname, 'latin1').toString(
            'utf8',
          );
          // 이름의 중복을 막기위해 처리
          const uniqueSuffix =
            // 지금 시간 + 랜덤숫자 를 결합해 만듬
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          // 원래 파일명에서 마지막 '.'을 포함한 확장자 부분만 추출하여 저장
          const ext = extname(file.originalname);
          // multer에게 작업이 끝난걸 알림
          // 에러체크, 파일필드명-uniqueSuffix.ext로 파일명 완성
          callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  // 인터셉터가 디스크에 파일을 저장하고나면 파일업로드를 위한 함수 실행
  // 인터셉터가 처리해서 req.file에 담아둔 파일 정보를 뽑아서 인자로 주입
  // @UploadedFile() file이게 인터셉트로 가공한 업로드 파일임
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    console.log('📂 파일 업로드 성공:', file.path);
    // file 객체 안의 path, originalname등을 자유롭게 꺼내 쓸 수 있음
    // service의 parsePdf로 file.path경로에 있는 파일의 텍스트를 추출해서 parsedText 변수에 할당
    const parsedText = await this.uploadService.parsePdf(file.path);

    // 추출한 텍스트를 서비스로 보내 청킹
    const chunkCount = await this.uploadService.saveFile(
      file.filename, // pdf 텍스트 추출 후 저장한 파일명 -> DB에서 파일 찾기위한 파일명
      file.originalname, // 원본 파일명 -> 출처를 알려주기 위한 파일명
      parsedText, // 원문 데이터 -> 청킹하기 전 파일의 텍스트를 추출한 데이터
    );

    console.log(`💾 총 ${chunkCount}개의 청크로 분할 저장 완료`);
    // NestJS에서는 express에서 처럼 res.json(...) 이렇게 작성하지 않아도 객체를 리턴하면 알아서 상태코드와 함께 JSON형식으로 변환해서 프론트엔드로 쏴줌
    return {
      message: 'Upload & Chunking Success',
      originalName: file.originalname, // @UploadedFile()로 받은 파일의 원본 이름
      chunkCount: chunkCount, // 서비스에서 반환한 지식 조각(Chunk)의 총 개수
      totalLength: parsedText.length, // 추출된 전체 텍스트의 글자 수 (데이터 크기 가늠용)
    };
  }

  // 클라이언트 검색 Post 동시 요청(chat 요청과)
  @Post('search')
  // @Body는 JSON 형태로 req.body를 전달해 searchDto 변수에 할당
  async search(@Body() searchDto: SearchDto) {
    // 컨트롤러에서 서비스의 함수를 호출해서 검색 로직 수행
    // backend/src/dto/search.dto.ts의 속성임 프론트엔드에서 필드값도 같아야함
    const results = await this.uploadService.search(searchDto.question);
    // res.json으로 nestjs 내부적으로 변환 및 HTTP 응답 처리해서 프론트엔드에서 사용하기 좋게 보냄
    return {
      question: searchDto.question, // 클라이언트가 질문한 질문 원문
      // 서비스에서 가져온 날것의 배열(question을 search한거)을 프론트엔드에 맞게 새 배열로 변환(mapping)
      results: results.map((r) => ({
        id: r.id, // 파일 업로드 시 청킹된 데이터의 id -> 검색 결과 해당 내용이 있는 데이터를 찾아야 하기 때문
        filename: r.originalName, // 업로드된 파일의 원본 명
        similarity: r.similarity, // 질문과 찾은 청킹 데이 사이의 벡터거리(유사도 0~1)
        preview: r.content.substring(0, 200) + '...', // 검색 결과 전체가 아니라 결과의 처음부터 200 까지의 내용만 보내줌 (성능 개선)
      })),
    };
  }

  // 클라이언트의 RAG 채팅 Post 동시 요청(search와 동시)
  @Post('chat')
  // 채팅에 대한 질문과 session이 있는경우는 세션도 서비스의 chat메서드 호출시 인자로 투입
  async chat(@Body() searchDto: SearchDto) {
    // promise롷 chat 요청이 가고 나면 메서드 실행
    const answer = await this.uploadService.chat(
      searchDto.question, // 채팅 시 질문 원문
      searchDto.sessionId, // 채팅 생성 시 세션아이디
    );
    // 응답값으로 nestjs 내부적으로 res.json으로 프론트엔드에서 처리할 수 있게 데이터 전달
    return {
      question: searchDto.question, // 채팅 질문 원문
      answer: answer, // 채팅 질문에 대한 라마3 모델의 답변 프롬프트
    };
  }
}
