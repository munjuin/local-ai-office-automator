// src/app/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid'; // 👈 [New] ID 생성기

// 백엔드 주소
const API_BASE_URL = 'http://localhost:3000';
// const API_BASE_URL = 'http://3.35.164.165:3001';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  // --- 상태 관리 (State) ---
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>(''); 
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  
  // ✅ [New] 세션 ID 상태
  const [sessionId, setSessionId] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ✅ [New] 페이지 접속 시 고유 세션 ID 발급
  useEffect(() => {
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    console.log('🆔 발급된 세션 ID:', newSessionId);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // --- 1. 파일 업로드 핸들러 ---
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
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      setUploadStatus('done');
      alert(`파일 업로드 완료! (청크 ${data.chunkCount}개)`);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus('error');
      alert('업로드 실패!');
    }
  };

  // --- 2. 채팅 핸들러 ---
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isThinking) return;

    const userQuestion = input;
    setInput(''); 

    setMessages((prev) => [...prev, { role: 'user', content: userQuestion }]);
    setIsThinking(true);

    try {
      // ✅ [New] sessionId를 함께 전송
      const response = await fetch(`${API_BASE_URL}/upload/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: userQuestion,
          sessionId: sessionId // 👈 여기가 핵심!
        }), 
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

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
      <div className="z-10 w-full max-w-3xl flex flex-col items-center mb-8">
        <h1 className="font-bold text-2xl text-gray-800">🤖 Local AI Office Automator</h1>
        {/* 세션 ID 표시 (디버깅용) */}
        <p className="text-xs text-gray-400 mt-2 font-mono">Session ID: {sessionId}</p>
      </div>

      <div className="w-full max-w-3xl bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200 flex flex-col h-[80vh]">
        
        {/* 상단: 파일 업로드 */}
        <div className="p-6 bg-blue-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-blue-800 mb-2">📁 지식 문서 업로드 (PDF)</h2>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
            />
            <button
              onClick={handleUpload}
              disabled={!file || uploadStatus === 'uploading'}
              className={`px-6 py-2 rounded-lg font-medium text-white transition-colors ${uploadStatus === 'uploading' ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {uploadStatus === 'uploading' ? '업로드 중...' : '업로드'}
            </button>
          </div>
          {uploadStatus === 'done' && <p className="text-green-600 text-xs mt-2 font-medium">✅ 업로드 완료!</p>}
        </div>

        {/* 중단: 채팅 영역 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-20">
              <p>문서를 업로드하고 대화를 시작하세요!</p>
              <p className="text-xs mt-2">새로고침(F5) 하면 대화 기억이 리셋됩니다.</p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'}`}>
                {msg.content}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-500 px-4 py-3 rounded-2xl rounded-bl-none text-sm animate-pulse">Thinking... 💭</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 하단: 입력창 */}
        <div className="p-4 bg-white border-t border-gray-200">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="질문을 입력하세요..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-black" 
              disabled={isThinking}
            />
            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              className="bg-gray-900 text-white px-6 py-3 rounded-xl hover:bg-black disabled:opacity-50 font-medium"
            >
              전송
            </button>
          </form>
        </div>

      </div>
    </main>
  );
}