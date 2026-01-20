// backend/src/services/embedding.service.ts
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export class EmbeddingService {
  static async splitText(text: string, sourceName: string): Promise<{content: string, metadata: any}[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 600,         // 법규 문장은 길 수 있으므로 약간 넉넉하게 설정
      chunkOverlap: 100,      // 문맥 연결을 위해 100자 정도 겹침
      // 법규 조항 기호들을 우선순위로 분할 시도
      separators: ["\n제", "\n제\\d+조", "\n", " ", ""], 
    });

    const chunks = await splitter.splitText(text);

    // 각 청크에 메타데이터 매핑
    return chunks.map((chunk, index) => ({
      content: chunk.trim(),
      metadata: {
        source: sourceName,
        chunkIndex: index,
        parsedAt: new Date().toISOString(),
      }
    }));
  }
}