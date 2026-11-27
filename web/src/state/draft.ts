// The trip a rider is setting up (client-only draft, nothing is decided here) + small UI memory.
import { create } from 'zustand';
import type { Category } from '@nextstop/shared';
import type { PlaceResult } from '../net/api.js';

const MEM_KEY = 'ridesync.places';
const readMem = (): { custom: Record<string, PlaceResult>; recent: string[] } => {
  try { const m = JSON.parse(localStorage.getItem(MEM_KEY) ?? 'null'); if (m?.custom && Array.isArray(m.recent)) return m; } catch { /* blocked */ }
  return { custom: {}, recent: [] };
};
const saveMem = (custom: Record<string, PlaceResult>, recent: string[]) => {
  try { localStorage.setItem(MEM_KEY, JSON.stringify({ custom: Object.fromEntries(recent.filter((k) => custom[k]).map((k) => [k, custom[k]])), recent })); } catch { /* blocked */ }
};

interface Draft {
  pickupKey: string | null; destKey: string | null; time: string;     // "08:00"
  category: Category; sameGenderOnly: boolean | null;                 // null = use the account's remembered toggle
  dismissed: string[];                                                // ride ids whose summary/cancel screen was closed
  chatSeen: Record<string, number>;                                   // ride id → last seen chat seq (unread is client-side)
  custom: Record<string, PlaceResult>;                                // 'g:<placeId>' → a searched or pinned place (P1)
  recent: string[];                                                   // last 5 places used (keys), this device only
  set(p: Partial<Pick<Draft, 'pickupKey' | 'destKey' | 'time' | 'category' | 'sameGenderOnly'>>): void;
  /** A picked place → its draft key (seed key, or 'g:<placeId>'), remembered as recent. */
  use(p: PlaceResult): string;
  dismiss(rideId: string): void;
  seenChat(rideId: string, seq: number): void;
}

export const useDraft = create<Draft>((set) => ({
  pickupKey: null, destKey: 'JUST', time: '08:00', category: 'economy', sameGenderOnly: null,
  dismissed: [], chatSeen: {}, ...readMem(),
  set: (p) => set(p),
  use: (p) => {
    const key = p.key ?? `g:${p.placeId}`;
    set((s) => {
      const custom = p.key ? s.custom : { ...s.custom, [key]: p };
      const recent = [key, ...s.recent.filter((k) => k !== key)].slice(0, 5);
      saveMem(custom, recent);
      return { custom, recent };
    });
    return key;
  },
  dismiss: (id) => set((s) => ({ dismissed: [...s.dismissed, id] })),
  seenChat: (id, seq) => set((s) => ({ chatSeen: { ...s.chatSeen, [id]: Math.max(seq, s.chatSeen[id] ?? 0) } })),
}));

/** Seed places for the quick picks (SPEC §2.6). Keys only: the server resolves names and areas. */
export const PLACES = [
  { key: 'CC', name: 'Irbid City Center', area: 'City Center area' }, { key: 'US', name: 'University Street', area: 'University Street area' },
  { key: 'HS', name: 'Al-Hashmi Street', area: 'Al-Hashmi area' }, { key: 'YU', name: 'Yarmouk University', area: 'Yarmouk area' },
  { key: 'AM', name: 'Arabella Mall', area: 'Arabella area' }, { key: 'JUST', name: 'JUST', area: 'JUST' },
  { key: 'QAIA', name: 'Queen Alia Airport', area: 'Queen Alia Airport' },
];
export const placeName = (key: string | null) =>
  PLACES.find((p) => p.key === key)?.name ?? (key && useDraft.getState().custom[key]?.name) ?? 'Choose a place';
export const placeArea = (key: string | null) => PLACES.find((p) => p.key === key)?.area ?? (key && useDraft.getState().custom[key]?.area) ?? '';
/** A draft key → what the server accepts: a seed key, or the Google / pinned place itself. */
export const placeRef = (key: string) => {
  const g = useDraft.getState().custom[key];
  return g ? { placeId: g.placeId, name: g.name, lat: g.lat, lng: g.lng } : { key };
};
