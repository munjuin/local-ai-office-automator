# 🏢 Local AI Office Automator (공사 행정 자동화 솔루션) `v0.2`

> **RAG(검색 증강 생성) 기술이 적용된 보안 중심의 공사 행정 및 전기/소방 통신 공무 자동화 솔루션**
>
> 외부 유출이 민감한 공사 서류와 행정 업무를 로컬 환경의 AI(Ollama + RAG)를 통해 안전하고 정확하게 처리합니다.

---

## 📅 버전 기록 (Version History)

- **v0.1:** 기본 서버 구축 및 Ollama 연동 (단순 대화형)
- **v0.2 (Current):** **RAG 파이프라인 구축 완료**
  - PDF 문서 업로드 및 텍스트 추출 엔진 탑재 (`pdf2json`)
  - Vector Database 구축 (`pgvector`) 및 임베딩 저장
  - 한국어 최적화 청킹(Chunking) 전략 적용 (200자 단위/30자 오버랩)
  - 인프라 안정화 (Docker 포트 분리, ESM 호환성 해결)

---

## 🌟 주요 특징 (Key Features)

- **📄 Document Learning (RAG):** PDF 공문, 시방서, 규정집을 업로드하여 AI가 해당 내용을 기반으로 정확한 답변을 제공합니다.
- **🧠 Semantic Search:** 단순 키워드 매칭이 아닌, 문맥(Context)을 이해하는 벡터 검색을 통해 방대한 문서 속에서 필요한 정보를 찾아냅니다.
- **🇰🇷 Korean Optimization:** 한국어의 토큰 밀도를 고려한 정밀한 텍스트 분할(Chunking) 알고리즘이 적용되어 있습니다.
- **🔒 Security First:** 데이터베이스부터 AI 모델까지 모든 데이터가 100% 로컬 환경에서 처리되어 외부 유출을 원천 차단합니다.
- **⚙️ Robust Infrastructure:** Docker 기반의 `pgvector` 환경을 통해 안정적인 벡터 연산을 지원합니다.

---

## 🛠 기술 스택 (Tech Stack)

### Backend Logic

- **Runtime:** Node.js v22 (ESM Support)
- **Framework:** Express v5
- **Language:** TypeScript
- **Text Processing:** `pdf2json` (PDF Parsing), Custom Chunking Logic

### Database & Vector Engine

- **ORM:** Prisma v6.2.1
- **Database:** PostgreSQL 16
- **Extension:** **pgvector** (Vector Similarity Search)
- **Container:** Docker Compose

### AI & LLM

- **Inference Engine:** Ollama
- **Chat Model:** `llama3` (General Purpose)
- **Embedding Model:** `mxbai-embed-large` (1024 Dimension, High Performance)

---

## 🏗 시스템 아키텍처 (RAG Pipeline)

1.  **Upload:** 사용자가 PDF 문서를 업로드.
2.  **Extract:** `pdf2json`을 통해 순수 텍스트 추출 및 제어 문자 정제.
3.  **Chunking:** 한국어 특성을 고려하여 **200자 단위(Overlap 30자)**로 정밀 분할.
4.  **Embedding:** `mxbai-embed-large` 모델을 통해 텍스트를 **1024차원 벡터**로 변환.
5.  **Storage:** PostgreSQL(`DocumentChunk` 테이블)에 벡터 데이터 저장.

---

## 🚀 시작하기 (Getting Started)

### 1. 전제 조건 (Prerequisites)

- [Node.js v22 이상](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/) (pgvector 실행용)
- **Ollama 모델 설치:**
  ```bash
  # 채팅용 모델
  ollama pull llama3
  # 임베딩용 모델 (필수)
  ollama pull mxbai-embed-large
  ```

### 2. 설치 (Installation)

```bash
git clone [https://github.com/munjuin/local-ai-office-automator.git](https://github.com/munjuin/local-ai-office-automator.git)
cd local-ai-office-automator
npm install
```

### 3. 데이터베이스 실행 (Docker)

AI 기능을 지원하는 벡터 데이터베이스를 실행합니다. (기존 로컬 DB와 충돌 방지를 위해 5433 포트 사용)

```bash
docker-compose up -d
```

### 4. 환경 설정 (Environment Variables)

프로젝트 루트에 .env 파일을 생성하고 아래 내용을 설정합니다.

주의: Docker 설정에 맞춰 포트(5433)와 DB명(local_ai_db)을 정확히 입력해야 합니다.

```bash
# Server
PORT=3000

# Database (Docker pgvector)
# 포트 5433 확인 필수
DATABASE_URL="postgresql://postgres:[DB비밀번호]@localhost:5433/local_ai_db?schema=public"

# AI Configuration
OLLAMA_HOST=http://localhost:11434
```

### 5. 벡터 기능 활성화 및 마이그레이션

pgvector 확장 기능을 활성화하고 테이블을 생성합니다.

```bash
# 1. 벡터 확장 기능 강제 활성화 (스크립트 실행)
npx tsx --env-file=.env backend/enable-vector.ts

# 2. Prisma 스키마 반영
npx prisma db push
```

### 6. 서버 실행 (Run)

```bash
# 개발 모드 실행
npm run dev
```

서버가 성공적으로 실행되면 터미널에 🚀 [Server] 실행 중: http://localhost:3000 메시지가 출력됩니다.

---

## 📜 라이선스 (License)

MIT License
