# Architecture Documentation

## System Overview

The Internet Sentiment Aggregator is a web application that collects, processes, and analyzes online content to provide sentiment analysis on user-specified topics.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js Frontend                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │  Input   │ │  Stance  │ │ Clusters │ │ Limitations Panel│   │
│  │   Form   │ │  Chart   │ │ Explorer │ │                  │   │
│  │          │ │          │ │          │ │                  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                           │
│  POST /api/analyze - Main analysis endpoint                     │
│  GET  /api/status/:id - Poll analysis status                    │
│  GET  /api/health - Service health check                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Analysis Pipeline                           │
│                                                                 │
│  1. LLM #1: Generate Search Phrases                             │
│     └─> Diverse search queries for the topic                    │
│                                                                 │
│  2. Web Search (OpenRouter Web Search Plugin)                   │
│     └─> Fetch content from search results                       │
│                                                                 │
│  3. Data Processing                                             │
│     ├─> Normalize to canonical schema                           │
│     ├─> Clean (strip boilerplate, truncate)                     │
│     └─> Deduplicate (URL hash + SimHash)                        │
│                                                                 │
│  4. LLM #2: Analyze & Structure                                 │
│     ├─> Identify opinion clusters                               │
│     ├─> Classify stance (support/oppose/mixed/unclear)          │
│     ├─> Select evidence excerpts                                │
│     └─> Return structured JSON for UI                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SQLite Cache Layer                         │
│  - Retrieved content cache (TTL-based)                          │
│  - Analysis results cache                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
internet-sentiment-aggregator/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Main UI
│   │   ├── layout.tsx                # Root layout
│   │   ├── globals.css               # Global styles
│   │   └── api/
│   │       ├── analyze/route.ts      # Main analysis endpoint
│   │       ├── status/[id]/route.ts  # Status polling
│   │       └── health/route.ts       # Health check
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── InputForm.tsx             # Topic input + filters
│   │   ├── StanceChart.tsx           # Stance distribution chart
│   │   ├── ClusterExplorer.tsx       # Expandable clusters
│   │   ├── EvidenceCard.tsx          # Individual evidence
│   │   └── LimitationsPanel.tsx      # Method/limitations
│   │
│   ├── lib/
│   │   ├── connectors/               # Data source connectors
│   │   │   ├── types.ts              # Connector interface
│   │   │   ├── openrouter-search.ts  # Web search (OpenRouter plugin)
│   │   │   └── registry.ts           # Connector health registry
│   │   │
│   │   ├── llm/
│   │   │   ├── client.ts             # OpenRouter client
│   │   │   ├── search-phrases.ts     # LLM #1: Generate search phrases
│   │   │   └── analyze-content.ts    # LLM #2: Analyze & structure
│   │   │
│   │   ├── processing/
│   │   │   ├── normalizer.ts         # Schema conversion
│   │   │   ├── cleaner.ts            # Text cleaning
│   │   │   ├── language-detect.ts    # Language detection
│   │   │   └── deduplicator.ts       # URL + SimHash dedupe
│   │   │
│   │   ├── pipeline/
│   │   │   ├── analyze.ts            # Main export (re-exports simple-analyze)
│   │   │   └── simple-analyze.ts     # Pipeline orchestration
│   │   │
│   │   ├── db/
│   │   │   ├── client.ts             # SQLite connection
│   │   │   ├── schema.ts             # Table definitions
│   │   │   └── cache.ts              # Cache operations
│   │   │
│   │   ├── schemas/
│   │   │   ├── input.ts              # Input validation
│   │   │   ├── output.ts             # Output JSON schema
│   │   │   └── normalized-item.ts    # Canonical item schema
│   │   │
│   │   └── utils/
│   │       ├── simhash.ts            # SimHash implementation
│   │       └── rate-limiter.ts       # Rate limiting
│   │
│   └── types/
│       └── index.ts                  # Shared TypeScript types
│
├── tests/
│   ├── unit/                         # Unit tests
│   └── integration/                  # Integration tests
│
├── .env.example                      # Environment template
├── package.json
├── README.md
└── ARCHITECTURE.md
```

## Data Flow

### 1. Input Processing

User input is validated against `AnalysisInputSchema`:

```typescript
interface AnalysisInput {
  topic: string;
  timeframe: 'last_24h' | 'last_week' | ... | CustomTimeframe;
  geo_scope: 'global' | 'us' | 'europe' | 'asia' | null;
  languages: string[] | null;
  sources: DataSource[];
  options: AnalysisOptions;
}
```

### 2. Search Phrase Generation (LLM #1)

The first LLM call generates diverse search phrases:

```typescript
// Input: "AI regulation"
// Output:
[
  "AI regulation opinions 2024",
  "artificial intelligence laws debate",
  "AI governance controversy",
  "machine learning regulation pros cons",
  "AI safety rules discussion"
]
```

### 3. Web Search

OpenRouter's web search plugin searches the web using the generated phrases and returns content with citations:

```typescript
interface NormalizedItem {
  id: string;
  source_type: 'open_web';
  source_name: string;          // Domain name
  url: string;
  title: string | null;
  author: string | null;
  published_at: string | null;  // ISO 8601
  retrieved_at: string;         // ISO 8601
  language: string | null;      // ISO 639-1
  text: string;                 // Cleaned content
  meta: object;                 // Additional metadata
}
```

### 4. Data Processing

- **Normalization**: Convert to canonical schema
- **Cleaning**: Remove boilerplate, truncate long texts
- **Deduplication**: URL-based and SimHash content-based

### 5. Analysis (LLM #2)

The second LLM call analyzes all content and returns structured output:

```typescript
// LLM receives: topic + processed items
// LLM returns:
{
  clusters: [
    {
      label: "Concerns about AI job displacement",
      stance: "oppose",
      aspect_tags: ["economic", "social_impact"],
      item_indices: [0, 3, 7, 12],
      notes: "Multiple sources express worry about automation...",
      evidence_excerpts: [
        { item_index: 0, excerpt: "Workers fear AI will..." }
      ]
    }
  ],
  stance_distribution: [
    { stance: "support", percent: 35 },
    { stance: "oppose", percent: 40 },
    { stance: "mixed", percent: 20 },
    { stance: "unclear", percent: 5 }
  ],
  overall_confidence: 0.75,
  limitations: ["Limited to English sources"]
}
```

### 6. Output Assembly

The pipeline maps LLM results to the final output schema:

```typescript
interface AnalysisOutput {
  analysis_id: string;
  created_at: string;
  completed_at: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';

  query: {
    topic: string;
    timeframe: { start: string; end: string } | null;
    geo_scope: string | null;
    language_scope: string[] | null;
  };

  sampling: {
    sources_used: string[];
    n_raw: number;
    n_after_dedupe: number;
    n_analyzed: number;
    source_breakdown: Array<{ source_type: string; count: number; percent: number }>;
    domain_caps_applied: boolean;
  };

  stance_distribution: Array<{ stance: string; count: number; percent: number }>;
  clusters: Array<Cluster>;

  confidence: {
    overall_score_0_1: number;
    limitations: string[];
    warnings: string[];
  };
}
```

## Caching Strategy

### Content Cache
- TTL: 24 hours (configurable via `CACHE_TTL_SECONDS`)
- Key: Canonical URL
- Prevents redundant fetches

### Analysis Results Cache
- TTL: 7 days
- Key: Analysis ID
- Allows polling for async results

## Error Handling

- **Connector failures**: Log warning, return partial results
- **Rate limits**: Exponential backoff with jitter
- **LLM failures**: Fallback to heuristic-based grouping by source
- **Validation errors**: Return 400 with details

## Security

- API keys stored in environment variables only
- Never exposed to client
- No personal data storage by default
- Rate limiting to prevent abuse
