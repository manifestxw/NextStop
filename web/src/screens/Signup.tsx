// Sign-up / sign-in (owner request): phone number → 6-digit code → (new number) first name + gender.
// Demo: the code isn't texted; the server returns it and the screen shows it. Seeded phones use /?as=… instead.
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { Gender, Role } from '@nextstop/shared';
import { api } from '../net/api.js';
import { useSession } from '../state/session.js';
import { fmtPhone } from '../lib/phone.js';
import { Icon } from '../components/Icon.js';
import { Button, ErrorNote, Logo, useAction } from '../components/ui.js';

type Step = { kind: 'phone' } | { kind: 'code'; phone: string; demoCode: string; resendAt: number } | { kind: 'profile'; phone: string; ticket: string };

export function Signup() {
  const token = useSession((s) => s.token);
  const nav = useNavigate();
  const [step, setStep] = useState<Step>({ kind: 'phone' });
  if (token) return <Navigate to="/" replace />;
  return (
    <main className="screen">
      <div className="row">
        {step.kind !== 'phone' ? <button type="button" className="iconbtn" aria-label="Back" onClick={() => setStep({ kind: 'phone' })}><Icon name="back" /></button> : <Logo />}
      </div>
      {step.kind === 'phone' && <PhoneStep onSent={(phone, demoCode, resendInSec) => setStep({ kind: 'code', phone, demoCode, resendAt: Date.now() + resendInSec * 1000 })} />}
      {step.kind === 'code' && <CodeStep step={step} onResent={(demoCode, resendInSec) => setStep({ ...step, demoCode, resendAt: Date.now() + resendInSec * 1000 })}
        onNew={(ticket) => setStep({ kind: 'profile', phone: step.phone, ticket })} onIn={() => nav('/')} />}
      {step.kind === 'profile' && <ProfileStep phone={step.phone} ticket={step.ticket} onDone={() => nav('/')} onExpired={() => setStep({ kind: 'phone' })} />}
    </main>
  );
}

function PhoneStep({ onSent }: { onSent: (phone: string, code: string, resendInSec: number) => void }) {
  const [phone, setPhone] = useState('');
  const a = useAction();
  const send = () => a.run(async () => { const r = await api.requestOtp(phone); onSent(r.phone, r.demoCode, r.resendInSec); });
  return (
    <>
      <h1 className="t-h1" style={{ marginTop: 'var(--s-8)' }}>Ride together, pay less</h1>
      <p className="t-body text-2">Enter your mobile number. We'll send you a code to sign in or create your account.</p>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (phone.trim()) send(); }}>
        <label className="stack"><span className="t-caption text-2">Mobile number</span>
          <span className="row field" style={{ gap: 8, padding: '0 14px' }}><span className="t-body-l text-2">🇯🇴 +962</span>
            <input type="tel" inputMode="tel" autoComplete="tel-national" placeholder="79 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)}
              aria-label="Mobile number" style={{ border: 0, background: 'none', font: 'inherit', fontSize: 17, flex: 1, minWidth: 0, outline: 'none', color: 'var(--text-1)' }} /></span>
        </label>
        <ErrorNote text={a.message} />
        <div className="dock"><Button type="submit" disabled={phone.replace(/\D/g, '').length < 9 || a.busy}>Send code</Button></div>
      </form>
      <p className="t-caption text-2">Your number is shared only with your driver during a trip, so they can call you.</p>
    </>
  );
}

function CodeStep({ step, onResent, onNew, onIn }: { step: Extract<Step, { kind: 'code' }>; onResent: (code: string, s: number) => void; onNew: (t: string) => void; onIn: () => void }) {
  const [code, setCode] = useState('');
  const [now, setNow] = useState(Date.now());
  const a = useAction();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const verify = (c: string) => a.run(async () => { const r = await api.verifyOtp(step.phone, c); if ('ticket' in r) onNew(r.ticket); else onIn(); });
  const wait = Math.max(0, Math.ceil((step.resendAt - now) / 1000));
  return (
    <>
      <h1 className="t-h1" style={{ marginTop: 'var(--s-6)' }}>Enter the code</h1>
      <p className="t-body text-2">Sent to {fmtPhone(step.phone)}</p>
      <div className="card card--tight row" style={{ background: 'var(--accent-soft)', border: 0, color: 'var(--ink-900)' }}>
        <Icon name="message" /><span className="grow t-body">Demo: no SMS is sent. Your code is <b style={{ letterSpacing: '0.12em' }}>{step.demoCode}</b></span>
      </div>
      <input ref={input} className="field code-big" style={{ height: 64, fontSize: 32 }} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
        aria-label="6-digit code" onChange={(e) => { const c = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(c); if (c.length === 6) verify(c); }} />
      <ErrorNote text={a.message} />
      <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start' }} disabled={wait > 0 || a.busy}
        onClick={() => a.run(async () => { const r = await api.requestOtp(step.phone); setCode(''); onResent(r.demoCode, r.resendInSec); })}>
        {wait > 0 ? `Send a new code in ${wait} s` : 'Send a new code'}
      </button>
      <div className="dock"><Button disabled={code.length !== 6 || a.busy} onClick={() => verify(code)}>Continue</Button></div>
    </>
  );
}

function ProfileStep({ phone, ticket, onDone, onExpired }: { phone: string; ticket: string; onDone: () => void; onExpired: () => void }) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [role, setRole] = useState<Role>('rider');
  const a = useAction();
  const ok = name.trim().length > 0 && gender;
  return (
    <>
      <h1 className="t-h1" style={{ marginTop: 'var(--s-6)' }}>{role === 'rider' ? 'Create your account' : 'Drive scheduled shared rides'}</h1>
      <p className="t-body text-2">{fmtPhone(phone)} · verified <span style={{ color: 'var(--success-text)' }}><Icon name="check" size={16} /></span></p>
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
      {a.error?.code === 'OTP_EXPIRED' && <button type="button" className="linkbtn" onClick={onExpired}>Verify your number again</button>}
      <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => setRole(role === 'rider' ? 'driver' : 'rider')}>
        {role === 'rider' ? 'Driving with RideSync? Sign up as a driver' : 'Riding instead? Sign up as a rider'}
      </button>
      <div className="dock">
        <Button disabled={!ok || a.busy} onClick={() => a.run(async () => { await api.signup({ firstName: name, gender: gender!, role, ticket }); onDone(); })}>Create account</Button>
      </div>
    </>
  );
}
