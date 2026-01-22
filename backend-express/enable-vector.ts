// backend/enable-vector.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("🔌 데이터베이스에 연결 중...");
  try {
    // 1. vector 확장 기능 강제 활성화 쿼리 실행
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log("✅ 성공! 'ai_office_db' 데이터베이스에 vector 기능이 활성화되었습니다.");
  } catch (e) {
    console.error("❌ 실패:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();