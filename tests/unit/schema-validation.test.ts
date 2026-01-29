import { describe, it, expect } from 'vitest';
import {
  NormalizedItemSchema,
  SourceTypeSchema,
} from '@/lib/schemas/normalized-item';
import {
  AnalysisInputSchema,
  TimeframePresetSchema,
  timeframeToDateRange,
} from '@/lib/schemas/input';
import {
  AnalysisOutputSchema,
  StanceSchema,
  AspectTagSchema,
  ClusterSchema,
} from '@/lib/schemas/output';

describe('NormalizedItem Schema', () => {
  it('should validate a complete normalized item', () => {
    const item = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      source_type: 'open_web',
      source_name: 'example.com',
      url: 'https://example.com/article',
      title: 'Test Article',
      author: 'John Doe',
      published_at: '2024-01-15T10:00:00Z',
      retrieved_at: '2024-01-16T12:00:00Z',
      language: 'en',
      geo: null,
      text: 'This is the article content.',
      meta: {
        word_count: 5,
      },
    };

    const result = NormalizedItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('should validate item with minimal fields', () => {
    const item = {
      id: '123',
      source_type: 'open_web',
      source_name: 'example.com',
      url: 'https://example.com/post/123',
      title: null,
      author: null,
      published_at: null,
      retrieved_at: '2024-01-16T12:00:00Z',
      language: null,
      geo: null,
      text: 'Comment text here',
    };

    const result = NormalizedItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('should reject invalid source type', () => {
    const item = {
      id: '123',
      source_type: 'invalid_type',
      source_name: 'test',
      url: 'https://example.com',
      title: null,
      author: null,
      published_at: null,
      retrieved_at: '2024-01-16T12:00:00Z',
      language: null,
      geo: null,
      text: 'Test',
    };

    const result = NormalizedItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it('should reject invalid URL', () => {
    const item = {
      id: '123',
      source_type: 'open_web',
      source_name: 'test',
      url: 'not-a-valid-url',
      title: null,
      author: null,
      published_at: null,
      retrieved_at: '2024-01-16T12:00:00Z',
      language: null,
      geo: null,
      text: 'Test',
    };

    const result = NormalizedItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });
});

describe('AnalysisInput Schema', () => {
  it('should validate a complete analysis input', () => {
    const input = {
      topic: 'AI regulation',
      timeframe: 'last_week',
      geo_scope: 'global',
      languages: ['en', 'es'],
      sources: ['openrouter_web_search'],
      max_items_per_source: 50,
      options: {
        enable_spam_detection: true,
        enable_deduplication: true,
        apply_domain_caps: true,
        domain_cap_percent: 10,
        min_cluster_size: 3,
        max_clusters: 15,
      },
    };

    const result = AnalysisInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should apply defaults for missing optional fields', () => {
    const input = {
      topic: 'AI regulation',
    };

    const result = AnalysisInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timeframe).toBe('last_week');
      expect(result.data.geo_scope).toBe(null);
      expect(result.data.sources).toEqual(['openrouter_web_search']);
    }
  });

  it('should reject topic that is too short', () => {
    const input = {
      topic: 'A', // Too short
    };

    const result = AnalysisInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should validate custom timeframe', () => {
    const input = {
      topic: 'Test topic',
      timeframe: {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-31T23:59:59Z',
      },
    };

    const result = AnalysisInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('TimeframeToDateRange', () => {
  it('should convert last_24h to date range', () => {
    const { start, end } = timeframeToDateRange('last_24h');
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(24, 0);
  });

  it('should convert last_week to date range', () => {
    const { start, end } = timeframeToDateRange('last_week');
    const diffMs = end.getTime() - start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
  });

  it('should handle custom timeframe', () => {
    const customTimeframe = {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-15T00:00:00Z',
    };
    const { start, end } = timeframeToDateRange(customTimeframe);
    expect(start.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });
});

describe('Stance Schema', () => {
  it('should validate valid stances', () => {
    expect(StanceSchema.safeParse('support').success).toBe(true);
    expect(StanceSchema.safeParse('oppose').success).toBe(true);
    expect(StanceSchema.safeParse('mixed').success).toBe(true);
    expect(StanceSchema.safeParse('unclear').success).toBe(true);
  });

  it('should reject invalid stance', () => {
    expect(StanceSchema.safeParse('positive').success).toBe(false);
    expect(StanceSchema.safeParse('negative').success).toBe(false);
  });
});

describe('AspectTag Schema', () => {
  it('should validate all aspect tags', () => {
    const validTags = [
      'cost', 'safety', 'ethics', 'legality', 'effectiveness',
      'environmental', 'social_impact', 'technical', 'political',
      'economic', 'health', 'privacy', 'security', 'innovation',
      'tradition', 'other'
    ];

    for (const tag of validTags) {
      expect(AspectTagSchema.safeParse(tag).success).toBe(true);
    }
  });

  it('should reject invalid aspect tag', () => {
    expect(AspectTagSchema.safeParse('invalid_tag').success).toBe(false);
  });
});

describe('Cluster Schema', () => {
  it('should validate a complete cluster', () => {
    const cluster = {
      id: 'cluster-1',
      label: 'Supporting AI Regulation',
      stance: 'support',
      aspect_tags: ['safety', 'ethics'],
      share: { count: 25, percent: 30.5 },
      breakdown: {
        by_source_type: [{ source_type: 'open_web', count: 15 }],
        by_language: [{ language: 'en', count: 25 }],
      },
      evidence: [
        {
          url: 'https://example.com/article',
          title: 'Test Article',
          source_name: 'example.com',
          source_type: 'open_web',
          published_at: '2024-01-15T10:00:00Z',
          excerpt: 'AI regulation is important...',
        },
      ],
      notes: 'This cluster represents supportive opinions.',
      confidence: {
        score_0_1: 0.85,
        reasons: ['High cluster coherence'],
      },
    };

    const result = ClusterSchema.safeParse(cluster);
    expect(result.success).toBe(true);
  });

  it('should require at least one evidence item', () => {
    const cluster = {
      id: 'cluster-1',
      label: 'Test',
      stance: 'support',
      aspect_tags: [],
      share: { count: 1, percent: 100 },
      breakdown: { by_source_type: [], by_language: [] },
      evidence: [], // Empty - should fail
      notes: 'Test',
      confidence: { score_0_1: 0.5, reasons: [] },
    };

    const result = ClusterSchema.safeParse(cluster);
    expect(result.success).toBe(false);
  });
});
