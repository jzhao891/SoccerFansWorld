'use client';

import { useState, useRef, useEffect } from 'react';
import { useMapStore } from '@/store/mapStore';

interface GeocodeSuggestion {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

export default function SearchBar() {
  const setFlyToTarget = useMapStore((s) => s.setFlyToTarget);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&types=place,neighborhood,address,locality&limit=5`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        setSuggestions(data.features ?? []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(suggestion: GeocodeSuggestion) {
    setFlyToTarget({ lng: suggestion.center[0], lat: suggestion.center[1], zoom: 13 });
    setQuery(suggestion.place_name);
    setOpen(false);
  }

  return (
    <div
      ref={containerRef}
      className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-72"
    >
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search location…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          className="w-full pl-8 pr-4 py-2 rounded-full text-sm bg-white border border-gray-200 shadow-md outline-none focus:border-gray-400 text-gray-800 placeholder-gray-400"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setSuggestions([]); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => handleSelect(s)}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="flex-shrink-0 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                <span className="truncate">{s.place_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
