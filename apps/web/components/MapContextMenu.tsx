'use client';

interface Props {
  x: number;
  y: number;
  onCreateParty: () => void;
  onClose: () => void;
}

export default function MapContextMenu({ x, y, onCreateParty, onClose }: Props) {
  // Adjust so menu never overflows the right or bottom edge
  const left = Math.min(x, window.innerWidth - 180);
  const top = Math.min(y, window.innerHeight - 80);

  return (
    <div
      style={{ top, left }}
      className="fixed z-30 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden w-44"
    >
      <button
        onClick={() => { onCreateParty(); onClose(); }}
        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
      >
        <span>🎉</span>
        <span>Create watch party</span>
      </button>
    </div>
  );
}
