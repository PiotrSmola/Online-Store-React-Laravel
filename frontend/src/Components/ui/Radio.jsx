import PropTypes from 'prop-types';

export default function Radio({ label, aside = null, hint = null, disabled = false, ...input }) {
  return (
    <label className={`flex min-h-11 items-center gap-3 py-1 ${disabled ? 'text-stone' : 'cursor-pointer'}`}>
      <input type="radio" disabled={disabled} className="size-5 shrink-0 accent-pine" {...input} />
      <span className="flex grow flex-wrap items-baseline justify-between gap-x-4">
        <span>
          {label}
          {hint && <span className="block text-sm text-stone">{hint}</span>}
        </span>
        {aside && <span>{aside}</span>}
      </span>
    </label>
  );
}

Radio.propTypes = {
  label: PropTypes.string.isRequired,
  aside: PropTypes.string,
  hint: PropTypes.string,
  disabled: PropTypes.bool,
};
