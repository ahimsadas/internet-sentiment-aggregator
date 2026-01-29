import { NextRequest } from 'next/server';
import { AnalysisInputSchema, AnalysisInput } from '@/lib/schemas/input';
import { AnalysisOutputSchema } from '@/lib/schemas/output';
import { runAnalysis } from '@/lib/pipeline/analyze';
import { createAnalysis, updateAnalysisStatus } from '@/lib/db/cache';

export const maxDuration = 300; // 5 minutes max for serverless

/**
 * POST /api/analyze/stream
 *
 * Stream analysis progress using Server-Sent Events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const parseResult = AnalysisInputSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parseResult.error.flatten(),
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const input: AnalysisInput = parseResult.data;

    // Create analysis record
    const analysisId = createAnalysis(input.topic, JSON.stringify(input));

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    let isClosed = false;
    const abortController = new AbortController();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          if (isClosed) return; // Don't send if stream is closed
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            // Controller may be closed due to client disconnect
            isClosed = true;
            abortController.abort();
          }
        };

        const closeStream = () => {
          if (isClosed) return;
          isClosed = true;
          abortController.abort();
          try {
            controller.close();
          } catch {
            // Already closed
          }
        };

        try {
          updateAnalysisStatus(analysisId, 'processing');

          // Run analysis with progress callback and abort signal
          const output = await runAnalysis(input, {
            onProgress: (progress) => {
              sendEvent('progress', {
                stage: progress.stage,
                progress: progress.progress,
                message: progress.message,
              });
            },
            signal: abortController.signal,
          });

          // Check if client disconnected during analysis
          if (isClosed) {
            console.log('[stream] Client disconnected, skipping result send');
            return;
          }

          // Validate output
          const validationResult = AnalysisOutputSchema.safeParse(output);

          if (!validationResult.success) {
            console.error('Output validation failed:', JSON.stringify(validationResult.error.flatten(), null, 2));
            sendEvent('error', { message: 'Output validation failed' });
            closeStream();
            return;
          }

          // Save to database
          updateAnalysisStatus(analysisId, 'completed', JSON.stringify(validationResult.data));

          // Send the final result
          sendEvent('complete', validationResult.data);
          closeStream();
        } catch (error) {
          // Don't log error if it's just a cancelled/closed stream
          const isCancelled = isClosed ||
            (error instanceof Error && (error.name === 'AbortError' || error.message === 'Analysis cancelled'));

          if (!isCancelled) {
            console.error('Analysis pipeline error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            updateAnalysisStatus(analysisId, 'failed', undefined, errorMessage);
            sendEvent('error', { message: errorMessage });
          } else {
            console.log('[stream] Analysis cancelled');
            updateAnalysisStatus(analysisId, 'failed', undefined, 'Cancelled by user');
          }
          closeStream();
        }
      },
      cancel() {
        // Called when client disconnects
        isClosed = true;
        abortController.abort();
        console.log('[stream] Client disconnected - analysis cancelled');
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
