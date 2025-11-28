import { GoogleGenAI } from "@google/genai";

export const getPracticeAdvice = async (
  query: string, 
  context?: string
): Promise<string> => {
  // Check localStorage first, then environment variable
  const apiKey = localStorage.getItem('gemini_api_key') || process.env.API_KEY;

  if (!apiKey) {
    return "請點擊右上角設定圖示，輸入 API Key 以啟用 AI 教練功能。(若不需要 AI 功能可忽略)";
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  try {
    const prompt = `
      You are a world-class music teacher and practice coach. 
      The user is practicing music and has a question.
      
      User's Context: ${context || 'General practice'}
      User's Query: "${query}"
      
      Provide a concise, encouraging, and actionable tip (max 100 words). 
      Focus on technique, musicality, or practice methodology.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Keep practicing! Listen carefully to your rhythm and tone.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to reach the AI coach right now. Please check your API Key or connection.";
  }
};