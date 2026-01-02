import OpenAI from 'openai'

let openaiClient: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

export async function chatCompletion(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) {
  const client = getOpenAIClient()
  
  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    })

    return response.choices[0]?.message?.content || 'I apologize, but I could not generate a response.'
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw new Error(`Failed to get AI response: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

