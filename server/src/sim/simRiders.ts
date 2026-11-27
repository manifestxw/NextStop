// Simulated riders (SPEC §2.5, §2.6): seed riders that "Simulate rider" adds, and their automatic Ready.
// The auto-Ready uses REAL time so it works while the demo clock is paused (ARCH §8).
export { SIM_ORDER } from '../store/seed.js';

export const SIM_READY_AFTER_MS = 3_000;

/** Whether a simulated member should answer Ready now. The only domain-side use of real time. */
export const simShouldAnswer = (startedRealMs: number, realNowMs: number) => realNowMs - startedRealMs >= SIM_READY_AFTER_MS;
