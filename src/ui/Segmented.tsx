import { useId, type ReactNode } from 'react';

interface SegmentedProps<T extends string | number> {
  legend: string;
  name: string;
  options: readonly { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  help?: string;
  className?: string;
}

/** A choice of one among a few, as a row of segments in a fieldset (the Ear and Read setups). */
export function Segmented<T extends string | number>({
  legend,
  name,
  options,
  value,
  onChange,
  help,
  className,
}: SegmentedProps<T>) {
  const helpId = useId();
  return (
    <fieldset
      className={className ? `field ${className}` : 'field'}
      aria-describedby={help ? helpId : undefined}
    >
      <legend>{legend}</legend>
      <div className="segmented">
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {help && (
        <p id={helpId} className="help">
          {help}
        </p>
      )}
    </fieldset>
  );
}
