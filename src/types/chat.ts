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