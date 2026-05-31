import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format as dateFnsFormat } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SPANISH_MMM = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export function formatDateSpanish(date: Date, pattern: string): string {
  if (!date || isNaN(date.getTime())) return '';
  
  const monthIndex = date.getMonth();
  const spanishMonth = SPANISH_MMM[monthIndex];
  
  if (pattern.includes('MMM')) {
    if (pattern === 'dd MMM yyyy') {
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${day} ${spanishMonth} ${year}`;
    }
    if (pattern === 'dd MMM') {
      const day = String(date.getDate()).padStart(2, '0');
      return `${day} ${spanishMonth}`;
    }
    if (pattern === "HH:mm · d 'de' MMM" || pattern === "HH:mm · d 'de' MMMM") {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const day = date.getDate();
      return `${hours}:${minutes} · ${day} de ${spanishMonth}`;
    }
    if (pattern === "eeee, dd 'de' MMMM") {
      const SPANISH_MMMM = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
      const dayName = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][date.getDay()];
      const day = String(date.getDate()).padStart(2, '0');
      const monthLong = SPANISH_MMMM[monthIndex];
      return `${dayName}, ${day} de ${monthLong}`;
    }
  }
  
  let formatted = dateFnsFormat(date, pattern);
  const englishMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const englishMonthsUpper = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  
  for (let i = 0; i < englishMonths.length; i++) {
    formatted = formatted
      .replace(new RegExp(englishMonths[i], 'gi'), SPANISH_MMM[i])
      .replace(new RegExp(englishMonthsUpper[i], 'gi'), SPANISH_MMM[i]);
  }
  
  const spanishMonthsLower = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  for (let i = 0; i < spanishMonthsLower.length; i++) {
    formatted = formatted.replace(new RegExp(spanishMonthsLower[i], 'gi'), SPANISH_MMM[i]);
  }
  
  return formatted;
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

export function formatHours(decimalHours: number): string {
  const h = Math.floor(Math.abs(decimalHours));
  const m = Math.round((Math.abs(decimalHours) - h) * 60);
  return `${decimalHours < 0 ? '-' : ''}${h}h ${m}m`;
}

export function parseTime(timeStr?: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}

export function getActivityBounds(a: any): { minStart: number, maxEnd: number } {
  let minStart = Infinity;
  let maxEnd = -Infinity;

  if (a.startTimeMorning) {
     const sm = parseTime(a.startTimeMorning);
     let em = parseTime(a.endTimeMorning);
     if (em < sm) em += 24;
     minStart = Math.min(minStart, sm);
     maxEnd = Math.max(maxEnd, em);
  }
  
  if (a.startTimeAfternoon) {
     let sa = parseTime(a.startTimeAfternoon);
     let ea = parseTime(a.endTimeAfternoon);
     if (ea < sa) ea += 24;
     minStart = Math.min(minStart, sa);
     maxEnd = Math.max(maxEnd, ea);
  }

  if (!a.startTimeMorning && !a.startTimeAfternoon && a.startTime) {
     const sm = parseTime(a.startTime);
     let em = parseTime(a.endTime);
     if (em < sm) em += 24;
     minStart = Math.min(minStart, sm);
     maxEnd = Math.max(maxEnd, em);
  }

  return { minStart, maxEnd };
}

export function calculateRealHours(minStart: number, maxEnd: number, hasPause: boolean): number {
  if (minStart !== Infinity && maxEnd !== -Infinity) {
     let totalRealHours = maxEnd - minStart;
     if (totalRealHours < 0) totalRealHours = 0;
     if (hasPause) {
        totalRealHours -= 1;
        if (totalRealHours < 0) totalRealHours = 0;
     }
     return totalRealHours;
  }
  return 0;
}

export function capitalizeSentence(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

