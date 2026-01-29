'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Country {
  value: string;
  label: string;
}

interface CountrySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  countries: Country[];
  disabled?: boolean;
  placeholder?: string;
}

// Convert country code to flag emoji
function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode === 'global') return '🌍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 0x1F1E6 - 65 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function CountrySelect({
  value,
  onValueChange,
  countries,
  disabled = false,
  placeholder = 'Select region...',
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Filter countries based on search
  const filteredCountries = countries.filter(country =>
    country.label.toLowerCase().includes(search.toLowerCase())
  );

  // Get display label for current value
  const getDisplayLabel = () => {
    if (value === 'global') return `🌍 Global`;
    const country = countries.find(c => c.value === value);
    if (country) return `${getFlagEmoji(country.value)} ${country.label}`;
    return placeholder;
  };

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "ring-1 ring-ring"
        )}
      >
        <span className="truncate">{getDisplayLabel()}</span>
        <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          {/* Search input */}
          <div className="flex items-center border-b px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground mr-2" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search countries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Options list */}
          <div className="max-h-[250px] overflow-y-auto p-1">
            {/* Global option */}
            <button
              type="button"
              onClick={() => handleSelect('global')}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer",
                "hover:bg-accent hover:text-accent-foreground",
                value === 'global' && "bg-accent"
              )}
            >
              <span>🌍</span>
              <span className="flex-1 text-left">Global</span>
              {value === 'global' && <Check className="h-4 w-4" />}
            </button>

            {/* Country options */}
            {filteredCountries.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No countries found
              </div>
            ) : (
              filteredCountries.map(country => (
                <button
                  key={country.value}
                  type="button"
                  onClick={() => handleSelect(country.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer",
                    "hover:bg-accent hover:text-accent-foreground",
                    value === country.value && "bg-accent"
                  )}
                >
                  <span>{getFlagEmoji(country.value)}</span>
                  <span className="flex-1 text-left">{country.label}</span>
                  {value === country.value && <Check className="h-4 w-4" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
