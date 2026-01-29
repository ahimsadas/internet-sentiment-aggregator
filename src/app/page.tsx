'use client';

import { useState, useEffect, useRef } from 'react';
import { InputForm, AnalysisFormData } from '@/components/InputForm';
import { StanceChart } from '@/components/StanceChart';
import { ClusterExplorer } from '@/components/ClusterExplorer';
import { LimitationsPanel } from '@/components/LimitationsPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, BarChart3, MessageSquare, Info, Loader2, CheckCircle2, Timer, Square } from 'lucide-react';

interface AnalysisOutput {
  analysis_id: string;
  created_at: string;
  completed_at: string | null;
  status: string;
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
  clusters: Array<{
    id: string;
    label: string;
    stance: 'support' | 'oppose' | 'mixed' | 'unclear';
    aspect_tags: string[];
    share: { count: number; percent: number };
    breakdown: {
      by_source_type: Array<{ source_type: string; count: number }>;
      by_language: Array<{ language: string; count: number }>;
    };
    evidence: Array<{
      url: string;
      title: string | null;
      source_name: string;
      source_type: string;
      published_at: string | null;
      excerpt: string;
    }>;
    notes: string;
    confidence: { score_0_1: number; reasons: string[] };
  }>;
  confidence: {
    overall_score_0_1: number;
    limitations: string[];
    warnings: string[];
  };
}

interface ProgressState {
  stage: string;
  progress: number;
  message: string;
}

const STAGE_LABELS: Record<string, { label: string; icon: string }> = {
  search_phrases: { label: 'Generating search phrases', icon: '🔍' },
  fetch: { label: 'Searching the web', icon: '🌐' },
  process: { label: 'Processing content', icon: '⚙️' },
  analyze: { label: 'Analyzing sentiment', icon: '🧠' },
  assemble: { label: 'Assembling results', icon: '📊' },
};

function formatElapsedTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisOutput | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [totalTime, setTotalTime] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Timer effect
  useEffect(() => {
    if (isLoading) {
      startTimeRef.current = Date.now();
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isLoading]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setProgress(null);
    setError('Analysis stopped by user');
  };

  const handleSubmit = async (data: AnalysisFormData) => {
    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setResult(null);
    setProgress(null);
    setTotalTime(null);

    try {
      const response = await fetch('/api/analyze/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: data.topic,
          timeframe: data.timeframe,
          geo_scope: data.geoScope,
          languages: data.languages.length > 0 ? data.languages : null,
          sources: data.sources,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Analysis failed');
      }

      // Handle SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete events in buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6);

            if (currentEvent && currentData) {
              try {
                const data = JSON.parse(currentData);

                if (currentEvent === 'progress') {
                  setProgress(data);
                } else if (currentEvent === 'complete') {
                  setResult(data);
                  setTotalTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
                  setProgress(null);
                } else if (currentEvent === 'error') {
                  throw new Error(data.message || 'Analysis failed');
                }
              } catch (parseError) {
                if (parseError instanceof SyntaxError) {
                  console.error('Failed to parse SSE data:', currentData);
                } else {
                  throw parseError;
                }
              }

              currentEvent = '';
              currentData = '';
            }
          }
        }
      }
    } catch (err) {
      // Don't show error if user aborted
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setProgress(null);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const currentStage = progress?.stage ? STAGE_LABELS[progress.stage] : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Internet Sentiment Aggregator</h1>
          <p className="text-muted-foreground text-sm">
            Analyze public sentiment on any topic with evidence-backed insights
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Input form */}
        <InputForm onSubmit={handleSubmit} isLoading={isLoading} />

        {/* Loading state with progress */}
        {isLoading && (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 p-4">
              {/* Header row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600 shrink-0" />
                  <div className="font-medium text-blue-900 dark:text-blue-100">
                    {currentStage?.label || 'Starting analysis...'}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-mono text-lg">
                    <Timer className="h-4 w-4" />
                    <span>{formatElapsedTime(elapsedTime)}</span>
                  </div>
                  <button
                    onClick={handleStop}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 rounded-md transition-colors"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    Stop
                  </button>
                </div>
              </div>

              {/* Progress stages */}
              <div className="mt-4 flex items-center justify-center gap-1 sm:gap-2">
                {Object.entries(STAGE_LABELS).map(([key, { icon }], index) => {
                  const stages = Object.keys(STAGE_LABELS);
                  const currentIndex = progress?.stage ? stages.indexOf(progress.stage) : -1;
                  const isComplete = currentIndex > index;
                  const isCurrent = progress?.stage === key;

                  return (
                    <div key={key} className="flex items-center">
                      <div
                        className={`
                          flex items-center justify-center w-8 h-8 rounded-full text-sm shrink-0
                          ${isComplete ? 'bg-green-500 text-white' : ''}
                          ${isCurrent ? 'bg-blue-500 text-white animate-pulse' : ''}
                          ${!isComplete && !isCurrent ? 'bg-gray-200 dark:bg-gray-700 text-gray-500' : ''}
                        `}
                      >
                        {isComplete ? <CheckCircle2 className="h-4 w-4" /> : icon}
                      </div>
                      {index < stages.length - 1 && (
                        <div
                          className={`w-4 sm:w-8 h-0.5 shrink-0 ${
                            isComplete ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-[300px]" />
              <Skeleton className="h-[300px]" />
            </div>
            <Skeleton className="h-[400px]" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Analysis Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {result && !isLoading && (
          <div className="space-y-6">
            {/* Query summary with time taken */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing results for: <strong className="text-foreground">{result.query.topic}</strong>
                {result.query.timeframe && (
                  <span className="ml-2">
                    ({new Date(result.query.timeframe.start).toLocaleDateString()} - {new Date(result.query.timeframe.end).toLocaleDateString()})
                  </span>
                )}
              </div>
              {totalTime !== null && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Completed in {formatElapsedTime(totalTime)}</span>
                </div>
              )}
            </div>

            {/* Mobile tabs / Desktop grid */}
            <div className="block md:hidden">
              <Tabs defaultValue="overview">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview" className="text-xs">
                    <BarChart3 className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="clusters" className="text-xs">
                    <MessageSquare className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="method" className="text-xs">
                    <Info className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-4">
                  <StanceChart data={result.stance_distribution} />
                </TabsContent>
                <TabsContent value="clusters" className="mt-4">
                  <ClusterExplorer clusters={result.clusters} />
                </TabsContent>
                <TabsContent value="method" className="mt-4">
                  <LimitationsPanel
                    sampling={result.sampling}
                    confidence={result.confidence}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Desktop layout */}
            <div className="hidden md:block space-y-6">
              {/* Stance chart and method */}
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <StanceChart data={result.stance_distribution} />
                </div>
                <div>
                  <LimitationsPanel
                    sampling={result.sampling}
                    confidence={result.confidence}
                  />
                </div>
              </div>

              {/* Clusters */}
              <ClusterExplorer clusters={result.clusters} />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !isLoading && !error && (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
              <BarChart3 className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Ready to Analyze</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Enter a topic, event, or current affair above to analyze public sentiment
              across the web. Results include stance distribution, opinion clusters,
              and evidence from multiple sources.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          <p>
            Internet Sentiment Aggregator - Analysis reflects online discourse only.
            Results may not represent general population views.
          </p>
        </div>
      </footer>
    </div>
  );
}
