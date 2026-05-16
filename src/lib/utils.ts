import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | number) {
  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatIncidentNumber(val: string): string {
  if (!val) return '';
  
  let clean = val.toUpperCase().replace(/[^A-Z0-9-]/g, '');

  if (['I', 'IN', 'INC', 'INC-'].includes(clean)) {
    return clean;
  }

  if (/^[0-9]/.test(clean)) {
    clean = 'INC-' + clean;
  }

  if (clean.startsWith('INC') && clean.length > 3 && clean[3] !== '-') {
    clean = 'INC-' + clean.substring(3);
  }

  let prefix = '';
  let rest = clean;
  if (clean.startsWith('INC-')) {
    prefix = 'INC-';
    rest = clean.substring(4);
  } else {
    prefix = 'INC-';
    rest = rest.replace(/^INC-?/, '');
  }

  rest = rest.replace(/-/g, '');

  if (rest.length === 0) return prefix;

  if (rest.length > 4) {
    return `${prefix}${rest.substring(0, 4)}-${rest.substring(4)}`;
  } else {
    return `${prefix}${rest}`;
  }
}
