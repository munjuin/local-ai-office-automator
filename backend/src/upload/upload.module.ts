import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // 추가
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { PdfDocument } from './pdf-document.entity'; // 추가

@Module({
  imports: [TypeOrmModule.forFeature([PdfDocument])],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
