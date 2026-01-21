// backend/src/services/embedding.service.ts
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import ollama from 'ollama';

export class EmbeddingService {
  // 텍스트 분할 로직 (Issue #14에서 완성한 내용)
  static async splitText(text: string, sourceName: string) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 600,
      chunkOverlap: 100,
      separators: ["\n제", "\n제\\d+조", "\n", " ", ""],
    });

    const chunks = await splitter.splitText(text);

    return chunks.map((chunk, index) => ({
      content: chunk.trim(),
      metadata: {
        source: sourceName,
        chunkIndex: index,
        parsedAt: new Date().toISOString(),
      }
    }));
  }

  // 🌟 Ollama 임베딩 생성 로직
  static async getEmbedding(text: string): Promise<number[]> {
    try {
      const response = await ollama.embeddings({
        model: 'mxbai-embed-large',
        prompt: text,
      });
      return response.embedding;
    } catch (error) {
      console.error('Ollama Embedding Error:', error);
      throw new Error('AI 모델을 통한 벡터화에 실패했습니다. Ollama 상태를 확인하세요.');
    }
  }
}