// Defence in depth: an instrument (or a thru route in between) could send our notes back to its
// input. A note-on from a device matching a note we sent to the output of the same name within
// a few milliseconds is taken for such an echo and ignored. The MP11SE itself has no USB-to-USB
// route, so this should never fire with it.

export const ECHO_WINDOW_MS = 30;

export interface EchoGuard {
  /** Records a note-on sent to the output named `deviceName` at `time`. */
  sent: (deviceName: string, midi: number, time: number) => void;
  /** True (and the record is used up) when this note-on is one of ours coming back. */
  isEcho: (deviceName: string, midi: number, time: number) => boolean;
}

export function createEchoGuard(windowMs = ECHO_WINDOW_MS): EchoGuard {
  let records: { name: string; midi: number; time: number }[] = [];
  return {
    sent(deviceName, midi, time) {
      if (!deviceName) return;
      // Anything older than a few windows can no longer match.
      records = records.filter((r) => r.time > time - windowMs * 4);
      records.push({ name: deviceName, midi, time });
    },
    isEcho(deviceName, midi, time) {
      if (!deviceName) return false;
      const i = records.findIndex(
        (r) => r.name === deviceName && r.midi === midi && Math.abs(time - r.time) <= windowMs,
      );
      if (i < 0) return false;
      records.splice(i, 1);
      return true;
    },
  };
}
