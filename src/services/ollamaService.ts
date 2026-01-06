import ollama from 'ollama';
import { ChatMessage } from '../types/chat.js'

export class OllamaService {

  private static readonly DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3';
  
  // AI에게 질문을 보냅니다.
  // @param messages 대화 내역 배열
  // @param model 사용할 모델 이름 (선택 사항)
  
  static async ask(
    messages: ChatMessage[],
    model: string = this.DEFAULT_MODEL
  ): Promise<string> {
    try {
      console.log(`[Debug] AI에게 요청을 보냅니다... 모델: ${model}`); // 로그 추가
      const response = await ollama.chat({
        model: model,
        messages: messages,
        stream: false,
        // 추가 설정: 온도를 조절하여 창의성 제어 (0에 가까울수록 일관됨)
        options: {
          temperature: 0.7,
        }
      });
      console.log(`[Debug] AI로부터 응답을 받았습니다!`); // 로그 추가

      // 응답 값이 비어있을 경우에 대한 방어 코드
      if (!response.message?.content) {
        throw new Error('AI로부터 빈 응답을 받았습니다.');
      }

      return response.message.content;
    } catch (error) {
      // 에러 로그를 더 구체적으로 출력
      console.error(`[OllamaService Error] 모델(${model}) 호출 실패:`, error);
      // 사용자에게 보여줄 에러 메시지 재정의
      throw new Error('AI 응답을 가져오는 과정에서 기술적인 문제가 발생했습니다.');
    }
  }
}