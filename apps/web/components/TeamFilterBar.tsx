'use client';

import { useState, useRef, useEffect } from 'react';
import { useMapStore } from '@/store/mapStore';
import { WORLD_CUP_2026_TEAMS } from '@sfw/shared';

export default function TeamFilterBar() {
  const selectedTeam = useMapStore((s) => s.selectedTeam);
  const setSelectedTeam = useMapStore((s) => s.setSelectedTeam);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? WORLD_CUP_2026_TEAMS.filter((t) =>
        t.toLowerCase().includes(query.toLowerCase()),
      )
    : WORLD_CUP_2026_TEAMS;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function selectTeam(team: string | null) {
    setSelectedTeam(team);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={panelRef} className="absolute top-3 left-3 z-10">
      {/* trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          backgroundColor: selectedTeam ? '#111827' : '#fff',
          color: selectedTeam ? '#fff' : '#374151',
        }}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border border-gray-200 shadow-md whitespace-nowrap"
      >
        <svg
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
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="11" y1="18" x2="13" y2="18" />
        </svg>
        {selectedTeam ?? 'All teams'}
        {selectedTeam && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              selectTeam(null);
            }}
            style={{ marginLeft: 2, opacity: 0.7 }}
          >
            ✕
          </span>
        )}
      </button>

      {/* dropdown panel */}
      {open && (
        <div className="mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* search */}
          <div className="px-3 pt-3 pb-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search team…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-400 text-gray-800 placeholder-gray-400"
            />
          </div>

          {/* list */}
          <ul className="max-h-72 overflow-y-auto py-1">
            {!query && (
              <li>
                <button
                  onClick={() => selectTeam(null)}
                  style={{
                    fontWeight: selectedTeam === null ? 600 : 400,
                    backgroundColor: selectedTeam === null ? '#F3F4F6' : 'transparent',
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  All venues
                </button>
              </li>
            )}
            {filtered.map((team) => (
              <li key={team}>
                <button
                  onClick={() => selectTeam(team)}
                  style={{
                    fontWeight: selectedTeam === team ? 600 : 400,
                    backgroundColor: selectedTeam === team ? '#F3F4F6' : 'transparent',
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {team}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-gray-400">No teams found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
