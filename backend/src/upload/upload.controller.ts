import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          // 한글 파일명 깨짐 방지: latin1 -> utf8 변환
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

    // 1. PDF 파싱 (텍스트 추출)
    const parsedText = await this.uploadService.parsePdf(file.path);

    // 2. DB 저장 (추가된 부분)
    const savedData = await this.uploadService.saveFile(
      file.filename,
      file.originalname,
      parsedText,
    );

    console.log('💾 DB 저장 완료 ID:', savedData.id);

    // 3. 결과 반환
    return {
      message: 'Upload & Save Success',
      id: savedData.id,
      originalName: savedData.originalName,
      textLength: parsedText.length,
    };
  }
}
