'use client';

interface Props {
  x: number;
  y: number;
  onCreateParty: () => void;
  onClose: () => void;
}

export default function MapContextMenu({ x, y, onCreateParty, onClose }: Props) {
  // Adjust so the button never overflows the right or bottom edge
  const left = Math.min(x, window.innerWidth - 150);
  const top = Math.min(y, window.innerHeight - 60);

  return (
    <div style={{ top, left }} className="fixed z-30">
      <button
        onClick={() => { onCreateParty(); onClose(); }}
        className="px-4 py-2 rounded-lg bg-gray-900/80 text-xs font-semibold text-white hover:bg-gray-900/90 whitespace-nowrap cursor-pointer shadow-lg"
      >
        Create fan zone
      </button>
    </div>
  );
}
