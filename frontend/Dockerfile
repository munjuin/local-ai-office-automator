# 1. Node.js 설치
FROM node:18-alpine

# 2. 작업 폴더 생성
WORKDIR /app

# 3. 패키지 파일 복사 및 설치
COPY package*.json ./
RUN npm install

# 4. 소스 코드 복사
COPY . .

# 5. 빌드 (Next.js)
RUN npm run build

# 6. 포트 열기 (3000번)
EXPOSE 3000

# 7. 실행 명령어
CMD ["npm", "start"]