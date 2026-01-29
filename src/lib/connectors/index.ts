/**
 * Connectors module exports
 */

// Types
export type {
  DataConnector,
  ConnectorQuery,
  ConnectorResult,
  ConnectorHealth,
  ConnectorRegistry,
} from './types';

// OpenRouter web search
export {
  searchWeb,
  searchMultipleQueries,
  citationsToItems,
} from './openrouter-search';

export type {
  WebSearchOptions,
  WebSearchResult,
  UrlCitation,
  SearchAndAnalyzeResult,
} from './openrouter-search';
