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
import React from 'react';
import { Download, Table, Calendar, ChevronLeft, ChevronRight, FileText, Plus, Database, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Search, AlertOctagon } from 'lucide-react';
import { Activity, Technician } from '../../../types';
import { cn } from '../../../lib/utils';
import { format, startOfDay, endOfDay, isSameDay, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { formatHours } from './ActivityForm';

const formatTimeAMPM = (time24: string) => {
  if (!time24 || time24 === '--:--') return '--:--';
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours, 10);
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
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
}

export default function SmartSpreadsheet({ activities, technicians, onAddActivity, selectedDate, onDateChange, onEdit, onDelete, highlightedId }: SmartSpreadsheetProps) {
  const [sortConfig, setSortConfig] = React.useState<{ key: keyof Activity | 'participantsCount' | 'perDiem'; direction: 'asc' | 'desc' } | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');

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
  const filteredActivities = activities.filter(a => {
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
    
    return isToday && matchesSearch;
  });

  const sortedActivities = React.useMemo(() => {
    if (!sortConfig) return filteredActivities;

    return [...filteredActivities].sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof Activity];
      let bValue: any = b[sortConfig.key as keyof Activity];

      if (sortConfig.key === 'participantsCount') {
        aValue = a.participants?.length || 0;
        bValue = b.participants?.length || 0;
      } else if (sortConfig.key === 'perDiem') {
        aValue = a.perDiemAmount || 0;
        bValue = b.perDiemAmount || 0;
      }

      if (aValue === undefined || aValue === null) aValue = '';
      if (bValue === undefined || bValue === null) bValue = '';

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredActivities, sortConfig]);

  const excesoPersonas = React.useMemo(() => {
    const stPorPersona: Record<string, number> = {};
    sortedActivities.forEach(a => {
      const parts = a.participants && a.participants.length > 0 ? a.participants : (a.technicianName ? [a.technicianName] : []);
      parts.forEach(p => {
        if (a.overtimeHours && a.overtimeHours > 0) {
          stPorPersona[p] = (stPorPersona[p] || 0) + a.overtimeHours;
        }
      });
    });
    // Total hours > 10 means Overtime > 2
    return Object.values(stPorPersona).filter(st => st > 2).length;
  }, [sortedActivities]);

  const handleSort = (key: any) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: any }) => {
    if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown size={14} strokeWidth={2.5} className="text-slate-400 group-hover:text-brand-blue transition-colors" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} strokeWidth={3} className="text-brand-blue" /> 
      : <ArrowDown size={14} strokeWidth={3} className="text-brand-blue" />;
  };

  const exportSobretiempoToExcel = async () => {
    if (!sortedActivities || sortedActivities.length === 0) {
      console.warn("No hay actividades registradas para esta fecha.");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(format(selectedDate, 'dd-MM-yyyy'));

      sheet.columns = [
        { header: 'AREA', key: 'area', width: 12 },
        { header: 'P00', key: 'p00', width: 10 },
        { header: 'Nombres y Apellidos', key: 'name', width: 28 },
        { header: 'Cedula', key: 'cedula', width: 12 },
        { header: 'Región', key: 'region', width: 10 },
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Codigo', key: 'codigo', width: 10 },
        { header: 'Causa', key: 'causa', width: 25 },
        { header: 'Hora Entrada Mañana', key: 'he_m', width: 18 },
        { header: 'Hora Salida Mañana', key: 'hs_m', width: 18 },
        { header: 'Pausa', key: 'pausa', width: 8 },
        { header: 'Hora Entrada Tarde', key: 'he_t', width: 18 },
        { header: 'Hora Salida Tarde', key: 'hs_t', width: 18 },
        { header: 'JUSTIFIQUE', key: 'justifique', width: 45 }
      ];

      const headerRow = sheet.getRow(1);
      headerRow.height = 30;

      headerRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true, color: { argb: colNumber === 1 || colNumber === 14 ? 'FF000000' : 'FFFFFFFF' }, size: 9, name: 'Arial' };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        
        let fgColor = 'FF4F81BD'; // Blue 
        
        if (colNumber === 1) fgColor = 'FFF79646'; // AREA (Orange)
        if (colNumber >= 9 && colNumber <= 13) fgColor = 'FF5B9BD5'; // Horarios (Lighter Blue)
        if (colNumber === 14) fgColor = 'FFFCD5B4'; // JUSTIFIQUE (Peach)

        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });

      sortedActivities.forEach(a => {
        const parts = a.participants && a.participants.length > 0 ? a.participants : (a.technicianName ? [a.technicianName] : []);
        
        parts.forEach(p => {
          const techMatch = technicians.find(t => (t.name || '').toLowerCase() === (p || '').toLowerCase());
          
          let he_m = a.startTimeMorning ? formatTimeAMPM(a.startTimeMorning) : '07:30 AM';
          let hs_m = a.endTimeMorning ? formatTimeAMPM(a.endTimeMorning) : '11:45 AM';
          let pausa = a.hasPause || 'SI';
          let he_t = a.startTimeAfternoon ? formatTimeAMPM(a.startTimeAfternoon) : '12:45 PM';
          let hs_t = a.endTimeAfternoon ? formatTimeAMPM(a.endTimeAfternoon) : formatTimeAMPM(a.endTime || '16:00');
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
            area: techMatch ? (techMatch.specialty || 'DATOS').toUpperCase() : 'DATOS',
            p00: techMatch && techMatch.employeeId ? techMatch.employeeId : '',
            name: (p || '').toUpperCase(),
            cedula: techMatch && (techMatch as any).idCard ? (techMatch as any).idCard : 'S/N',
            region: region,
            fecha: fechaValue,
            codigo: 'PRIM',
            causa: 'Horas Product. Con Manejo', 
            he_m, hs_m, pausa, he_t, hs_t,
            justifique: `${a.incidentNumber ? a.incidentNumber + ' ' : ''}${a.title}`.trim()
          });

          row.eachCell(cell => {
            cell.font = { size: 9, name: 'Arial' };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
              left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
              bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
              right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
            };
          });

          row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
          row.getCell(14).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          row.height = Math.max(15, Math.ceil((row.getCell(14).text?.length || 10) / 45) * 15);
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      
      const dayName = format(new Date(), 'EEEE', { locale: es });
      const day = format(new Date(), 'dd');
      const monthName = format(new Date(), 'MMMM', { locale: es });
      const year = format(new Date(), 'yyyy');
      const dataDate = format(selectedDate, 'dd-MM-yyyy');
      
      const fileName = `Sobretiempo_CANTV_${day}_${monthName}_${year}_${dayName}_Generado_De_${dataDate}.xlsx`;
      saveAs(new Blob([buffer]), fileName);
    } catch (err: any) {
      console.error("Error exporting daily Excel:", err);
      alert("Error al generar Excel: " + (err.message || "Desconocido"));
    }
  };

  const exportPlanificacionToExcel = async () => {
    if (!sortedActivities || sortedActivities.length === 0) {
      console.warn("No hay actividades registradas para esta fecha.");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(format(selectedDate, 'dd-MM-yyyy'));

      const transmisionTechs = technicians.filter(t => (t.specialty || '').toLowerCase().includes('transmision') || (t.specialty || '').toLowerCase().includes('transmisión'));
      const datosTechs = technicians.filter(t => (t.specialty || '').toLowerCase().includes('datos') || (!(t.specialty || '').toLowerCase().includes('transmision') && !(t.specialty || '').toLowerCase().includes('transmisión')));
      const planTechs = [...transmisionTechs, ...datosTechs];

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
        { header: 'SOBRETIEMPO', key: 'st', width: 15 },
        { header: 'Hora Entrada Mañana', key: 'he_m', width: 18 },
        { header: 'Hora Salida Mañana', key: 'hs_m', width: 18 },
        { header: 'Pausa', key: 'pausa', width: 10 },
        { header: 'Hora Entrada Tarde', key: 'he_t', width: 18 },
        { header: 'Hora Salida Tarde', key: 'hs_t', width: 18 },
        { header: 'HORAS', key: 'horas', width: 10 },
        { header: 'MANEJO', key: 'manejo', width: 15 },
        { header: 'VIATICOS', key: 'viaticos', width: 12 },
        { header: 'DEPARTAMENTO', key: 'dpto', width: 15 }
      );

      sheet.columns = cols;
      sheet.insertRow(1, []);

      if (transmisionTechs.length > 0) {
        sheet.mergeCells(1, 4, 1, 3 + transmisionTechs.length);
        const cell = sheet.getCell(1, 4);
        cell.value = 'TRANSMISION';
        cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF000000' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      
      if (datosTechs.length > 0) {
        sheet.mergeCells(1, 4 + transmisionTechs.length, 1, 3 + planTechs.length);
        const cell = sheet.getCell(1, 4 + transmisionTechs.length);
        cell.value = 'DATOS';
        cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF000000' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      const styleHeader = (rowNum: number) => {
        const row = sheet.getRow(rowNum);
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B0F0' } };
          cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF000000' } };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
      };

      styleHeader(1);
      styleHeader(2);

      sortedActivities.forEach(a => {
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
          incidente: `${a.incidentNumber ? a.incidentNumber + ' ' : ''}${a.title}`.trim(),
          doc: 'no',
          st: a.overtimeHours && a.overtimeHours > 0 ? `${formatHours(a.overtimeHours)}` : 'no',
          he_m: a.startTimeMorning ? formatTimeAMPM(a.startTimeMorning) : '07:30 AM',
          hs_m: a.endTimeMorning ? formatTimeAMPM(a.endTimeMorning) : '11:45 AM',
          pausa: a.hasPause || 'SI',
          he_t: a.startTimeAfternoon ? formatTimeAMPM(a.startTimeAfternoon) : '12:45 PM',
          hs_t: a.endTimeAfternoon ? formatTimeAMPM(a.endTimeAfternoon) : formatTimeAMPM(a.endTime || '16:00'),
          horas: a.totalHours ? `${formatHours(a.totalHours)}h` : '',
          manejo: '',
          viaticos: a.hasPerDiem ? 'si' : 'no',
          dpto: ''
        };

        const parts = a.participants && a.participants.length > 0 ? a.participants : (a.technicianName ? [a.technicianName] : []);
        planTechs.forEach(t => {
           const isParticipant = parts.some((p: string) => (p || '').toLowerCase() === (t.name || '').toLowerCase());
           data[`tech_${t.id}`] = isParticipant ? 'X' : '';
        });

        const row = sheet.addRow(data);

        row.eachCell((cell, colNumber) => {
          cell.font = { size: 9, name: 'Arial' };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
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

      const buffer = await workbook.xlsx.writeBuffer();
      const dayName = format(new Date(), 'EEEE', { locale: es });
      const day = format(new Date(), 'dd');
      const monthName = format(new Date(), 'MMMM', { locale: es });
      const year = format(new Date(), 'yyyy');
      const dataDate = format(selectedDate, 'dd-MM-yyyy');
      
      const fileName = `Planificacion_CANTV_${day}_${monthName}_${year}_${dayName}_Generado_De_${dataDate}.xlsx`;
      saveAs(new Blob([buffer]), fileName);
    } catch (err: any) {
      console.error("Error exporting daily Excel:", err);
      alert("Error al generar Planificación: " + (err.message || "Desconocido"));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Excel Header Control */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-4 sm:p-6 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.02),0_15px_35px_rgba(0,0,0,0.06)] border border-slate-300">
        <div className="flex items-center gap-4 w-full">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner shrink-0">
            <Table size={28} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-display font-black text-slate-900 tracking-tight truncate">Planilla Inteligente</h2>
            <p className="text-xs text-slate-500 font-medium truncate">Formato Excel - Central 4357</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
          {/* Date Selector */}
          <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-300 shadow-sm relative group/date w-full sm:w-auto">
            <button 
              onClick={() => onDateChange(subDays(selectedDate, 1))}
              className="w-10 h-10 flex items-center justify-center hover:bg-white hover:text-brand-blue rounded-xl transition-all hover:shadow-md border border-transparent hover:border-slate-300"
            >
              <ChevronLeft size={20} />
            </button>
            
            <div className="flex-1 flex items-center gap-1 min-w-[280px] bg-white/80 rounded-2xl border-2 border-slate-300 p-1 shadow-sm">
              {/* Day Selector */}
              <select 
                value={format(selectedDate, 'd')}
                onChange={(e) => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(parseInt(e.target.value));
                  onDateChange(newDate);
                }}
                className="flex-1 bg-transparent text-xs font-black text-slate-800 text-center py-2 hover:bg-slate-50 rounded-xl cursor-pointer focus:outline-none transition-colors appearance-none"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>{day.toString().padStart(2, '0')}</option>
                ))}
              </select>

              <div className="w-[1px] h-4 bg-slate-200" />

              {/* Month Selector */}
              <select 
                value={format(selectedDate, 'M')}
                onChange={(e) => {
                  const newDate = new Date(selectedDate);
                  newDate.setMonth(parseInt(e.target.value) - 1);
                  onDateChange(newDate);
                }}
                className="flex-[2] bg-transparent text-xs font-black text-slate-800 text-center py-2 hover:bg-slate-50 rounded-xl cursor-pointer focus:outline-none transition-colors appearance-none capitalize"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>
                    {format(new Date(2024, month - 1, 1), 'MMMM', { locale: es })}
                  </option>
                ))}
              </select>

              <div className="w-[1px] h-4 bg-slate-200" />

              {/* Year Selector */}
              <select 
                value={format(selectedDate, 'yyyy')}
                onChange={(e) => {
                  const newDate = new Date(selectedDate);
                  newDate.setFullYear(parseInt(e.target.value));
                  onDateChange(newDate);
                }}
                className="flex-1 bg-transparent text-xs font-black text-slate-800 text-center py-2 hover:bg-slate-50 rounded-xl cursor-pointer focus:outline-none transition-colors appearance-none"
              >
                {Array.from({ length: 7 }, (_, i) => 2026 - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => onDateChange(addDays(selectedDate, 1))}
              disabled={isFuture}
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-xl transition-all border border-transparent",
                isFuture 
                  ? "text-slate-300 cursor-not-allowed" 
                  : "hover:bg-white hover:text-brand-blue hover:shadow-md hover:border-slate-300"
              )}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full xl:w-auto">
            {onAddActivity && (
              <button 
                onClick={onAddActivity}
                className="flex-[1_1_100%] sm:flex-[0_0_auto] px-3 sm:px-6 py-2.5 bg-brand-blue text-white rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:bg-brand-blue-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} className="shrink-0" />
                <span className="truncate">Nueva Entrada</span>
              </button>
            )}
            <button 
              onClick={exportPlanificacionToExcel}
              className="flex-[1_1_100%] sm:flex-[0_0_auto] px-3 sm:px-6 py-2.5 bg-brand-blue text-white rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:bg-brand-blue-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Table size={16} className="shrink-0" />
              <span className="truncate">Planificación</span>
            </button>
            <button 
              onClick={exportSobretiempoToExcel}
              className="flex-[1_1_100%] sm:flex-[0_0_auto] px-3 sm:px-6 py-2.5 bg-emerald-600 text-white rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Download size={16} className="shrink-0" />
              <span className="truncate">Sobretiempo</span>
            </button>
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
              <tr className="bg-slate-100/80 border-b-2 border-slate-300">
                <th className="px-4 py-4 w-12 text-center text-[10px] font-black text-slate-400 bg-slate-100 uppercase tracking-widest border border-slate-300">#</th>
                <th 
                  onClick={() => handleSort('incidentNumber')}
                  className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    Incidente <SortIcon columnKey="incidentNumber" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('title')}
                  className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    Actividad / Labor Realizada <SortIcon columnKey="title" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('participantsCount')}
                  className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    Técnicos <SortIcon columnKey="participantsCount" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('region')}
                  className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                >
                  <div className="flex items-center justify-center gap-2">
                    Región <SortIcon columnKey="region" />
                  </div>
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                  Entrada AM
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                  Salida AM
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                  Pausa
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                  Entrada PM
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                  Salida PM
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                  ST / Déficit
                </th>
                <th 
                  onClick={() => handleSort('perDiem')}
                  className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                >
                  <div className="flex items-center justify-center gap-2">
                    Viático <SortIcon columnKey="perDiem" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('fleet')}
                  className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                >
                  <div className="flex items-center justify-center gap-2">
                    Flota <SortIcon columnKey="fleet" />
                  </div>
                </th>
                <th className="px-6 py-4 border border-slate-300 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>
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
                        "px-4 py-4 text-center font-mono text-[10px] transition-colors border border-slate-300",
                        isHighlighted ? "text-brand-blue bg-brand-blue/10" : "text-slate-400 bg-slate-50/50"
                      )}>
                        {index + 1}
                        {isHighlighted && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-blue" />
                        )}
                      </td>
                    <td className="px-6 py-4 border border-slate-300">
                      <span className="font-mono text-[10px] font-black text-brand-blue bg-brand-blue/5 px-2 py-1 rounded">
                        {activity.incidentNumber || 'S/N'}
                      </span>
                    </td>
                    <td className="px-6 py-4 border border-slate-300 min-w-[320px]">
                      <p className="text-sm font-bold text-slate-900 mb-2">{activity.title}</p>
                      <div className="max-h-24 overflow-y-auto custom-scrollbar pr-2 bg-slate-50/50 rounded-lg p-2 border border-slate-300">
                        <p className="text-[10px] text-slate-500 leading-relaxed whitespace-pre-wrap">
                          {activity.description}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 border border-slate-300">
                      <div className="flex flex-col gap-2">
                        {activity.participants?.map((p, pIdx) => {
                          const techMatch = technicians.find(t => t.name === p);
                          const cedula = techMatch && (techMatch as any).idCard ? (techMatch as any).idCard : (techMatch?.employeeId || 'S/N');
                          return (
                            <div key={`activity-${activity.id}-participant-${pIdx}`} className="flex flex-col bg-slate-100 px-2 py-1 rounded">
                              <span className="text-[10px] font-bold text-slate-700 italic">
                                {p.toUpperCase()}
                              </span>
                              <span className="text-[9px] font-mono text-brand-blue font-black">
                                P00: {techMatch?.employeeId || 'S/N'}
                              </span>
                              <span className="text-[8px] font-mono text-brand-blue font-black uppercase tracking-wider mt-0.5">
                                {techMatch?.specialty || 'DATOS'}
                              </span>
                            </div>
                          );
                        }) || <span className="text-[10px] text-slate-300">N/A</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 border border-slate-300 text-center">
                      <span className="text-[10px] font-bold text-slate-700">{activity.region || 'Central'}</span>
                    </td>
                    <td className="px-4 py-4 border border-slate-300 text-center">
                      <span className="text-xs font-mono font-black text-slate-700">{formatTimeAMPM(activity.startTimeMorning || '07:45')}</span>
                    </td>
                    <td className="px-4 py-4 border border-slate-300 text-center">
                      <span className="text-xs font-mono font-black text-slate-700">{formatTimeAMPM(activity.endTimeMorning || '11:45')}</span>
                    </td>
                    <td className="px-4 py-4 border border-slate-300 text-center">
                      <span className="text-[10px] font-bold text-slate-600">{activity.hasPause || 'SI'}</span>
                    </td>
                    <td className="px-4 py-4 border border-slate-300 text-center">
                      <span className="text-xs font-mono font-black text-slate-700">{formatTimeAMPM(activity.startTimeAfternoon || '12:45')}</span>
                    </td>
                    <td className="px-4 py-4 border border-slate-300 text-center">
                      <span className="text-xs font-mono font-black text-slate-700">{formatTimeAMPM(activity.endTimeAfternoon || activity.endTime || '16:00')}</span>
                    </td>
                    <td className="px-6 py-4 border border-slate-300 text-center bg-slate-50/30">
                      {(activity.overtimeHours || 0) !== 0 ? (
                        <div className="flex flex-col items-center">
                          <span className={cn(
                            "text-[10px] font-black px-2 py-0.5 rounded-full border shadow-sm leading-none",
                            (activity.overtimeHours || 0) > 0 
                              ? "text-emerald-600 bg-emerald-50 border-emerald-100" 
                              : "text-red-600 bg-red-50 border-red-100"
                          )}>
                            {(activity.overtimeHours || 0) > 0 ? '+' : ''}{formatHours(activity.overtimeHours || 0)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md border text-slate-400 bg-slate-50 border-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 border border-slate-300 text-center">
                      {activity.hasPerDiem ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">SÍ</span>
                          <span className="text-xs font-black text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-300">Bs.{activity.perDiemAmount}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md border text-slate-400 bg-slate-50 border-slate-300">NO</span>
                      )}
                    </td>
                    <td className="px-6 py-4 border border-slate-300 text-center">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">
                        {activity.fleet || '---'}
                      </span>
                    </td>
                    <td className="px-6 py-4 border border-slate-300 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {onEdit && (
                          <button 
                            onClick={() => onEdit(activity)}
                            className="p-1.5 text-slate-400 hover:text-brand-blue transition-colors rounded-lg hover:bg-white border border-transparent hover:border-slate-300"
                          >
                             <FileText size={14} />
                          </button>
                        )}
                        {onDelete && (
                          <button 
                            onClick={() => onDelete(activity.id, activity.title || 'Actividad')}
                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100"
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
                    <td className="px-6 py-6 border border-slate-300 bg-slate-50/10"></td>
                    <td className="px-6 py-6 border border-slate-300"></td>
                    <td className="px-6 py-6 border border-slate-300"></td>
                    <td className="px-6 py-6 border border-slate-300"></td>
                    <td className="px-6 py-6 border border-slate-300"></td>
                    <td className="px-6 py-6 border border-slate-300"></td>
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
                      <span className="font-mono text-[9px] font-black text-brand-blue bg-brand-blue/5 px-2 py-0.5 rounded">
                        {activity.incidentNumber || 'S/N'}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 leading-tight">{activity.title}</h4>
                    </div>
                  </div>

                  <div className="max-h-32 overflow-y-auto bg-white/50 p-2 rounded-xl border border-slate-300">
                    <p className="text-[10px] text-slate-500 leading-relaxed whitespace-pre-wrap">{activity.description}</p>
                  </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-300">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Personal (P00)</p>
                    <div className="flex flex-wrap gap-1">
                      {activity.participants?.slice(0, 2).map((p, pIdx) => {
                        const tMatch = technicians.find(t => t.name === p);
                        return (
                          <span key={`${activity.id}-pm-${pIdx}`} className="text-[9px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-300 whitespace-nowrap">
                            {p.split(' ')[0]} ({tMatch?.employeeId || '??'})
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
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[9px] font-mono text-slate-500 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-300">
                        {formatTimeAMPM(activity.startTimeMorning || '-')} a {formatTimeAMPM(activity.endTimeAfternoon || '-')}
                      </span>
                      {(activity.overtimeHours || 0) !== 0 ? (
                        <span className={cn(
                          "text-[9px] font-black px-1.5 py-0.5 rounded border", 
                          (activity.overtimeHours || 0) > 0 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                            : "bg-red-50 text-red-600 border-red-100"
                        )}>
                          {(activity.overtimeHours || 0) > 0 ? '+' : ''}{formatHours(activity.overtimeHours || 0)}
                        </span>
                      ) : (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-slate-400 bg-slate-50 border border-slate-300">0.00h</span>
                      )}
                      <span className={cn("text-[10px] font-black px-2 py-0.5 rounded border", activity.hasPerDiem ? "bg-amber-50 text-amber-600 border-amber-100" : "text-slate-400 bg-slate-50 border-slate-300")}>
                        {activity.hasPerDiem ? `Bs.${activity.perDiemAmount}` : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center gap-2">
                    {onEdit && (
                      <button 
                        onClick={() => onEdit(activity)}
                        className="p-1.5 text-brand-blue bg-brand-blue/5 rounded-lg hover:bg-brand-blue hover:text-white transition-all flex items-center gap-1.5"
                      >
                        <FileText size={12} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Editar</span>
                      </button>
                    )}
                    {onDelete && (
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
          <div className="absolute inset-x-0 bottom-1/2 translate-y-1/2 flex flex-col items-center justify-center pointer-events-none">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4 border border-slate-300 shadow-inner">
              <Database size={32} />
            </div>
            <h4 className="text-lg font-display font-black text-slate-300 tracking-tight">Planilla Disponible</h4>
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Sin registros para esta fecha técnica</p>
          </div>
        ) }
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 px-6 py-5 rounded-3xl text-white shadow-2xl shadow-slate-900/40 gap-6 border border-slate-800">
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 sm:gap-10 w-full md:w-auto">
          <div className="flex flex-col items-center md:items-start min-w-[90px]">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5">Total Horas</span>
            <span className="text-2xl font-display font-black leading-none text-white">
              {formatHours(sortedActivities.reduce((acc, a) => acc + (a.totalHours || (a.overtimeHours || 0) + 8), 0))}
            </span>
          </div>
          <div className="hidden sm:block w-[1px] h-10 bg-slate-800" />
          <div className="flex flex-col items-center md:items-start min-w-[90px]">
            <span className="text-[9px] font-black text-emerald-500/60 uppercase tracking-[0.2em] mb-1.5">ST Acumulado</span>
            <span className="text-2xl font-display font-black text-emerald-400 leading-none">
              {formatHours(sortedActivities.reduce((acc, a) => {
                const st = (a.overtimeHours || 0);
                return acc + (st > 0 ? st : 0);
              }, 0))}
            </span>
          </div>
          <div className="hidden sm:block w-[1px] h-10 bg-slate-800" />
          <div className="flex flex-col items-center md:items-start min-w-[90px]">
            <span className="text-[9px] font-black text-amber-500/60 uppercase tracking-[0.2em] mb-1.5">DF Acumulado</span>
            <span className="text-2xl font-display font-black text-amber-400 leading-none">
              {formatHours(Math.abs(sortedActivities.reduce((acc, a) => {
                const st = (a.overtimeHours || 0);
                return acc + (st < 0 ? st : 0);
              }, 0)))}
            </span>
          </div>
          <div className="hidden sm:block w-[1px] h-10 bg-slate-800" />
          <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
            <div className="flex flex-col items-center md:items-start">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertOctagon size={12} className="text-brand-red animate-pulse" />
                <span className="text-[9px] font-black text-brand-red uppercase tracking-widest leading-none">Jornada {'>'} 10h</span>
              </div>
              <span className="text-2xl font-display font-black text-white leading-none">
                {excesoPersonas}
              </span>
            </div>
          </div>
        </div>
        <div className="hidden xl:block text-right">
          <p className="text-[10px] font-bold text-slate-500 italic leading-tight uppercase tracking-wider">CANTV · Datos y Transmisión</p>
          <p className="text-[9px] font-black text-brand-blue uppercase tracking-[0.3em] mt-1.5 shadow-sm">Central Maracay 4357</p>
        </div>
      </div>
    </div>
  );
}
