import { describe, it, expect } from 'vitest';
import {
  canonicalizeUrl,
  hashUrl,
  extractDomain,
} from '@/lib/processing/deduplicator';
import { computeSimHash, hammingDistance, areNearDuplicates } from '@/lib/utils/simhash';

describe('URL Canonicalization', () => {
  it('should remove tracking parameters', () => {
    const url = 'https://example.com/page?utm_source=google&utm_medium=cpc&id=123';
    const canonical = canonicalizeUrl(url);
    expect(canonical).toBe('https://example.com/page?id=123');
  });

  it('should lowercase the URL', () => {
    const url = 'https://EXAMPLE.COM/Page';
    const canonical = canonicalizeUrl(url);
    expect(canonical).toBe('https://example.com/page');
  });

  it('should remove trailing slash', () => {
    const url = 'https://example.com/page/';
    const canonical = canonicalizeUrl(url);
    expect(canonical).toBe('https://example.com/page');
  });

  it('should keep trailing slash for root', () => {
    const url = 'https://example.com/';
    const canonical = canonicalizeUrl(url);
    // Root with trailing slash is kept
    expect(canonical).toMatch(/^https:\/\/example\.com\/?$/);
  });

  it('should sort query parameters', () => {
    const url = 'https://example.com/page?z=1&a=2&m=3';
    const canonical = canonicalizeUrl(url);
    expect(canonical).toBe('https://example.com/page?a=2&m=3&z=1');
  });
});

describe('URL Hashing', () => {
  it('should produce consistent hashes', () => {
    const url = 'https://example.com/page';
    const hash1 = hashUrl(url);
    const hash2 = hashUrl(url);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different URLs', () => {
    const hash1 = hashUrl('https://example.com/page1');
    const hash2 = hashUrl('https://example.com/page2');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce same hash for equivalent URLs', () => {
    const hash1 = hashUrl('https://example.com/page?a=1&b=2');
    const hash2 = hashUrl('https://example.com/page?b=2&a=1');
    expect(hash1).toBe(hash2);
  });
});

describe('Domain Extraction', () => {
  it('should extract domain from URL', () => {
    expect(extractDomain('https://www.example.com/page')).toBe('example.com');
  });

  it('should remove www prefix', () => {
    expect(extractDomain('https://www.example.com')).toBe('example.com');
  });

  it('should handle subdomains', () => {
    expect(extractDomain('https://blog.example.com/post')).toBe('blog.example.com');
  });

  it('should return unknown for invalid URLs', () => {
    expect(extractDomain('not-a-url')).toBe('unknown');
  });
});

describe('SimHash', () => {
  it('should compute hash for text', () => {
    const hash = computeSimHash('This is a test sentence.');
    expect(hash).toHaveLength(16); // 64 bits = 16 hex chars
  });

  it('should produce similar hashes for similar text', () => {
    const text1 = 'The quick brown fox jumps over the lazy dog.';
    const text2 = 'The quick brown fox leaps over the lazy dog.';

    const hash1 = computeSimHash(text1);
    const hash2 = computeSimHash(text2);

    const distance = hammingDistance(hash1, hash2);
    expect(distance).toBeLessThan(10); // Should be somewhat similar
  });

  it('should produce different hashes for different text', () => {
    const text1 = 'The quick brown fox jumps over the lazy dog.';
    const text2 = 'Completely different text about something else entirely.';

    const hash1 = computeSimHash(text1);
    const hash2 = computeSimHash(text2);

    const distance = hammingDistance(hash1, hash2);
    expect(distance).toBeGreaterThan(5); // Should be quite different
  });

  it('should identify near-duplicates', () => {
    const text1 = 'AI regulation is important for safety and ethics in technology development.';
    const text2 = 'AI regulation is crucial for safety and ethics in tech development.';

    expect(areNearDuplicates(text1, text2, 5)).toBe(true);
  });

  it('should not identify dissimilar text as duplicates', () => {
    const text1 = 'AI regulation is important for safety.';
    const text2 = 'The weather today is sunny and warm.';

    expect(areNearDuplicates(text1, text2, 3)).toBe(false);
  });
});

describe('Hamming Distance', () => {
  it('should return 0 for identical hashes', () => {
    const hash = 'abcdef0123456789';
    expect(hammingDistance(hash, hash)).toBe(0);
  });

  it('should count differing bits correctly', () => {
    // 0 = 0000, 1 = 0001 -> 1 bit difference
    const hash1 = '0000000000000000';
    const hash2 = '0000000000000001';
    expect(hammingDistance(hash1, hash2)).toBe(1);
  });

  it('should handle maximum difference', () => {
    // All 0s vs all Fs (all 1s)
    const hash1 = '0000000000000000';
    const hash2 = 'ffffffffffffffff';
    expect(hammingDistance(hash1, hash2)).toBe(64); // All bits different
  });
});
