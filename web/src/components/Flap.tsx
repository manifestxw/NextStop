// Split-flap number (DESIGN §5): when the value changes, only the digits that changed roll: the old one
// leaves upward, the new one arrives from below, 220 ms with a 30 ms stagger. Unchanged digits never move.
// Web Animations API so re-renders (countdown ticks) can't replay it; reduced motion skips it entirely.
import { useLayoutEffect, useRef } from 'react';

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

export function Flap({ value, className }: { value: string; className?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useLayoutEffect(() => {
    const old = prev.current;
    prev.current = value;
    if (old === value || !box.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let n = 0;
    [...value].forEach((ch, i) => {
      const cell = box.current!.children[i] as HTMLElement | undefined;
      if (!cell || old[i] === ch || !/\d/.test(ch)) return;
      const timing = { duration: 220, delay: n++ * 30, easing: EASE };
      cell.firstElementChild?.animate(
        [{ transform: 'translateY(70%)', opacity: 0, filter: 'blur(2px)' }, { transform: 'none', opacity: 1, filter: 'none' }],
        { ...timing, fill: 'backwards' });
      if (old[i] === undefined) return;
      const ghost = document.createElement('span');
      ghost.className = 'flap-ghost';
      ghost.textContent = old[i]!;
      cell.appendChild(ghost);
      ghost.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-70%)', opacity: 0, filter: 'blur(2px)' }], { ...timing, fill: 'forwards' })
        .finished.finally(() => ghost.remove());
    });
  }, [value]);
  return (
    <span className={`flap ${className ?? ''}`}>
      <span className="sr-only">{value}</span>
      <span ref={box} className="flap-row" aria-hidden>{[...value].map((ch, i) => <span key={i} className="flap-cell"><span>{ch}</span></span>)}</span>
    </span>
  );
}
