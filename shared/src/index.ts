// The protocol contract between server and web (ARCH §7, §9). Filled in by task T2.

export interface Health {
  ok: boolean;
  buildStamp: { hash: string; builtAt: string } | null;
}
