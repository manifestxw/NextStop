import { StrictMode, useEffect } from 'react';
import { setupInstall } from './lib/install.js';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { api } from './net/api.js';
import { connectSocket, disconnectSocket } from './net/socket.js';
import { AppRoutes } from './router.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { MapsProvider } from './components/MapView.js';
import { useSession } from './state/session.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

/** `/?as=lina&pin=1337` logs this phone in as a seeded account, then cleans the URL (SPEC §2.6). */
async function seededLogin() {
  const q = new URLSearchParams(location.search);
  const as = q.get('as'), pin = q.get('pin');
  if (q.get('demo') === '1') history.replaceState(null, '', '/demo');
  if (as !== 'lina' && as !== 'sara' && as !== 'omar' && as !== 'noor' && as !== 'huda') return;
  if (!pin) return;
  q.delete('as'); q.delete('pin');
  history.replaceState(null, '', location.pathname + (q.size ? `?${q}` : ''));
  await api.demoLogin(as, pin).catch((e) => console.warn('seeded login failed:', e));
}

function App() {
  const token = useSession((s) => s.token);
  const view = useSession((s) => s.view);

  // One socket per token: (re)connect on login, close on logout. A stale stored token is cleared by 401.
  useEffect(() => {
    if (!token) { disconnectSocket(); return; }
    connectSocket(token);
    api.me().catch(() => undefined);
    return disconnectSocket;
  }, [token]);

  // Role picks the surface (Paper / Cockpit), the ride's category picks the accent (DESIGN §2).
  useEffect(() => {
    const b = document.body.dataset;
    b.role = view?.role ?? 'rider';
    b.category = view?.role === 'rider' ? view.ride?.category ?? 'economy'
      : view?.role === 'driver' ? view.trip?.category ?? view.offers[0]?.category ?? 'economy' : 'economy';
  }, [view]);

  return <AppRoutes />;
}

// The seeded login must finish BEFORE the first render: otherwise the router's "not logged in → /signup"
// redirect runs first and drops the ?as= query.
void seededLogin().finally(() => {
  setupInstall();
  createRoot(document.getElementById('root')!).render(
    <StrictMode><ErrorBoundary><MapsProvider><BrowserRouter><App /></BrowserRouter></MapsProvider></ErrorBoundary></StrictMode>,
  );
});
