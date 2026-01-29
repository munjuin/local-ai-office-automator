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

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          file.originalname = Buffer.from(file.originalname, 'latin1').toString(
            'utf8',
          );
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    console.log('📂 파일 업로드 성공:', file.path);
    const parsedText = await this.uploadService.parsePdf(file.path);

    // ✅ 반환값 변경 (savedData -> chunkCount)
    const chunkCount = await this.uploadService.saveFile(
      file.filename,
      file.originalname,
      parsedText,
    );

    console.log(`💾 총 ${chunkCount}개의 청크로 분할 저장 완료`);

    return {
      message: 'Upload & Chunking Success',
      originalName: file.originalname,
      chunkCount: chunkCount, // 저장된 청크 개수 반환
      totalLength: parsedText.length,
    };
  }

  @Post('search')
  async search(@Body() searchDto: SearchDto) {
    const results = await this.uploadService.search(searchDto.question);
    return {
      question: searchDto.question,
      results: results.map((r) => ({
        id: r.id,
        filename: r.originalName,
        similarity: r.similarity,
        preview: r.content.substring(0, 200) + '...',
      })),
    };
  }

  // ✅ [New] 채팅 API 엔드포인트
  @Post('chat')
  async chat(@Body() searchDto: SearchDto) {
    const answer = await this.uploadService.chat(searchDto.question);
    return {
      question: searchDto.question,
      answer: answer,
    };
  }
}
