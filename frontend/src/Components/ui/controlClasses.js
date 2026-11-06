export const LABEL = 'block font-medium';
export const HINT = 'mt-1 max-w-prose text-sm text-stone';
export const ERROR = 'mt-1 max-w-prose text-sm text-ember';

const CONTROL = 'mt-1 min-h-11 w-full rounded-control border bg-white px-3 text-ink read-only:bg-mist';

export function controlClasses(hasError) {
  return `${CONTROL} ${hasError ? 'border-ember' : 'border-stone'}`;
}
