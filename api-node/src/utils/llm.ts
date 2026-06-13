import { ENV } from '../config/env.js'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMOptions {
  temperature?: number
  maxTokens?: number
  jsonMode?: boolean
}

/**
 * Robust LLM caller that tries Groq first, and transparently falls back to Gemini
 * if Groq fails (e.g. rate-limit, network error, server error, or missing key).
 */
export async function callLLM(messages: ChatMessage[], options: LLMOptions = {}): Promise<string> {
  let groqError: any = null

  if (ENV.GROQ_API_KEY) {
    try {
      console.log('[LLM] Attempting Groq API...')
      const payload: any = {
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: options.temperature ?? 0.2,
        top_p: 1,
        stream: false,
      }

      if (options.maxTokens) {
        payload.max_tokens = options.maxTokens
      }

      if (options.jsonMode) {
        payload.response_format = { type: 'json_object' }
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ENV.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const data = await response.json() as any
        const text = data.choices?.[0]?.message?.content
        if (typeof text === 'string') {
          console.log('[LLM] Groq API response successfully received.')
          return text
        }
        throw new Error('Groq returned an empty response or unexpected structure.')
      } else {
        const errorText = await response.text()
        throw new Error(`Groq API responded with status ${response.status}: ${errorText}`)
      }
    } catch (err: any) {
      groqError = err
      console.warn(`[LLM] Groq API call failed: ${err.message || err}`)
    }
  } else {
    console.warn('[LLM] Groq API Key is not configured.')
  }

  // Fallback to Gemini API
  console.log('[LLM] Shifting to Gemini API as backup...')
  if (!ENV.GEMINI_API_KEY) {
    throw new Error('Both Groq and Gemini API Keys are missing or unconfigured.')
  }

  try {
    // 1. Separate system instructions and user/assistant messages
    const systemMsgs = messages.filter((m) => m.role === 'system')
    const systemPrompt = systemMsgs.map((m) => m.content).join('\n\n')

    const chatMsgs = messages.filter((m) => m.role !== 'system')

    // 2. Map messages to Gemini contents format (roles: 'user' or 'model')
    // We consolidate consecutive turns with identical roles as Gemini strictly requires alternating roles.
    const contents: any[] = []
    for (const msg of chatMsgs) {
      const role = msg.role === 'assistant' ? 'model' : 'user'
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += '\n\n' + msg.content
      } else {
        contents.push({
          role,
          parts: [{ text: msg.content }],
        })
      }
    }

    // Ensure we don't send an empty contents array
    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Hello' }],
      })
    }

    // Build the request body for Gemini REST API (v1beta generateContent)
    const geminiPayload: any = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        ...(options.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
        ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    }

    if (systemPrompt) {
      geminiPayload.systemInstruction = {
        parts: [{ text: systemPrompt }],
      }
    }

    const modelName = 'gemini-2.5-flash'
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${ENV.GEMINI_API_KEY}`

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API responded with status ${response.status}: ${errorText}`)
    }

    const data = await response.json() as any
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text === 'string') {
      console.log('[LLM] Gemini API response successfully received.')
      return text
    }
    throw new Error('Gemini API returned an empty response or unexpected structure.')
  } catch (geminiErr: any) {
    console.error(`[LLM] Gemini API call failed: ${geminiErr.message || geminiErr}`)
    const groqMsg = groqError ? `Groq: ${groqError.message || groqError}. ` : ''
    throw new Error(`Both LLM providers failed. ${groqMsg}Gemini: ${geminiErr.message || geminiErr}`)
  }
}
