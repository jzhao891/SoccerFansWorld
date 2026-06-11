'use client';

import { useState, useRef, useEffect } from 'react';
import { useMapStore } from '@/store/mapStore';
import { WORLD_CUP_2026_TEAMS } from '@sfw/shared';

interface GeocodeSuggestion {
  id: string;
  place_name: string;
  center: [number, number];
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

export default function MapTopBar() {
  // team filter
  const selectedTeam = useMapStore((s) => s.selectedTeam);
  const setSelectedTeam = useMapStore((s) => s.setSelectedTeam);
  const [filterOpen, setFilterOpen] = useState(false);
  const [teamQuery, setTeamQuery] = useState('');

  // search
  const setFlyToTarget = useMapStore((s) => s.setFlyToTarget);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // geocode debounce
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      setSearchOpen(false);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${MAPBOX_TOKEN}&types=place,neighborhood,address,locality&limit=5`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        setSuggestions(data.features ?? []);
        setSearchOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  // close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectTeam(team: string | null) {
    setSelectedTeam(team);
    setFilterOpen(false);
    setTeamQuery('');
  }

  function selectSuggestion(s: GeocodeSuggestion) {
    setFlyToTarget({ lng: s.center[0], lat: s.center[1], zoom: 13 });
    setSearchQuery(s.place_name);
    setSearchOpen(false);
  }

  const filteredTeams = teamQuery.trim()
    ? WORLD_CUP_2026_TEAMS.filter((t) => t.toLowerCase().includes(teamQuery.toLowerCase()))
    : WORLD_CUP_2026_TEAMS;

  return (
    <div ref={containerRef} className="absolute top-3 left-3 right-3 z-10 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[480px]">
      {/* top row: filter button + search input */}
      <div className="flex items-center gap-2">
        {/* filter pill */}
        <button
          onClick={() => { setFilterOpen((v) => !v); setSearchOpen(false); }}
          style={{
            backgroundColor: selectedTeam ? '#111827' : '#fff',
            color: selectedTeam ? '#fff' : '#374151',
          }}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border border-gray-200 shadow-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
          </svg>
          <span className="max-w-[100px] truncate">{selectedTeam ?? 'All teams'}</span>
          {selectedTeam && (
            <span
              onClick={(e) => { e.stopPropagation(); selectTeam(null); }}
              className="opacity-70 ml-0.5"
            >✕</span>
          )}
        </button>

        {/* search input */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search location…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setFilterOpen(false); }}
            onFocus={() => suggestions.length > 0 && setSearchOpen(true)}
            className="w-full pl-8 pr-8 py-2 rounded-full text-sm bg-white border border-gray-200 shadow-md outline-none focus:border-gray-400 text-gray-800 placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSuggestions([]); setSearchOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* team filter dropdown */}
      {filterOpen && (
        <div className="mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="px-3 pt-3 pb-2 border-b border-gray-100">
            <input
              type="text"
              placeholder="Search team…"
              value={teamQuery}
              onChange={(e) => setTeamQuery(e.target.value)}
              autoFocus
              className="w-full text-sm px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-400 text-gray-800 placeholder-gray-400"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {!teamQuery && (
              <li>
                <button
                  onClick={() => selectTeam(null)}
                  style={{ fontWeight: selectedTeam === null ? 600 : 400, backgroundColor: selectedTeam === null ? '#F3F4F6' : 'transparent' }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  All venues
                </button>
              </li>
            )}
            {filteredTeams.map((team) => (
              <li key={team}>
                <button
                  onClick={() => selectTeam(team)}
                  style={{ fontWeight: selectedTeam === team ? 600 : 400, backgroundColor: selectedTeam === team ? '#F3F4F6' : 'transparent' }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {team}
                </button>
              </li>
            ))}
            {filteredTeams.length === 0 && (
              <li className="px-4 py-3 text-sm text-gray-400">No teams found</li>
            )}
          </ul>
        </div>
      )}

      {/* geocode suggestions dropdown */}
      {searchOpen && suggestions.length > 0 && (
        <div className="mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <ul>
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => selectSuggestion(s)}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="flex-shrink-0 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="truncate">{s.place_name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
