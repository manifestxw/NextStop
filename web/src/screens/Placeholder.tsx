// Skeleton screen (T5). Each route renders this until T8/T9 build the real screen from DESIGN.md.
import { useSession, serverNowMs } from '../state/session.js';

export function Placeholder({ name }: { name: string }) {
  const { view, conn, clock } = useSession();
  const ride = view?.role === 'rider' ? view.ride : undefined;
  const trip = view?.role === 'driver' ? view.trip : undefined;
  const offers = view?.role === 'driver' ? view.offers.length : 0;
  const now = clock ? new Date(serverNowMs(clock)).toLocaleTimeString('en-US', { timeZone: 'Asia/Amman', hour: 'numeric', minute: '2-digit' }) : '—';
  return (
    <main style={{ padding: 'var(--s-6) var(--pad-x)' }}>
      <p className="t-eyebrow text-2">RideSync · {name}</p>
      <h1 className="t-h1">{view ? `Hi ${view.me.firstName}` : 'Not logged in'}</h1>
      <p className="t-body text-2">
        {conn} · demo clock {now}{clock?.paused ? ' (paused)' : ''}
        {ride && ` · ride ${ride.state} · ${ride.seats.length} seats · JOD ${ride.shareJod.toFixed(2)} each`}
        {trip && ` · trip ${trip.state}`}
        {view?.role === 'driver' && ` · ${offers} offer${offers === 1 ? '' : 's'}`}
      </p>
    </main>
  );
}
