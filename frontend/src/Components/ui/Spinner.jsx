import PropTypes from 'prop-types';
import { LoaderCircle } from 'lucide-react';

/** inline: a decoration inside a busy button. Otherwise it announces the label. */
export default function Spinner({ inline = false, label = 'Ładowanie' }) {
  const icon = <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />;

  if (inline) return icon;

  return (
    <div role="status" className="gutter flex items-center gap-3 py-16 text-stone">
      {icon}
      <span>{label}</span>
    </div>
  );
}

Spinner.propTypes = {
  inline: PropTypes.bool,
  label: PropTypes.string,
};
