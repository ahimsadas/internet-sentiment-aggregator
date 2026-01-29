'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Info, BarChart3 } from 'lucide-react';

interface SamplingMetadata {
  sources_used: string[];
  n_raw: number;
  n_after_dedupe: number;
  n_analyzed: number;
  source_breakdown: Array<{
    source_type: string;
    count: number;
    percent: number;
  }>;
  domain_caps_applied: boolean;
}

interface Confidence {
  overall_score_0_1: number;
  limitations: string[];
  warnings: string[];
}

interface LimitationsPanelProps {
  sampling: SamplingMetadata;
  confidence: Confidence;
}

export function LimitationsPanel({ sampling, confidence }: LimitationsPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Info className="h-5 w-5" />
          Method & Limitations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warnings */}
        {confidence.warnings.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warnings</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {confidence.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm">{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Sampling stats */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Sampling Statistics
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{sampling.n_raw}</div>
              <div className="text-xs text-muted-foreground">Raw items collected</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{sampling.n_after_dedupe}</div>
              <div className="text-xs text-muted-foreground">After deduplication</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{sampling.n_analyzed}</div>
              <div className="text-xs text-muted-foreground">Items analyzed</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{sampling.sources_used.length}</div>
              <div className="text-xs text-muted-foreground">Sources used</div>
            </div>
          </div>

          {/* Source breakdown */}
          <div className="text-sm">
            <span className="text-muted-foreground">Sources:</span>
            <span className="ml-2">
              {sampling.sources_used.join(', ')}
            </span>
          </div>

          {/* Source distribution */}
          {sampling.source_breakdown.length > 0 && (
            <div className="space-y-2">
              {sampling.source_breakdown.map(src => (
                <div key={src.source_type} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span>{src.source_type}</span>
                      <span>{src.count} ({src.percent.toFixed(1)}%)</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60"
                        style={{ width: `${src.percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confidence */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Overall Confidence</h4>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  confidence.overall_score_0_1 >= 0.7
                    ? 'bg-green-500'
                    : confidence.overall_score_0_1 >= 0.4
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${confidence.overall_score_0_1 * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium">
              {(confidence.overall_score_0_1 * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Limitations */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Limitations</h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {confidence.limitations.map((limitation, idx) => (
              <li key={idx}>{limitation}</li>
            ))}
          </ul>
        </div>

        {/* Methodology note */}
        <div className="text-xs text-muted-foreground border-t pt-3 mt-3">
          <strong>Methodology:</strong> This analysis searches the web for content related to
          your topic, applies deduplication and filtering, then uses AI to identify opinion
          clusters and classify stances. Results reflect online discourse and may not represent
          general population views.
        </div>
      </CardContent>
    </Card>
  );
}
