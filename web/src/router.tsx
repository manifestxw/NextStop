// Routes (ARCH §10). T8 builds the rider screens, T9 the driver screens and demo menu.
import { Navigate, Route, Routes } from 'react-router-dom';
import { Placeholder } from './screens/Placeholder.js';
import { useSession } from './state/session.js';

function Home() {
  const view = useSession((s) => s.view);
  if (!view) return <Placeholder name="loading" />;
  return view.role === 'driver' ? <Navigate to="/driver" replace /> : <Placeholder name="home" />;
}

/** Everything but signup and the demo menu needs a login. */
function Authed({ children }: { children: React.ReactElement }) {
  const token = useSession((s) => s.token);
  return token ? children : <Navigate to="/signup" replace />;
}

const screens: [path: string, name: string][] = [
  ['/search', 'search'], ['/shared', 'rides going your way'], ['/shared/new', 'start your own sync'],
  ['/ride/:id', 'ride status'], ['/ride/:id/chat', 'group chat'], ['/ride/:id/summary', 'trip summary'],
  ['/driver', 'driver home'], ['/driver/offer/:id', 'trip offer'], ['/driver/trip/:id', 'active trip'],
];

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/signup" element={<Placeholder name="signup" />} />
      <Route path="/demo" element={<Placeholder name="demo menu" />} />
      <Route path="/" element={<Authed><Home /></Authed>} />
      {screens.map(([path, name]) => <Route key={path} path={path} element={<Authed><Placeholder name={name} /></Authed>} />)}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
