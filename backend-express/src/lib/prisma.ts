// backend/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

// 이제 schema.prisma가 URL을 알고 있으므로 빈 생성자로도 충분합니다.
const prisma = new PrismaClient();

export default prisma;