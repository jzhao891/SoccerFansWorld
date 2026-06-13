import type { Firestore } from 'firebase/firestore';

let instance: Firestore | null = null;

export function setDb(db: Firestore): void {
  instance = db;
}

export function getDb(): Firestore {
  if (!instance) throw new Error('Firestore not initialized. Call setDb(db) before using shared hooks.');
  return instance;
}
