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

  // ✅ 수정: nomic-embed-text 모델의 차원수인 768로 설정
  // (주의: 나중에 모델을 바꾸면 이 숫자도 바꿔야 합니다)
  @Column({ type: 'vector', nullable: true }) // 구체적인 차원 지정 생략 가능 (유연성 위해)
  embedding: number[];

  @CreateDateColumn()
  createdAt: Date;
}
