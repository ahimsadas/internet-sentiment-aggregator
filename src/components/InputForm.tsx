'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CountrySelect } from '@/components/ui/country-select';
import { Search } from 'lucide-react';

export interface AnalysisFormData {
  topic: string;
  timeframe: string;
  geoScope: string | null;
  languages: string[];
  sources: string[];
}

interface InputFormProps {
  onSubmit: (data: AnalysisFormData) => void;
  isLoading: boolean;
}

interface Country {
  value: string;
  label: string;
}

const TIMEFRAME_OPTIONS = [
  { value: 'last_24h', label: 'Last 24 hours' },
  { value: 'last_week', label: 'Last 7 days' },
  { value: 'last_month', label: 'Last 30 days' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'last_year', label: 'Last year' },
];

export function InputForm({ onSubmit, isLoading }: InputFormProps) {
  const [topic, setTopic] = useState('');
  const [timeframe, setTimeframe] = useState('last_week');
  const [geoScope, setGeoScope] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);

  useEffect(() => {
    // Fetch countries from REST Countries API
    fetch('https://restcountries.com/v3.1/all?fields=name,cca2')
      .then(res => res.json())
      .then((data: Array<{ name: { common: string }; cca2: string }>) => {
        const sorted = data
          .map(c => ({ value: c.cca2.toLowerCase(), label: c.name.common }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setCountries(sorted);
      })
      .catch(err => {
        console.error('Failed to fetch countries:', err);
      });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    onSubmit({
      topic: topic.trim(),
      timeframe,
      geoScope,
      languages: [],
      sources: ['openrouter_web_search'],
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <Search className="h-5 w-5" />
          Analyze Topic
        </CardTitle>
        <CardDescription>
          Enter a topic to analyze public sentiment across the web
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Main topic input */}
          <div className="space-y-2">
            <label htmlFor="topic" className="text-sm font-medium">
              Topic / Event / Current Affair
            </label>
            <Input
              id="topic"
              placeholder="e.g., AI regulation, climate policy, remote work trends..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isLoading}
              className="text-base"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[150px]">
              <label className="text-sm font-medium mb-1 block">Timeframe</label>
              <Select value={timeframe} onValueChange={setTimeframe} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAME_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="text-sm font-medium mb-1 block">Region</label>
              <CountrySelect
                value={geoScope || 'global'}
                onValueChange={(v) => setGeoScope(v === 'global' ? null : v)}
                countries={countries}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            disabled={!topic.trim() || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <span className="animate-pulse">Analyzing...</span>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Analyze Sentiment
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
