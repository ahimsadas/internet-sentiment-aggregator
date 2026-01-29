import { NormalizedItem, SourceType } from '../schemas/normalized-item';

/**
 * Query parameters passed to connectors
 */
export interface ConnectorQuery {
  // Search queries to use (may be multiple for different aspects)
  queries: string[];

  // Date range for filtering
  dateRange: {
    start: Date;
    end: Date;
  };

  // Maximum number of items to fetch
  maxItems: number;

  // Language filters (if supported)
  languages?: string[];

  // Geographic filters (if supported)
  geo?: string;

  // Additional source-specific options
  options?: Record<string, unknown>;
}

/**
 * Result from a connector
 */
export interface ConnectorResult {
  // The fetched and normalized items
  items: NormalizedItem[];

  // Metadata about the fetch
  metadata: {
    // Source identifier
    source: string;

    // Number of raw items before any filtering
    rawCount: number;

    // Number of items after filtering (before normalization)
    filteredCount: number;

    // Any rate limit info
    rateLimitRemaining?: number;
    rateLimitReset?: Date;

    // Errors or warnings during fetch
    warnings: string[];
    errors: string[];

    // Whether this result is partial (e.g., due to rate limits)
    isPartial: boolean;

    // Time taken in milliseconds
    durationMs: number;
  };
}

/**
 * Connector health check result
 */
export interface ConnectorHealth {
  available: boolean;
  message: string;
  lastChecked: Date;
}

/**
 * Base interface for all data connectors
 */
export interface DataConnector {
  // Unique identifier for this connector
  readonly id: string;

  // Human-readable name
  readonly name: string;

  // Source type classification
  readonly sourceType: SourceType;

  // Whether this connector requires API keys
  readonly requiresAuth: boolean;

  // Whether this connector is currently available
  isAvailable(): Promise<boolean>;

  // Check health and return status
  healthCheck(): Promise<ConnectorHealth>;

  // Fetch data based on query
  fetch(query: ConnectorQuery): Promise<ConnectorResult>;

  // Get rate limit status (if applicable)
  getRateLimitStatus?(): Promise<{
    remaining: number;
    limit: number;
    resetAt: Date;
  }>;
}

/**
 * Registry of available connectors
 */
export interface ConnectorRegistry {
  register(connector: DataConnector): void;
  get(id: string): DataConnector | undefined;
  getAll(): DataConnector[];
  getAvailable(): Promise<DataConnector[]>;
}
