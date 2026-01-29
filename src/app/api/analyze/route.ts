import { NextRequest, NextResponse } from 'next/server';
import { AnalysisInputSchema, AnalysisInput } from '@/lib/schemas/input';
import { AnalysisOutputSchema, AnalysisErrorSchema } from '@/lib/schemas/output';
import { runAnalysis } from '@/lib/pipeline/analyze';
import { createAnalysis, updateAnalysisStatus, getAnalysis } from '@/lib/db/cache';

export const maxDuration = 300; // 5 minutes max for serverless

/**
 * POST /api/analyze
 *
 * Trigger a new sentiment analysis for a topic
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const parseResult = AnalysisInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const input: AnalysisInput = parseResult.data;

    // Create analysis record
    const analysisId = createAnalysis(input.topic, JSON.stringify(input));

    // Check if this should be a background job
    const runInBackground = request.headers.get('X-Run-Background') === 'true';

    if (runInBackground) {
      // Start analysis in background and return immediately
      runAnalysisInBackground(analysisId, input);

      return NextResponse.json({
        analysis_id: analysisId,
        status: 'pending',
        message: 'Analysis started. Poll /api/status/:id for results.',
      });
    }

    // Run analysis synchronously
    updateAnalysisStatus(analysisId, 'processing');

    try {
      const output = await runAnalysis(input);

      // Validate output
      const validationResult = AnalysisOutputSchema.safeParse(output);

      if (!validationResult.success) {
        console.error('Output validation failed:', JSON.stringify(validationResult.error.flatten(), null, 2));
        throw new Error(`Output validation failed: ${validationResult.error.message}`);
      }

      // Save to database
      updateAnalysisStatus(analysisId, 'completed', JSON.stringify(validationResult.data));

      return NextResponse.json(validationResult.data);
    } catch (analysisError) {
      console.error('Analysis pipeline error:', analysisError);

      const errorMessage = analysisError instanceof Error
        ? analysisError.message
        : 'Unknown error';

      updateAnalysisStatus(analysisId, 'failed', undefined, errorMessage);

      return NextResponse.json(
        {
          error: {
            code: 'ANALYSIS_ERROR',
            message: 'Analysis failed',
            details: { error: errorMessage },
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('API error:', error);

    return NextResponse.json(
      {
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Run analysis in background (fire and forget)
 */
async function runAnalysisInBackground(analysisId: string, input: AnalysisInput) {
  updateAnalysisStatus(analysisId, 'processing');

  try {
    const output = await runAnalysis(input);
    updateAnalysisStatus(analysisId, 'completed', JSON.stringify(output));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    updateAnalysisStatus(analysisId, 'failed', undefined, errorMessage);
  }
}

/**
 * GET /api/analyze
 *
 * Get information about the analyze endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/analyze',
    method: 'POST',
    description: 'Analyze sentiment for a topic',
    headers: {
      'Content-Type': 'application/json',
      'X-Run-Background': 'Set to "true" to run analysis in background',
    },
    body: {
      topic: 'string (required) - The topic to analyze',
      timeframe: 'string | object (optional) - Time range for analysis',
      geo_scope: 'string (optional) - Geographic focus',
      languages: 'string[] (optional) - Language filter',
      sources: 'string[] (optional) - Data sources to use',
      max_items_per_source: 'number (optional) - Max items per source',
      options: {
        enable_spam_detection: 'boolean',
        enable_deduplication: 'boolean',
        apply_domain_caps: 'boolean',
        domain_cap_percent: 'number',
        min_cluster_size: 'number',
        max_clusters: 'number',
      },
    },
  });
}
