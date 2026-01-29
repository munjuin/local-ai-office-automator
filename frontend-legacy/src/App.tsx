// frontend/src/App.tsx
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendChatMessage } from './api/chatApi';
import type { IMessage, IChatHistory } from './types/chat';
import axios from 'axios';
import { FileUpload } from './components/FileUpload';

function App() {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await axios.get<IChatHistory[]>('http://localhost:3000/api/chat/history');
        const historyMessages = response.data.map((item) => ({
          id: item.id.toString(),
          role: item.role as 'user' | 'assistant',
          content: item.content,
        }));
        setMessages(historyMessages);
      } catch (error) {
        console.error('Failed to fetch history:', error);
      }
    };

    fetchHistory();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // 1. 사용자 메시지 추가
    const userMessage: IMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 2. 백엔드로 전송 (RAG 검색 수행)
      const response = await sendChatMessage({ prompt: input });

      // 3. AI 응답 메시지 생성 (sources 포함)
      const assistantMessage: IMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);
      alert('연결 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f0f2f5' }}>
      
      {/* 1. 헤더 영역 */}
      <header style={{ padding: '20px', backgroundColor: '#fff', borderBottom: '1px solid #ddd', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1a73e8' }}>⚡ AI 행정 비서 (전기/소방)</h1>
      </header>

      {/* 👇 2. [여기 추가!] 파일 업로드 컴포넌트 배치 */}
      {/* 헤더 바로 아래에 '도구 모음'처럼 보이도록 배치했습니다. */}
      <FileUpload />

      {/* 3. 대화창 영역 */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '20px' }}>
              
              {/* 메시지 말풍선 */}
              <div style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: '15px',
                backgroundColor: msg.role === 'user' ? '#1a73e8' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#333',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
              }}>
                <strong style={{ display: 'block', marginBottom: '5px' }}>{msg.role === 'user' ? '나' : 'AI 전문가'}</strong>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>

              {/* 참고 문서 표시 */}
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <div style={{ maxWidth: '70%', marginTop: '5px' }}>
                  <details style={{ fontSize: '0.85rem', color: '#666', cursor: 'pointer' }}>
                    <summary style={{ listStyle: 'none', backgroundColor: '#e9ecef', padding: '5px 10px', borderRadius: '5px', display: 'inline-block' }}>
                      📚 참고 문서 ({msg.sources.length}) 보기
                    </summary>
                    <div style={{ marginTop: '5px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
                      {msg.sources.map((src, idx) => (
                        <div key={idx} style={{ marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
                          <span style={{ fontWeight: 'bold', color: '#1a73e8' }}>[문서 {idx + 1}]</span>
                          <p style={{ margin: '4px 0', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
                            {src.content.length > 150 ? src.content.substring(0, 150) + '...' : src.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}

            </div>
          ))}
          {isLoading && <div style={{ textAlign: 'left', color: '#666', paddingLeft: '10px' }}>AI가 관련 법령을 검색 중입니다... 🔍</div>}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* 4. 입력창 영역 */}
      <footer style={{ padding: '20px', backgroundColor: '#fff', borderTop: '1px solid #ddd' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="질문을 입력하세요 (예: 전기 공사 준공 서류 알려줘)"
            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
            disabled={isLoading}
          />
          <button 
            onClick={handleSend}
            style={{ padding: '0 24px', borderRadius: '8px', backgroundColor: '#1a73e8', color: '#fff', border: 'none', cursor: 'pointer' }}
            disabled={isLoading}
          >
            {isLoading ? '...' : '전송'}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;