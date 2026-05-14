import { useState } from 'react';


const API_KEY = "AIzaSyBhBa5QiZj3qpineBOW0P7V35Z4WvDe7NQ";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

// Lời nhắc hệ thống (System Prompt) ép AI theo đúng format của Khoa
const SYSTEM_INSTRUCTION = `
Bạn là trợ lý phân tích dữ liệu AQI cho dashboard EDA. Nhiệm vụ của bạn là đọc dữ liệu đầu vào JSON đã được rút gọn và viết một đoạn insight ngắn, rõ, chuyên nghiệp bằng tiếng Việt.
Quy tắc TỐI THƯỢNG:
1. Chỉ dùng dữ liệu được cung cấp, không tự bịa thêm.
2. Không lặp lại số liệu máy móc. Không ví von ẩn dụ.
3. Luôn viết theo cấu trúc 3 dòng:
- Nhận xét chính: [Nội dung]
- Lý do: [Nội dung từ dữ liệu]
- Hành động gợi ý: [Nội dung], hãy thật tập trung vào những hành động gợi ý bảo vệ sức khỏe cực kỳ thiết thực, cụ thể cho người dân khi xem monitor tab 1
4. Văn phong ngắn gọn, tối đa 7-8 câu.
`;

export const useGemini = () => {
  const [loadingAI, setLoadingAI] = useState(false);

  const generateInsight = async (dataPayload) => {
    setLoadingAI(true);
    try {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Gộp thẳng lệnh hệ thống vào văn bản gửi đi để không bị lỗi không hỗ trợ (Not Supported)
          contents: [{
            parts: [{
              text: SYSTEM_INSTRUCTION + "\n\n" + `Dữ liệu đầu vào:\n${JSON.stringify(dataPayload)}`
            }]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 3000,
          }
        })
      });

      const data = await response.json();

      // Bắt lỗi nếu Google trả về lỗi (như sai API Key)
      if (data.error) throw new Error(data.error.message);

      let rawText = data.candidates[0].content.parts[0].text;
      return rawText;

    } catch (err) {
      console.error("Lỗi gọi Gemini:", err);
      return `- Lỗi kết nối máy chủ AI.\n- Lý do: ${err.message}\n- Vui lòng kiểm tra lại đường truyền hoặc mã API Key.`;
    } finally {
      setLoadingAI(false);
    }
  };

  return { generateInsight, loadingAI };
};