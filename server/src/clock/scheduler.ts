// Runs the domain tick every second (ARCH §8). The tick itself (due events, sim Ready, saving the clock)
// lives in the commands layer, which takes the write lock. A slow tick never overlaps the next one.
export function createScheduler({ tick, intervalMs = 1000 }: { tick: () => Promise<unknown>; intervalMs?: number }) {
  let timer: NodeJS.Timeout | undefined, running = false;
  return {
    start() {
      timer ??= setInterval(() => {
        if (running) return;
        running = true;
        tick().catch((e) => console.error('scheduler tick failed:', e)).finally(() => { running = false; });
      }, intervalMs);
    },
    stop() { clearInterval(timer); timer = undefined; },
  };
}
