// The trip a rider is setting up (client-only draft, nothing is decided here) + small UI memory.
import { create } from 'zustand';
import type { Category } from '@nextstop/shared';

interface Draft {
  pickupKey: string | null; destKey: string | null; time: string;     // "08:00"
  category: Category; sameGenderOnly: boolean | null;                 // null = use the account's remembered toggle
  dismissed: string[];                                                // ride ids whose summary/cancel screen was closed
  chatSeen: Record<string, number>;                                   // ride id → last seen chat seq (unread is client-side)
  custom: Record<string, GooglePlace>;                                // 'g:<placeId>' → a place picked from search (P1)
  set(p: Partial<Omit<Draft, 'set' | 'dismiss' | 'seenChat' | 'addCustom'>>): void;
  addCustom(p: GooglePlace): string;
  dismiss(rideId: string): void;
  seenChat(rideId: string, seq: number): void;
}

export const useDraft = create<Draft>((set) => ({
  pickupKey: null, destKey: 'JUST', time: '08:00', category: 'economy', sameGenderOnly: null,
  dismissed: [], chatSeen: {}, custom: {},
  set: (p) => set(p),
  addCustom: (p) => { const key = `g:${p.placeId}`; set((s) => ({ custom: { ...s.custom, [key]: p } })); return key; },
  dismiss: (id) => set((s) => ({ dismissed: [...s.dismissed, id] })),
  seenChat: (id, seq) => set((s) => ({ chatSeen: { ...s.chatSeen, [id]: Math.max(seq, s.chatSeen[id] ?? 0) } })),
}));

/** Seed places for the quick-pick chips (SPEC §2.6). Keys only: the server resolves names and areas. */
export const PLACES = [
  { key: 'CC', name: 'Irbid City Center' }, { key: 'US', name: 'University Street' }, { key: 'HS', name: 'Al-Hashmi Street' },
  { key: 'YU', name: 'Yarmouk University' }, { key: 'AM', name: 'Arabella Mall' }, { key: 'JUST', name: 'JUST' },
  { key: 'QAIA', name: 'Queen Alia Airport' },
];
export interface GooglePlace { placeId: string; name: string; lat: number; lng: number }
export const placeName = (key: string | null) =>
  PLACES.find((p) => p.key === key)?.name ?? (key && useDraft.getState().custom[key]?.name) ?? 'Choose a place';
/** A draft key → what the server accepts: a seed key, or the Google place itself. */
export const placeRef = (key: string) => {
  const g = useDraft.getState().custom[key];
  return g ? { placeId: g.placeId, name: g.name, lat: g.lat, lng: g.lng } : { key };
};
