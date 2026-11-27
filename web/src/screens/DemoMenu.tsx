// Hidden demo menu (SPEC §2.5, DESIGN §8): plain functional screen, not the RideSync look. PIN required.
import { useCallback, useEffect, useState } from 'react';
import type { DemoView } from '@nextstop/shared';
import { api, ApiError } from '../net/api.js';
import { fmtTime } from '../lib/format.js';

const PIN_KEY = 'ridesync.demoPin';
const readPin = () => { try { return sessionStorage.getItem(PIN_KEY) ?? ''; } catch { return ''; } };
const savePin = (p: string) => { try { sessionStorage.setItem(PIN_KEY, p); } catch { /* private mode */ } };
const big: React.CSSProperties = { font: '600 18px system-ui', padding: '16px', borderRadius: 8, border: '1px solid #888', background: '#fff', color: '#111' };

export function DemoMenu() {
  const [pin, setPin] = useState(readPin);
  const [demo, setDemo] = useState<DemoView | null>(null);
  const [rideId, setRideId] = useState('');
  const [jump, setJump] = useState('06:35');
  const [msg, setMsg] = useState<string | null>(null);

  const act = useCallback(async (fn: () => Promise<DemoView>) => {
    try { const d = await fn(); setDemo(d); setMsg(null); } catch (e) {
      setMsg(e instanceof ApiError ? (e.code === 'BAD_PIN' ? 'Wrong PIN' : e.message) : 'Server unreachable');
      if (e instanceof ApiError && e.code === 'BAD_PIN') setDemo(null);
    }
  }, []);

  useEffect(() => {
    if (!pin) return;
    void act(() => api.demo.view(pin));
    const t = setInterval(() => void act(() => api.demo.view(pin)), 3000);
    return () => clearInterval(t);
  }, [pin, act]);

  const ride = demo?.rides.find((r) => r.id === rideId) ?? demo?.rides[0];
  const day = demo?.clock.nowIso.slice(0, 10);

  if (!demo) {
    return (
      <main style={{ font: '16px system-ui', padding: 20, background: '#fff', color: '#111', minHeight: '100dvh' }}>
        <h1>Demo menu</h1>
        <form onSubmit={(e) => { e.preventDefault(); const p = (new FormData(e.currentTarget).get('pin') as string) ?? ''; savePin(p); setPin(p); }}>
          <input name="pin" type="password" inputMode="numeric" placeholder="PIN" defaultValue={pin} style={{ ...big, width: '100%' }} />
          <button type="submit" style={{ ...big, width: '100%', marginTop: 12 }}>Open</button>
        </form>
        {msg && <p style={{ color: '#b00' }}>{msg}</p>}
      </main>
    );
  }

  return (
    <main style={{ font: '16px system-ui', padding: 20, background: '#fff', color: '#111', minHeight: '100dvh', display: 'grid', gap: 12 }}>
      <h1 style={{ margin: 0 }}>Demo menu</h1>
      <section style={{ border: '2px solid #111', borderRadius: 8, padding: 12, display: 'grid', gap: 8 }}>
        <b>Autopilot (SPEC §2.2 script)</b>
        <span>{demo.autopilot ? `Next: step ${demo.autopilot.step} of 7: ${demo.autopilot.label}` : 'Script done. Reset to run it again.'}</span>
        <button style={{ ...big, background: '#111', color: '#fff' }} disabled={!demo.autopilot} onClick={() => act(() => api.demo.autopilot(pin))}>Play next step</button>
      </section>
      <p style={{ margin: 0 }}>Build <b>{demo.buildStamp?.hash ?? 'dev'}</b> · source <b>{demo.settings.source}</b> · clock <b>{fmtTime(demo.clock.nowIso)}</b>{demo.clock.paused ? ' (paused)' : ' (running)'}</p>
      {msg && <p style={{ color: '#b00', margin: 0 }}>{msg}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <button style={big} onClick={() => act(() => api.demo.clock(pin, { advanceMin: 5 }))}>+5 min</button>
        <button style={big} onClick={() => act(() => api.demo.clock(pin, { next: true }))}>Next event</button>
        <button style={big} onClick={() => act(() => api.demo.clock(pin, { paused: !demo.clock.paused }))}>{demo.clock.paused ? 'Resume clock' : 'Pause clock'}</button>
        <span style={{ display: 'flex', gap: 6 }}>
          <input type="time" value={jump} onChange={(e) => setJump(e.target.value)} style={{ ...big, flex: 1, minWidth: 0 }} />
          <button style={big} onClick={() => act(() => api.demo.clock(pin, { jumpTo: `${day}T${jump}:00+03:00` }))}>Jump</button>
        </span>
      </div>
      <label>Ride:{' '}
        <select value={ride?.id ?? ''} onChange={(e) => setRideId(e.target.value)} style={{ ...big, padding: 8 }}>
          {demo.rides.length === 0 && <option value="">no active rides</option>}
          {demo.rides.map((r) => <option key={r.id} value={r.id}>{r.hostFirstName} · {r.state} · {r.riders} riders · {fmtTime(r.firstPickupAt)}</option>)}
        </select>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <button style={big} disabled={!ride} onClick={() => ride && act(() => api.demo.simulateRider(pin, ride.id))}>Simulate rider</button>
        <button style={big} disabled={!ride} onClick={() => ride && act(() => api.demo.completeTrip(pin, ride.id))}>Complete trip</button>
        <button style={{ ...big, gridColumn: 'span 2' }} onClick={() => act(() => api.demo.placePlanned(pin))}>Place planned rides now (next 36 h)</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <label>Traffic<select value={demo.settings.traffic} onChange={(e) => act(() => api.demo.settings(pin, { traffic: e.target.value as 'normal' | 'heavy' | 'jam' }))} style={{ ...big, padding: 8, width: '100%' }}>
          {['normal', 'heavy', 'jam'].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        <label>Weather<select value={demo.settings.weather} onChange={(e) => act(() => api.demo.settings(pin, { weather: e.target.value as 'clear' | 'rain' }))} style={{ ...big, padding: 8, width: '100%' }}>
          {['clear', 'rain'].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        <label>Drivers<select value={demo.settings.driversNearby} onChange={(e) => act(() => api.demo.settings(pin, { driversNearby: Number(e.target.value) as 2 | 8 | 20 }))} style={{ ...big, padding: 8, width: '100%' }}>
          {[2, 8, 20].map((v) => <option key={v} value={v}>{v} nearby</option>)}</select></label>
      </div>
      <label>Omar's position (demand spots):{' '}
        <select defaultValue="" onChange={(e) => e.target.value && act(() => api.demo.driverPosition(pin, 'u-omar', e.target.value))} style={{ ...big, padding: 8 }}>
          <option value="" disabled>choose…</option>
          {['CC', 'HS', 'US', 'YU', 'AM'].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={demo.settings.simAutoReady} onChange={(e) => act(() => api.demo.settings(pin, { simAutoReady: e.target.checked }))} />
        Simulated riders answer Ready automatically
      </label>
      <button style={{ ...big, borderColor: '#b00', color: '#b00' }} onClick={() => { if (confirm('Reset everything and log out all phones?')) void act(() => api.demo.reset(pin)); }}>Reset demo</button>
      <p style={{ margin: 0, color: '#555' }}>Phone links: <code>/?as=lina&amp;pin=…</code> · <code>/?as=sara&amp;pin=…</code> · <code>/?as=omar&amp;pin=…</code></p>
    </main>
  );
}
