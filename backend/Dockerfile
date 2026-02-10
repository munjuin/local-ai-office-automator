# 1. Node.js가 설치된 리눅스 환경을 가져옴 (가벼운 Alpine 버전)
FROM node:20-alpine

# 2. 작업할 폴더를 만듦
WORKDIR /app

# 3. 패키지 설치를 위해 package.json부터 복사
COPY package*.json ./

# 4. 라이브러리 설치
RUN npm install

# 5. 나머지 소스 코드 전체 복사
COPY . .

# 6. 배포용 빌드 실행 (NestJS 빌드)
RUN npm run build

# 7. 서버 실행 포트 열기
EXPOSE 3001

# 8. 서버 실행 명령어
CMD ["npm", "run", "start:prod"]