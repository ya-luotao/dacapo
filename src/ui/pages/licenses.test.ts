import { describe, expect, it } from 'vitest';
import bravuraShipped from '../../../public/licenses/bravura/LICENSE.txt?raw';
import dacapoShipped from '../../../public/licenses/dacapo/LICENSE.txt?raw';
import fflateShipped from '../../../public/licenses/fflate/LICENSE.txt?raw';
import idbShipped from '../../../public/licenses/idb/LICENSE.txt?raw';
import reactShipped from '../../../public/licenses/react/LICENSE.txt?raw';
import ccBy3 from '../../../public/licenses/salamander/CC-BY-3.0.txt?raw';
import salamanderReadme from '../../../public/licenses/salamander/README.txt?raw';
import sourceFontsShipped from '../../../public/licenses/source-fonts/OFL.txt?raw';
import vexflowShipped from '../../../public/licenses/vexflow/LICENSE.txt?raw';
import verovioNotices from '../../../public/licenses/verovio/THIRD-PARTY.txt?raw';
import bravura from '../../../node_modules/@vexflow-fonts/bravura/LICENSE.txt?raw';
import fflate from '../../../node_modules/fflate/LICENSE?raw';
import idb from '../../../node_modules/idb/LICENSE?raw';
import reactDom from '../../../node_modules/react-dom/LICENSE?raw';
import react from '../../../node_modules/react/LICENSE?raw';
import vexflow from '../../../node_modules/vexflow/LICENSE?raw';
import dacapo from '../../../LICENSE?raw';
import sourceFonts from '../fonts/OFL.txt?raw';

// The About page shows the licence texts from public/licenses/. They are copies; this keeps them
// equal to what the dependencies ship, so an upgrade that changes a licence fails here.
describe('shipped licence texts', () => {
  it.each([
    ['dacapo', dacapoShipped, dacapo],
    ['vexflow', vexflowShipped, vexflow],
    ['bravura', bravuraShipped, bravura],
    ['source-fonts', sourceFontsShipped, sourceFonts],
    ['react', reactShipped, react],
    ['react-dom', reactShipped, reactDom],
    ['idb', idbShipped, idb],
    ['fflate', fflateShipped, fflate],
  ])('%s matches its source', (_name, shipped, source) => {
    expect(shipped).toBe(source);
  });

  it('credits the piano’s samples as their licence asks', () => {
    expect(salamanderReadme).toContain('Alexander Holm');
    expect(salamanderReadme).toContain('http://creativecommons.org/licenses/by/3.0/');
    expect(ccBy3).toContain('Attribution 3.0 Unported');
  });

  it('has the notices of every library Verovio contains', () => {
    for (const name of ['pugixml', 'Hong Jiang', 'tuning-library', 'zip_file', 'midifile', 'CRC'])
      expect(verovioNotices).toContain(name);
  });
});
