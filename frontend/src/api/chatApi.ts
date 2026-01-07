import axios from 'axios';
// 'type' 키워드를 추가하여 형식을 가져온다는 것을 명시합니다.
import type { ChatRequestDTO, ChatResponseDTO } from '../types/chat';

const API_BASE_URL = 'http://localhost:3000/api';

export const sendChatMessage = async (data: ChatRequestDTO): Promise<ChatResponseDTO> => {
  try {
    const response = await axios.post<ChatResponseDTO>(`${API_BASE_URL}/chat`, data);
    return response.data;
  } catch (error) {
    console.error('API 통신 에러:', error);
    throw new Error('AI와 대화하는 중 오류가 발생했습니다.');
  }
};