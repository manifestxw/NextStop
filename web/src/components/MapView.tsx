// Google map (DESIGN §7, SPEC §3.14). Shows only what the view gives it: a rider gets their own pickup
// and destination; a driver gets every stop after accepting. No key or a failed load → the marks panel.
import { useEffect, useSyncExternalStore } from 'react';
import { APIProvider, Map, Marker, useApiLoadingStatus, useMap, APILoadingStatus } from '@vis.gl/react-google-maps';
import { MapPanel } from './ui.js';

export interface Mark { kind: 'pickup' | 'dest'; lat: number; lng: number; label: string; n?: number; me?: boolean }

export const MAPS_KEY = import.meta.env.VITE_GOOGLE_BROWSER_KEY as string | undefined;

// Google reports a bad key or a referrer that isn't allowed through window.gm_authFailure, after the
// script has loaded. Catch it ourselves so every map swaps to the marks panel instead of Google's error box.
let authFailed = false;
const listeners = new Set<() => void>();
const w = window as unknown as { gm_authFailure?: () => void };
const prevHook = w.gm_authFailure;
w.gm_authFailure = () => { prevHook?.(); authFailed = true; listeners.forEach((l) => l()); console.warn('Google Maps key rejected: showing the marks panel'); };
const useAuthFailed = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => authFailed);
const IRBID = { lat: 32.535, lng: 35.875 };

// Paper (riders) and Cockpit (drivers) map styles, DESIGN §7. POIs and transit off.
const base: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];
const PAPER: google.maps.MapTypeStyle[] = [...base,
  { elementType: 'geometry', stylers: [{ color: '#EDE9E1' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#666970' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F6F3EE' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#DCD8D0' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#CBD9E0' }] },
];
const COCKPIT: google.maps.MapTypeStyle[] = [...base,
  { elementType: 'geometry', stylers: [{ color: '#0D0F13' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6E737D' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0D0F13' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#232831' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2C323C' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#151A22' }] },
];

const token = (name: string) => getComputedStyle(document.body).getPropertyValue(name).trim();

/** Pickup = ring, destination = square (DESIGN §2.5). Your own pickup gets the accent halo; drivers see numbers. */
function iconFor(m: Mark): google.maps.Icon {
  const ink = token('--text-1') || '#15171C', card = token('--card') || '#FFFFFF', accent = token('--accent') || '#FF6A2B';
  let svg: string, size: number;
  if (m.kind === 'dest') {
    size = 18;
    svg = `<rect x="3" y="3" width="12" height="12" fill="${ink}" stroke="${card}" stroke-width="2"/>`;
  } else if (m.n !== undefined) {
    size = 28;
    svg = `<circle cx="14" cy="14" r="11.5" fill="${card}" stroke="${ink}" stroke-width="2.5"/>
      <text x="14" y="18.5" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="13" font-weight="700" fill="${ink}">${m.n}</text>`;
  } else {
    size = m.me ? 34 : 20;
    const c = size / 2;
    svg = `${m.me ? `<circle cx="${c}" cy="${c}" r="15" fill="${accent}" fill-opacity="0.35"/>` : ''}
      <circle cx="${c}" cy="${c}" r="7" fill="${card}" stroke="${ink}" stroke-width="3"/>`;
  }
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${svg}</svg>`)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

/** Keep every mark in view (one mark: centre on it). */
function FitBounds({ marks }: { marks: Mark[] }) {
  const map = useMap();
  const key = marks.map((m) => `${m.lat},${m.lng}`).join('|');
  useEffect(() => {
    if (!map || marks.length === 0) return;
    if (marks.length === 1) { map.setCenter(marks[0]!); map.setZoom(15); return; }
    const b = new google.maps.LatLngBounds();
    marks.forEach((m) => b.extend(m));
    map.fitBounds(b, 56);
  }, [map, key]);   // re-fit only when the positions change, not on every render
  return null;
}

function Inner({ marks, dark, fallback }: { marks: Mark[]; dark?: boolean; fallback: React.ReactNode }) {
  const status = useApiLoadingStatus();
  const rejected = useAuthFailed();
  if (rejected || status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) return <>{fallback}</>;
  return (
    <Map className="map map--live" defaultCenter={IRBID} defaultZoom={13} styles={dark ? COCKPIT : PAPER}
      disableDefaultUI gestureHandling="greedy" clickableIcons={false} keyboardShortcuts={false}>
      {status === APILoadingStatus.LOADED && marks.map((m, i) => (
        <Marker key={`${m.kind}-${i}-${m.lat}`} position={m} icon={iconFor(m)} title={m.label} zIndex={m.me ? 10 : m.n ?? 1} />
      ))}
      <FitBounds marks={marks} />
    </Map>
  );
}

export function MapView({ marks, dark }: { marks: Mark[]; dark?: boolean }) {
  const pickup = marks.find((m) => m.kind === 'pickup' && (m.me || m.n === 1)) ?? marks.find((m) => m.kind === 'pickup');
  const dest = marks.find((m) => m.kind === 'dest');
  const fallback = <MapPanel pickup={pickup?.label} dest={dest?.label} pulse={pickup?.me} />;
  if (!MAPS_KEY) return fallback;
  return <Inner marks={marks} dark={dark} fallback={fallback} />;
}

/** One provider for the whole app (main.tsx): one script load and one auth-failure callback. */
export function MapsProvider({ children }: { children: React.ReactNode }) {
  return MAPS_KEY ? <APIProvider apiKey={MAPS_KEY}>{children}</APIProvider> : <>{children}</>;
}
