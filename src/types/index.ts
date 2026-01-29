/**
 * Re-export all schemas and types for convenience
 */

// Normalized item types
export type {
  SourceType,
  NormalizedItem,
  TextChunk,
} from '@/lib/schemas/normalized-item';

export {
  SourceTypeSchema,
  NormalizedItemSchema,
  TextChunkSchema,
} from '@/lib/schemas/normalized-item';

// Input types
export type {
  TimeframePreset,
  CustomTimeframe,
  GeoScope,
  DataSource,
  AnalysisInput,
} from '@/lib/schemas/input';

export {
  TimeframePresetSchema,
  CustomTimeframeSchema,
  GeoScopeSchema,
  DataSourceSchema,
  AnalysisInputSchema,
  timeframeToDateRange,
} from '@/lib/schemas/input';

// Output types
export type {
  Stance,
  AspectTag,
  Evidence,
  ConfidenceScore,
  SourceBreakdown,
  StanceDistributionEntry,
  Cluster,
  Claim,
  SamplingMetadata,
  QueryEcho,
  OverallConfidence,
  AnalysisOutput,
  AnalysisError,
} from '@/lib/schemas/output';

export {
  StanceSchema,
  AspectTagSchema,
  EvidenceSchema,
  ConfidenceScoreSchema,
  SourceBreakdownSchema,
  StanceDistributionEntrySchema,
  ClusterSchema,
  ClaimSchema,
  SamplingMetadataSchema,
  QueryEchoSchema,
  OverallConfidenceSchema,
  AnalysisOutputSchema,
  AnalysisErrorSchema,
} from '@/lib/schemas/output';

// Connector types
export type {
  ConnectorQuery,
  ConnectorResult,
  ConnectorHealth,
  DataConnector,
  ConnectorRegistry,
} from '@/lib/connectors/types';
