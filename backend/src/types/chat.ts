export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OllamaResponse {
  model: string;
  create_at: string;
  message: ChatMessage;
  done: boolean;
}

//클라이언트가 서버로 보내는 요청 데이터 구조
export interface ChatRequest {
  prompt: string;
  model?: string;// 사용자가 모델을 선택할 수도 있게 열어둠
}

// 서버가 클라이언트로 보내는 응답 데이터 구조
export interface ChatResponse {
  answer: string;
  timestamp: string;
  model: string;
  sources?: { content: string; similarity?: number }[];
}