// Friend code card (P1): a small pass, like the Sync Pass and the invite card. Six character tiles, then copy / share.
import { useState } from 'react';
import { Icon } from './Icon.js';
import { Button } from './ui.js';

export function FriendCodeCard({ code, name }: { code: string; name?: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === 'function';
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* not allowed */ } };
  const share = () => navigator.share({ text: `Ride with me on RideSync. My friend code: ${code}` }).catch(() => undefined);
  return (
    <section className="pass" aria-label="Your friend code">
      <div className="pass-top">
        <span className="t-eyebrow text-2">{name ? `${name} · ` : ''}Your friend code</span>
        <span className="code-tiles" aria-label={code.split('').join(' ')}>
          {[...code].map((ch, i) => <span key={i} className="code-tile" aria-hidden>{ch}</span>)}
        </span>
      </div>
      <div className="pass-perf" />
      <div className="pass-bottom">
        <div className={canShare ? 'code-actions' : ''}>
          <Button kind="secondary" small onClick={copy} aria-live="polite">
            <Icon name={copied ? 'check' : 'copy'} size={18} /> {copied ? 'Copied' : 'Copy code'}
          </Button>
          {canShare && <Button kind="secondary" small onClick={share}><Icon name="share" size={18} /> Share</Button>}
        </div>
        <span className="t-caption text-2">Friends type this code to invite you to their ride. You still pick your own pickup and pay your own share.</span>
      </div>
    </section>
  );
}
