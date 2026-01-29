/**
 * Main Analysis Pipeline
 *
 * Re-exports the simplified pipeline for backwards compatibility.
 * The new pipeline uses just 2 LLM calls:
 * 1. Generate search phrases
 * 2. Analyze content and return structured output
 */

export { runAnalysis } from './simple-analyze';
export type { PipelineProgress, PipelineOptions } from './simple-analyze';
