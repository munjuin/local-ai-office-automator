import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { EmbeddingService } from '../services/embedding.service.js';

// @ts-ignore
import PDFParser from 'pdf2json';

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ dest: 'uploads/' });

/**
 * [유틸] PDF에서 텍스트 추출 (pdf2json)
 */
async function extractTextFromPDF(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);

    pdfParser.on("pdfParser_dataError", (errData: any) => {
      reject(new Error(errData.parserError));
    });

    pdfParser.on("pdfParser_dataReady", () => {
      try {
        const rawText = pdfParser.getRawTextContent();
        resolve(rawText);
      } catch (err) {
        reject(err);
      }
    });

    pdfParser.loadPDF(filePath);
  });
}

/**
 * [유틸] 텍스트 분할 함수
 * 한국어는 1글자당 약 2.5~3토큰을 소모하므로, 
 * 모델의 한계(512 토큰)를 고려하여 200자 단위로 자릅니다.
 */
function splitText(text: string, chunkSize: number = 200, chunkOverlap: number = 30) {
  const chunks = [];
  
  // 1. 토큰을 불필요하게 잡아먹는 제어 문자 및 연속 공백 제거 (다이어트)
  const cleanedText = text
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // 보이지 않는 제어 문자 제거
    .replace(/\s+/g, ' ')                // 연속된 공백/줄바꿈을 하나로 축소
    .trim();
  
  let i = 0;
  while (i < cleanedText.length) {
    const chunk = cleanedText.slice(i, i + chunkSize);
    if (chunk.trim().length > 10) { // 너무 짧은 쓰레기 데이터는 제외
      chunks.push(chunk);
    }
    // 문맥 보존을 위해 30자씩 겹치며 이동
    i += (chunkSize - chunkOverlap);
  }
  return chunks;
}

/**
 * POST /api/upload
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 전송되지 않았습니다.' });
    }

    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    console.log(`\n📂 [Upload] 파일 수신: ${originalName}`);

    // 1. PDF 텍스트 추출
    let fullText = "";
    try {
      console.log("⚙️ [Process] PDF 파싱 시작...");
      fullText = await extractTextFromPDF(req.file.path);
    } catch (parseError: any) {
      console.error("❌ PDF 파싱 실패:", parseError);
      throw new Error(`PDF 내용을 읽을 수 없습니다.`);
    }

    if (!fullText || fullText.trim().length === 0) {
      throw new Error("추출된 텍스트가 없습니다.");
    }
    console.log(`✅ [Extract] 텍스트 추출 성공 (총 ${fullText.length}자)`);

    // 2. Document 메타데이터 저장
    const document = await prisma.document.create({
      data: {
        title: originalName,
        content: fullText,
      },
    });

    // 3. 텍스트 청킹 (200자 단위)
    const chunks = splitText(fullText, 200, 30);
    console.log(`📄 [Chunking] 총 ${chunks.length}개의 조각으로 분할됨.`);

    // 4. 조각별 임베딩 생성 및 DB 저장
    let processedCount = 0;
    for (const chunkContent of chunks) {
      try {
        const embedding = await EmbeddingService.getEmbedding(chunkContent);
        const chunkId = randomUUID();
        
        await prisma.$executeRaw`
          INSERT INTO "DocumentChunk" (id, content, embedding, "documentId")
          VALUES (${chunkId}, ${chunkContent}, ${embedding}::vector, ${document.id});
        `;
        
        processedCount++;
        process.stdout.write(`\r✅ 임베딩 진행 중: ${Math.round((processedCount / chunks.length) * 100)}% (${processedCount}/${chunks.length})`);
      } catch (embError: any) {
        console.error(`\n\n❌ [Embedding Error] 조각 ${processedCount + 1} 처리 실패!`);
        console.error(`내용 요약: "${chunkContent.substring(0, 50)}..."`);
        console.error(`메시지: ${embError.message}`);
        throw new Error("AI 모델의 처리 용량을 초과했습니다. 조각 크기를 더 줄여야 합니다.");
      }
    }

    // 5. 임시 파일 삭제
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.log(`\n✨ [Complete] '${originalName}' 학습 완료!`);
    
    res.json({ 
      success: true, 
      message: '문서 학습이 완료되었습니다.', 
      documentId: document.id 
    });

  } catch (error: any) {
    console.error('\n❌ [Error] 업로드 처리 중 오류:', error.message);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message || '처리 실패' });
  }
});

export default router;