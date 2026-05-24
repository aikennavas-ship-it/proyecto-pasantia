import React from 'react';
import { Download, FileText, Table, Users, Filter, Calendar, ChevronRight, Archive, History, X, Clock, MapPin, Wrench, Zap, TrendingDown, AlertOctagon } from 'lucide-react';
import { Activity, Technician } from '../../../types';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, getYear, getMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../../../lib/utils';
import { formatHours } from '../../activities/components/ActivityForm';

interface ReportGeneratorProps {
  activities: Activity[];
  technicians: Technician[];
}

export default function ReportGenerator({ activities, technicians }: ReportGeneratorProps) {
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState(new Date().getMonth());
  const [viewMode, setViewMode] = React.useState<'summary' | 'history'>('summary');
  const [monthlySummaryDetails, setMonthlySummaryDetails] = React.useState<'total' | 'st' | 'df' | 'exceso' | null>(null);
  
  // State for the modal
  const [selectedDayActivities, setSelectedDayActivities] = React.useState<{ date: Date, activities: Activity[] } | null>(null);

  const currentYear = new Date().getFullYear();
  const startYear = 2024;
  const numYears = Math.max(5, currentYear - startYear + 1);
  const years = Array.from({ length: numYears }, (_, i) => currentYear - i);
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const safeGetActivityDate = (a: Activity): Date => {
    try {
      if (!a || !a.date) return new Date();
      if (typeof a.date.toDate === 'function') {
        return a.date.toDate();
      }
      return new Date(a.date as any);
    } catch {
      return new Date();
    }
  };

  const filteredActivities = React.useMemo(() => {
    return activities.filter(a => {
      if (!a || !a.date) return false;
      const date = safeGetActivityDate(a);
      return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth;
    });
  }, [activities, selectedYear, selectedMonth]);

  const totalHours = React.useMemo(() => {
    return filteredActivities.reduce((acc, a) => acc + (a.totalHours || (a.overtimeHours || 0) + 8), 0);
  }, [filteredActivities]);

  const stHours = React.useMemo(() => {
    return filteredActivities.reduce((acc, a) => {
      const r_st = (a.overtimeHours || 0);
      return acc + (r_st > 0 ? r_st : 0);
    }, 0);
  }, [filteredActivities]);

  const dfHours = React.useMemo(() => {
    return Math.abs(filteredActivities.reduce((acc, a) => {
      const r_st = (a.overtimeHours || 0);
      return acc + (r_st < 0 ? r_st : 0);
    }, 0));
  }, [filteredActivities]);

  const excesoPersonasMensual = React.useMemo(() => {
    const hoursPerPersonPerDay: Record<string, number> = {};
    filteredActivities.forEach(a => {
      const dateKey = safeGetActivityDate(a).toISOString().split('T')[0];
      const parts = a.participants && a.participants.length > 0 ? a.participants : (a.technicianName ? [a.technicianName] : []);
      parts.forEach(p => {
        const key = `${dateKey}_${p}`;
        hoursPerPersonPerDay[key] = (hoursPerPersonPerDay[key] || 0) + (a.totalHours || 0);
      });
    });
    return Object.values(hoursPerPersonPerDay).filter(h => h > 10).length;
  }, [filteredActivities]);

  const checkActivitiesCompleteness = (activitiesToExport: Activity[]) => {
    return activitiesToExport.filter(a => {
      const hasBasicInfo = a.title && a.description && a.date;
      const hasAdminInfo = a.incidentNumber && a.fleet;
      const hasTimes = (a.startTime && a.endTime) || (a.startTimeMorning && a.endTimeMorning);
      const hasTechs = (a.participants && a.participants.length > 0) || a.technicianName;
      const perDiemOk = !a.hasPerDiem || (a.perDiemAmount !== undefined && a.perDiemAmount > 0);
      
      const isComplete = !!(hasBasicInfo && hasAdminInfo && hasTimes && hasTechs && perDiemOk);
      return !isComplete;
    });
  };

  const formatTimeAMPM = (time24: string) => {
    if (!time24 || time24 === '--:--') return '--:--';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours, 10);
    if (isNaN(h)) return time24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const generateSobretiempoExcel = async () => {
    if (filteredActivities.length === 0) return;

    try {
      const incomplete = checkActivitiesCompleteness(filteredActivities);
      if (incomplete.length > 0) {
        const confirmExport = window.confirm(
          `¡Atención! Se han detectado ${incomplete.length} actividades con información incompleta en este periodo (faltan incidentes, flota, horarios o técnicos).\n\n` +
          `¿Desea continuar con la exportación a Excel de todos modos?`
        );
        if (!confirmExport) return;
      }

      const workbook = new ExcelJS.Workbook();
      const sheetName = `${months[selectedMonth].substring(0, 3).toUpperCase()}_${selectedYear}`;
      const sheet = workbook.addWorksheet(sheetName);

      const getTechDept = (t: any) => {
        if (t.department && t.department.trim()) return t.department.trim().toUpperCase();
        const spec = (t.specialty || '').toLowerCase();
        if (spec.includes('transmision') || spec.includes('transmisión')) return 'TRANSMISIÓN';
        return 'DATOS';
      };

      const deptsMap = new Map<string, any[]>();
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

      const planTechs: any[] = [];
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
        { header: 'SOBRETIEMPO', key: 'st', width: 15 },
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

      filteredActivities.forEach(a => {
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
          doc: a.documentation ? a.documentation.toLowerCase() : 'no',
          st: a.overtimeHours && a.overtimeHours > 0 ? `${formatHours(a.overtimeHours)}` : 'no',
          deficit: typeof a.overtimeHours === 'number' && a.overtimeHours < 0 ? `${formatHours(a.overtimeHours)}` : 'no',
          he_m: a.startTimeMorning ? formatTimeAMPM(a.startTimeMorning) : '07:30 AM',
          hs_m: a.endTimeMorning ? formatTimeAMPM(a.endTimeMorning) : '11:45 AM',
          pausa: a.hasPause || 'SI',
          he_t: a.startTimeAfternoon ? formatTimeAMPM(a.startTimeAfternoon) : '12:45 PM',
          hs_t: a.endTimeAfternoon ? formatTimeAMPM(a.endTimeAfternoon) : formatTimeAMPM(a.endTime || '16:00'),
          justifique: a.justification || ((a.overtimeHours || 0) === 0 ? '' : 'No justificado.'),
          horas: a.totalHours ? `${formatHours(a.totalHours)}h` : '',
          manejo: a.driver || '',
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
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
          cell.numFmt = '@';
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
      const fileName = `PLANIFICACION_${months[selectedMonth].toUpperCase()}_${selectedYear}_TX_DX.xlsx`;
      saveAs(new Blob([buffer]), fileName);

    } catch (err: any) {
      console.error("Error generating Excel report:", err);
      alert("Error al generar el archivo Excel: " + (err.message || ""));
    }
  };

  const generateConsolidatedPDF = () => {
    if (filteredActivities.length === 0) return;

    try {
      const incomplete = checkActivitiesCompleteness(filteredActivities);
      if (incomplete.length > 0) {
        const confirmExport = window.confirm(
          `¡Atención! Se han detectado ${incomplete.length} actividades con información incompleta en este periodo.\n\n` +
          `¿Desea continuar con la generación del PDF de todos modos?`
        );
        if (!confirmExport) return;
      }
      
      const docPdf = new jsPDF();
    const pageWidth = docPdf.internal.pageSize.width;
    
    // CANTV Header Design
    docPdf.setFillColor(0, 74, 153); // Blue
    docPdf.rect(0, 0, pageWidth, 40, 'F');
    
    docPdf.setFontSize(22);
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFont('helvetica', 'bold');
    docPdf.text('CANTV', 14, 20);
    
    docPdf.setFontSize(10);
    docPdf.text('Gerencia de Datos y Transmisión · Central 4357', 14, 28);
    docPdf.text(`REPORTE MENSUAL: ${months[selectedMonth].toUpperCase()} ${selectedYear}`, pageWidth - 14, 28, { align: 'right' });
    
    docPdf.setFontSize(12);
    docPdf.setTextColor(255, 255, 255);
    docPdf.text('Libro de Control de Actividades y Sobretiempos', 14, 35);

    // Summary Statistics
    docPdf.setTextColor(40, 40, 40);
    docPdf.setFontSize(11);
    docPdf.text(`Total de Incidencias: ${filteredActivities.length}`, 14, 50);
    const totalOT = filteredActivities.reduce((acc, a) => acc + ((a.overtimeHours || 0) > 0 ? a.overtimeHours! : 0), 0);
    const totalDF = filteredActivities.reduce((acc, a) => acc + ((a.overtimeHours || 0) < 0 ? a.overtimeHours! : 0), 0);
    docPdf.text(`Horas Extra: +${formatHours(totalOT)}    Déficit: ${formatHours(totalDF)}`, 14, 56);

    // Table Data
    const tableData = filteredActivities.map(a => [
      format(a.date.toDate(), 'dd/MM'),
      a.incidentNumber || 'S/N',
      a.title,
      a.participants?.join(', ').split(' ').filter((_, i) => i % 2 === 0).join(', ') || '-',
      a.overtimeHours ? formatHours(a.overtimeHours) : '-',
      a.hasPerDiem ? 'SÍ' : 'NO'
    ]);

    autoTable(docPdf, {
      startY: 65,
      head: [['FECHA', 'INCIDENTE', 'LABOR REALIZADA', 'TÉCNICOS', 'ST/DF', 'VIÁT.']],
      body: tableData,
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 20 },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 15, halign: 'center' }
      },
      margin: { top: 65 }
    });

    // Footer
    const finalY = (docPdf as any).lastAutoTable.finalY + 20;
    if (finalY < 270) {
      docPdf.setFontSize(8);
      docPdf.setTextColor(150);
      docPdf.text('Firma Supervisor de Guardia', 40, finalY);
      docPdf.text('Firma Gerencia Técnica', pageWidth - 80, finalY);
      docPdf.line(20, finalY - 5, 80, finalY - 5);
      docPdf.line(pageWidth - 100, finalY - 5, pageWidth - 20, finalY - 5);
    }

    docPdf.save(`REPORTE_CANTV_${months[selectedMonth].toUpperCase()}_${selectedYear}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Error al generar el reporte PDF.");
    }
  };

  const generateMonthlyExcel = () => {
    generateSobretiempoExcel();
  };

  const generateActualSobretiempoExcel = async () => {
    if (filteredActivities.length === 0) return;

    try {
      const incomplete = checkActivitiesCompleteness(filteredActivities);
      if (incomplete.length > 0) {
        const confirmExport = window.confirm(
          `¡Atención! Se han detectado ${incomplete.length} actividades con información incompleta en este periodo (faltan incidentes, flota, horarios o técnicos).\n\n` +
          `¿Desea continuar con la exportación del Reporte de Sobretiempo de todos modos?`
        );
        if (!confirmExport) return;
      }

      const workbook = new ExcelJS.Workbook();
      const sheetName = `ST_${months[selectedMonth].substring(0, 3).toUpperCase()}_${selectedYear}`;
      const sheet = workbook.addWorksheet(sheetName);

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

      filteredActivities.forEach(a => {
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
              const d = safeGetActivityDate(a);
              if (!isNaN(d.getTime())) {
                fechaValue = format(d, 'dd/MM/yyyy');
              }
            }
          } catch(e) {}

          const row = sheet.addRow({
            area: techMatch ? (techMatch.department || techMatch.specialty || 'DATOS').toUpperCase() : 'DATOS',
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

      const buffer = await workbook.xlsx.writeBuffer();
      
      const day = format(new Date(), 'dd');
      const monthName = format(new Date(), 'MMMM', { locale: es });
      const year = format(new Date(), 'yyyy');
      
      const selectedMonthName = months[selectedMonth].toUpperCase();
      const fileName = `SOBRETIEMPO_CANTV_${day}_${monthName}_${year}_Mes_${selectedMonthName}_${selectedYear}.xlsx`;
      
      saveAs(new Blob([buffer]), fileName);

    } catch (err: any) {
      console.error("Error generating Sobretiempo Excel report:", err);
      alert("Error al generar el archivo Excel de Sobretiempo: " + (err.message || ""));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 select-none">
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-slate-900 border border-slate-800/80 p-6 rounded-[2rem] shadow-[0_4px_30px_rgba(0,0,0,0.3)] relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-1/4 w-60 h-60 bg-brand-blue/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full xl:w-auto relative">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-brand-blue to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-blue/30 shrink-0 border border-blue-400/20">
            <Archive size={26} className="sm:size-7 drop-shadow-[0_2px_8px_rgba(0,123,255,0.4)]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-display font-black text-white tracking-tight uppercase truncate">Historial de Reportes</h2>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-[10px] xl:text-xs text-slate-400 font-bold uppercase tracking-wider">Gestión administrativa</p>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-600" />
              <p className="text-[10px] text-brand-blue font-black uppercase tracking-widest flex items-center gap-1">
                Central Maracay 4357
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800/80 shadow-inner shrink-0 w-fit relative z-10">
          <select 
            className="flex-1 sm:flex-initial bg-transparent border-none text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-300 focus:ring-0 cursor-pointer px-3 py-1.5 text-center min-w-[100px] sm:min-w-[130px] appearance-none outline-none focus:outline-none"
            style={{ backgroundImage: 'none', paddingLeft: '8px', paddingRight: '8px', textAlignLast: 'center' }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          >
            {months.map((m, i) => (
              <option key={m} value={i} className="bg-slate-900 text-slate-200 font-sans font-bold uppercase tracking-normal text-left">
                {m}
              </option>
            ))}
          </select>
          <div className="w-px h-5 bg-slate-800 shrink-0" />
          <select 
            className="flex-1 sm:flex-initial bg-transparent border-none text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-300 focus:ring-0 cursor-pointer px-3 py-1.5 text-center min-w-[75px] sm:min-w-[85px] appearance-none outline-none focus:outline-none block"
            style={{ backgroundImage: 'none', paddingLeft: '8px', paddingRight: '8px', textAlignLast: 'center' }}
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {years.map(y => (
              <option key={y} value={y} className="bg-slate-900 text-slate-200 font-sans font-bold uppercase tracking-normal text-left">
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Resumen de Métricas de Planificación Mensual */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button 
          onClick={() => setMonthlySummaryDetails('total')}
          className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-brand-blue/40 transition-all duration-300 p-5 rounded-3xl text-left cursor-pointer group relative overflow-hidden shadow-lg shadow-black/20"
        >
          <div className="absolute right-0 top-0 w-24 h-24 bg-brand-blue/5 rounded-bl-[4rem] group-hover:scale-110 transition-transform duration-300"></div>
          <div className="flex items-center gap-3 mb-3 relative">
            <div className="w-10 h-10 bg-brand-blue/10 border border-brand-blue/10 rounded-2xl flex items-center justify-center text-brand-blue group-hover:scale-105 transition-transform">
              <Clock size={20} />
            </div>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Horas Totales</span>
          </div>
          <p className="text-2xl font-display font-black text-white tracking-tight drop-shadow-[0_2px_8px_rgba(59,130,246,0.15)]">{formatHours(totalHours)}h</p>
          <span className="text-[9px] font-bold text-slate-500 mt-1 block uppercase tracking-wider group-hover:text-brand-blue transition-colors">Desglose mensual</span>
        </button>

        <button 
          onClick={() => setMonthlySummaryDetails('st')}
          className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all duration-300 p-5 rounded-3xl text-left cursor-pointer group relative overflow-hidden shadow-lg shadow-black/20"
        >
          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-bl-[4rem] group-hover:scale-110 transition-transform duration-300"></div>
          <div className="flex items-center gap-3 mb-3 relative">
            <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <Zap size={20} />
            </div>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Sobretiempos</span>
          </div>
          <p className="text-2xl font-display font-black text-emerald-400 tracking-tight drop-shadow-[0_2px_8px_rgba(16,185,129,0.15)]">+{formatHours(stHours)}h</p>
          <span className="text-[9px] font-bold text-slate-500 mt-1 block uppercase tracking-wider group-hover:text-emerald-450 transition-colors">Ver horas extra</span>
        </button>

        <button 
          onClick={() => setMonthlySummaryDetails('df')}
          className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all duration-300 p-5 rounded-3xl text-left cursor-pointer group relative overflow-hidden shadow-lg shadow-black/20"
        >
          <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-bl-[4rem] group-hover:scale-110 transition-transform duration-300"></div>
          <div className="flex items-center gap-3 mb-3 relative">
            <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <TrendingDown size={20} />
            </div>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Déficit ST</span>
          </div>
          <p className="text-2xl font-display font-black text-amber-400 tracking-tight">-{formatHours(dfHours)}h</p>
          <span className="text-[9px] font-bold text-slate-500 mt-1 block uppercase tracking-wider group-hover:text-amber-450 transition-colors">Detalle de déficits</span>
        </button>

        <button 
          onClick={() => setMonthlySummaryDetails('exceso')}
          className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-brand-red/45 transition-all duration-300 p-5 rounded-3xl text-left cursor-pointer group relative overflow-hidden shadow-lg shadow-black/20"
        >
          <div className="absolute right-0 top-0 w-24 h-24 bg-brand-red/5 rounded-bl-[4rem] group-hover:scale-110 transition-transform duration-300"></div>
          <div className="flex items-center gap-3 mb-3 relative">
            <div className="w-10 h-10 bg-brand-red/10 border border-brand-red/10 rounded-2xl flex items-center justify-center text-brand-red group-hover:scale-105 transition-transform">
              <AlertOctagon size={20} />
            </div>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Jornadas &gt; 10h</span>
          </div>
          <p className="text-2xl font-display font-black text-brand-red tracking-tight drop-shadow-[0_2px_8px_rgba(239,68,68,0.15)]">{excesoPersonasMensual} d</p>
          <span className="text-[9px] font-bold text-slate-500 mt-1 block uppercase tracking-wider group-hover:text-brand-red transition-colors">Ver alertas de fatiga</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actions Sidebar */}
        <div className="space-y-4">
          <button 
            onClick={generateMonthlyExcel}
            className="w-full bg-[#0b1120] hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition-all duration-300 p-6 flex flex-col items-center gap-4 group rounded-3xl cursor-pointer shadow-lg relative overflow-hidden text-left"
          >
            {/* Hover decorative shine */}
            <div className="absolute -inset-y-20 -left-40 w-44 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent skew-x-12 group-hover:translate-x-[500px] transition-transform duration-1000" />
            
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform duration-300 shadow-xl shadow-black/40">
              <Table size={32} />
            </div>
            <div className="text-center relative">
              <span className="block font-display font-black text-white text-base">Planificación Mensual Excel</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed mt-1 block">
                Formato TX y DX (TX/DX)<br/>
                <span className="text-emerald-400/80">({months[selectedMonth]} {selectedYear})</span>
              </span>
            </div>
          </button>

          <button 
            onClick={generateActualSobretiempoExcel}
            className="w-full bg-[#0b1120] hover:bg-slate-900 border border-slate-800 hover:border-teal-500/50 transition-all duration-300 p-6 flex flex-col items-center gap-4 group rounded-3xl cursor-pointer shadow-lg relative overflow-hidden text-left"
          >
            <div className="absolute -inset-y-20 -left-40 w-44 bg-gradient-to-r from-transparent via-teal-500/10 to-transparent skew-x-12 group-hover:translate-x-[500px] transition-transform duration-1000" />
            
            <div className="w-16 h-16 bg-teal-500/10 border border-teal-500/20 rounded-2xl flex items-center justify-center text-teal-400 group-hover:scale-110 transition-transform duration-300 shadow-xl shadow-black/40">
              <Download size={32} />
            </div>
            <div className="text-center relative">
              <span className="block font-display font-black text-white text-base">Institucional: Sobretiempo Excel</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed mt-1 block">
                Formato Sobretiempos de Ley<br/>
                <span className="text-teal-400/80">({months[selectedMonth]} {selectedYear})</span>
              </span>
            </div>
          </button>

          <button 
            onClick={generateConsolidatedPDF}
            className="w-full bg-[#0b1120] hover:bg-slate-900 border border-slate-800 hover:border-brand-red/50 transition-all duration-300 p-6 flex flex-col items-center gap-4 group rounded-3xl cursor-pointer shadow-lg relative overflow-hidden text-left"
          >
            <div className="absolute -inset-y-20 -left-40 w-44 bg-gradient-to-r from-transparent via-brand-red/10 to-transparent skew-x-12 group-hover:translate-x-[500px] transition-transform duration-1000" />
            
            <div className="w-16 h-16 bg-brand-red/10 border border-brand-red/20 rounded-2xl flex items-center justify-center text-brand-red group-hover:scale-110 transition-transform duration-300 shadow-xl shadow-black/40">
              <FileText size={32} />
            </div>
            <div className="text-center relative">
              <span className="block font-display font-black text-white text-base">Reporte Consolidado PDF</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed mt-1 block">
                Formato Institucional<br/>
                <span className="text-brand-red/70">({months[selectedMonth]} {selectedYear})</span>
              </span>
            </div>
          </button>
        </div>

        {/* List of Daily Sheets in the month */}
        <div className="lg:col-span-2 bg-[#0b1120]/65 border border-slate-800/80 rounded-[2rem] flex flex-col h-[520px] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-blue/20 via-brand-blue/60 to-brand-blue/20" />
          
          <div className="px-6 py-5 border-b border-slate-800/60 flex items-center justify-between bg-slate-900/40 relative">
            <h3 className="font-display font-black text-white text-sm tracking-tight flex items-center gap-2">
              <History size={18} className="text-brand-blue drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
              Libro de Actividades: {months[selectedMonth]} {selectedYear}
            </h3>
            <span className="text-[9px] font-black text-slate-300 bg-slate-950 border border-slate-800 px-3 py-1 rounded-full uppercase tracking-widest shadow-inner">
              {filteredActivities.length} Entradas Totales
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-950/20">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 31 }).map((_, i) => {
                const day = i + 1;
                const d = new Date(selectedYear, selectedMonth, day);
                if (d.getMonth() !== selectedMonth) return null;
                
                const dayActs = filteredActivities.filter(a => {
                  try {
                    const aDate = safeGetActivityDate(a);
                    return aDate.getDate() === day;
                  } catch {
                    return false;
                  }
                });
                
                return (
                  <div 
                    key={`report-day-${selectedYear}-${selectedMonth}-${day}`} 
                    onClick={() => dayActs.length > 0 && setSelectedDayActivities({ date: d, activities: dayActs })}
                    className={cn(
                    "p-4 rounded-2xl border transition-all flex items-center justify-between group",
                    dayActs.length > 0 
                      ? "bg-slate-900 border-slate-800 hover:border-brand-blue/50 hover:bg-slate-800/40 cursor-pointer shadow-md hover:shadow-brand-blue/5" 
                      : "bg-slate-950/40 border-slate-900/30 opacity-20 select-none"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-sm border",
                        dayActs.length > 0 
                          ? "bg-brand-blue/10 text-brand-blue border-brand-blue/20 drop-shadow-[0_0_6px_rgba(59,130,246,0.2)]" 
                          : "bg-slate-900/55 text-slate-600 border-slate-800/45"
                      )}>
                        {day}
                      </div>
                      <div>
                        <p className={cn(
                          "text-xs font-black capitalize",
                          dayActs.length > 0 ? "text-slate-100" : "text-slate-600"
                        )}>
                          {format(d, 'eeee', { locale: es })}
                        </p>
                        <p className="text-[10px] text-slate-505 font-bold uppercase tracking-widest mt-0.5">
                          {dayActs.length} {dayActs.length === 1 ? 'registro' : 'registros'}
                        </p>
                      </div>
                    </div>
                    {dayActs.length > 0 && (
                      <ChevronRight size={16} className="text-slate-500 group-hover:text-brand-blue transition-colors group-hover:translate-x-0.5 duration-200" />
                    )}
                  </div>
                );
              })}
            </div>
            {filteredActivities.length === 0 && (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-900/80 rounded-full flex items-center justify-center text-slate-650 mb-4 border border-slate-800">
                  <Archive size={32} />
                </div>
                <h4 className="font-display font-black text-slate-400 tracking-tight text-sm uppercase">Archivo Vacío</h4>
                <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest mt-1">No hay reportes de labores para este período</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Day Details Modal */}
      {selectedDayActivities && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setSelectedDayActivities(null)} />
          <div className="bg-[#0b1120] border border-slate-800 w-full max-w-4xl max-h-[85vh] xl:max-h-[80vh] overflow-hidden flex flex-col relative shadow-2xl rounded-[2.5rem] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between sticky top-0 z-10 w-full">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-blue/10 border border-brand-blue/20 rounded-2xl flex items-center justify-center shadow-lg shadow-black/30">
                  <span className="font-display font-black text-brand-blue text-lg">{format(selectedDayActivities.date, 'dd')}</span>
                </div>
                <div>
                  <h3 className="font-display font-black text-white tracking-tight text-lg capitalize">
                    {format(selectedDayActivities.date, "eeee, dd 'de' MMMM", { locale: es })}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-brand-blue/10 text-brand-blue border border-brand-blue/20 font-black uppercase tracking-widest text-[9px] px-2.5 py-0.5 rounded-full">
                      {selectedDayActivities.activities.length} {selectedDayActivities.activities.length === 1 ? 'Actividad registrada' : 'Actividades registradas'}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDayActivities(null)}
                className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* List */}
            <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-950/40 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedDayActivities.activities.map((activity) => (
                  <div key={activity.id} className="bg-slate-900 border border-slate-800/60 rounded-2xl p-5 shadow-inner relative overflow-hidden group hover:border-slate-750 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-brand-blue/20 group-hover:bg-brand-blue transition-colors duration-300" />
                    
                    <div className="flex items-start justify-between mb-3">
                      <div className="space-y-1 w-full">
                        <span className="font-mono text-[9px] font-black text-brand-blue bg-brand-blue/10 border border-brand-blue/10 px-2 py-0.5 rounded uppercase">
                          {activity.incidentNumber || 'S/N'}
                        </span>
                        <h4 className="font-bold text-slate-100 leading-tight pr-6 mt-1.5">{activity.title}</h4>
                      </div>
                    </div>
                    
                    <p className="text-xs text-slate-400 line-clamp-2 mb-4 pr-4 leading-relaxed">{activity.description}</p>
                    
                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
                      <div className="flex items-start gap-2">
                        <Clock size={14} className="text-slate-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-300">{activity.startTime || '--:--'} a {activity.endTime || '--:--'}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Horario</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <Wrench size={14} className="text-slate-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-300 capitalize">{activity.type}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Tipo</p>
                        </div>
                      </div>

                      <div className="col-span-2 pt-3 border-t border-slate-800 mt-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-1">
                            {activity.participants?.map((p, pIdx) => (
                              <span key={`${activity.id}-p-${pIdx}`} className="text-[10px] font-bold text-slate-300 bg-slate-800/80 border border-slate-700/30 px-2 py-0.5 rounded-md italic">
                                {p.split(' ')[0]}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            {(activity.overtimeHours || 0) !== 0 && (
                              <span className={cn(
                                "text-[10px] font-black px-2 py-0.5 rounded border",
                                (activity.overtimeHours || 0) > 0 
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                  : "bg-red-500/10 text-red-500 border-red-500/20"
                              )}>
                                {(activity.overtimeHours || 0) > 0 ? '+' : ''}{formatHours(activity.overtimeHours || 0)}
                              </span>
                            )}
                            {activity.hasPerDiem && (
                              <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                Bs. {Number(activity.perDiemAmount || 0).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Summary Details Modal */}
      {monthlySummaryDetails && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setMonthlySummaryDetails(null)}></div>
          <div className="relative bg-[#0b1120] border border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/45 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-display font-black text-white text-base">
                  {monthlySummaryDetails === 'total' && 'Desglose de Horas Totales (Mensual)'}
                  {monthlySummaryDetails === 'st' && 'Desglose de Sobretiempos (Mensual)'}
                  {monthlySummaryDetails === 'df' && 'Desglose de Déficits (Mensual)'}
                  {monthlySummaryDetails === 'exceso' && 'Jornadas Mayores a 10h (Mensual)'}
                </h3>
              </div>
              <button onClick={() => setMonthlySummaryDetails(null)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="p-0 overflow-y-auto flex-1 custom-scrollbar bg-slate-950/20">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-850 z-10">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actividad / Técnico</th>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Horas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {monthlySummaryDetails === 'exceso' ? (
                    (() => {
                      const hoursPerPersonPerDay: Record<string, { total: number, name: string, date: Date, titles: string[] }> = {};
                      
                      filteredActivities.forEach(a => {
                        const dateObj = safeGetActivityDate(a);
                        const dateKey = dateObj.toISOString().split('T')[0];
                        
                        const parts = a.participants && a.participants.length > 0 ? a.participants : (a.technicianName ? [a.technicianName] : []);
                        parts.forEach(p => {
                          const key = `${dateKey}_${p}`;
                          if (!hoursPerPersonPerDay[key]) {
                            hoursPerPersonPerDay[key] = { total: 0, name: p, date: dateObj, titles: [] };
                          }
                          hoursPerPersonPerDay[key].total += (a.totalHours || 0);
                          if (!hoursPerPersonPerDay[key].titles.includes(a.title)) {
                            hoursPerPersonPerDay[key].titles.push(a.title);
                          }
                        });
                      });

                      const items = Object.values(hoursPerPersonPerDay)
                        .filter(h => h.total > 10)
                        .sort((a, b) => b.date.getTime() - a.date.getTime());

                      if (items.length === 0) {
                        return (
                          <tr>
                            <td colSpan={2} className="px-6 py-8 text-center text-sm font-bold text-slate-500 animate-pulse">No hay registros</td>
                          </tr>
                        );
                      }

                      return items.map((item, idx) => (
                        <tr key={`monthly-exceso-${idx}`} className="hover:bg-slate-900/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-slate-100 mb-0.5 leading-tight">{item.name}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
                                {format(item.date, 'dd MMM', { locale: es })}
                              </span>
                              <span className="text-[9px] font-bold text-slate-401 truncate max-w-[200px]">
                                {item.titles.join(', ')}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-xs font-black px-2.5 py-1 rounded-lg border inline-block text-brand-red bg-brand-red/10 border-brand-red/20 shadow-sm shadow-brand-red/10">
                              {formatHours(item.total)}h
                            </span>
                          </td>
                        </tr>
                      ));
                    })()
                  ) : filteredActivities.filter(a => {
                    if (monthlySummaryDetails === 'total') return true;
                    if (monthlySummaryDetails === 'st') return (a.overtimeHours || 0) > 0;
                    if (monthlySummaryDetails === 'df') return (a.overtimeHours || 0) < 0;
                    return false;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-6 py-8 text-center text-sm font-bold text-slate-500 animate-pulse">No hay registros</td>
                    </tr>
                  ) : filteredActivities.filter(a => {
                    if (monthlySummaryDetails === 'total') return true;
                    if (monthlySummaryDetails === 'st') return (a.overtimeHours || 0) > 0;
                    if (monthlySummaryDetails === 'df') return (a.overtimeHours || 0) < 0;
                    return false;
                  }).map((activity, idx) => {
                    let value = 0;
                    if (monthlySummaryDetails === 'total') value = activity.totalHours || ((activity.overtimeHours || 0) + 8);
                    if (monthlySummaryDetails === 'st') value = activity.overtimeHours || 0;
                    if (monthlySummaryDetails === 'df') value = Math.abs(activity.overtimeHours || 0);

                    return (
                      <tr key={`monthly-summary-row-${idx}`} className="hover:bg-slate-900/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-100 mb-1 leading-tight">{activity.title || 'Sin Título'}</div>
                          <div className="text-[10px] font-bold text-slate-450 flex gap-2 flex-wrap items-center">
                            <span className="text-slate-300">{activity.participants && activity.participants.length > 0 ? activity.participants.map(p => p.split(' ')[0]).join(', ') : activity.technicianName}</span>
                            <span className="bg-slate-900 border border-slate-800 text-slate-405 px-1.5 py-0.2 rounded text-[8px] uppercase">{format(safeGetActivityDate(activity), 'dd MMM')}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={cn(
                            "text-xs font-black px-2.5 py-1 rounded-lg border inline-block shadow-sm",
                            monthlySummaryDetails === 'st' ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                            monthlySummaryDetails === 'df' ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                            "text-brand-blue bg-brand-blue/10 border-brand-blue/20"
                          )}>
                            {formatHours(value)}h
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/40 flex justify-end shrink-0">
              <button 
                onClick={() => setMonthlySummaryDetails(null)}
                className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-700 active:scale-95 transition-all cursor-pointer border border-slate-700"
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
