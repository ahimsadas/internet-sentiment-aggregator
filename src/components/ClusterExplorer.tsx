'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { EvidenceCard } from './EvidenceCard';

interface Evidence {
  url: string;
  title: string | null;
  source_name: string;
  source_type: string;
  published_at: string | null;
  excerpt: string;
}

interface Cluster {
  id: string;
  label: string;
  stance: 'support' | 'oppose' | 'mixed' | 'unclear';
  aspect_tags: string[];
  share: {
    count: number;
    percent: number;
  };
  breakdown: {
    by_source_type: Array<{ source_type: string; count: number }>;
    by_language: Array<{ language: string; count: number }>;
  };
  evidence: Evidence[];
  notes: string;
  confidence: {
    score_0_1: number;
    reasons: string[];
  };
}

interface ClusterExplorerProps {
  clusters: Cluster[];
  title?: string;
}

const STANCE_COLORS: Record<string, string> = {
  support: 'bg-green-500/10 text-green-600 border-green-500/20',
  oppose: 'bg-red-500/10 text-red-600 border-red-500/20',
  mixed: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  unclear: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
};

const STANCE_LABELS: Record<string, string> = {
  support: 'Supporting',
  oppose: 'Opposing',
  mixed: 'Mixed',
  unclear: 'Unclear',
};

export function ClusterExplorer({
  clusters,
  title = 'Opinion Clusters',
}: ClusterExplorerProps) {
  if (clusters.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No opinion clusters found
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{title}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {clusters.length} clusters found
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {clusters.map((cluster, index) => (
            <AccordionItem key={cluster.id} value={cluster.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-left w-full pr-4">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={STANCE_COLORS[cluster.stance]}
                    >
                      {STANCE_LABELS[cluster.stance]}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {cluster.share.percent.toFixed(1)}% ({cluster.share.count} items)
                    </span>
                  </div>
                  <span className="font-medium flex-1 text-left">
                    {cluster.label}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  {/* Cluster notes */}
                  <p className="text-sm text-muted-foreground">
                    {cluster.notes}
                  </p>

                  {/* Aspect tags */}
                  {cluster.aspect_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {cluster.aspect_tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Source breakdown */}
                  {cluster.breakdown.by_source_type.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Sources:</span>
                      {cluster.breakdown.by_source_type.map(src => (
                        <span key={src.source_type}>
                          {src.source_type} ({src.count})
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Evidence */}
                  {cluster.evidence.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Evidence</h4>
                      <div className="space-y-2">
                        {cluster.evidence.map((ev, evIdx) => (
                          <EvidenceCard key={evIdx} evidence={ev} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confidence indicator */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                    <span>Confidence:</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[100px]">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${cluster.confidence.score_0_1 * 100}%` }}
                      />
                    </div>
                    <span>{(cluster.confidence.score_0_1 * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
