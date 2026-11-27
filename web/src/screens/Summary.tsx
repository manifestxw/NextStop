// Trip summary (DESIGN §8, SPEC §3.15). Shown when the ride completes; chat becomes read-only.
import { Icon } from '../components/Icon.js';
import { Navigate, useNavigate } from 'react-router-dom';
import type { RiderView } from '@nextstop/shared';
import { useSession } from '../state/session.js';
import { useDraft } from '../state/draft.js';
import { fmtJod, fmtTime } from '../lib/format.js';
import { Button, MergeMark, SeatMeter } from '../components/ui.js';

export function Summary() {
  const view = useSession((s) => s.view) as RiderView | null;
  const d = useDraft();
  const nav = useNavigate();
  const ride = view?.ride;
  const s = ride?.summary;
  if (!view || !ride || !s) return <Navigate to="/" replace />;
  const done = () => { d.dismiss(ride.id); nav('/'); };
  return (
    <main className="screen" style={{ alignItems: 'stretch' }}>
      <div className="stack center" style={{ alignItems: 'center', marginTop: 'var(--s-6)' }}>
        <MergeMark size={96} done />
        <h1 className="t-h1">{s.leftLate ? 'You left this ride' : "You've arrived"}</h1>
        <p className="t-body text-2">To {s.destArea}{s.leftLate ? '' : ` · arrived ${fmtTime(s.arrivedAt)}`}</p>
      </div>
      <section className="pass">
        <div className="pass-top">
          {s.leftLate ? (
            <p className="t-body-l" style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmtJod(s.leftLate.chargedJod)} added to your next ride</p>
          ) : (
            <>
              <span className="t-eyebrow text-2">You paid</span>
              <span className="t-hero">{fmtJod(s.paidJod)}</span>
              <span className="row t-body" style={{ gap: 8 }}><span style={{ color: 'var(--success)' }}><Icon name="banknote" /></span>Cash</span>
            </>
          )}
        </div>
        <div className="pass-perf" />
        <div className="pass-bottom">
          {ride.seats.length > 0 && <SeatMeter seats={ride.seats} max={ride.seats.length} closed />}
          <span className="t-body">{s.riders} riders synced this ride</span>
          {!s.leftLate && s.savedJod > 0 && <span className="t-body" style={{ color: 'var(--success-text)', fontWeight: 600 }}>You saved {fmtJod(s.savedJod)} vs riding solo</span>}
          {s.outstandingJod > 0 && <span className="row t-body" style={{ gap: 8 }}><span style={{ color: 'var(--warn)' }}><Icon name="alert" /></span>Outstanding balance {fmtJod(s.outstandingJod)}</span>}
        </div>
      </section>
      <div className="dock"><Button onClick={done}>Done</Button></div>
    </main>
  );
}
