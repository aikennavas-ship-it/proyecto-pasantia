/**
 * src/modules/activities/components/SmartSpreadsheet.tsx
 * 
 * ACTIVITIES MODULE - Planilla Inteligente
 * -----------------------------------------
 * Pertenece al módulo central de 'Activities' (Labores). Es la vista de cuadrícula
 * (tipo Excel) para entrada de datos diarios.
 * 
 * Características:
 * - Carga registros basados en el componente `<ActivityForm>`
 * - Genera cálculos en vivo de (S.T) Sobretiempos y (D.F) Descanso Fuera
 * - Gestiona la exportación directa a Excel y opciones de ordenación de filas.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Download, Table, Calendar, ChevronLeft, ChevronRight, ChevronDown, FileText, Plus, Database, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Search, AlertOctagon, X, Clock, Zap, TrendingDown } from 'lucide-react';
import { Activity, Technician, UserProfile } from '../../../types';
import { cn, formatDateSpanish, capitalizeSentence, getActivityBounds, calculateRealHours, parseTime } from '../../../lib/utils';
import { format, startOfDay, endOfDay, isSameDay, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { formatHours } from './ActivityForm';

function CustomSelect({ value, options, onChange, className, align = 'center' }: { value: any, options: {value: any, label: string, disabled?: boolean}[], onChange: (val: any) => void, className?: string, align?: 'left'|'center'|'right' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value.toString() === value.toString()) || options[0];

  return (
    <div className={cn("relative flex-1", className)} ref={containerRef}>
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full h-full flex items-center justify-center bg-transparent py-2 px-1 hover:bg-slate-50 cursor-pointer rounded-xl transition-colors focus:outline-none"
      >
        <span className="text-xs font-black text-slate-800 capitalize">
          {selectedOption?.label}
        </span>
      </button>
      
      {isOpen && (
        <div className={cn(
          "absolute top-full mt-1 bg-white rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.15)] border border-slate-200 py-1.5 z-[100] max-h-48 overflow-y-auto custom-scrollbar min-w-[70px]",
          align === 'center' ? 'left-1/2 -translate-x-1/2' : (align === 'right' ? 'right-0' : 'left-0')
        )}>
          {options.map((opt) => (
            <button
              key={`opt-${opt.value}`}
              disabled={opt.disabled}
              onClick={() => {
                if (opt.disabled) return;
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={cn(
                "w-full px-3 py-1.5 text-xs font-bold transition-colors capitalize text-left",
                opt.value.toString() === value.toString()
                  ? "bg-brand-blue/10 text-brand-blue" 
                  : (opt.disabled 
                      ? "text-slate-300 opacity-40 cursor-not-allowed" 
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900")
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const ExpandableText = ({ 
  text, 
  className = "", 
  containerClassName = "",
  buttonClassName = "",
  maxLength = 75 
}: { 
  text: string; 
  className?: string; 
  containerClassName?: string;
  buttonClassName?: string;
  maxLength?: number;
}) => {
  const [expanded, setExpanded] = useState(false);
  
  if (!text || text === '---' || text === 'S/N' || text === 'No justificado.') {
    return <div className={cn("inline-block", containerClassName)}><span className={className}>{text}</span></div>;
  }

  const isLong = text.length > maxLength;

  // Flatten and replace newlines with a single space when collapsed to avoid vertical break offset
  const processedText = !expanded 
    ? text.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ') 
    : text;

  const displayText = !expanded && isLong 
    ? processedText.substring(0, maxLength).trimEnd() 
    : processedText;

  return (
    <div className={cn("inline-block w-full", containerClassName)}>
      <span className={cn(className, !expanded && "line-clamp-2 inline")}>
        {displayText}
        {isLong && (
          <button 
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className={cn("text-[10px] text-brand-blue font-bold hover:underline inline ml-1 active:scale-95 transition-all cursor-pointer whitespace-nowrap align-baseline", buttonClassName)}
          >
            {expanded ? ' (Ver menos)' : '... ver más...'}
          </button>
        )}
      </span>
    </div>
  );
};

const formatTimeAMPM = (time24: string) => {
  if (!time24 || time24 === '--:--') return '--:--';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  const [hours, minutes] = parts;
  const h = parseInt(hours, 10);
  if (isNaN(h)) return time24;
  return `${h.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`;
};

const formatTime24h = (time24: string, defaultValue: string) => {
  if (!time24 || time24 === '--:--' || !time24.trim()) return defaultValue;
  // Strip AM/PM if somehow present
  let cleaned = time24.replace(/\s*[aApP][mM]\s*/g, '').trim();
  const parts = cleaned.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
  }
  return defaultValue;
};

interface SmartSpreadsheetProps {
  activities: Activity[];
  technicians: Technician[];
  onAddActivity?: () => void;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onEdit?: (activity: Activity) => void;
  onDelete?: (id: string, title: string) => void;
  highlightedId?: string | null;
  user?: UserProfile | null;
}

export default function SmartSpreadsheet({ activities, technicians, onAddActivity, selectedDate, onDateChange, onEdit, onDelete, highlightedId, user }: SmartSpreadsheetProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedTechnician, setSelectedTechnician] = React.useState<string>('todos');
  const [summaryDetails, setSummaryDetails] = React.useState<'total' | 'st' | 'df' | 'exceso' | null>(null);
  const [weeklySummaryDetails, setWeeklySummaryDetails] = React.useState<'total' | 'st' | 'df' | 'exceso' | null>(null);

  // Determine "Today" in Maracay (UTC-4)
  const getTodayInMaracay = () => {
    const now = new Date();
    const offset = -4; 
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const maracayTime = new Date(utc + (3600000 * offset));
    return startOfDay(maracayTime);
  };

  const today = getTodayInMaracay();
  const isFuture = selectedDate >= today;

  // Filter activities for the selected date and search term
  const filteredActivities = React.useMemo(() => {
    return activities.filter(a => {
      if (!a || !a.date) return false;
      let activityDate: Date;
      try {
        activityDate = typeof a.date.toDate === 'function' ? a.date.toDate() : new Date(a.date as any);
      } catch {
        activityDate = new Date();
      }
      const isToday = isSameDay(activityDate, selectedDate);
      const matchesSearch = searchTerm === '' || 
        (a.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.incidentNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.technicianName || '').toLowerCase().includes(searchTerm.toLowerCase());
        
      const matchesTechnician = selectedTechnician === 'todos' || 
        (a.technicianName || '') === selectedTechnician || 
        (a.participants || []).includes(selectedTechnician);
      
      return isToday && matchesSearch && matchesTechnician;
    });
  }, [activities, selectedDate, searchTerm, selectedTechnician]);

  const weeklyActivities = React.useMemo(() => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
    
    return activities.filter(a => {
      if (!a || !a.date) return false;
      let activityDate: Date;
      try {
        activityDate = typeof a.date.toDate === 'function' ? a.date.toDate() : new Date(a.date as any);
      } catch {
        activityDate = new Date();
      }
      const isWithinWeek = activityDate >= weekStart && activityDate <= weekEnd;
      
      const matchesTechnician = selectedTechnician === 'todos' || 
        (a.technicianName || '') === selectedTechnician || 
        (a.participants || []).includes(selectedTechnician);
        
      return isWithinWeek && matchesTechnician;
    });
  }, [activities, selectedDate, selectedTechnician]);

  const sortedActivities = filteredActivities;

  const dailyMetrics = React.useMemo(() => {
    const total = sortedActivities.reduce((acc, a) => acc + (a.totalHours || (a.overtimeHours || 0) + 8), 0);
    const stAcumulado = sortedActivities.reduce((acc, a) => {
      const st = (a.overtimeHours || 0);
      return acc + (st > 0 ? st : 0);
    }, 0);
    const dfAcumulado = Math.abs(sortedActivities.reduce((acc, a) => {
      const st = (a.overtimeHours || 0);
      return acc + (st < 0 ? st : 0);
    }, 0));
    return { total, stAcumulado, dfAcumulado };
  }, [sortedActivities]);

  const weeklyMetrics = React.useMemo(() => {
    const total = weeklyActivities.reduce((acc, a) => acc + (a.totalHours || (a.overtimeHours || 0) + 8), 0);
    const stAcumulado = weeklyActivities.reduce((acc, a) => {
      const r_st = (a.overtimeHours || 0);
      return acc + (r_st > 0 ? r_st : 0);
    }, 0);
    const dfAcumulado = Math.abs(weeklyActivities.reduce((acc, a) => {
      const r_st = (a.overtimeHours || 0);
      return acc + (r_st < 0 ? r_st : 0);
    }, 0));
    return { total, stAcumulado, dfAcumulado };
  }, [weeklyActivities]);

  // Shared helper for calculating true hours (with getBounds logic)
  const calculateExcesoPersonasForActivities = (acts: Activity[], considerDate: boolean) => {
    const dailyHoursForTech: Record<string, { minStart: number, maxEnd: number, hasPause: boolean, titles: string[], name: string, dateObj: Date | null }> = {};
    
    acts.forEach(a => {
      let dateKey = 'same_day';
      let dateObj: Date | null = null;
      if (considerDate) {
        if (a.date && typeof a.date.toDate === 'function') {
          dateObj = a.date.toDate();
          dateKey = dateObj!.toISOString().split('T')[0];
        } else if (a.date) {
          try {
            dateObj = new Date(a.date as any);
            dateKey = dateObj.toISOString().split('T')[0];
          } catch {
            dateKey = 'unknown';
          }
        }
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
       const totalRealHours = calculateRealHours(dayData.minStart, dayData.maxEnd, dayData.hasPause);
       if (totalRealHours > 10.0) {
         items.push({
           name: dayData.name,
           total: totalRealHours,
           titles: dayData.titles,
           date: dayData.dateObj
         });
       }
    });

    if (considerDate) {
       items.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    }

    return { count: items.length, items };
  };

  const dayExcesoData = React.useMemo(() => {
    return calculateExcesoPersonasForActivities(sortedActivities, false);
  }, [sortedActivities]);
  
  const excesoPersonas = dayExcesoData.count;

  const weekExcesoData = React.useMemo(() => {
    return calculateExcesoPersonasForActivities(weeklyActivities, true);
  }, [weeklyActivities]);
  
  const excesoPersonasSemanal = weekExcesoData.count;



  const exportSobretiempoToExcel = async (activitiesList = sortedActivities, period: 'daily' | 'weekly' | 'monthly' = 'daily') => {
    if (!activitiesList || activitiesList.length === 0) {
      console.warn("No hay actividades registradas.");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      let sheetName = '';
      if (period === 'monthly') {
        sheetName = `Mes_${format(selectedDate, 'MM-yyyy')}`;
      } else if (period === 'weekly') {
        sheetName = `Semana_${format(startOfWeek(selectedDate, {weekStartsOn: 1}), 'dd-MM')}`;
      } else {
        sheetName = format(selectedDate, 'dd-MM-yyyy');
      }
      const sheet = workbook.addWorksheet(sheetName.substring(0, 31));

      sheet.columns = [
        { header: 'AREA', key: 'area', width: 12 },
        { header: 'P00', key: 'p00', width: 10 },
        { header: 'Nombres y Apellidos', key: 'name', width: 28 },
        { header: 'Cedula', key: 'cedula', width: 12 },
        { header: 'Región', key: 'region', width: 10 },
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Codigo', key: 'codigo', width: 10 },
        { header: 'Causa', key: 'causa', width: 25 },
        { header: 'Hora Entrada Mañana', key: 'he_m', width: 22 },
        { header: 'Hora Salida Mañana', key: 'hs_m', width: 22 },
        { header: 'Pausa', key: 'pausa', width: 8 },
        { header: 'Hora Entrada Tarde', key: 'he_t', width: 22 },
        { header: 'Hora Salida Tarde', key: 'hs_t', width: 22 },
        { header: 'HORAS', key: 'horas', width: 10 },
        { header: 'JUSTIFIQUE', key: 'justifique', width: 45 }
      ];

      const headerRow = sheet.getRow(1);
      headerRow.height = 30;

      headerRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true, color: { argb: colNumber === 1 || colNumber === 15 ? 'FF000000' : 'FFFFFFFF' }, size: 9, name: 'Arial' };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
        
        let fgColor = 'FF4F81BD'; // Blue 
        
        if (colNumber === 1) fgColor = 'FFF79646'; // AREA (Orange)
        if (colNumber >= 9 && colNumber <= 13) fgColor = 'FF5B9BD5'; // Horarios (Lighter Blue)
        if (colNumber === 15) fgColor = 'FFFCD5B4'; // JUSTIFIQUE (Peach)

        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } }, left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } }, right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });

      const sortedActs = [...activitiesList].sort((x, y) => {
        const getTimestamp = (act: any) => {
          if (!act.date) return 0;
          if (typeof act.date.toDate === 'function') {
            return act.date.toDate().getTime();
          }
          return new Date(act.date as any).getTime();
        };
        return getTimestamp(x) - getTimestamp(y);
      });

      sortedActs.forEach(a => {
        const parts = a.participants && a.participants.length > 0 ? a.participants : (a.technicianName ? [a.technicianName] : []);
        
        parts.forEach(p => {
          const techMatch = technicians.find(t => (t.name || '').toLowerCase() === (p || '').toLowerCase());
          
          let he_m = formatTime24h(a.startTimeMorning || '', '07:30');
          let hs_m = formatTime24h(a.endTimeMorning || '', '11:45');
          let pausa = a.hasPause || 'SI';
          let he_t = formatTime24h(a.startTimeAfternoon || '', '12:45');
          let hs_t = formatTime24h(a.endTimeAfternoon || a.endTime || '', '16:00');
          let region = a.region || 'Central';

          let fechaValue = 'S/N';
          try {
            if (a.date) {
              const d = typeof (a.date as any).toDate === 'function' ? (a.date as any).toDate() : new Date(a.date as any);
              if (!isNaN(d.getTime())) {
                fechaValue = format(d, 'dd/MM/yyyy');
              }
            }
          } catch(e) {}

          const row = sheet.addRow({
            area: '',
            p00: techMatch && techMatch.employeeId ? techMatch.employeeId : '',
            name: (p || '').toUpperCase(),
            cedula: techMatch && (techMatch as any).idCard ? (techMatch as any).idCard : 'S/N',
            region: region,
            fecha: fechaValue,
            codigo: a.code || 'HORA',
            causa: a.cause || '', 
            he_m, hs_m, pausa, he_t, hs_t,
            horas: a.totalHours ? formatHours(a.totalHours) : '',
            justifique: a.justification || ((a.overtimeHours || 0) === 0 ? 'Jornada estándar sin sobretiempo ni déficit.' : 'No justificado.')
          });

          row.eachCell(cell => {
            cell.font = { size: 9, name: 'Arial' };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
            cell.numFmt = '@'; // Force text format
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF000000' } },
              left: { style: 'thin', color: { argb: 'FF000000' } },
              bottom: { style: 'thin', color: { argb: 'FF000000' } },
              right: { style: 'thin', color: { argb: 'FF000000' } }
            };
          });

          row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
          row.getCell(15).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          row.height = Math.max(15, Math.ceil((row.getCell(15).text?.length || 10) / 45) * 15);
        });
      });

      sheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 0;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 12 ? 12 : maxLength + 4;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      
      const dayName = format(new Date(), 'EEEE', { locale: es });
      const day = format(new Date(), 'dd');
      const monthName = format(new Date(), 'MMMM', { locale: es });
      const year = format(new Date(), 'yyyy');
      const dataDate = format(selectedDate, 'dd-MM-yyyy');
      
      let fileName = '';
      if (period === 'monthly') {
        fileName = `Sobretiempo_CANTV_${day}_${monthName}_${year}_Mes_${format(selectedDate, 'MMMM_yyyy', { locale: es })}.xlsx`;
      } else if (period === 'weekly') {
        fileName = `Sobretiempo_CANTV_${day}_${monthName}_${year}_Semana_De_${format(startOfWeek(selectedDate, {weekStartsOn: 1}), 'dd-MM')}_AL_${format(endOfWeek(selectedDate, {weekStartsOn: 1}), 'dd-MM')}.xlsx`;
      } else {
        fileName = `Sobretiempo_CANTV_${day}_${monthName}_${year}_${dayName}_Generado_De_${dataDate}.xlsx`;
      }
      
      saveAs(new Blob([buffer]), fileName);
    } catch (err: any) {
      console.error("Error exporting Excel:", err);
      alert("Error al generar Excel: " + (err.message || "Desconocido"));
    }
  };

  const exportPlanificacionToExcel = async (activitiesList = sortedActivities, period: 'daily' | 'weekly' | 'monthly' = 'daily') => {
    if (!activitiesList || activitiesList.length === 0) {
      console.warn("No hay actividades registradas.");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      let sheetName = '';
      if (period === 'monthly') {
        sheetName = `Mes_${format(selectedDate, 'MM-yyyy')}`;
      } else if (period === 'weekly') {
        sheetName = `Semana_${format(startOfWeek(selectedDate, {weekStartsOn: 1}), 'dd-MM')}`;
      } else {
        sheetName = format(selectedDate, 'dd-MM-yyyy');
      }
      const sheet = workbook.addWorksheet(sheetName.substring(0, 31));

      const getTechDept = (t: Technician) => {
        if (t.department && t.department.trim()) return t.department.trim().toUpperCase();
        const spec = (t.specialty || '').toLowerCase();
        if (spec.includes('transmision') || spec.includes('transmisión')) return 'TRANSMISIÓN';
        return 'DATOS';
      };

      const deptsMap = new Map<string, Technician[]>();
      technicians.forEach(t => {
        const d = getTechDept(t);
        if (!deptsMap.has(d)) deptsMap.set(d, []);
        deptsMap.get(d)!.push(t);
      });

      const orderedDepts = Array.from(deptsMap.keys()).sort((a, b) => {
        if (a === 'TRANSMISIÓN' || a === 'TRANSMISION') return -1;
        if (b === 'TRANSMISIÓN' || b === 'TRANSMISION') return 1;
        if (a === 'DATOS') return -1;
        if (b === 'DATOS') return 1;
        return a.localeCompare(b);
      });

      const planTechs: Technician[] = [];
      const deptsInfo: { name: string; startIdx: number; count: number }[] = [];

      orderedDepts.forEach(deptName => {
        const techs = deptsMap.get(deptName)!;
        if (techs.length > 0) {
          deptsInfo.push({
            name: deptName,
            startIdx: 4 + planTechs.length,
            count: techs.length
          });
          planTechs.push(...techs);
        }
      });

      const cols = [
        { header: 'FECHA', key: 'fecha', width: 12 },
        { header: 'FLOTA', key: 'flota', width: 10 },
        { header: 'INCIDENTE', key: 'incidente', width: 45 },
      ];
      
      planTechs.forEach(t => {
        const nameParts = t.name.split(' ');
        const shortName = nameParts[0].toUpperCase();
        cols.push({ header: shortName, key: `tech_${t.id}`, width: 10 });
      });

      cols.push(
        { header: 'DOCUMENTACION', key: 'doc', width: 15 },
        { header: 'SOBRETIEMPO', key: 'st', width: 18 },
        { header: 'DEFICIT', key: 'deficit', width: 15 },
        { header: 'Hora Entrada Mañana', key: 'he_m', width: 22 },
        { header: 'Hora Salida Mañana', key: 'hs_m', width: 22 },
        { header: 'Pausa', key: 'pausa', width: 10 },
        { header: 'Hora Entrada Tarde', key: 'he_t', width: 22 },
        { header: 'Hora Salida Tarde', key: 'hs_t', width: 22 },
        { header: 'JUSTIFIQUE', key: 'justifique', width: 45 },
        { header: 'HORAS', key: 'horas', width: 10 },
        { header: 'MANEJO', key: 'manejo', width: 15 },
        { header: 'VIATICOS', key: 'viaticos', width: 12 },
        { header: 'MONTO VIATICOS (Bs.)', key: 'monto_viaticos', width: 22 },
        { header: 'DEPARTAMENTO', key: 'dpto', width: 15 }
      );

      sheet.columns = cols;
      sheet.insertRow(1, []);

      deptsInfo.forEach(info => {
        if (info.count > 0) {
          sheet.mergeCells(1, info.startIdx, 1, info.startIdx + info.count - 1);
          const cell = sheet.getCell(1, info.startIdx);
          cell.value = info.name;
          cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF000000' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });

      const styleHeader = (rowNum: number) => {
        const row = sheet.getRow(rowNum);
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B0F0' } };
          cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF000000' } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } }, left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } }, right: { style: 'thin', color: { argb: 'FF000000' } }
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
        });
      };

      styleHeader(1);
      styleHeader(2);

      const sortedActs = [...activitiesList].sort((x, y) => {
        const getTimestamp = (act: any) => {
          if (!act.date) return 0;
          if (typeof act.date.toDate === 'function') {
            return act.date.toDate().getTime();
          }
          return new Date(act.date as any).getTime();
        };
        return getTimestamp(x) - getTimestamp(y);
      });

      sortedActs.forEach(a => {
        let fechaValue = 'S/N';
        try {
          if (a.date) {
            const d = typeof (a.date as any).toDate === 'function' ? (a.date as any).toDate() : new Date(a.date as any);
            if (!isNaN(d.getTime())) {
              fechaValue = format(d, 'dd-MM-yy');
            }
          }
        } catch(e) {}

        const data: any = {
          fecha: fechaValue,
          flota: a.fleet || '',
          incidente: a.incidentNumber ? ` ${a.incidentNumber} - ${a.title}` : a.title,
          doc: '',
          st: a.overtimeHours && a.overtimeHours > 0 ? `${formatHours(a.overtimeHours)}` : 'no',
          deficit: typeof a.overtimeHours === 'number' && a.overtimeHours < 0 ? `${formatHours(a.overtimeHours)}` : 'no',
          he_m: formatTime24h(a.startTimeMorning || '', '07:30'),
          hs_m: formatTime24h(a.endTimeMorning || '', '11:45'),
          pausa: a.hasPause || 'SI',
          he_t: formatTime24h(a.startTimeAfternoon || '', '12:45'),
          hs_t: formatTime24h(a.endTimeAfternoon || a.endTime || '', '16:00'),
          justifique: a.justification || ((a.overtimeHours || 0) === 0 ? 'Jornada estándar sin sobretiempo ni déficit.' : 'No justificado.'),
          horas: a.totalHours ? formatHours(a.totalHours) : '',
          manejo: a.driver || '',
          viaticos: a.hasPerDiem ? 'si' : 'no',
          monto_viaticos: a.hasPerDiem ? Number(a.perDiemAmount || 0).toFixed(2) : '0.00',
          dpto: ''
        };

        const parts = a.participants && a.participants.length > 0 ? a.participants : (a.technicianName ? [a.technicianName] : []);
        planTechs.forEach(t => {
           const isParticipant = parts.some((p: string) => (p || '').toLowerCase().trim() === (t.name || '').toLowerCase().trim());
           data[`tech_${t.id}`] = isParticipant ? 'X' : '';
         });

        const row = sheet.addRow(data);

        row.eachCell((cell, colNumber) => {
          cell.font = { size: 9, name: 'Arial' };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
          cell.numFmt = '@'; // Force text format
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
          
          if (colNumber === 3) {
            cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          }
          if (colNumber >= 4 && colNumber <= 3 + planTechs.length) {
            cell.font = { size: 9, name: 'Arial', bold: true };
          }
        });
      });

      sheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 0;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 12 ? 12 : maxLength + 4;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const dayName = format(new Date(), 'EEEE', { locale: es });
      const day = format(new Date(), 'dd');
      const monthName = format(new Date(), 'MMMM', { locale: es });
      const year = format(new Date(), 'yyyy');
      const dataDate = format(selectedDate, 'dd-MM-yyyy');
      
      let fileName = '';
      if (period === 'monthly') {
        fileName = `Planificacion_CANTV_${day}_${monthName}_${year}_Mes_${format(selectedDate, 'MMMM_yyyy', { locale: es })}.xlsx`;
      } else if (period === 'weekly') {
        fileName = `Planificacion_CANTV_${day}_${monthName}_${year}_Semana_De_${format(startOfWeek(selectedDate, {weekStartsOn: 1}), 'dd-MM')}_AL_${format(endOfWeek(selectedDate, {weekStartsOn: 1}), 'dd-MM')}.xlsx`;
      } else {
        fileName = `Planificacion_CANTV_${day}_${monthName}_${year}_${dayName}_Generado_De_${dataDate}.xlsx`;
      }
      
      saveAs(new Blob([buffer]), fileName);
    } catch (err: any) {
      console.error("Error exporting Excel:", err);
      alert("Error al generar Planificación: " + (err.message || "Desconocido"));
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Excel Header Control */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02),0_15px_35px_rgba(0,0,0,0.06)] border border-slate-200">
        <div className="flex flex-row items-center gap-3 sm:gap-4 w-full xl:w-auto overflow-hidden">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-brand-blue to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-blue/15 shrink-0">
            <Table size={24} className="sm:size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg lg:text-xl font-display font-black text-slate-900 tracking-tight uppercase truncate">Planilla Inteligente</h2>
            <div className="flex flex-row sm:flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5 overflow-hidden">
              <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider truncate">Formato Excel Estándar</p>
              <div className="hidden sm:block w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-slate-300 shrink-0" />
              <p className="text-[8px] sm:text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1 shrink-0 truncate">
                Central Maracay 4357
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
          {/* Date Selector and Actions */}
          <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-200 shadow-sm relative group/date w-full md:w-auto shrink-0">
            <button 
              onClick={() => onDateChange(subDays(selectedDate, 1))}
              className="w-10 h-10 shrink-0 flex items-center justify-center hover:bg-white hover:text-brand-blue rounded-xl transition-all hover:shadow-md border border-transparent hover:border-slate-200"
            >
              <ChevronLeft size={20} />
            </button>
            
            <div className="flex-1 flex justify-between items-center gap-1 min-w-0 bg-white/80 rounded-2xl border-2 border-slate-200 py-1 shadow-sm mx-1 w-full md:w-[260px]">
              {/* Day Selector */}
              {(() => {
                const selectedYearNum = parseInt(format(selectedDate, 'yyyy'));
                const selectedMonthNum = parseInt(format(selectedDate, 'M')); // 1-12
                const selectedMonthIndex = selectedMonthNum - 1; // 0-11
                const currentYear = today.getFullYear();
                const currentMonth = today.getMonth() + 1; // 1-12
                const currentDay = today.getDate();
                
                // Calculate days in month dynamically, taking leap years into account
                const daysInMonth = new Date(selectedYearNum, selectedMonthIndex + 1, 0).getDate();

                return (
                  <>
                    <CustomSelect 
                      value={format(selectedDate, 'd')}
                      options={Array.from({ length: daysInMonth }, (_, i) => {
                        const dVal = i + 1;
                        return { 
                          value: dVal.toString(), 
                          label: dVal.toString().padStart(2, '0')
                        };
                      }).filter(opt => {
                        const dVal = parseInt(opt.value);
                        const isFutureDay = (selectedYearNum === currentYear && selectedMonthNum === currentMonth) && dVal > currentDay;
                        const isFutureComplete = selectedYearNum > currentYear || (selectedYearNum === currentYear && selectedMonthNum > currentMonth);
                        return !(isFutureComplete || isFutureDay);
                      })}
                      onChange={(val) => {
                        const newDate = new Date(selectedDate);
                        newDate.setDate(parseInt(val));
                        onDateChange(newDate);
                      }}
                    />

                    <div className="w-[1px] h-4 bg-slate-200 shrink-0" />

                    {/* Month Selector with Dynamic Slice */}
                    <CustomSelect 
                      value={format(selectedDate, 'M')}
                      options={Array.from({ length: 12 }, (_, i) => {
                        const mVal = i + 1;
                        return { 
                          value: mVal.toString(), 
                          label: format(new Date(2024, i, 1), 'MMMM', { locale: es })
                        };
                      }).filter(opt => {
                        if (selectedYearNum === currentYear) {
                          return parseInt(opt.value) <= currentMonth;
                        }
                        return true;
                      })}
                      onChange={(val) => {
                        const newDate = new Date(selectedDate);
                        newDate.setMonth(parseInt(val) - 1);
                        // Safe day limit adjustment if changing months makes the currently selected day out of bounds
                        const targetDays = new Date(selectedYearNum, parseInt(val), 0).getDate();
                        if (newDate.getDate() > targetDays) {
                          newDate.setDate(targetDays);
                        }
                        onDateChange(newDate);
                      }}
                      className="flex-[2] min-w-0"
                    />

                    <div className="w-[1px] h-4 bg-slate-200 shrink-0" />

                    {/* Year Selector - Dynamic Range strictly up to currentYear */}
                    <CustomSelect 
                      value={format(selectedDate, 'yyyy')}
                      options={Array.from(
                        { length: currentYear - 2024 + 1 }, 
                        (_, i) => {
                          const yr = currentYear - i;
                          return { 
                            value: yr.toString(), 
                            label: yr.toString()
                          };
                        }
                      )}
                      onChange={(val) => {
                        const newDate = new Date(selectedDate);
                        newDate.setFullYear(parseInt(val));
                        onDateChange(newDate);
                      }}
                    />
                  </>
                );
              })()}
            </div>

            <button 
              onClick={() => onDateChange(addDays(selectedDate, 1))}
              disabled={isFuture}
              className={cn(
                "w-10 h-10 shrink-0 flex items-center justify-center rounded-xl transition-all border border-transparent",
                isFuture 
                  ? "text-slate-300 cursor-not-allowed" 
                  : "hover:bg-white hover:text-brand-blue hover:shadow-md hover:border-slate-300"
              )}
            >
              <ChevronRight size={20} />
            </button>

            {onAddActivity && user?.role === 'supervisor' && (
              <>
                <div className="w-[1px] h-8 bg-slate-200 mx-1.5 shrink-0" />
                <button 
                  onClick={onAddActivity}
                  className="shrink-0 px-4 sm:px-6 py-2.5 bg-brand-blue text-white rounded-[14px] font-black text-xs uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:bg-brand-blue-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2 mr-0.5"
                >
                  <Plus size={16} className="shrink-0" />
                  <span className="truncate hidden sm:block">Nueva Entrada</span>
                  <span className="truncate sm:hidden">Nuevo</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tools & Filters Bar */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-200 mb-4">
        <div className="flex flex-row items-center gap-2 sm:gap-3 w-full">
          {/* Search */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center w-full bg-slate-100/80 border border-slate-300 shadow-inner hover:border-slate-400 rounded-xl px-2 sm:px-3 py-2 sm:py-2.5 focus-within:ring-2 focus-within:ring-brand-blue/30 focus-within:border-brand-blue focus-within:bg-white transition-all min-h-[40px] sm:min-h-[46px]">
              <Search size={14} className="text-slate-500 mr-1.5 sm:mr-2 shrink-0 sm:size-[16px]" />
              <input
                type="text"
                placeholder="Buscar actividad o personal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none w-full text-[11px] sm:text-sm font-bold text-slate-800 placeholder:text-slate-500 min-w-0"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-slate-500 hover:text-slate-800 transition-colors ml-1 shrink-0 p-1 bg-slate-200 hover:bg-slate-300 rounded-full">
                  <X size={12} className="sm:size-[14px]" />
                </button>
              )}
            </div>
          </div>
          
          {/* Filter */}
          <div className="w-[110px] sm:w-[220px] md:w-[260px] shrink-0">
            <div className="flex items-center bg-slate-100/80 border border-slate-300 shadow-inner hover:border-slate-400 rounded-xl px-2 py-0 relative w-full min-h-[40px] sm:min-h-[46px] focus-within:ring-2 focus-within:ring-brand-blue/30 focus-within:border-brand-blue focus-within:bg-white transition-all">
              <CustomSelect
                value={selectedTechnician}
                onChange={(val) => setSelectedTechnician(val)}
                className="w-full text-left bg-transparent h-full"
                align="right"
                options={[
                  { value: 'todos', label: 'PERSONAL (TODOS)' },
                  ...technicians.map(tech => ({ value: tech.name, label: tech.name }))
                ]}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <ChevronDown size={14} className="sm:size-[16px]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spreadsheet Grid / Mobile View Switcher */}
      <div className="glass-card overflow-hidden shadow-2xl relative min-h-[400px]">
        {/* Spreadsheet Tab Effect */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500 z-10" />
        
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100/90 border-b-2 border-slate-400">
                <th className="px-4 py-4 w-12 text-center text-[10px] font-black text-slate-900 bg-slate-200/50 uppercase tracking-widest border border-slate-300 whitespace-nowrap">#</th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center whitespace-nowrap">
                  Incidente
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center whitespace-nowrap">
                  Código
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center whitespace-nowrap">
                  Causa
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center whitespace-nowrap">
                  Actividad / Labor Realizada
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center whitespace-nowrap">
                  Técnicos
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center whitespace-nowrap">
                  Región
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center whitespace-nowrap">
                  Horario Mañana
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center whitespace-nowrap">
                  Pausa
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center whitespace-nowrap">
                  Horario Tarde
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center whitespace-nowrap">
                  ST / Déficit
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center whitespace-nowrap">
                  Horas Totales
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center whitespace-nowrap">
                  Justificación
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center whitespace-nowrap">
                  Viático
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center whitespace-nowrap">
                  Flota
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center whitespace-nowrap">
                  Manejo
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="font-medium">
              {sortedActivities.length > 0 ? (
                sortedActivities.map((activity, index) => {
                  const isHighlighted = highlightedId === activity.id;
                  return (
                    <tr 
                       key={`activity-row-${activity.id}`} 
                      className={cn(
                        "transition-all duration-300 group relative border-b border-slate-300",
                        isHighlighted 
                          ? "bg-brand-blue/5 ring-2 ring-inset ring-brand-blue/20 z-10" 
                          : "hover:bg-slate-100/50"
                      )}
                    >
                      <td className={cn(
                        "px-4 py-4 text-center font-mono text-xs font-bold transition-colors border border-slate-300",
                        isHighlighted ? "text-brand-blue bg-brand-blue/10" : "text-slate-600 bg-slate-50/50"
                      )}>
                        {index + 1}
                        {isHighlighted && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-blue" />
                        )}
                      </td>
                    <td className="px-6 py-4 border border-slate-300">
                      <span className="font-mono text-xs font-bold text-brand-blue bg-brand-blue/10 px-2 py-1 rounded whitespace-nowrap border border-brand-blue/20">
                        {activity.incidentNumber || 'S/N'}
                      </span>
                    </td>
                    <td className="px-6 py-4 border border-slate-300 text-center">
                      <span className="text-xs font-mono font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300 uppercase tracking-wider block shadow-sm">
                        {activity.code || 'HORA'}
                      </span>
                    </td>
                    <td className="px-6 py-4 border border-slate-300">
                      <div className="max-w-[150px]">
                        <ExpandableText 
                          text={activity.cause || '---'} 
                          className="text-xs text-slate-900 leading-relaxed font-black uppercase tracking-wide"
                          maxLength={35}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 border border-slate-300 min-w-[320px]">
                      <p className="text-sm font-black text-slate-900 mb-1.5">{activity.title}</p>
                      <div className="bg-slate-100/60 rounded-lg p-2 border border-slate-300">
                        <ExpandableText 
                          text={activity.description || ''} 
                          className="text-xs text-slate-800 font-medium leading-relaxed whitespace-pre-wrap"
                          maxLength={75}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 border border-slate-300">
                      <div className="flex flex-row items-stretch gap-2.5 max-w-[480px] overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                        {activity.participants?.map((p, pIdx) => {
                          const techMatch = technicians.find(t => t.name === p);
                          const isDefinitiveBaja = techMatch?.status?.toLowerCase().trim() === 'inactivo' || techMatch?.status?.toLowerCase().trim() === 'baja';
                          return (
                            <div 
                              key={`activity-${activity.id}-participant-${pIdx}`} 
                              className={cn(
                                "flex flex-col justify-between px-2.5 py-1.5 rounded shadow-sm border min-w-[130px] shrink-0 transition-opacity",
                                isDefinitiveBaja 
                                  ? "bg-slate-100 border-slate-300/60 opacity-60 grayscale saturate-50 italic" 
                                  : "bg-slate-200/60 border-slate-300/40"
                              )}
                            >
                              <span className="text-xs font-extrabold text-slate-900 leading-tight truncate flex items-center justify-between gap-1" title={p.toUpperCase()}>
                                <span className="truncate">{p.toUpperCase()}</span>
                                {isDefinitiveBaja && (
                                  <span className="text-[9px] font-black tracking-wide text-rose-600 not-italic shrink-0 ml-1 bg-rose-50 px-1 py-0.5 rounded leading-none border border-rose-100/50">(Baja)</span>
                                )}
                              </span>
                              <div className="mt-1 flex flex-col">
                                <span className={cn("text-[10px] font-mono font-bold", isDefinitiveBaja ? "text-slate-400" : "text-brand-blue")}>
                                  P00: {techMatch?.employeeId || 'S/N'}
                                </span>
                                <span className={cn("text-[10px] font-mono font-bold mt-0.5 leading-none", isDefinitiveBaja ? "text-slate-400" : "text-brand-blue")}>
                                  C.I: {techMatch?.idCard || 'S/N'}
                                </span>
                                <span className="text-[9px] font-mono text-slate-800 font-extrabold uppercase tracking-wider mt-0.5">
                                  {techMatch?.department || techMatch?.specialty || 'DATOS'}
                                </span>
                              </div>
                            </div>
                          );
                        }) || <span className="text-xs text-slate-400">N/A</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 border border-slate-300 text-center">
                      <span className="text-xs font-extrabold text-slate-900">{activity.region || 'Central'}</span>
                    </td>
                    <td className="px-5 py-4 border border-slate-300 text-center whitespace-nowrap bg-white">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-[11px] font-mono font-black text-slate-800 bg-slate-50 px-1.5 py-0.5 border border-slate-200 rounded">{formatTimeAMPM(activity.startTimeMorning || '07:45')}</span>
                        <span className="text-slate-400 font-bold">-</span>
                        <span className="text-[11px] font-mono font-black text-slate-800 bg-slate-50 px-1.5 py-0.5 border border-slate-200 rounded">{formatTimeAMPM(activity.endTimeMorning || '11:45')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 border border-slate-300 text-center">
                      <span className="text-xs font-bold text-slate-900 bg-slate-100/50 px-2 py-0.5 border border-slate-300 rounded shadow-sm">{activity.hasPause || 'SI'}</span>
                    </td>
                    <td className="px-5 py-4 border border-slate-300 text-center whitespace-nowrap bg-white">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-[11px] font-mono font-black text-slate-800 bg-slate-50 px-1.5 py-0.5 border border-slate-200 rounded">{formatTimeAMPM(activity.startTimeAfternoon || '12:45')}</span>
                        <span className="text-slate-400 font-bold">-</span>
                        <span className="text-[11px] font-mono font-black text-slate-800 bg-slate-50 px-1.5 py-0.5 border border-slate-200 rounded">{formatTimeAMPM(activity.endTimeAfternoon || activity.endTime || '16:00')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 border border-slate-300 text-center bg-slate-100/30">
                      {(activity.overtimeHours || 0) !== 0 ? (
                        <div className="flex flex-col items-center">
                          <span className={cn(
                            "text-[11px] font-black px-2 py-0.5 rounded border shadow-sm leading-none whitespace-nowrap",
                            (activity.overtimeHours || 0) > 0 
                              ? "text-emerald-700 bg-emerald-50 border-emerald-300" 
                              : "text-red-700 bg-red-50 border-red-300"
                          )}>
                            {(activity.overtimeHours || 0) > 0 ? '+' : ''}{formatHours(activity.overtimeHours || 0)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md border text-slate-400 bg-slate-50 border-slate-200">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 border border-slate-300 text-center">
                      <span className="text-xs font-black px-2 py-1 rounded-md border text-brand-blue bg-brand-blue/5 border-brand-blue/20 whitespace-nowrap shadow-sm">
                        {activity.totalHours ? `${formatHours(activity.totalHours)}` : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 border border-slate-300">
                      <div className="max-w-[180px]">
                        <ExpandableText 
                          text={activity.justification || (((activity.overtimeHours || 0) === 0) ? '' : 'No justificado.')} 
                          className="text-xs text-slate-900 font-bold leading-relaxed italic"
                          maxLength={35}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 border border-slate-300 text-center">
                      {activity.hasPerDiem ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-black text-emerald-800 uppercase tracking-widest bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">SÍ</span>
                          <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-300 shadow-sm whitespace-nowrap">Bs. {Number(activity.perDiemAmount || 0).toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md border text-slate-650 bg-slate-50 border-slate-300">NO</span>
                      )}
                    </td>
                    <td className="px-6 py-4 border border-slate-300 text-center">
                      <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300/60 shadow-sm uppercase tracking-wider block whitespace-nowrap">
                        {activity.fleet || '---'}
                      </span>
                    </td>
                    <td className="px-6 py-4 border border-slate-300 text-center">
                      <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300/60 shadow-sm uppercase tracking-wider block whitespace-nowrap">
                        {activity.driver || '---'}
                      </span>
                    </td>
                    <td className="px-6 py-4 border border-slate-300 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {onEdit && (user?.role !== 'tecnico' || ((activity.adminId === user?.uid || (activity as any).technicianId === user?.uid) && activity.status !== 'aprobado')) && (
                          <button 
                            onClick={() => onEdit(activity)}
                            className="p-1.5 text-slate-500 hover:text-brand-blue transition-all rounded-lg bg-white border border-slate-200 shadow-sm hover:border-brand-blue/30 hover:shadow"
                          >
                             <FileText size={14} />
                          </button>
                        )}
                        {onDelete && (user?.role !== 'tecnico' || ((activity.adminId === user?.uid || (activity as any).technicianId === user?.uid) && activity.status !== 'aprobado')) && (
                          <button 
                            onClick={() => onDelete(activity.id, activity.title || 'Actividad')}
                            className="p-1.5 text-slate-500 hover:text-red-600 transition-all rounded-lg bg-white border border-slate-200 shadow-sm hover:border-red-500/30 hover:shadow hover:bg-red-50"
                          >
                             <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`spreadsheet-skeleton-row-${i}`} className="opacity-40 border-b border-slate-300">
                    <td className="px-4 py-6 border border-slate-300 text-center text-slate-200 font-mono text-[10px] bg-slate-50/30">{sortedActivities.length + i + 1}</td>
                    <td colSpan={16} className="px-6 py-6 border border-slate-300"></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden p-4 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
          {sortedActivities.length > 0 ? (
            sortedActivities.map((activity, index) => {
              const isHighlighted = highlightedId === activity.id;
              return (
                <div 
                  key={`activity-card-mobile-${activity.id}`} 
                  className={cn(
                    "border rounded-2xl p-4 space-y-3 relative overflow-hidden transition-all duration-300",
                    isHighlighted 
                      ? "bg-brand-blue/5 border-brand-blue ring-2 ring-brand-blue/20 shadow-lg scale-[1.02]" 
                      : "bg-slate-50/50 border-slate-300"
                  )}
                >
                  {isHighlighted && (
                    <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-brand-blue" />
                  )}
                  <div className="absolute top-0 right-0 p-2">
                    <span className="text-[10px] font-mono text-slate-300 font-black">#{index + 1}</span>
                  </div>
                  
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] font-black text-brand-blue bg-brand-blue/5 px-2 py-0.5 rounded whitespace-nowrap">
                          {activity.incidentNumber || 'S/N'}
                        </span>
                        <span className="font-mono text-[9px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded whitespace-nowrap border border-slate-200">
                          {activity.code || 'HORA'}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 leading-tight">{activity.title}</h4>
                    </div>
                  </div>

                  <div className="bg-white/50 p-2 rounded-xl border border-slate-300">
                    <ExpandableText 
                      text={activity.description || ''} 
                      className="text-[10px] text-slate-500 leading-relaxed whitespace-pre-wrap"
                      maxLength={75}
                    />
                    {activity.cause && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <span className="text-[8px] font-black tracking-widest uppercase text-slate-400 mb-1 block">Causa</span>
                        <ExpandableText 
                          text={activity.cause} 
                          className="text-[9px] text-slate-700 font-bold leading-relaxed italic uppercase"
                          maxLength={35}
                        />
                      </div>
                    )}
                    {activity.justification && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <span className="text-[8px] font-black tracking-widest uppercase text-slate-400 mb-1 block">Justificación</span>
                        <ExpandableText 
                           text={activity.justification} 
                           className="text-[9px] text-slate-500 leading-relaxed italic"
                           maxLength={35}
                        />
                      </div>
                    )}
                  </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-300">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Personal (P00)</p>
                    <div className="flex flex-wrap gap-1">
                      {activity.participants?.slice(0, 2).map((p, pIdx) => {
                        const tMatch = technicians.find(t => t.name === p);
                        const isDefinitiveBaja = tMatch?.status?.toLowerCase().trim() === 'inactivo' || tMatch?.status?.toLowerCase().trim() === 'baja';
                        return (
                          <span 
                            key={`${activity.id}-pm-${pIdx}`} 
                            className={cn(
                              "text-[9px] font-bold whitespace-nowrap px-1.5 py-0.5 rounded border",
                              isDefinitiveBaja 
                                ? "bg-slate-100 text-slate-400 border-slate-250 italic opacity-65" 
                                : "text-slate-600 bg-white border-slate-300"
                            )}
                          >
                            {p.split(' ')[0]} ({tMatch?.employeeId || '??'}){isDefinitiveBaja ? ' (Baja)' : ''}
                          </span>
                        );
                      })}
                      {(activity.participants?.length || 0) > 2 && (
                        <span className="text-[8px] font-bold text-slate-400">+{activity.participants!.length - 2}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">ST / Viático</p>
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <span className="text-[9px] font-mono text-slate-500 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-300">
                        {formatTimeAMPM(activity.startTimeMorning || '-')} a {formatTimeAMPM(activity.endTimeAfternoon || '-')}
                      </span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded border text-brand-blue bg-brand-blue/5 border-brand-blue/20 whitespace-nowrap">
                        {activity.totalHours ? `${formatHours(activity.totalHours)}` : '-'}
                      </span>
                      {(activity.overtimeHours || 0) !== 0 ? (
                        <span className={cn(
                          "text-[9px] font-black px-1.5 py-0.5 rounded border whitespace-nowrap", 
                          (activity.overtimeHours || 0) > 0 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                            : "bg-red-50 text-red-600 border-red-100"
                        )}>
                          {(activity.overtimeHours || 0) > 0 ? '+' : ''}{formatHours(activity.overtimeHours || 0)}
                        </span>
                      ) : (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-slate-400 bg-slate-50 border border-slate-300">0.00h</span>
                      )}
                      <span className={cn("text-[10px] font-black px-2 py-0.5 rounded border whitespace-nowrap", activity.hasPerDiem ? "bg-amber-50 text-amber-600 border-amber-100" : "text-slate-400 bg-slate-50 border-slate-300")}>
                        {activity.hasPerDiem ? `Bs. ${Number(activity.perDiemAmount || 0).toFixed(2)}` : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-2 text-left">
                   <div>
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Manejo (Chofer)</p>
                     <div className="flex items-center gap-2">
                       <span className="text-[9px] font-bold text-slate-600 truncate max-w-[80px]">{activity.driver || 'S/N'}</span>
                     </div>
                   </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center gap-2">
                    {onEdit && (user?.role !== 'tecnico' || ((activity.adminId === user?.uid || (activity as any).technicianId === user?.uid) && activity.status !== 'aprobado')) && (
                      <button 
                        onClick={() => onEdit(activity)}
                        className="p-1.5 text-brand-blue bg-brand-blue/5 rounded-lg hover:bg-brand-blue hover:text-white transition-all flex items-center gap-1.5"
                      >
                        <FileText size={12} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Editar</span>
                      </button>
                    )}
                    {onDelete && (user?.role !== 'tecnico' || ((activity.adminId === user?.uid || (activity as any).technicianId === user?.uid) && activity.status !== 'aprobado')) && (
                      <button 
                        onClick={() => onDelete(activity.id, activity.title || 'Actividad')}
                        className="p-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-600 hover:text-white transition-all flex items-center gap-1.5"
                      >
                        <Trash2 size={12} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Eliminar</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-slate-50/30 rounded-2xl border border-dashed border-slate-300 animate-pulse" />
            ))
          )}
        </div>

        {sortedActivities.length === 0 && (
          <div className="absolute inset-x-0 bottom-1/2 translate-y-1/2 flex flex-col items-center justify-center pointer-events-none opacity-90">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-4 border border-slate-200 shadow-sm">
              <Database size={32} strokeWidth={1.5} />
            </div>
            <h4 className="text-xl font-display font-black text-slate-400 tracking-tight mb-1">Planilla Disponible</h4>
            <p className="text-[11px] text-slate-400/80 font-bold uppercase tracking-widest">Sin registros para esta fecha técnica</p>
          </div>
        )}
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl shadow-slate-900/40 overflow-hidden flex flex-col">
        {/* Sección Día Actual */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center p-4 lg:p-5 gap-4 lg:gap-6 w-full">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 lg:gap-6 w-full xl:flex-1 min-w-0 sm:items-center">
            <div className="col-span-2 sm:col-span-1 flex flex-col items-start border-b sm:border-b-0 pb-2 sm:pb-0 border-slate-800/60 xl:border-r xl:pr-6 xl:border-slate-800 sm:py-1">
               <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest mb-1">Día Actual</span>
               <span className="text-sm font-bold text-slate-200 whitespace-nowrap">
                 {formatDateSpanish(selectedDate, 'dd MMM yyyy')}
               </span>
            </div>
            
            <button 
              onClick={() => setSummaryDetails('total')}
              className="flex flex-col items-start cursor-pointer hover:bg-slate-800/50 p-1.5 rounded-lg transition-colors active:scale-95 text-left"
            >
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={10} /> Total Horas</span>
              <span className="text-lg font-display font-black leading-none text-white whitespace-nowrap">
                {formatHours(dailyMetrics.total)}
              </span>
            </button>
            
            <button 
              onClick={() => setSummaryDetails('st')}
              className="flex flex-col items-start cursor-pointer hover:bg-slate-800/50 p-1.5 rounded-lg transition-colors active:scale-95 text-left"
            >
              <span className="text-[8px] font-black text-emerald-500/60 uppercase tracking-wider mb-1 flex items-center gap-1"><Zap size={10} /> ST Acumulado</span>
              <span className="text-lg font-display font-black text-emerald-400 leading-none whitespace-nowrap">
                {formatHours(dailyMetrics.stAcumulado)}
              </span>
            </button>
            
            <button 
              onClick={() => setSummaryDetails('df')}
              className="flex flex-col items-start cursor-pointer hover:bg-slate-800/50 p-1.5 rounded-lg transition-colors active:scale-95 text-left"
            >
              <span className="text-[8px] font-black text-amber-500/60 uppercase tracking-wider mb-1 flex items-center gap-1"><TrendingDown size={10} /> DF Acumulado</span>
              <span className="text-lg font-display font-black text-amber-400 leading-none whitespace-nowrap">
                {formatHours(dailyMetrics.dfAcumulado)}
              </span>
            </button>
            
            <button 
              onClick={() => setSummaryDetails('exceso')}
              className="flex items-center gap-2 bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/5 cursor-pointer hover:border-white/20 hover:bg-white/10 transition-colors active:scale-95 self-start sm:self-auto w-full"
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-1 mb-0.5">
                  <AlertOctagon size={11} className="text-brand-red animate-pulse" />
                  <span className="text-[8px] font-black text-brand-red uppercase tracking-widest leading-none xs:whitespace-nowrap">Jornada {'>'} 10h</span>
                </div>
                <span className="text-lg font-display font-black text-white leading-none flex items-baseline gap-1">
                  <span>{excesoPersonas}</span>
                  <span className="text-[10px] font-bold font-sans text-red-400 uppercase tracking-widest">{excesoPersonas === 0 ? 'casos' : excesoPersonas === 1 ? 'caso' : 'alertas'}</span>
                </span>
              </div>
            </button>
          </div>
          
          <div className="grid grid-cols-2 xl:flex xl:flex-col 2xl:flex-row w-full xl:w-[220px] shrink-0 gap-2 pt-2 xl:pt-0">
            <button
              onClick={() => exportPlanificacionToExcel()}
              className="justify-center flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-slate-300 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-wider w-full"
              title="Exportar Planificación Diaria"
            >
              <Download size={12} /> Plan Diario
            </button>
            <button
              onClick={() => exportSobretiempoToExcel()}
              className="justify-center flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors text-[10px] font-bold uppercase tracking-wider w-full"
              title="Exportar ST Diario"
            >
              <Download size={12} /> ST Diario
            </button>
          </div>
        </div>

        {/* Línea Divisoria */}
        <div className="w-full h-px bg-slate-800" />

        {/* Sección Semanal */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center p-4 lg:p-5 bg-slate-800/20 gap-4 lg:gap-6 w-full">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 lg:gap-6 w-full xl:flex-1 min-w-0 sm:items-center">
            <div className="col-span-2 sm:col-span-1 flex flex-col items-start border-b sm:border-b-0 pb-2 sm:pb-0 border-slate-800/60 xl:border-r xl:pr-6 xl:border-slate-800 sm:py-1">
               <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest mb-1">Semana</span>
               <span className="text-sm font-bold text-slate-200 whitespace-nowrap">
                 {formatDateSpanish(startOfWeek(selectedDate, {weekStartsOn: 1}), 'dd MMM')} - {formatDateSpanish(endOfWeek(selectedDate, {weekStartsOn: 1}), 'dd MMM')}
               </span>
            </div>
            
            <button 
              onClick={() => setWeeklySummaryDetails('total')}
              className="flex flex-col items-start cursor-pointer hover:bg-slate-800/50 p-1.5 rounded-lg transition-colors active:scale-95 text-left"
            >
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={10} /> Total (Sem)</span>
              <span className="text-lg font-display font-black leading-none text-slate-300 whitespace-nowrap">
                {formatHours(weeklyMetrics.total)}
              </span>
            </button>
            
            <button 
              onClick={() => setWeeklySummaryDetails('st')}
              className="flex flex-col items-start cursor-pointer hover:bg-slate-800/50 p-1.5 rounded-lg transition-colors active:scale-95 text-left"
            >
              <span className="text-[8px] font-black text-emerald-500/60 uppercase tracking-wider mb-1 flex items-center gap-1"><Zap size={10} /> ST Acumulado</span>
              <span className="text-lg font-display font-black text-emerald-500 leading-none whitespace-nowrap">
                {formatHours(weeklyMetrics.stAcumulado)}
              </span>
            </button>
            
            <button 
              onClick={() => setWeeklySummaryDetails('df')}
              className="flex flex-col items-start cursor-pointer hover:bg-slate-800/50 p-1.5 rounded-lg transition-colors active:scale-95 text-left"
            >
              <span className="text-[8px] font-black text-amber-500/60 uppercase tracking-wider mb-1 flex items-center gap-1"><TrendingDown size={10} /> DF Acumulado</span>
              <span className="text-lg font-display font-black text-amber-500 leading-none whitespace-nowrap">
                {formatHours(weeklyMetrics.dfAcumulado)}
              </span>
            </button>
            
            <button 
              onClick={() => setWeeklySummaryDetails('exceso')}
              className="flex items-center gap-2 bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/5 cursor-pointer hover:border-white/20 hover:bg-white/10 transition-colors active:scale-95 self-start sm:self-auto w-full"
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-1 mb-0.5">
                  <AlertOctagon size={11} className="text-brand-red animate-pulse" />
                  <span className="text-[8px] font-black text-brand-red uppercase tracking-widest leading-none xs:whitespace-nowrap">Jornada {'>'} 10h</span>
                </div>
                <span className="text-lg font-display font-black text-white leading-none flex items-baseline gap-1">
                  <span>{excesoPersonasSemanal}</span>
                  <span className="text-[10px] font-bold font-sans text-red-400 uppercase tracking-widest">{excesoPersonasSemanal === 0 ? 'casos' : excesoPersonasSemanal === 1 ? 'caso' : 'alertas'}</span>
                </span>
              </div>
            </button>
          </div>
          
          <div className="grid grid-cols-2 xl:flex xl:flex-col 2xl:flex-row w-full xl:w-[220px] shrink-0 gap-2 pt-2 xl:pt-0">
            <button
               onClick={() => exportPlanificacionToExcel(weeklyActivities, 'weekly')}
              className="justify-center flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-slate-300 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-wider w-full"
              title="Exportar Planificación Semanal"
            >
              <Download size={12} /> Plan Semanal
            </button>
            <button
               onClick={() => exportSobretiempoToExcel(weeklyActivities, 'weekly')}
              className="justify-center flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors text-[10px] font-bold uppercase tracking-wider w-full"
              title="Exportar ST/DF Semanal"
            >
              <Download size={12} /> ST Semanal
            </button>
          </div>
        </div>
      </div>

      {/* Summary Details Modal */}
      {summaryDetails && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSummaryDetails(null)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 className="font-display font-black text-slate-900 text-lg">
                  {summaryDetails === 'total' && 'Desglose de Horas Totales'}
                  {summaryDetails === 'st' && 'Desglose de Sobretiempos'}
                  {summaryDetails === 'df' && 'Desglose de Déficits'}
                  {summaryDetails === 'exceso' && (
                    <span className="flex items-center gap-2">
                      Jornadas Mayores a 10h
                      <span className="text-xs font-bold font-sans bg-rose-50 border border-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                        {excesoPersonas} {excesoPersonas === 0 ? 'casos' : excesoPersonas === 1 ? 'caso' : 'alertas'}
                      </span>
                    </span>
                  )}
                </h3>
              </div>
              <button onClick={() => setSummaryDetails(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition-colors shrink-0">
                <X size={20} />
              </button>
            </div>
            <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-200/90 backdrop-blur-sm border-b border-slate-300 z-10">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-900 uppercase tracking-widest">Actividad / Técnico</th>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-900 uppercase tracking-widest text-right">Horas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryDetails === 'exceso' ? (
                    (() => {
                      const items = dayExcesoData.items;

                      if (items.length === 0) {
                        return (
                          <tr>
                            <td colSpan={2} className="px-6 py-8 text-center text-sm font-bold text-slate-400">No hay registros</td>
                          </tr>
                        );
                      }

                      return items.map((item, idx) => (
                        <tr key={`summary-exceso-${idx}`} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-slate-900 mb-1 leading-tight">{capitalizeSentence(item.name)}</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                               {item.titles.slice(0, 2).join(', ')}{item.titles.length > 2 ? '...' : ''}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-xs font-black px-2.5 py-1 rounded-lg border inline-block text-brand-red bg-brand-red/5 border-brand-red/10 whitespace-nowrap">
                              {formatHours(item.total)}
                            </span>
                          </td>
                        </tr>
                      ));
                    })()
                  ) : sortedActivities.filter(a => {
                    if (summaryDetails === 'total') return true;
                    if (summaryDetails === 'st') return (a.overtimeHours || 0) > 0;
                    if (summaryDetails === 'df') return (a.overtimeHours || 0) < 0;
                    return false;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-6 py-8 text-center text-sm font-bold text-slate-400">No hay registros</td>
                    </tr>
                  ) : sortedActivities.filter(a => {
                    if (summaryDetails === 'total') return true;
                    if (summaryDetails === 'st') return (a.overtimeHours || 0) > 0;
                    if (summaryDetails === 'df') return (a.overtimeHours || 0) < 0;
                    return false;
                  }).map((activity, idx) => {
                    let value = 0;
                    if (summaryDetails === 'total') value = activity.totalHours || ((activity.overtimeHours || 0) + 8);
                    if (summaryDetails === 'st') value = activity.overtimeHours || 0;
                    if (summaryDetails === 'df') value = Math.abs(activity.overtimeHours || 0);

                    return (
                      <tr key={`summary-row-${idx}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-900 mb-1 leading-tight">{activity.title || 'Sin Título'}</div>
                          <div className="text-[10px] font-bold text-slate-500">
                            {activity.participants && activity.participants.length > 0 ? activity.participants.map(p => p.split(' ')[0]).join(', ') : activity.technicianName}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={cn(
                            "text-xs font-black px-2.5 py-1 rounded-lg border inline-block whitespace-nowrap",
                            summaryDetails === 'st' ? "text-emerald-600 bg-emerald-50 border-emerald-100" :
                            summaryDetails === 'df' ? "text-amber-600 bg-amber-50 border-amber-100" :
                            "text-brand-blue bg-brand-blue/5 border-brand-blue/10"
                          )}>
                            {formatHours(value)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
              <button 
                onClick={() => setSummaryDetails(null)}
                className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-700 active:scale-95 transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Weekly Summary Details Modal */}
      {weeklySummaryDetails && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setWeeklySummaryDetails(null)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 className="font-display font-black text-slate-900 text-lg">
                  {weeklySummaryDetails === 'total' && 'Desglose de Horas Totales (Semanal)'}
                  {weeklySummaryDetails === 'st' && 'Desglose de Sobretiempos (Semanal)'}
                  {weeklySummaryDetails === 'df' && 'Desglose de Déficits (Semanal)'}
                  {weeklySummaryDetails === 'exceso' && (
                    <span className="flex items-center gap-2">
                      Jornadas Mayores a 10h (Semanal)
                      <span className="text-xs font-bold font-sans bg-rose-50 border border-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                        {excesoPersonasSemanal} {excesoPersonasSemanal === 0 ? 'casos' : excesoPersonasSemanal === 1 ? 'caso' : 'alertas'}
                      </span>
                    </span>
                  )}
                </h3>
              </div>
              <button onClick={() => setWeeklySummaryDetails(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition-colors shrink-0">
                <X size={20} />
              </button>
            </div>
            <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-200/90 backdrop-blur-sm border-b border-slate-300 z-10">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-900 uppercase tracking-widest">Actividad / Técnico</th>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-900 uppercase tracking-widest text-right">Horas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {weeklySummaryDetails === 'exceso' ? (
                    (() => {
                      const items = weekExcesoData.items;

                      if (items.length === 0) {
                        return (
                          <tr>
                            <td colSpan={2} className="px-6 py-8 text-center text-sm font-bold text-slate-400">No hay registros</td>
                          </tr>
                        );
                      }

                      return items.map((item, idx) => (
                        <tr key={`weekly-exceso-${idx}`} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-slate-800 whitespace-normal leading-snug">
                              {capitalizeSentence(item.name)}
                            </div>
                            <div className="flex flex-col gap-1 mt-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold text-slate-400">
                                <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase shrink-0 leading-none flex items-center gap-1">
                                  📅 {formatDateSpanish(item.date, 'dd MMM')}
                                </span>
                                <span className="whitespace-normal">
                                  {item.titles.map(t => capitalizeSentence(!t || t.trim().toLowerCase() === 's' ? 'Mantenimiento Preventivo de Enlace' : t)).join(', ')}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-xs font-black px-2.5 py-1 rounded-lg border inline-block text-brand-red bg-brand-red/5 border-brand-red/10 whitespace-nowrap shadow-sm">
                              {formatHours(item.total)}
                            </span>
                          </td>
                        </tr>
                      ));
                    })()
                  ) : weeklyActivities.filter(a => {
                    if (weeklySummaryDetails === 'total') return true;
                    if (weeklySummaryDetails === 'st') return (a.overtimeHours || 0) > 0;
                    if (weeklySummaryDetails === 'df') return (a.overtimeHours || 0) < 0;
                    return false;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-6 py-8 text-center text-sm font-bold text-slate-400">No hay registros</td>
                    </tr>
                  ) : weeklyActivities.filter(a => {
                    if (weeklySummaryDetails === 'total') return true;
                    if (weeklySummaryDetails === 'st') return (a.overtimeHours || 0) > 0;
                    if (weeklySummaryDetails === 'df') return (a.overtimeHours || 0) < 0;
                    return false;
                  }).map((activity, idx) => {
                    let value = 0;
                    if (weeklySummaryDetails === 'total') value = activity.totalHours || ((activity.overtimeHours || 0) + 8);
                    if (weeklySummaryDetails === 'st') value = activity.overtimeHours || 0;
                    if (weeklySummaryDetails === 'df') value = Math.abs(activity.overtimeHours || 0);

                    const isSt = weeklySummaryDetails === 'st';
                    const isDf = weeklySummaryDetails === 'df';
                    const actTitle = !activity.title || activity.title.trim().toLowerCase() === 's' ? 'Mantenimiento Preventivo de Enlace' : activity.title;

                    return (
                      <tr key={`weekly-summary-row-${idx}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-800 whitespace-normal leading-snug">
                            {capitalizeSentence(actTitle)}
                          </div>
                          <div className="flex flex-col gap-1 mt-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold text-slate-400">
                              <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase shrink-0 leading-none flex items-center gap-1">
                                📅 {formatDateSpanish(activity.date.toDate ? activity.date.toDate() : new Date(activity.date as any), 'dd MMM')}
                              </span>
                              <span className="whitespace-normal">
                                👤 {activity.participants && activity.participants.length > 0 ? activity.participants.map(p => capitalizeSentence(p.split(' ')[0])).join(', ') : capitalizeSentence(activity.technicianName)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={cn(
                            "text-xs font-black px-2.5 py-1 rounded-lg border inline-block whitespace-nowrap shadow-sm",
                            isSt ? "text-emerald-600 bg-emerald-50 border-emerald-100" :
                            isDf ? "text-amber-600 bg-amber-50 border-amber-100" :
                            "text-brand-blue bg-brand-blue/5 border-brand-blue/10"
                          )}>
                            {isSt ? '+' : ''}{formatHours(value)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
              <button 
                onClick={() => setWeeklySummaryDetails(null)}
                className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-700 active:scale-95 transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
