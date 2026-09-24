import { useT } from '../../i18n/index.ts';

export function SustainIndicator({ down }: { down: boolean }) {
  const t = useT();
  return (
    <div className={down ? 'sustain is-down' : 'sustain'}>
      <svg className="sustain-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4 16h12M6 16l2-11h4l2 11" />
      </svg>
      <span className="sustain-text">
        <span className="sustain-label">{t('play.sustain')}</span>
        <span className="sustain-state">{t(down ? 'play.sustain.down' : 'play.sustain.up')}</span>
      </span>
    </div>
  );
}
