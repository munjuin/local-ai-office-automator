# 🏢 Local AI Office Automator (공사 행정 자동화 솔루션)

> **보안과 효율을 동시에 잡는 공사 행정 및 전기/소방 통시 공무 자동화 솔루션** > 외부 유출이 민감한 공사 서류와 행정 업무를 로컬 환경의 AI(Ollama)를 통해 안전하고 빠르게 처리합니다.

---

## 🌟 주요 특징 (Key Features)

- **Local AI Integration:** Ollama(Llama3)를 활용하여 오프라인 환경에서도 강력한 AI 비서 기능 제공.
- **Auto History Logging:** 모든 대화 내역은 PostgreSQL DB에 자동으로 기록되어 업무 이력 관리 가능.
- **Security First:** 모든 데이터는 로컬 환경 내에서 처리되어 보안이 중요한 공사 행정 업무에 최적화.
- **Admin Expertise:** 대한민국 전기 및 소방 공무 행정 지식에 특화된 시스템 프롬프트 적용.

---

## 🛠 기술 스택 (Tech Stack)

### Backend

- **Runtime:** Node.js v22.21.0
- **Language:** TypeScript (ESM 모드)
- **Framework:** Express v5
- **ORM:** Prisma v6.2.1
- **Runner:** tsx (watch mode)

### Database & AI

- **Database:** PostgreSQL (with Docker/Local)
- **AI Engine:** Ollama (Model: Llama3)

---

## 🚀 시작하기 (Getting Started)

### 1. 전제 조건 (Prerequisites)

- [Node.js v22 이상](https://nodejs.org/)
- [Ollama](https://ollama.com/) 설치 및 `llama3` 모델 다운로드
- [PostgreSQL](https://www.postgresql.org/) 데이터베이스 서버 가동

### 2. 설치 (Installation)

```bash
# 저장소 복제
git clone [https://github.com/munjuin/local-ai-office-automator.git](https://github.com/munjuin/local-ai-office-automator.git)
cd local-ai-office-automator/backend

# 의존성 설치
npm install
```

### 3. 환경 설정 (Environment Variables)

`backend` 폴더 루트에 `.env` 파일을 생성하고 아래 내용을 입력합니다. 프로젝트 실행에 필요한 핵심 접속 정보들입니다.

```env
# Server Configuration
PORT=3000

# Database Configuration (PostgreSQL)
# 형식: postgresql://사용자명:비밀번호@호스트:포트/DB명?schema=public
DATABASE_URL="postgresql://postgres:****@localhost:5432/ai_office_db?schema=public"

# AI Engine Configuration (Ollama)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3
```

### 4. 데이터베이스 및 Prisma 설정 (Database Setup)

Prisma ORM을 사용하여 데이터베이스 스키마를 동기화하고 클라이언트를 생성합니다.

```
# 1. 스키마를 DB에 반영 (테이블 생성)
npx prisma db push

# 2. Prisma Client 생성 (TypeScript 타입 지원)
npx prisma generate
```

### 5. 서버 실행 (Running the App)

개발 모드로 서버를 실행합니다. tsx를 사용하여 코드 변경 시 서버가 자동으로 재시작됩니다.

```
# 개발 서버 가동
npm run dev
```

서버가 성공적으로 실행되면 터미널에 🚀 [Server] 실행 중: http://localhost:3000 메시지가 출력됩니다.

### 6. 라이선스 (License)

본 프로젝트는 MIT License를 따릅니다.
