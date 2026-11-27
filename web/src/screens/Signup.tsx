// Signup (SPEC §3.2): first name + gender, fixed after signup. Demo phones use /?as=… instead.
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { Gender, Role } from '@nextstop/shared';
import { api } from '../net/api.js';
import { useSession } from '../state/session.js';
import { Button, ErrorNote, Logo, useAction } from '../components/ui.js';

export function Signup() {
  const token = useSession((s) => s.token);
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [role, setRole] = useState<Role>('rider');
  const a = useAction();
  if (token) return <Navigate to="/" replace />;
  const ok = name.trim().length > 0 && gender;
  return (
    <main className="screen">
      <Logo />
      <h1 className="t-h1" style={{ marginTop: 'var(--s-8)' }}>{role === 'rider' ? 'Ride together, pay less' : 'Drive scheduled shared rides'}</h1>
      <label className="stack"><span className="t-caption text-2">First name</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={30} />
      </label>
      <div className="stack"><span className="t-caption text-2">Gender (can't be changed later)</span>
        <div className="chips">
          {(['F', 'M'] as const).map((g) => (
            <button key={g} type="button" className={`chip${gender === g ? ' chip--on' : ''}`} aria-pressed={gender === g} onClick={() => setGender(g)}>
              {g === 'F' ? 'Woman' : 'Man'}
            </button>
          ))}
        </div>
      </div>
      <p className="t-caption text-2">Your first name and pickup area are shown to riders in your ride, and you can chat with them.</p>
      <ErrorNote text={a.message} />
      <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => setRole(role === 'rider' ? 'driver' : 'rider')}>
        {role === 'rider' ? 'Driving with RideSync? Sign up as a driver' : 'Riding instead? Sign up as a rider'}
      </button>
      <div className="dock">
        <Button disabled={!ok || a.busy} onClick={() => a.run(async () => { await api.signup({ firstName: name, gender: gender!, role }); nav('/'); })}>Continue</Button>
      </div>
    </main>
  );
}
