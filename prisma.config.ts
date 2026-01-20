// root/prisma.config.ts
import { defineConfig } from '@prisma/config';

export default defineConfig({
  schema: './backend/prisma/schema.prisma',
  datasource: {
    // process.env.DATABASE_URL이 없을 경우 빈 문자열을 주어 타입을 맞춥니다.
    url: process.env.DATABASE_URL || "",
  },
});