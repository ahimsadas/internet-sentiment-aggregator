/**
 * OpenRouter LLM client
 *
 * Provides a unified interface for LLM calls via OpenRouter
 */

import { RateLimiter, isRateLimitError } from '../utils/rate-limiter';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  responseFormat?: { type: 'json_object' } | { type: 'text' };
}

const defaultOptions: LLMOptions = {
  model: process.env.OPENROUTER_MODEL || 'xiaomi/mimo-v2-flash',
  temperature: 0.7,
  maxTokens: 4096,
};

// Rate limiter for API calls
const rateLimiter = new RateLimiter({
  maxRetries: 3,
  baseDelayMs: 1000,
  requestsPerWindow: 20,
  windowMs: 60000,
});

/**
 * Truncate string for logging
 */
function truncateForLog(str: string, maxLen: number = 500): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `... [${str.length - maxLen} more chars]`;
}

/**
 * Log LLM request
 */
function logRequest(messages: LLMMessage[], options: LLMOptions): void {
  console.log('\n┌─── LLM Request ─────────────────────────────────────────');
  console.log(`│ Model: ${options.model}`);
  console.log(`│ Temperature: ${options.temperature}`);
  console.log(`│ Max Tokens: ${options.maxTokens}`);
  console.log('│');

  for (const msg of messages) {
    console.log(`│ [${msg.role.toUpperCase()}]:`);
    const lines = truncateForLog(msg.content, 1000).split('\n');
    for (const line of lines) {
      console.log(`│   ${line}`);
    }
    console.log('│');
  }
  console.log('└─────────────────────────────────────────────────────────\n');
}

/**
 * Log LLM response
 */
function logResponse(response: LLMResponse): void {
  console.log('\n┌─── LLM Response ────────────────────────────────────────');
  console.log(`│ Model: ${response.model}`);
  console.log(`│ Finish Reason: ${response.finishReason}`);
  console.log(`│ Tokens: ${response.usage.promptTokens} prompt + ${response.usage.completionTokens} completion = ${response.usage.totalTokens} total`);
  console.log('│');
  console.log('│ Content:');

  // Try to parse and pretty-print if JSON
  let content = response.content;
  try {
    const parsed = JSON.parse(content);
    content = JSON.stringify(parsed, null, 2);
  } catch {
    // Not JSON, use as-is
  }

  const lines = truncateForLog(content, 2000).split('\n');
  for (const line of lines) {
    console.log(`│   ${line}`);
  }
  console.log('└─────────────────────────────────────────────────────────\n');
}

/**
 * Make a chat completion request to OpenRouter
 */
export async function chatCompletion(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  const mergedOptions = { ...defaultOptions, ...options };

  // Log the request
  logRequest(messages, mergedOptions);

  return rateLimiter.executeWithRetry(
    async () => {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
          'X-Title': 'Internet Sentiment Aggregator',
        },
        body: JSON.stringify({
          model: mergedOptions.model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          temperature: mergedOptions.temperature,
          max_tokens: mergedOptions.maxTokens,
          top_p: mergedOptions.topP,
          response_format: mergedOptions.responseFormat,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('\n┌─── LLM Error ───────────────────────────────────────────');
        console.log(`│ Status: ${response.status}`);
        console.log(`│ Error: ${errorText}`);
        console.log('└─────────────────────────────────────────────────────────\n');
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenRouter');
      }

      const choice = data.choices[0];

      const result: LLMResponse = {
        content: choice.message?.content || '',
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        model: data.model || mergedOptions.model || '',
        finishReason: choice.finish_reason || 'unknown',
      };

      // Log the response
      logResponse(result);

      return result;
    },
    (error) => isRateLimitError(error)
  );
}

/**
 * Make a JSON-structured completion request
 */
export async function jsonCompletion<T>(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<{ data: T; usage: LLMResponse['usage'] }> {
  const response = await chatCompletion(messages, {
    ...options,
    responseFormat: { type: 'json_object' },
  });

  try {
    // Try to extract JSON from the response
    let jsonContent = response.content;

    // Handle case where JSON is wrapped in markdown code blocks
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    // Parse JSON
    const data = JSON.parse(jsonContent.trim()) as T;

    return {
      data,
      usage: response.usage,
    };
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error}\n\nResponse: ${response.content}`);
  }
}

/**
 * Simple prompt completion
 */
export async function complete(
  prompt: string,
  options: LLMOptions = {}
): Promise<LLMResponse> {
  return chatCompletion(
    [{ role: 'user', content: prompt }],
    options
  );
}

/**
 * Complete with a system prompt
 */
export async function completeWithSystem(
  systemPrompt: string,
  userPrompt: string,
  options: LLMOptions = {}
): Promise<LLMResponse> {
  return chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    options
  );
}

/**
 * Check if the LLM is available
 */
export async function checkLLMAvailability(): Promise<{
  available: boolean;
  message: string;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      available: false,
      message: 'OPENROUTER_API_KEY not configured',
    };
  }

  try {
    // Make a minimal request to verify the API key works
    const response = await chatCompletion(
      [{ role: 'user', content: 'Say "OK"' }],
      { maxTokens: 10 }
    );

    return {
      available: true,
      message: `OpenRouter available, model: ${response.model}`,
    };
  } catch (error) {
    return {
      available: false,
      message: `OpenRouter error: ${error}`,
    };
  }
}
