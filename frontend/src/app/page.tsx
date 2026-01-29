// src/app/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';

// 백엔드 주소
const API_BASE_URL = 'http://localhost:3000';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  // --- 상태 관리 (State) ---
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>(''); // 'idle' | 'uploading' | 'done' | 'error'
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  
  // 스크롤 자동 이동을 위한 Ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // --- 1. 파일 업로드 핸들러 (fetch 사용) ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setUploadStatus('idle');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploadStatus('uploading');
    const formData = new FormData();
    formData.append('file', file);

    try {
      // ✅ Fetch API 사용
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
        // 주의: FormData 전송 시 Content-Type 헤더를 설정하면 안 됩니다! 
        // 브라우저가 boundary와 함께 자동으로 설정합니다.
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setUploadStatus('done');
      alert('파일이 성공적으로 업로드되었습니다! 이제 질문해 보세요.');
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus('error');
      alert('업로드 실패! 백엔드 로그를 확인하세요.');
    }
  };

  // --- 2. 채팅 핸들러 (fetch 사용) ---
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isThinking) return;

    const userQuestion = input;
    setInput(''); // 입력창 비우기

    // 사용자 메시지 화면에 추가
    setMessages((prev) => [...prev, { role: 'user', content: userQuestion }]);
    setIsThinking(true);

    try {
      // ✅ Fetch API 사용
      const response = await fetch(`${API_BASE_URL}/upload/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // JSON 전송 시 필수
        },
        body: JSON.stringify({ question: userQuestion }), // 객체를 문자열로 변환
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json(); // 응답 JSON 파싱

      // AI 답변 화면에 추가
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer },
      ]);
    } catch (error) {
      console.error('Chat failed:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '죄송합니다. 오류가 발생했습니다.' },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 p-6">
      {/* 헤더 */}
      <div className="z-10 w-full max-w-3xl items-center justify-between font-bold text-2xl text-gray-800 mb-8">
        🤖 Local AI Office Automator
      </div>

      {/* 컨테이너 */}
      <div className="w-full max-w-3xl bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200 flex flex-col h-[80vh]">
        
        {/* 1. 상단: 파일 업로드 영역 */}
        <div className="p-6 bg-blue-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-blue-800 mb-2">📁 지식 문서 업로드 (PDF)</h2>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-100 file:text-blue-700
                hover:file:bg-blue-200"
            />
            <button
              onClick={handleUpload}
              disabled={!file || uploadStatus === 'uploading'}
              className={`px-6 py-2 rounded-lg font-medium text-white transition-colors
                ${uploadStatus === 'uploading' 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {uploadStatus === 'uploading' ? '업로드 중...' : '업로드'}
            </button>
          </div>
          {uploadStatus === 'done' && (
            <p className="text-green-600 text-xs mt-2 font-medium">✅ 업로드 완료! AI가 문서를 읽었습니다.</p>
          )}
        </div>

        {/* 2. 중단: 채팅 영역 (스크롤) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-20">
              <p>문서를 업로드하고 궁금한 점을 물어보세요!</p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-sm
                  ${msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                  }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-500 px-4 py-3 rounded-2xl rounded-bl-none text-sm animate-pulse">
                Thinking... 💭
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 3. 하단: 입력창 영역 */}
        <div className="p-4 bg-white border-t border-gray-200">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="PDF 내용에 대해 질문하세요..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-black" 
              disabled={isThinking}
            />
            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              className="bg-gray-900 text-white px-6 py-3 rounded-xl hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              전송
            </button>
          </form>
        </div>

      </div>
    </main>
  );
}