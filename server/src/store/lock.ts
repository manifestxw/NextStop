/** One global async mutex: callers run strictly one after another, in call order (ARCH §7.2). */
export function createLock() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn);
    tail = run.catch(() => undefined);   // a failed commit must not block the next one
    return run;
  };
}
