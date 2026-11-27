import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Health } from '@nextstop/shared';

// Walking-skeleton page: proves the build, the server and the phone browser work together.
// Replaced by the router and real screens in T5.
function Hello() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => setError(true));
  }, []);
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 20 }}>
      <h1>RideSync</h1>
      <p>{error ? 'Server unreachable' : health ? `Server ok · build ${health.buildStamp?.hash ?? 'dev'}` : 'Checking server…'}</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Hello /></StrictMode>);
