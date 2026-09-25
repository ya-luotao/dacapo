import { useState, type ReactNode } from 'react';
import { useT, type MessageKey } from '../../i18n/index.ts';

const REPO_URL = 'https://github.com/ya-luotao/dacapo';
/** Where the licence texts are served: public/licenses/, below the app's base path. */
const LICENCES = `${import.meta.env.BASE_URL}licenses/`;

/** A licence text shipped with the app, under public/licenses/. */
interface LicenceFile {
  /** Shown as it is: a file name or a licence's short name. */
  name: string;
  path: string;
}

interface Credit {
  id: string;
  /** The credit itself: one or more lines. */
  lines: readonly MessageKey[];
  files: readonly LicenceFile[];
}

const VEROVIO_NPM = 'https://www.npmjs.com/package/verovio/v/6.3.0';
const VEROVIO_WEBSITE = 'https://www.verovio.org';
const VEROVIO_SOURCE = 'https://github.com/rism-digital/verovio/tree/version-6.3.0';

const SOFTWARE: readonly Credit[] = [
  {
    id: 'vexflow',
    lines: ['about.vexflow'],
    files: [{ name: 'MIT License', path: `${LICENCES}vexflow/LICENSE.txt` }],
  },
  {
    id: 'react',
    lines: ['about.react'],
    files: [{ name: 'MIT License', path: `${LICENCES}react/LICENSE.txt` }],
  },
  { id: 'wouter', lines: ['about.wouter'], files: [] },
  {
    id: 'idb',
    lines: ['about.idb'],
    files: [{ name: 'ISC License', path: `${LICENCES}idb/LICENSE.txt` }],
  },
  {
    id: 'fflate',
    lines: ['about.fflate'],
    files: [{ name: 'MIT License', path: `${LICENCES}fflate/LICENSE.txt` }],
  },
];

const FONTS: readonly Credit[] = [
  {
    id: 'bravura',
    lines: ['about.bravura'],
    files: [{ name: 'SIL Open Font License 1.1', path: `${LICENCES}bravura/LICENSE.txt` }],
  },
  {
    id: 'source',
    lines: ['about.sourceFonts'],
    files: [{ name: 'SIL Open Font License 1.1', path: `${LICENCES}source-fonts/OFL.txt` }],
  },
];

/** Replaces the placeholder `{name}` in a message with `node`. */
function withPart(text: string, name: string, node: ReactNode): ReactNode {
  const placeholder = `{${name}}`;
  const at = text.indexOf(placeholder);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      {node}
      {text.slice(at + placeholder.length)}
    </>
  );
}

/** Replaces `{url}` in a message with a link that shows the URL itself. */
function withUrl(text: string, url: string): ReactNode {
  return withPart(text, 'url', <a href={url}>{url}</a>);
}

type LoadState = { state: 'idle' | 'loading' | 'failed' } | { state: 'ready'; text: string };

/** A licence text, read from the app's own files when it is opened. */
function LicenceText({ file }: { file: LicenceFile }) {
  const t = useT();
  const [load, setLoad] = useState<LoadState>({ state: 'idle' });

  function onToggle(open: boolean) {
    if (!open || load.state === 'ready' || load.state === 'loading') return;
    setLoad({ state: 'loading' });
    fetch(file.path)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.text();
      })
      .then(
        (text) => setLoad({ state: 'ready', text }),
        () => setLoad({ state: 'failed' }),
      );
  }

  return (
    <details
      className="history-details licence-text"
      onToggle={(e) => onToggle(e.currentTarget.open)}
    >
      <summary>{t('about.licenceText', { name: file.name })}</summary>
      {load.state === 'ready' ? (
        <pre tabIndex={0}>{load.text}</pre>
      ) : load.state === 'failed' ? (
        <p className="help">{t('about.loadFailed')}</p>
      ) : (
        <p className="help">{t('about.loading')}</p>
      )}
    </details>
  );
}

function CreditItem({ credit }: { credit: Credit }) {
  const t = useT();
  return (
    <li className="credit">
      {credit.lines.map((key) => (
        <p key={key}>{t(key)}</p>
      ))}
      {credit.files.map((file) => (
        <LicenceText key={file.path} file={file} />
      ))}
    </li>
  );
}

/**
 * About dacapo and the licences of everything it ships: the Verovio credit its maintainers ask
 * App Store apps to show (docs/APPLE.md), the other libraries, the fonts and the music, with the
 * licence texts from public/licenses/. The same page in the browser and in the Apple app.
 */
export function AboutPage() {
  const t = useT();

  return (
    <section className="page about-page">
      <h1>{t('about.title')}</h1>
      <p>{t('settings.about.text', { version: __APP_VERSION__ })}</p>
      <p className="help">{t('about.intro')}</p>
      <ul className="about-links">
        <li>
          <a href={REPO_URL}>{t('settings.about.source')}</a>
        </li>
      </ul>
      <LicenceText file={{ name: 'MIT License', path: `${LICENCES}dacapo/LICENSE.txt` }} />

      <section className="field data" aria-labelledby="about-software">
        <h2 id="about-software">{t('about.software')}</h2>
        <ul className="credits">
          <li className="credit">
            <p>{withPart(t('about.verovio.role'), 'name', <strong>Verovio 6.3.0</strong>)}</p>
            <p>{t('about.verovio.copyright')}</p>
            <p>{t('about.verovio.licence')}</p>
            <p>{withUrl(t('about.verovio.included'), VEROVIO_NPM)}</p>
            <p>{withUrl(t('about.website'), VEROVIO_WEBSITE)}</p>
            <p>{withUrl(t('about.source'), VEROVIO_SOURCE)}</p>
            <p>{t('about.verovio.contains')}</p>
            <p className="help">{t('about.verovio.use')}</p>
            <LicenceText
              file={{ name: 'COPYING.LESSER', path: `${LICENCES}verovio/COPYING.LESSER` }}
            />
            <LicenceText file={{ name: 'COPYING', path: `${LICENCES}verovio/COPYING` }} />
            <LicenceText
              file={{
                name: 'pugixml, JSON, tuning-library, zip_file, midifile, CRC',
                path: `${LICENCES}verovio/THIRD-PARTY.txt`,
              }}
            />
            <LicenceText file={{ name: 'README.txt', path: `${LICENCES}verovio/README.txt` }} />
          </li>
          {SOFTWARE.map((credit) => (
            <CreditItem key={credit.id} credit={credit} />
          ))}
        </ul>
      </section>

      <section className="field data" aria-labelledby="about-fonts">
        <h2 id="about-fonts">{t('about.fonts')}</h2>
        <ul className="credits">
          {FONTS.map((credit) => (
            <CreditItem key={credit.id} credit={credit} />
          ))}
        </ul>
      </section>

      <section className="field data" aria-labelledby="about-music">
        <h2 id="about-music">{t('about.music')}</h2>
        <ul className="credits">
          <li className="credit">
            <p>{t('about.music.intro')}</p>
            <p>{t('about.music.ours')}</p>
          </li>
          <li className="credit">
            <p>{t('about.music.pdmx')}</p>
            <p>
              <a href="https://zenodo.org/records/15571083">PDMX</a>
              {' · '}
              <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
              {' · '}
              <a href="https://musescore.com/user/9292486/scores/5849868">PianoXML</a>
              {' · '}
              <a href="https://musescore.com/user/31901603/scores/5860733">jadr</a>
              {' · '}
              <a href="https://musescore.com/user/9836/scores/719631">OpenGoldberg</a>
            </p>
          </li>
        </ul>
      </section>
    </section>
  );
}
