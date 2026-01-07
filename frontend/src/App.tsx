import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendChatMessage } from './api/chatApi';
import type { IMessage, IChatHistory } from './types/chat';
import axios from 'axios';

function App() {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // 자동 스크롤을 위한 Ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지 목록이 변경될 때마다 바닥으로 스크롤
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
      // DB에서 가져온 데이터를 IMessage 형식에 맞게 변환하여 상태 업데이트
      const historyMessages = response.data.map((item) => ({
        id: item.id.toString(),
        role: item.role,
        content: item.content
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

    const userMessage: IMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage({ prompt: input });

      const assistantMessage: IMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
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
      <header style={{ padding: '20px', backgroundColor: '#fff', borderBottom: '1px solid #ddd', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1a73e8' }}>⚡ AI 행정 비서 (전기/소방)</h1>
      </header>

      {/* 대화창 영역 */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '20px' }}>
              <div style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: '15px',
                backgroundColor: msg.role === 'user' ? '#1a73e8' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#333',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
              }}>
                <strong>{msg.role === 'user' ? '나' : 'AI 전문가'}</strong>
                {/* 마크다운 렌더링 적용 */}
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          {isLoading && <div style={{ textAlign: 'left', color: '#666' }}>AI가 답변을 생성하고 있습니다...</div>}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* 입력창 영역 */}
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
            전송
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;