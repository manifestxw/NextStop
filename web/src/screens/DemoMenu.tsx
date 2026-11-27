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

  const [busy, setBusy] = useState(false);
  const act = useCallback(async (fn: () => Promise<DemoView>) => {
    setBusy(true);
    try { const d = await fn(); setDemo(d); setMsg(null); } catch (e) {
      setMsg(e instanceof ApiError ? (e.code === 'BAD_PIN' ? 'Wrong PIN' : e.message) : 'Server unreachable');
      if (e instanceof ApiError && e.code === 'BAD_PIN') setDemo(null);
    } finally { setBusy(false); }
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
      <Autopilot demo={demo} busy={busy} play={() => act(() => api.demo.autopilot(pin))} />
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
      <p style={{ margin: 0, color: '#555' }}>Phone links: <code>/?as=lina&amp;pin=…</code> · <code>/?as=sara&amp;pin=…</code> · <code>/?as=omar&amp;pin=…</code> · <code>/?as=noor&amp;pin=…</code> (friend to invite, code NOOR26) · <code>/?as=huda&amp;pin=…</code> (Uni plan)</p>
    </main>
  );
}

const box: React.CSSProperties = { border: '1px solid #bbb', borderRadius: 8, padding: 12, display: 'grid', gap: 6 };

/** The SPEC §2.2 script as a checklist: done steps show what really happened, the next one says what to watch. */
function Autopilot({ demo, busy, play }: { demo: DemoView; busy: boolean; play: () => void }) {
  const next = demo.autopilot?.step ?? demo.script.length + 1;
  const cur = demo.script.find((x) => x.step === next);
  return (
    <section style={{ border: '2px solid #111', borderRadius: 8, padding: 12, display: 'grid', gap: 10 }}>
      <b style={{ fontSize: 18 }}>Autopilot · the pitch script (SPEC §2.2)</b>
      <span style={{ color: '#555' }}>Each tap acts as the seeded people through the same commands their phones use. Keep Lina, Sara and Omar open to watch it happen.
        Numbers assume the snapshot travel source.</span>
      <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 4 }}>
        {demo.script.map((x) => (
          <li key={x.step} style={{ color: x.step < next ? '#167A43' : x.step === next ? '#111' : '#777', fontWeight: x.step === next ? 700 : 400 }}>
            {x.step < next ? '✓ ' : x.step === next ? '▶ ' : ''}{x.title}
          </li>
        ))}
      </ol>
      {cur ? (
        <div style={{ ...box, borderColor: '#111', background: '#f6f6f6' }}>
          <b>Next: step {cur.step} of {demo.script.length}: {cur.title}</b>
          <span><b>Who:</b> {cur.who}</span>
          <span><b>What happens:</b> {cur.does}</span>
          <b>Watch:</b>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 2 }}>
            {cur.watch.map((w) => <li key={w.phone}><b>{w.phone}:</b> {w.what}</li>)}
          </ul>
          <span><b>Expect:</b> {cur.expect}</span>
        </div>
      ) : <b style={{ color: '#167A43' }}>Script done. Reset to run it again.</b>}
      <button style={{ ...big, background: '#111', color: '#fff' }} disabled={!cur || busy} onClick={play}>{busy ? 'Playing…' : cur ? `Play step ${cur.step}: ${cur.title}` : 'Play next step'}</button>
      {demo.now.length > 0 && (
        <div style={box}>
          <b>Live: Lina's ride now</b>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', font: '14px ui-monospace, monospace' }}>{demo.now.join('\n')}</pre>
        </div>
      )}
      {demo.log.length > 0 && (
        <details open style={box}>
          <summary style={{ fontWeight: 700, cursor: 'pointer' }}>What happened ({demo.log.length} step{demo.log.length === 1 ? '' : 's'})</summary>
          {[...demo.log].reverse().map((e, i) => (
            <div key={i} style={{ borderTop: '1px solid #ddd', paddingTop: 6 }}>
              <b>{fmtTime(e.at)} · step {e.step}: {e.title}</b>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', font: '14px ui-monospace, monospace' }}>{e.lines.join('\n')}</pre>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
