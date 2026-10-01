import { useEffect, useState } from 'react';

// A device played by touch alone (a phone, a tablet in a browser): nothing hovers and the pointer
// is coarse, so there are no computer keys to speak of and the keys on the screen are what plays
// (docs/START.md). Told from what the device says of its own input, never from its name.

const NO_HOVER = '(hover: none)';
const COARSE = '(pointer: coarse)';

/**
 * Whether the device is played by touch alone, from its two answers: whether its main pointer
 * can hover, and whether it is coarse. A laptop with a touch screen hovers with a fine pointer,
 * and is not; nor is a tablet whose trackpad has become its pointer.
 */
export function isTouchOnly(hovers: boolean, coarse: boolean): boolean {
  return !hovers && coarse;
}

function queries(): MediaQueryList[] {
  const match = globalThis.matchMedia;
  return typeof match === 'function' ? [match(NO_HOVER), match(COARSE)] : [];
}

function read(): boolean {
  const [noHover, coarse] = queries();
  return (
    noHover !== undefined && coarse !== undefined && isTouchOnly(!noHover.matches, coarse.matches)
  );
}

/**
 * Whether this device is played by touch alone: read when the component mounts, and again when
 * an answer changes (a keyboard and trackpad attached to a tablet, or taken away).
 */
export function useTouchOnly(): boolean {
  const [touch, setTouch] = useState(read);
  useEffect(() => {
    const lists = queries();
    const onChange = () => setTouch(read());
    for (const list of lists) list.addEventListener('change', onChange);
    return () => {
      for (const list of lists) list.removeEventListener('change', onChange);
    };
  }, []);
  return touch;
}
