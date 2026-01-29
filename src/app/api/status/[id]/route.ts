import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis } from '@/lib/db/cache';

/**
 * GET /api/status/:id
 *
 * Get the status of an analysis by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_ID',
            message: 'Analysis ID is required',
          },
        },
        { status: 400 }
      );
    }

    // Get analysis from database
    const analysis = getAnalysis(id);

    if (!analysis) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Analysis not found',
          },
        },
        { status: 404 }
      );
    }

    // Return based on status
    switch (analysis.status) {
      case 'pending':
        return NextResponse.json({
          analysis_id: analysis.id,
          status: 'pending',
          topic: analysis.topic,
          created_at: analysis.createdAt,
          message: 'Analysis is queued and waiting to start',
        });

      case 'processing':
        return NextResponse.json({
          analysis_id: analysis.id,
          status: 'processing',
          topic: analysis.topic,
          created_at: analysis.createdAt,
          started_at: analysis.startedAt,
          message: 'Analysis is in progress',
        });

      case 'completed':
        return NextResponse.json({
          analysis_id: analysis.id,
          status: 'completed',
          topic: analysis.topic,
          created_at: analysis.createdAt,
          completed_at: analysis.completedAt,
          result: analysis.output,
        });

      case 'failed':
        return NextResponse.json(
          {
            analysis_id: analysis.id,
            status: 'failed',
            topic: analysis.topic,
            created_at: analysis.createdAt,
            completed_at: analysis.completedAt,
            error: {
              code: 'ANALYSIS_FAILED',
              message: analysis.error || 'Analysis failed',
            },
          },
          { status: 500 }
        );

      default:
        return NextResponse.json({
          analysis_id: analysis.id,
          status: analysis.status,
          topic: analysis.topic,
        });
    }
  } catch (error) {
    console.error('Status API error:', error);

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
