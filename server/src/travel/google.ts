// Google source (SPEC §4.2.1, ARCH §5): Routes API route matrix (one call per evaluation) and routes with
// stops. Server only: the key comes from config and is never logged or sent to a phone.
import { ammanParts, offsetMs } from '../clock/amman.js';
import { pyRound } from '../engine/pyRound.js';
import type { LatLng, Us } from '../engine/types.js';
import type { Conditions } from './fixed.js';
import type { Cell, MatrixSpec, TravelProvider } from './provider.js';

const DAY_US = 86_400_000_000;
const wp = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
const secs = (d?: string) => Number((d ?? '0s').replace('s', ''));

/** Google only predicts traffic for future times: the next real date with the same Amman weekday and time. */
export function googleDeparture(demoUs: Us, realNowUs: Us): Us {
  const want = ammanParts(demoUs), now = ammanParts(realNowUs);
  for (let k = 0; k < 8; k++) {
    const localMs = Date.UTC(now.year, now.month - 1, now.day + k, want.hour, want.minute, want.second);
    const us = (localMs - offsetMs(localMs)) * 1000;
    if (ammanParts(us).weekday === want.weekday && us > realNowUs) return us;
  }
  return demoUs + 7 * DAY_US;   // unreachable: some day within a week matches
}

interface Element { originIndex?: number; destinationIndex?: number; distanceMeters?: number; duration?: string; staticDuration?: string; condition?: string }

/** Matrix element → cell. km rounded to 0.1 like the model's legs; a traffic delay is never negative. */
export function cellFrom(e: Element): Cell {
  const traffic = secs(e.duration), stat = secs(e.staticDuration);
  return { km: pyRound((e.distanceMeters ?? 0) / 1000, 1), minTraffic: traffic / 60, minFree: Math.min(stat, traffic) / 60 };
}

/** Google's encoded polyline format → points. */
export function decodePolyline(s: string): LatLng[] {
  const out: LatLng[] = [];
  let i = 0, lat = 0, lng = 0;
  const next = () => {
    let shift = 0, result = 0, b: number;
    do { b = s.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < s.length) {
    lat += next(); lng += next();
    out.push({ lat: pyRound(lat / 1e5, 5), lng: pyRound(lng / 1e5, 5) });
  }
  return out;
}

async function post<T>(url: string, key: string, fieldMask: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fieldMask }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Google ${new URL(url).pathname} ${r.status}`);   // no body: it can echo request details
  return (await r.json()) as T;
}

export function googleProvider(key: string, realNowUs: () => Us = () => Date.now() * 1000): TravelProvider {
  return {
    name: 'google',
    async getMatrix(points, departure, cond: Conditions = {}): Promise<MatrixSpec> {
      const when = new Date(googleDeparture(departure, realNowUs()) / 1000).toISOString();
      const els = await post<Element[]>('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', key,
        'originIndex,destinationIndex,distanceMeters,duration,staticDuration,condition', {
          origins: points.map((p) => ({ waypoint: wp(p) })), destinations: points.map((p) => ({ waypoint: wp(p) })),
          travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE', departureTime: when,
        });
      const cells: Cell[][] = points.map(() => points.map(() => ({ km: 0, minTraffic: 0, minFree: 0 })));
      for (const e of els) {
        const i = e.originIndex ?? 0, j = e.destinationIndex ?? 0;
        if (i !== j && e.condition === 'ROUTE_EXISTS') cells[i]![j] = cellFrom(e);
      }
      return { kind: 'cells', points, cells, cond };
    },
    async getRoute(points, departure) {
      const when = new Date(googleDeparture(departure, realNowUs()) / 1000).toISOString();
      const r = await post<{ routes?: { polyline?: { encodedPolyline?: string } }[] }>('https://routes.googleapis.com/directions/v2:computeRoutes', key,
        'routes.polyline.encodedPolyline', {
          origin: wp(points[0]!), destination: wp(points.at(-1)!), intermediates: points.slice(1, -1).map(wp),
          travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE', departureTime: when,
        });
      const enc = r.routes?.[0]?.polyline?.encodedPolyline;
      return enc ? decodePolyline(enc) : points;
    },
  };
}
