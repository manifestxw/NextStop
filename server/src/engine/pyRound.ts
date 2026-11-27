/** Python's round(x, nd): half-to-even on the EXACT binary value (round(2.675, 2) = 2.67). */
export function pyRound(x: number, nd = 0): number {
  if (!Number.isFinite(x) || x === 0) return x;
  // toFixed(100) prints the exact decimal expansion for every value this app handles (|x| ≥ 1e-50).
  const [int = '0', frac = ''] = Math.abs(x).toFixed(100).split('.');
  const keep = frac.slice(0, nd), rest = frac.slice(nd);
  const first = rest[0] ?? '0';
  let up = first > '5' || (first === '5' && /[1-9]/.test(rest.slice(1)));
  if (first === '5' && !/[1-9]/.test(rest.slice(1))) {   // exact tie: round to even
    const last = (nd > 0 ? keep[nd - 1] : int[int.length - 1]) ?? '0';
    up = Number(last) % 2 === 1;
  }
  const digits = BigInt(int + keep) + (up ? 1n : 0n);
  const r = Number(`${digits}e-${nd}`);                 // correctly rounded parse, like Python
  return x < 0 ? -r : r;
}

/** Round money up to 0.05 JD, exactly as fare_model.py's up05. */
export const up05 = (x: number): number => Math.ceil(pyRound(x * 100, 6) / 5) * 5 / 100;
