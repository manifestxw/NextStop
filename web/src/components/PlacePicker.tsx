// Place picker (P1): one full-screen sheet for every place choice. Search (server-proxied Google Places,
// falling back to the seed places), recent places, quick picks, and "Choose on map" with a centre pin.
// Nothing is decided here: the server names a pin and decides the area other riders see.
import { useEffect, useRef, useState } from 'react';
import { Map, useApiLoadingStatus, APILoadingStatus } from '@vis.gl/react-google-maps';
import { api, type PlaceResult } from '../net/api.js';
import { PLACES, useDraft } from '../state/draft.js';
import { Icon } from './Icon.js';
import { IRBID, MAPS_KEY, PAPER } from './MapView.js';
import { Button, ErrorNote, Ring, Square } from './ui.js';

export interface PickerProps {
  title: string; kind: 'pickup' | 'dest';
  onPick: (key: string) => void; onClose: () => void;
  exclude?: string[];            // draft keys that can't be chosen (e.g. the other end of the trip)
  quick?: string[];              // seed keys offered as quick picks (default: all)
  near?: { lat: number; lng: number };
}

const seedResult = (k: string): PlaceResult => {
  const p = PLACES.find((x) => x.key === k)!;
  return { key: p.key, placeId: `seed:${p.key}`, name: p.name, address: p.area, area: p.area, lat: 0, lng: 0 };
};

export function PlacePicker({ title, kind, onPick, onClose, exclude = [], quick, near }: PickerProps) {
  const d = useDraft();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [onMap, setOnMap] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) { setResults(null); setSearching(false); return; }
    let live = true;
    setSearching(true);
    const t = setTimeout(() => {
      api.places(text).then((r) => { if (live) setResults(r); }).catch(() => { if (live) setResults([]); }).finally(() => { if (live) setSearching(false); });
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  const pick = (p: PlaceResult) => onPick(d.use(p));
  const allowed = (key: string) => !exclude.includes(key);
  const quickKeys = (quick ?? PLACES.map((p) => p.key)).filter(allowed);
  const recent = d.recent.filter(allowed).map((k) => (PLACES.some((p) => p.key === k) ? seedResult(k) : d.custom[k])).filter(Boolean) as PlaceResult[];
  const Mark = kind === 'pickup' ? Ring : Square;

  if (onMap) return <PinMap title={title} kind={kind} near={near} onBack={() => setOnMap(false)} onPick={pick} />;

  return (
    <div className="picker" role="dialog" aria-label={title}>
      <header className="picker-head">
        <button type="button" className="iconbtn" aria-label="Back" onClick={onClose}><Icon name="back" /></button>
        <div className="picker-search">
          <Icon name="search" size={18} />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={kind === 'pickup' ? 'Search for a pickup' : 'Search for a place'}
            aria-label={title} enterKeyHint="search" autoComplete="off" />
          {q && <button type="button" className="iconbtn iconbtn--sm" aria-label="Clear" onClick={() => setQ('')}><Icon name="close" size={16} /></button>}
        </div>
      </header>
      <div className="picker-body">
        <span className="t-eyebrow text-2">{title}</span>
        {MAPS_KEY && (
          <button type="button" className="picker-row" onClick={() => setOnMap(true)}>
            <span className="picker-icon"><Icon name="pin" size={18} /></span>
            <span className="grow"><span className="t-body-l" style={{ fontWeight: 600 }}>Choose on map</span>
              <span className="t-caption text-2" style={{ display: 'block' }}>Drop a pin at the exact spot</span></span>
            <Icon name="next" size={16} />
          </button>
        )}
        {results ? (
          <>
            {results.filter((r) => allowed(r.key ?? `g:${r.placeId}`)).map((r) => <Row key={r.placeId} p={r} mark={<Mark />} onClick={() => pick(r)} />)}
            {!searching && results.length === 0 && <p className="t-body text-2" style={{ padding: '12px 0' }}>No places found. Try another name, or choose on the map.</p>}
            {searching && <p className="t-caption text-2" style={{ padding: '12px 0' }}>Searching…</p>}
          </>
        ) : (
          <>
            {recent.length > 0 && <span className="t-eyebrow text-2" style={{ marginTop: 12 }}>Recent</span>}
            {recent.map((r) => <Row key={`r-${r.placeId}`} p={r} mark={<Icon name="clock" size={18} />} onClick={() => pick(r)} />)}
            <span className="t-eyebrow text-2" style={{ marginTop: 12 }}>Popular places</span>
            {quickKeys.map((k) => { const r = seedResult(k); return <Row key={k} p={r} mark={<Mark />} onClick={() => pick(r)} />; })}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ p, mark, onClick }: { p: PlaceResult; mark: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="picker-row" onClick={onClick}>
      <span className="picker-icon">{mark}</span>
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="t-body-l truncate" dir="auto" style={{ display: 'block', fontWeight: 500 }}>{p.name}</span>
        {p.address && p.address !== p.name && <span className="t-caption text-2 truncate" style={{ display: 'block' }}>{p.address}</span>}
      </span>
    </button>
  );
}

/** "Choose on map": the pin stays in the middle, the map moves under it; the server names the spot. */
function PinMap({ title, kind, near, onBack, onPick }: { title: string; kind: 'pickup' | 'dest'; near?: { lat: number; lng: number }; onBack: () => void; onPick: (p: PlaceResult) => void }) {
  const status = useApiLoadingStatus();
  const [spot, setSpot] = useState<PlaceResult | null>(null);
  const [moving, setMoving] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const seq = useRef(0);
  const idle = (map: google.maps.Map) => {
    const c = map.getCenter();
    if (!c) return;
    const n = ++seq.current;
    setMoving(true);
    api.placeAt(c.lat(), c.lng())
      .then((p) => { if (n === seq.current) { setSpot(p); setErr(null); } })
      .catch((e: Error) => { if (n === seq.current) { setSpot(null); setErr(e.message); } })
      .finally(() => { if (n === seq.current) setMoving(false); });
  };
  return (
    <div className="picker picker--map" role="dialog" aria-label={`${title} on the map`}>
      <div className="pinmap">
        {status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE
          ? <p className="t-body text-2 center" style={{ padding: 24 }}>The map couldn't load. Go back and search instead.</p>
          : <Map defaultCenter={near ?? IRBID} defaultZoom={16} styles={PAPER} disableDefaultUI gestureHandling="greedy" clickableIcons={false}
              onIdle={(e) => idle(e.map)} onDragstart={() => setMoving(true)} />}
        <div className={`pin-mark${moving ? ' pin-mark--up' : ''}`} aria-hidden>{kind === 'pickup' ? <Ring /> : <Square />}<span className="pin-stem" /></div>
        <button type="button" className="iconbtn pinmap-back" aria-label="Back" onClick={onBack}><Icon name="back" /></button>
      </div>
      <div className="pinmap-card stack">
        <span className="t-eyebrow text-2">{title}</span>
        <span className="t-h2 truncate">{spot ? spot.name : moving ? 'Finding this spot…' : 'Move the map to place the pin'}</span>
        <span className="t-caption text-2">{spot ? `${spot.address ? `${spot.address} · ` : ''}Other riders see only: ${spot.area}` : 'Other riders see only the area name'}</span>
        <ErrorNote text={err} />
        <Button disabled={!spot || moving} onClick={() => spot && onPick(spot)}>{kind === 'pickup' ? 'Set pickup here' : 'Set destination here'}</Button>
      </div>
    </div>
  );
}
