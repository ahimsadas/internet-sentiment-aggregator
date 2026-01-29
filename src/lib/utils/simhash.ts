/**
 * SimHash implementation for near-duplicate detection
 *
 * SimHash is a locality-sensitive hash that produces similar hashes
 * for similar text content. This allows efficient near-duplicate detection
 * by comparing hash hamming distances.
 */

import crypto from 'crypto';

// Number of bits in the hash
const HASH_BITS = 64;

// Shingle size (n-gram size for tokenization)
const SHINGLE_SIZE = 3;

/**
 * Tokenize text into shingles (n-grams of words)
 */
function tokenize(text: string, shingleSize: number = SHINGLE_SIZE): string[] {
  // Normalize text
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ') // Keep only letters and spaces
    .replace(/\s+/g, ' ')
    .trim();

  const words = normalized.split(' ').filter(w => w.length > 0);

  if (words.length < shingleSize) {
    return [words.join(' ')];
  }

  const shingles: string[] = [];
  for (let i = 0; i <= words.length - shingleSize; i++) {
    shingles.push(words.slice(i, i + shingleSize).join(' '));
  }

  return shingles;
}

/**
 * Hash a string to a 64-bit value represented as BigInt
 */
function hashToken(token: string): bigint {
  const hash = crypto.createHash('md5').update(token).digest('hex');
  // Take first 16 hex chars (64 bits)
  return BigInt('0x' + hash.slice(0, 16));
}

/**
 * Compute SimHash for text
 */
export function computeSimHash(text: string): string {
  if (!text || text.trim().length === 0) {
    return '0'.repeat(16); // Return zero hash for empty text
  }

  const shingles = tokenize(text);

  if (shingles.length === 0) {
    return '0'.repeat(16);
  }

  // Initialize bit weights
  const weights = new Array(HASH_BITS).fill(0);

  // For each shingle, compute hash and update weights
  for (const shingle of shingles) {
    const hash = hashToken(shingle);

    for (let i = 0; i < HASH_BITS; i++) {
      // Check if bit i is set
      const bit = (hash >> BigInt(i)) & 1n;
      weights[i] += bit === 1n ? 1 : -1;
    }
  }

  // Build final hash from weights
  let simhash = 0n;
  for (let i = 0; i < HASH_BITS; i++) {
    if (weights[i] > 0) {
      simhash |= 1n << BigInt(i);
    }
  }

  // Convert to hex string (16 chars for 64 bits)
  return simhash.toString(16).padStart(16, '0');
}

/**
 * Compute hamming distance between two SimHash values
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hash lengths must match');
  }

  const a = BigInt('0x' + hash1);
  const b = BigInt('0x' + hash2);
  let xor = a ^ b;
  let distance = 0;

  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }

  return distance;
}

/**
 * Check if two texts are near-duplicates based on SimHash
 */
export function areNearDuplicates(
  text1: string,
  text2: string,
  maxDistance: number = 3
): boolean {
  const hash1 = computeSimHash(text1);
  const hash2 = computeSimHash(text2);
  return hammingDistance(hash1, hash2) <= maxDistance;
}

/**
 * Find near-duplicates in a list of texts
 * Returns groups of indices that are near-duplicates of each other
 */
export function findNearDuplicateGroups(
  texts: string[],
  maxDistance: number = 3
): number[][] {
  const hashes = texts.map(t => computeSimHash(t));
  const visited = new Set<number>();
  const groups: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    if (visited.has(i)) continue;

    const group = [i];
    visited.add(i);

    for (let j = i + 1; j < texts.length; j++) {
      if (visited.has(j)) continue;

      if (hammingDistance(hashes[i], hashes[j]) <= maxDistance) {
        group.push(j);
        visited.add(j);
      }
    }

    if (group.length > 1) {
      groups.push(group);
    }
  }

  return groups;
}

/**
 * Compute similarity score between two SimHash values (0-1)
 */
export function simhashSimilarity(hash1: string, hash2: string): number {
  const distance = hammingDistance(hash1, hash2);
  return 1 - distance / HASH_BITS;
}
