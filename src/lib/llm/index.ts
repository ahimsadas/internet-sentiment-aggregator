/**
 * LLM module exports
 */

// Client
export {
  chatCompletion,
  jsonCompletion,
  complete,
  completeWithSystem,
  checkLLMAvailability,
  type LLMMessage,
  type LLMResponse,
  type LLMOptions,
} from './client';

// Search phrase generation (LLM #1)
export { generateSearchPhrases } from './search-phrases';

// Content analysis (LLM #2)
export {
  analyzeContent,
  type WebContent,
  type AnalysisResult,
} from './analyze-content';
