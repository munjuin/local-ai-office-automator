// frontend/src/components/FileUpload.tsx

import React, { useState } from 'react';
import axios from 'axios';

export const FileUpload: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    
    // PDF인지 검사
    if (file.type !== 'application/pdf') {
      alert('PDF 파일만 업로드할 수 있습니다.');
      return;
    }

    // 업로드 시작
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // 백엔드로 전송
      const response = await axios.post('http://localhost:3000/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        alert(`✅ 학습 완료! 이제 '${file.name}' 내용에 대해 질문해보세요.`);
        // 입력값 초기화 (같은 파일 다시 올릴 수 있게)
        e.target.value = '';
      }
    } catch (error) {
      console.error('업로드 실패:', error);
      alert('❌ 파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ padding: '10px', borderBottom: '1px solid #ddd', background: '#f9f9f9' }}>
      <label 
        style={{ 
          cursor: isUploading ? 'wait' : 'pointer', 
          display: 'inline-flex', 
          alignItems: 'center',
          gap: '8px',
          fontWeight: 'bold',
          color: isUploading ? '#999' : '#333'
        }}
      >
        {/* 숨겨진 파일 입력창 */}
        <input 
          type="file" 
          accept=".pdf" 
          onChange={handleFileChange} 
          disabled={isUploading}
          style={{ display: 'none' }} 
        />
        
        {/* 보여지는 버튼 모양 */}
        <span>
          {isUploading ? '⏳ 문서를 읽고 학습하는 중...' : '📂 PDF 문서 업로드 (클릭)'}
        </span>
      </label>
    </div>
  );
};