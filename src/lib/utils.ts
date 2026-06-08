import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format as dateFnsFormat } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resuelve y unifica los permisos del usuario de forma robusta,
 * tolerando variaciones de mayúsculas, minúsculas o textos largos de base de datos.
 */
export const resolverPermisosDeSesion = (rolDB: string = '') => {
  const rolNormalizado = rolDB.toLowerCase().trim();

  // Búsqueda tolerante: si el rol contiene la palabra "admin", es Administrador
  const esAdmin = rolNormalizado === 'admin' || rolNormalizado.includes('admin');
  
  // Si contiene la palabra "super", es Supervisor
  const esSupervisor = rolNormalizado === 'supervisor' || rolNormalizado.includes('super');
  
  // El rol técnico actúa como el fallback seguro del sistema
  const esTecnico = !esAdmin && !esSupervisor;

  return {
    esAdmin,
    esSupervisor,
    esTecnico,
    rolVisual: esAdmin ? 'ADMIN GENERAL' : esSupervisor ? 'SUPERVISOR' : 'TÉCNICO'
  };
};

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
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Función unificada para calcular métricas (Planas si todos, por técnico si se especifica)
 */
export function calculateMetrics(activities: import('../types').Activity[], selectedTechnician: string = 'todos') {
  let total = 0;
  let stAcumulado = 0;
  let dfAcumulado = 0;

  activities.forEach(a => {
    const parts = a.participants && a.participants.length > 0 ? a.participants : (a.technicianName ? [a.technicianName] : []);
    const activityTotal = a.totalHours || ((a.overtimeHours || 0) + 8);
    const activitySt = (a.overtimeHours || 0);

    if (selectedTechnician === 'todos') {
      total += activityTotal;
      stAcumulado += activitySt > 0 ? activitySt : 0;
      dfAcumulado += activitySt < 0 ? Math.abs(activitySt) : 0;
    } else {
      const hasTech = parts.some((p: string) => (p || '').toLowerCase().trim() === selectedTechnician.toLowerCase().trim());
      if (hasTech) {
        total += activityTotal;
        stAcumulado += activitySt > 0 ? activitySt : 0;
        dfAcumulado += activitySt < 0 ? Math.abs(activitySt) : 0;
      }
    }
  });

  return { total, stAcumulado, dfAcumulado };
}

/**
 * Función unificada para calcular casos de fatiga (exceso de horas)
 */
export function calculateExcesoPersonas(acts: import('../types').Activity[], considerDate: boolean = true) {
  const dailyHoursForTech: Record<string, { minStart: number, maxEnd: number, hasPause: boolean, titles: string[], name: string, dateObj: Date | null }> = {};
  
  acts.forEach(a => {
    let dateKey = 'same_day';
    let dateObj: Date | null = null;
    
    if (a.date) {
      try {
        dateObj = typeof a.date.toDate === 'function' ? a.date.toDate() : new Date(a.date as any);
      } catch {
        dateObj = null;
      }
    }

    if (considerDate && dateObj) {
      dateKey = dateObj.toISOString().split('T')[0];
    }

    const parts = a.participants && a.participants.length > 0 ? a.participants : (a.technicianName ? [a.technicianName] : []);
    const { minStart, maxEnd } = getActivityBounds(a);

    parts.forEach(p => {
      const key = considerDate ? `${dateKey}_${p}` : p;
      if (!dailyHoursForTech[key]) {
        dailyHoursForTech[key] = { minStart: Infinity, maxEnd: -Infinity, hasPause: false, titles: [], name: p, dateObj };
      }
      
      if (a.hasPause === 'SI') {
        dailyHoursForTech[key].hasPause = true;
      }

      if (minStart !== Infinity) {
        dailyHoursForTech[key].minStart = Math.min(dailyHoursForTech[key].minStart, minStart);
      }
      if (maxEnd !== -Infinity) {
        dailyHoursForTech[key].maxEnd = Math.max(dailyHoursForTech[key].maxEnd, maxEnd);
      }
      if (!dailyHoursForTech[key].titles.includes(a.title)) {
         dailyHoursForTech[key].titles.push(a.title);
      }
    });
  });

  const items: Array<{ name: string, total: number, titles: string[], date: Date | null }> = [];
  Object.values(dailyHoursForTech).forEach(dayData => {
     if (dayData.minStart !== Infinity && dayData.maxEnd !== -Infinity) {
        const totalRealHours = calculateRealHours(dayData.minStart, dayData.maxEnd, dayData.hasPause);
        if (totalRealHours > 10.0) {
           items.push({
             name: dayData.name,
             total: totalRealHours,
             titles: dayData.titles,
             date: dayData.dateObj
           });
        }
     }
  });

  if (considerDate) {
     items.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }

  return { count: items.length, items };
}

export const optimizarAlturasJustificacionSGA = (worksheet: any) => {
  // Columna 15 (O) por defecto (Failsafe)
  let colIndexJustifique = 15;

  // Escáner con soporte para RichText para detectar la columna real
  const totalFilasParaEscanear = Math.min(worksheet.rowCount, 3);
  for (let i = 1; i <= totalFilasParaEscanear; i++) {
    const fila = worksheet.getRow(i);
    fila.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
      let valorTexto = '';
      if (cell.value) {
        if (typeof cell.value === 'string') {
          valorTexto = cell.value;
        } else if (typeof cell.value === 'object') {
          if ('richText' in cell.value && Array.isArray(cell.value.richText)) {
            valorTexto = cell.value.richText.map((t: any) => t.text || '').join('');
          } else if ('result' in cell.value && cell.value.result) {
            valorTexto = cell.value.result.toString();
          }
        } else {
          valorTexto = cell.value.toString();
        }
      }

      const valNormalizado = valorTexto
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();

      if (valNormalizado === 'JUSTIFIQUE' || valNormalizado === 'JUSTIFICACION') {
        colIndexJustifique = colNumber;
      }
    });
  }

  // Fijar ancho de columna a 50 puntos de Excel
  worksheet.getColumn(colIndexJustifique).width = 50;

  // Bucle numérico estricto para procesar todas las filas
  const totalFilas = worksheet.rowCount;
  for (let r = 1; r <= totalFilas; r++) {
    const row = worksheet.getRow(r);

    // Omitir la fila 1 de cabecera
    if (r === 1) {
      row.height = 24; // Alto estético para títulos
      continue;
    }

    const celdaJustifique = row.getCell(colIndexJustifique);
    const texto = celdaJustifique.value ? celdaJustifique.value.toString().trim() : '';

    // Si la celda de justificación está vacía
    if (texto === '') {
      row.height = 14.5; // Alto estándar plano para filas sin justificación
      continue;
    }

    // Configurar alineamiento superior y ajuste de párrafo (Wrap Text)
    celdaJustifique.alignment = {
      vertical: 'top',
      horizontal: 'left',
      wrapText: true
    };

    // Conteo de líneas con divisor calibrado de 58 caracteres
    const caracteresPorLinea = 58;
    const parrafos = texto.split('\n');
    let totalLineas = 0;

    parrafos.forEach((parrafo: string) => {
      const lineasDelParrafo = Math.ceil(parrafo.length / caracteresPorLinea);
      totalLineas += lineasDelParrafo === 0 ? 1 : lineasDelParrafo;
    });

    // ESCALA DE ALTURAS CEÑIDAS (Elimina por completo el aire muerto inferior)
    if (totalLineas === 1) {
      row.height = 14.5; // 1 línea (Alto estándar de Excel, totalmente chata)
    } else if (totalLineas === 2) {
      row.height = 25.5; // 2 líneas
    } else if (totalLineas === 3) {
      row.height = 36.5; // 3 líneas
    } else if (totalLineas === 4) {
      row.height = 47.5; // 4 líneas
    } else {
      // Escalabilidad para justificaciones muy largas
      row.height = 47.5 + (totalLineas - 4) * 11;
    }
  }
};

