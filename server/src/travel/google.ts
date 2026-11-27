// Google source (SPEC §4.2.1, ARCH §5): Routes API route matrix (one call per evaluation) and routes with
// stops. Server only: the key comes from config and is never logged or sent to a phone.
import { ammanParts, offsetMs } from '../clock/amman.js';
import { pyRound } from '../engine/pyRound.js';
import type { LatLng, Us } from '../engine/types.js';
import type { Conditions } from './fixed.js';
import type { Cell, MatrixSpec, TravelProvider } from './provider.js';
import type { AddressPart } from './places.js';

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

export interface FoundPlace { placeId: string; name: string; address: string; lat: number; lng: number; parts: AddressPart[] }
interface GPlace { id: string; displayName?: { text?: string }; shortFormattedAddress?: string; formattedAddress?: string;
  location: { latitude: number; longitude: number }; addressComponents?: { longText: string; types: string[] }[] }
const PLACE_FIELDS = 'id,displayName,shortFormattedAddress,formattedAddress,location,addressComponents';
const inJordan = (p: GPlace) => p.location.latitude > 29.1 && p.location.latitude < 33.4 && p.location.longitude > 34.9 && p.location.longitude < 39.4;
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3},?\s*/;   // "GVMG+J68, " means nothing to riders
const found = (p: GPlace): FoundPlace => ({ placeId: p.id, name: p.displayName?.text ?? 'Place', address: (p.shortFormattedAddress ?? p.formattedAddress ?? '').replace(PLUS_CODE, ''),
  lat: p.location.latitude, lng: p.location.longitude, parts: (p.addressComponents ?? []).map((c) => ({ text: c.longText, types: c.types })) });

/** Places Text Search (P1), Jordan only, biased to Irbid. Server only. */
export async function searchPlaces(key: string, q: string): Promise<FoundPlace[]> {
  const r = await post<{ places?: GPlace[] }>('https://places.googleapis.com/v1/places:searchText', key, PLACE_FIELDS.replace(/(^|,)/g, '$1places.'), {
    textQuery: q, regionCode: 'JO', languageCode: 'en', maxResultCount: 8,
    locationBias: { circle: { center: { latitude: 32.55, longitude: 35.86 }, radius: 30000 } },
  });
  return (r.places ?? []).filter(inJordan).map(found);
}

interface GeoResult { formatted_address: string; types: string[]; address_components?: { long_name: string; types: string[] }[] }
const STREET_TYPES = ['street_address', 'premise', 'subpremise', 'route', 'intersection'];

/** Reverse-geocode results → a pin name like "Wasfi Al-Tal St, Irbid" (no plus code, postcode or country), or null. */
export function streetFrom(results: GeoResult[]): { name: string; parts: AddressPart[] } | null {
  const r = results.find((x) => x.types.some((t) => STREET_TYPES.includes(t)));
  if (!r) return null;
  const name = r.formatted_address.replace(PLUS_CODE, '').replace(/,?\s*Jordan$/, '').replace(/\s+\d{5}\b/g, '').trim();
  return name ? { name, parts: (r.address_components ?? []).map((c) => ({ text: c.long_name, types: c.types })) } : null;
}

/** The street address at a pin (Geocoding API). Server only; the key is in the URL, so the URL is never logged. */
export async function reverseGeocode(key: string, p: LatLng): Promise<{ name: string; parts: AddressPart[] } | null> {
  const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${p.lat},${p.lng}&language=en&region=jo&key=${encodeURIComponent(key)}`);
  if (!r.ok) throw new Error(`Google geocode ${r.status}`);
  const j = (await r.json()) as { status: string; results?: GeoResult[] };
  if (j.status !== 'OK' && j.status !== 'ZERO_RESULTS') throw new Error(`Google geocode ${j.status}`);
  return streetFrom(j.results ?? []);
}

/** The closest named place to a pin (Places Nearby, 250 m), for its name and neighbourhood. Server only. */
export async function nearestPlace(key: string, p: LatLng): Promise<FoundPlace | null> {
  const r = await post<{ places?: GPlace[] }>('https://places.googleapis.com/v1/places:searchNearby', key, PLACE_FIELDS.replace(/(^|,)/g, '$1places.'), {
    maxResultCount: 1, rankPreference: 'DISTANCE', languageCode: 'en', regionCode: 'JO',
    locationRestriction: { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: 250 } },
  });
  const g = r.places?.[0];
  return g && inJordan(g) ? found(g) : null;
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
