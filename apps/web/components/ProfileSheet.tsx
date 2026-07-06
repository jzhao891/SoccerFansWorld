'use client';

import { useMapStore } from '@/store/mapStore';
import { signOut } from '@/lib/auth';

// Small card anchored under the avatar: name, email, sign out. Reads currentUser from the store.
export default function ProfileSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const currentUser = useMapStore((s) => s.currentUser);

  if (!isOpen || !currentUser) return null;

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      onClose();
    }
  }

  const label = (currentUser.displayName || currentUser.email || '?').trim().slice(0, 1).toUpperCase();

  return (
    <>
      {/* click-catcher to dismiss */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-16 right-3 z-50 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden text-gray-600">
            {currentUser.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentUser.photoURL} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-semibold">{label}</span>
            )}
          </div>
          <div className="min-w-0">
            {currentUser.displayName && (
              <p className="text-sm font-semibold text-gray-900 truncate">{currentUser.displayName}</p>
            )}
            <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
        >
          Sign out
        </button>
      </div>
    </>
  );
}
