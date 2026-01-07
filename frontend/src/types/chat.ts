// 1. 백엔드와 주고받는 데이터의 '계약' (DTO)
export interface ChatRequestDTO {
  prompt: string;
  model?: string;
}

export interface ChatResponseDTO {
  answer: string;
  timestamp: string;
  model: string;
}

// 2. AI 대화 로직을 위한 기본 메시지 구조
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 3. React UI 상태 관리를 위한 인터페이스 (ID 포함)
export interface IMessage {
  id: string; // React에서 리스트 렌더링 시 key로 사용
  role: 'user' | 'assistant';
  content: string;
}

// 백엔드 DB에서 넘어오는 원본 데이터 구조
export interface IChatHistory {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  createdAt: string;
}