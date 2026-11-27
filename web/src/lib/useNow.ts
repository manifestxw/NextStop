import { useEffect, useState } from 'react';
import { serverNowMs, useSession } from '../state/session.js';

/** Demo-clock "now" in epoch ms, re-rendering every second (countdowns freeze while the clock is paused). */
export function useNow(): number {
  const clock = useSession((s) => s.clock);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  return serverNowMs(clock);
}
