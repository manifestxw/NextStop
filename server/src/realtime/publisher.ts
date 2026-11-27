import type { ChatMessageView, ClockView, View } from '@nextstop/shared';

/** Server → phone pushes (ARCH §9). Socket.IO in the app, a recorder in tests. */
export interface Publisher {
  view(userId: string, view: View): void;
  chat(userId: string, message: ChatMessageView): void;
  clock(clock: ClockView): void;
  logout(): void;
}
