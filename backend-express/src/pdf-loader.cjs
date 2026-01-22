// backend/src/pdf-loader.cjs

// 1. 여기서 진짜 require를 수행합니다.
const pdf = require('pdf-parse');

// 2. 가져온 결과를 무조건 default로 내보냅니다.
module.exports = pdf;