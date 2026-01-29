/**
 * LLM #1: Generate search phrases from user topic
 */

import { jsonCompletion, LLMMessage } from './client';

// Number of search phrases to generate (default 5)
const SEARCH_PHRASES_COUNT = parseInt(process.env.SEARCH_PHRASES_COUNT || '5', 10);

interface SearchPhrasesResponse {
  phrases: string[];
}

function getSystemPrompt(count: number): string {
  return `You are a search query expert. Given a topic, generate exactly ${count} diverse search phrases that will help find different opinions and perspectives on this topic.

Your search phrases should cover:
- General discussions and opinions
- Pro/con debates and controversies
- Specific aspects (cost, safety, ethics, effectiveness)
- Different community perspectives (experts, users, critics)
- Recent developments and reactions

Return JSON in this exact format:
{
  "phrases": ["phrase 1", "phrase 2", ...]
}

Make phrases specific and searchable. Avoid generic terms. Include terms like "opinions", "discussion", "debate", "review", "controversy" to surface sentiment-rich content.`;
}

/**
 * Generate search phrases from a user topic
 */
export async function generateSearchPhrases(topic: string): Promise<string[]> {
  const messages: LLMMessage[] = [
    { role: 'system', content: getSystemPrompt(SEARCH_PHRASES_COUNT) },
    { role: 'user', content: `Generate search phrases for: "${topic}"` },
  ];

  try {
    const result = await jsonCompletion<SearchPhrasesResponse>(messages, {
      temperature: 0.7,
      maxTokens: 512,
    });

    console.log(`Generated ${result.data.phrases.length} search phrases. Tokens used: ${result.usage.totalTokens}`);

    // Validate and return
    if (Array.isArray(result.data.phrases) && result.data.phrases.length > 0) {
      return result.data.phrases.slice(0, SEARCH_PHRASES_COUNT);
    }

    // Fallback if parsing fails
    return createFallbackPhrases(topic);
  } catch (error) {
    console.error('Failed to generate search phrases:', error);
    return createFallbackPhrases(topic);
  }
}

/**
 * Fallback search phrases if LLM fails
 */
function createFallbackPhrases(topic: string): string[] {
  const cleanTopic = topic.trim();
  return [
    cleanTopic,
    `${cleanTopic} opinions`,
    `${cleanTopic} discussion`,
    `${cleanTopic} pros cons`,
    `${cleanTopic} controversy`,
    `${cleanTopic} review`,
  ];
}
