// Routes (ARCH §10). Screens are pure functions of the session view.
import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from './state/session.js';
import { Banners, ConnectionBar } from './components/ui.js';
import { Signup } from './screens/Signup.js';
import { Home } from './screens/Home.js';
import { SharedList } from './screens/SharedList.js';
import { SharedSetup } from './screens/SharedSetup.js';
import { Status } from './screens/Status.js';
import { Chat, DriverChat, DriverRiderChat } from './screens/Chat.js';
import { Summary } from './screens/Summary.js';
import { DriverHome, DriverOffer, DriverTrip } from './screens/Driver.js';
import { DemoMenu } from './screens/DemoMenu.js';
import { Plan } from './screens/Plan.js';

/** Everything but signup and the demo menu needs a login. */
function Authed({ children }: { children: React.ReactElement }) {
  const token = useSession((s) => s.token);
  const view = useSession((s) => s.view);
  if (!token) return <Navigate to="/signup" replace />;
  return (
    <>
      <ConnectionBar />
      {view && <Banners banners={view.banners} />}
      {view ? children : <main className="screen" aria-busy="true" />}
    </>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/signup" element={<Signup />} />
      <Route path="/demo" element={<DemoMenu />} />
      <Route path="/" element={<Authed><Home /></Authed>} />
      <Route path="/shared" element={<Authed><SharedList /></Authed>} />
      <Route path="/shared/new" element={<Authed><SharedSetup /></Authed>} />
      <Route path="/ride/:id" element={<Authed><Status /></Authed>} />
      <Route path="/ride/:id/chat" element={<Authed><Chat /></Authed>} />
      <Route path="/ride/:id/driver-chat" element={<Authed><DriverChat /></Authed>} />
      <Route path="/driver/trip/:id/chat/:riderId" element={<Authed><DriverRiderChat /></Authed>} />
      <Route path="/ride/:id/summary" element={<Authed><Summary /></Authed>} />
      <Route path="/plan" element={<Authed><Plan /></Authed>} />
      <Route path="/driver" element={<Authed><DriverHome /></Authed>} />
      <Route path="/driver/offer/:id" element={<Authed><DriverOffer /></Authed>} />
      <Route path="/driver/trip/:id" element={<Authed><DriverTrip /></Authed>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
