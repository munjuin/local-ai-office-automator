// src/upload/pdf-document.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class PdfDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  filename: string; // 저장된 파일명 (UUID 포함)

  @Column()
  originalName: string; // 사용자가 올린 원래 파일명

  @Column({ type: 'text' })
  content: string; // PDF에서 추출한 긴 텍스트

  @CreateDateColumn()
  createdAt: Date;
}
