'use client';

import { useMapStore } from '@/store/mapStore';

function initial(name: string | null, email: string | null): string {
  return (name || email || '?').trim().slice(0, 1).toUpperCase();
}

// Always-visible top-right avatar. Signed out → person icon → opens AuthSheet.
// Signed in → photo or initial → opens ProfileSheet. Reads currentUser from the store, so it
// reacts to sign-in/out automatically.
export default function ProfileAvatar({
  onRequestAuth,
  onOpenProfile,
}: {
  onRequestAuth: () => void;
  onOpenProfile: () => void;
}) {
  const currentUser = useMapStore((s) => s.currentUser);

  return (
    <button
      onClick={currentUser ? onOpenProfile : onRequestAuth}
      aria-label={currentUser ? 'Open profile' : 'Sign in'}
      className="absolute top-3 right-3 z-10 h-10 w-10 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center overflow-hidden text-gray-600 hover:bg-gray-50"
    >
      {currentUser?.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUser.photoURL} alt="" className="h-full w-full object-cover" />
      ) : currentUser ? (
        <span className="text-sm font-semibold text-gray-700">
          {initial(currentUser.displayName, currentUser.email)}
        </span>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )}
    </button>
  );
}
