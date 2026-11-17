import { useId } from 'react';
import { useI18n, type Locale } from '../i18n/index.ts';

// The official artwork keeps its own proportions in each language, at Apple's 40 px minimum.
const BADGE_WIDTH: Record<Locale, number> = {
  en: 119.66407,
  'zh-CN': 108.85157,
  'zh-TW': 108.85157,
  ja: 108.85157,
  ko: 129.70071,
};

/** A quiet recommendation at entry points, never over a practice or in the global navigation. */
export function KeeptimeRecommendation() {
  const { t, locale } = useI18n();
  const id = useId();
  const base = import.meta.env.BASE_URL;

  return (
    <aside className="keeptime" aria-labelledby={id}>
      <img
        className="keeptime-icon"
        src={`${base}keeptime/icon.webp`}
        alt={t('keeptime.icon')}
        width="80"
        height="80"
        loading="lazy"
      />
      <div className="keeptime-copy">
        <p className="keeptime-byline">{t('keeptime.byline')}</p>
        <h2 id={id} lang="en">
          Keeptime
        </h2>
        <p className="keeptime-description">{t('keeptime.description')}</p>
        <p className="keeptime-price">{t('keeptime.price')}</p>
      </div>
      <a
        className="keeptime-store"
        href="https://apps.apple.com/app/keeptime-metronome/id6832189111"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          src={`${base}badges/app-store-${locale}.svg`}
          alt={t('keeptime.appStore')}
          width={BADGE_WIDTH[locale]}
          height="40"
          loading="lazy"
        />
      </a>
    </aside>
  );
}
