import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export function getGeminiModel() {
  // gemini-flash-latest: 항상 최신 Flash 버전을 자동으로 사용
  // 현재 gemini-2.5-flash를 가리킴 (1M+ 입력 토큰, 65K 출력 토큰)
  // 무료 API 키에서도 안정적으로 작동
  return genAI.getGenerativeModel({ 
    model: 'gemini-flash-latest',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  })
}

// JSON 응답을 강제하는 프롬프트 헬퍼
export async function generateJSON<T>(prompt: string, systemPrompt: string): Promise<T> {
  const model = getGeminiModel()
  
  const fullPrompt = `${systemPrompt}

중요: 반드시 JSON 형식으로만 응답해주세요. 다른 텍스트는 포함하지 마세요.

${prompt}

JSON 응답:`

  const result = await model.generateContent(fullPrompt)
  const response = await result.response
  const text = response.text()
  
  // JSON 추출 (```json ... ``` 형태로 올 수 있음)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('AI 응답에서 JSON을 찾을 수 없습니다')
  }
  
  return JSON.parse(jsonMatch[0])
}

