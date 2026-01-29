'use client';

import { ExternalLink, Calendar, Globe } from 'lucide-react';

interface Evidence {
  url: string;
  title: string | null;
  source_name: string;
  source_type: string;
  published_at: string | null;
  excerpt: string;
}

interface EvidenceCardProps {
  evidence: Evidence;
}

export function EvidenceCard({ evidence }: EvidenceCardProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return null;
    }
  };

  const getSourceIcon = () => {
    switch (evidence.source_type) {
      case 'community':
        return '💬';
      case 'open_web':
        return '🌐';
      case 'social':
        return '📱';
      case 'scholarly':
        return '📚';
      default:
        return '📄';
    }
  };

  return (
    <div className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{getSourceIcon()}</span>
          <span className="font-medium">{evidence.source_name}</span>
          {evidence.published_at && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(evidence.published_at)}
              </span>
            </>
          )}
        </div>
        <a
          href={evidence.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {/* Title if available */}
      {evidence.title && (
        <a
          href={evidence.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium hover:underline line-clamp-1 block mb-1"
        >
          {evidence.title}
        </a>
      )}

      {/* Excerpt */}
      <blockquote className="text-sm text-muted-foreground border-l-2 border-muted pl-3 italic">
        "{evidence.excerpt}"
      </blockquote>
    </div>
  );
}
