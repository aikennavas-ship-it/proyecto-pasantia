import React from 'react';
import { Download, FileText, Table, Users, Filter, Calendar, ChevronRight, Archive, History, X, Clock, MapPin, Zap, TrendingDown, AlertOctagon, Eye } from 'lucide-react';
import { Activity, Technician } from '../../../types';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, getYear, getMonth, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, formatDateSpanish, getActivityBounds, calculateRealHours, parseTime, calculateMetrics, calculateExcesoPersonas, capitalizeSentence, optimizarAlturasJustificacionSGA } from '../../../lib/utils';
import { formatHours } from '../../activities/components/ActivityForm';
import LottAlertsModal from '../../activities/components/LottAlertsModal';
import { obtenerNombreArchivoExcel } from '../../../lib/filenameUtils';

function ReportDailyExcessRow({ d }: { d: any }) {
  const [expanded, setExpanded] = React.useState(false);
  const titlesText = d.titles.map((t: string) => capitalizeSentence(!t || t.trim().toLowerCase() === 's' ? 'Mantenimiento Preventivo de Enlace' : t)).join(', ');
  const isLong = titlesText.length > 35;

  return (
    <div className="flex justify-between items-center pl-3 py-1.5 border-l-2 border-brand-red/40 ml-1 gap-4 text-left">
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5 uppercase tracking-widest">
          <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex items-center gap-1 leading-none shrink-0 font-bold">
            📅 {formatDateSpanish(d.date, 'dd MMM').toUpperCase()}
          </span>
        </div>
        <div className="text-[10px] font-medium leading-normal">
          <p className={expanded ? "whitespace-normal text-slate-600 font-semibold" : "line-clamp-1 text-slate-500 italic"}>
            {titlesText}
            {isLong && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-[10px] text-brand-blue font-bold hover:underline inline ml-1 cursor-pointer transition-all active:scale-95 whitespace-nowrap focus:outline-none"
              >
                {expanded ? " ver menos" : " ver más..."}
              </button>
            )}
          </p>
        </div>
      </div>
      <div className="text-[10px] font-black font-mono text-brand-red border border-brand-red/15 bg-brand-red/5 px-2 py-1 rounded-lg whitespace-nowrap shadow-sm self-start mt-0.5">
        EXCESO DIARIO: {formatHours(d.total).toUpperCase()}
      </div>
    </div>
  );
}

interface ReportGeneratorProps {
  activities: Activity[];
  technicians: Technician[];
}

export function DescripcionExpandible({ texto, limite = 90 }: { texto: string; limite?: number }) {
  const [expandido, setExpandido] = React.useState(false);

  if (!texto || texto.length <= limite) {
    return <p className="text-xs text-slate-500 leading-relaxed mb-4">{texto}</p>;
  }

  const textoTruncado = `${texto.slice(0, limite)}...`;

  return (
    <p className="text-xs text-slate-500 leading-relaxed transition-all duration-200 mb-4 inline-block">
      {expandido ? texto : textoTruncado}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation(); // Evita disparar clics accidentales en la tarjeta
          setExpandido(!expandido);
        }}
        className="text-blue-600 font-semibold italic hover:underline ml-1 focus:outline-none inline-block line-clamp-none whitespace-nowrap"
      >
        {expandido ? 'ver menos' : 'ver más...'}
      </button>
    </p>
  );
}

export default function ReportGenerator({ activities, technicians }: ReportGeneratorProps) {
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState(new Date().getMonth());
  const [selectedTechnician, setSelectedTechnician] = React.useState<string>('todos');
  const [viewMode, setViewMode] = React.useState<'summary' | 'history'>('summary');
  const [monthlySummaryDetails, setMonthlySummaryDetails] = React.useState<'total' | 'st' | 'df' | 'exceso' | null>(null);
  
  // State for the modal
  const [selectedDayActivities, setSelectedDayActivities] = React.useState<{ date: Date, activities: Activity[] } | null>(null);

  const currentYear = new Date().getFullYear();
  const startYear = 2024;
  const numYears = currentYear - startYear + 1;
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
      const isSameMonthYear = date.getFullYear() === selectedYear && date.getMonth() === selectedMonth;
      if (!isSameMonthYear) return false;

      const parts = a.participants && a.participants.length > 0 ? a.participants : (a.technicianName ? [a.technicianName] : []);
      const matchesTechnician = selectedTechnician === 'todos' || 
        parts.some(p => (p || '').toLowerCase().trim() === selectedTechnician.toLowerCase().trim());
        
      return matchesTechnician;
    });
  }, [activities, selectedYear, selectedMonth, selectedTechnician]);

  const { totalHours, stHours, dfHours } = React.useMemo(() => {
    const metrics = calculateMetrics(filteredActivities, selectedTechnician);
    return { totalHours: metrics.total, stHours: metrics.stAcumulado, dfHours: metrics.dfAcumulado };
  }, [filteredActivities, selectedTechnician]);

  const excesoPersonasMensual = React.useMemo(() => {
    const rawExceso = calculateExcesoPersonas(filteredActivities, true);
    if (selectedTechnician !== 'todos') {
      return rawExceso.items.filter(item => (item.name || '').toLowerCase() === selectedTechnician.toLowerCase()).length;
    }
    return rawExceso.count;
  }, [filteredActivities, selectedTechnician]);

  const activitiesByDay = React.useMemo(() => {
    const map = new Map<number, Activity[]>();
    filteredActivities.forEach(a => {
      const date = safeGetActivityDate(a);
      const day = date.getDate();
      if (!map.has(day)) {
        map.set(day, []);
      }
      map.get(day)!.push(a);
    });
    return map;
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
        { header: 'SOBRETIEMPO', key: 'st', width: 16 },
        { header: 'DEFICIT', key: 'deficit', width: 15 },
        { header: 'Hora Entrada Mañana', key: 'he_m', width: 22 },
        { header: 'Hora Salida Mañana', key: 'hs_m', width: 22 },
        { header: 'Pausa', key: 'pausa', width: 10 },
        { header: 'Hora Entrada Tarde', key: 'he_t', width: 22 },
        { header: 'Hora Salida Tarde', key: 'hs_t', width: 22 },
        { header: 'HORAS', key: 'horas', width: 10 },
        { header: 'MANEJO', key: 'manejo', width: 15 },
        { header: 'VIATICOS', key: 'viaticos', width: 12 },
        { header: 'MONTO VIATICOS (Bs.)', key: 'monto_viaticos', width: 22 }
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
        row.height = 24;
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

      const sortedActs = [...filteredActivities].sort((x, y) => {
        return safeGetActivityDate(x).getTime() - safeGetActivityDate(y).getTime();
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
          st: a.overtimeHours && a.overtimeHours > 0 ? `${formatHours(a.overtimeHours)}` : 'no',
          deficit: typeof a.overtimeHours === 'number' && a.overtimeHours < 0 ? `${formatHours(a.overtimeHours)}` : 'no',
          he_m: formatTime24h(a.startTimeMorning || '', '07:30'),
          hs_m: formatTime24h(a.endTimeMorning || '', '11:45'),
          pausa: a.hasPause || 'SI',
          he_t: formatTime24h(a.startTimeAfternoon || '', '12:45'),
          hs_t: formatTime24h(a.endTimeAfternoon || a.endTime || '', '16:00'),
          horas: a.totalHours ? `${formatHours(a.totalHours)}` : '',
          manejo: a.driver || '',
          viaticos: a.hasPerDiem ? 'si' : 'no',
          monto_viaticos: a.hasPerDiem ? Number(a.perDiemAmount || 0).toFixed(2) : '0.00'
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

        row.height = 18;
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

      // 1. Obtener la Fila 2 (donde se encuentran físicamente los títulos de las columnas)
      const filaCabecera = sheet.getRow(2);
      let indiceColumnaSobretiempo = -1;

      // 2. Escanear celda por celda de la fila para encontrar la columna correcta
      filaCabecera.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const valorCelda = cell.value ? cell.value.toString().trim().toUpperCase() : '';
        if (valorCelda === 'SOBRETIEMPO') {
          indiceColumnaSobretiempo = colNumber;
        }
      });

      // 3. Si se localiza la columna, forzar el ancho de seguridad y alineación
      if (indiceColumnaSobretiempo !== -1) {
        const columna = sheet.getColumn(indiceColumnaSobretiempo);
        // Establecemos un ancho de 20 para dar espacio de respiración en el margen derecho (R)
        columna.width = 20;
        columna.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      
      const fechaFiltro = new Date(selectedYear, selectedMonth, 1);
      const fileName = obtenerNombreArchivoExcel({
        tipoDoc: 'Planificacion',
        frecuencia: 'mensual',
        fechaFiltro: fechaFiltro,
        tecnicoSeleccionado: selectedTechnician
      });
      
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
    
    docPdf.setFont('helvetica', 'normal');
    docPdf.setFontSize(8.5);
    docPdf.setTextColor(176, 196, 222); // #b0c4de
    docPdf.text('Departamento de Datos y Transmisión · Central 4357', 14, 28);

    const headerTitle = selectedTechnician !== 'todos' 
      ? `REPORTE MENSUAL INDIVIDUAL: ${selectedTechnician.toUpperCase()} - ${months[selectedMonth].toUpperCase()} ${selectedYear}`
      : `REPORTE MENSUAL: ${months[selectedMonth].toUpperCase()} ${selectedYear}`;
    
    docPdf.setFont('helvetica', 'bold');
    docPdf.setTextColor(255, 255, 255); // #ffffff
    docPdf.text(headerTitle, pageWidth - 14, 28, { align: 'right' });
    
    docPdf.setFontSize(12);
    docPdf.setTextColor(255, 255, 255);
    docPdf.text('Libro de Control de Actividades y Sobretiempos', 14, 35);

    // Summary Statistics
    docPdf.setTextColor(40, 40, 40);
    docPdf.setFontSize(11);
    docPdf.text(`Total de Incidencias: ${filteredActivities.length}`, 14, 50);
    docPdf.text(`Horas Extra: +${formatHours(stHours)}    Déficit: -${formatHours(dfHours)}`, 14, 56);

    // Table Data
    const tableData = filteredActivities.map(a => [
      format(a.date.toDate(), 'dd/MM/yyyy'),
      a.incidentNumber || 'S/N',
      a.title,
      a.participants?.map(p => {
        const t = technicians.find(tc => tc.name.trim().toLowerCase() === p.trim().toLowerCase());
        const words = p.split(' ');
        const surname = words.length > 1 ? words[words.length - 1] : p;
        const id = t?.employeeId || t?.idCard || 'S/N';
        return `${surname} (${id})`;
      }).join('\n') || '-',
      a.overtimeHours ? formatHours(a.overtimeHours) : '-',
      a.hasPerDiem && a.perDiemAmount ? `Bs. ${a.perDiemAmount.toFixed(2)}` : 'Bs. 0.00'
    ]);

    autoTable(docPdf, {
      startY: 65,
      head: [['FECHA', 'INCIDENTE', 'LABOR REALIZADA', 'TÉCNICOS', 'ST/DF', 'VIÁT.']],
      body: tableData,
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', valign: 'middle' },
      bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85], valign: 'middle' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 3.5, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 23 }, // 65 points equivalent, avoids year/date cut-off
        1: { cellWidth: 33.5 }, // 95 points equivalent, avoids incident code split
        3: { cellWidth: 33.5 }, // 95 points equivalent, ideal for names without extra parenthesis
        4: { cellWidth: 16, halign: 'center' }, // 45 points equivalent
        5: { cellWidth: 21, halign: 'center' }  // 60 points equivalent
      },
      margin: { top: 65 }
    });

    // Footer / Signatures
    const pageHeight = docPdf.internal.pageSize.height;
    const tableFinalY = (docPdf as any).lastAutoTable?.finalY || 65;
    
    // We need about 30 units of space for signature lines & text
    const signatureRequiredHeight = 30;
    let finalY = tableFinalY + 25; // Flow immediately below the table
    
    // If it doesn't fit on the current page, add a new page and align at pageHeight - 50
    if (finalY + signatureRequiredHeight > pageHeight - 15) {
      docPdf.addPage();
      finalY = pageHeight - 50;
    }
    
    docPdf.setFontSize(10);
    docPdf.setTextColor(150);
    
    docPdf.line(20, finalY - 5, 80, finalY - 5);
    docPdf.text('Firma Supervisor de Guardia', 50, finalY + 5, { align: 'center' });
    
    docPdf.line(pageWidth - 80, finalY - 5, pageWidth - 20, finalY - 5);
    docPdf.text('Firma Gerencia Técnica', pageWidth - 50, finalY + 5, { align: 'center' });

    const pdfTechSuffix = selectedTechnician !== 'todos' ? `_INDIVIDUAL_${selectedTechnician.toUpperCase().replace(/\s+/g, '_')}` : '';
    docPdf.save(`REPORTE_CANTV_${months[selectedMonth].toUpperCase()}_${selectedYear}${pdfTechSuffix}.pdf`);
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
        { header: 'JUSTIFIQUE', key: 'justifique', width: 50 }
      ];

      const headerRow = sheet.getRow(1);
      headerRow.height = 24;

      headerRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true, color: { argb: colNumber === 1 || colNumber === 15 ? 'FF000000' : 'FFFFFFFF' }, size: 9, name: 'Arial' };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
        
        let fgColor = 'FF4F81BD'; // Blue 
        
        if (colNumber === 1) fgColor = 'FFF79646'; // AREA (Orange)
        if (colNumber === 15) fgColor = 'FFFCD5B4'; // JUSTIFIQUE (Peach)

        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fgColor } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } }, left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } }, right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });

      const sortedActs = [...filteredActivities].sort((x, y) => {
        return safeGetActivityDate(x).getTime() - safeGetActivityDate(y).getTime();
      });

      sortedActs.forEach(a => {
        const parts = a.participants && a.participants.length > 0 ? a.participants : (a.technicianName ? [a.technicianName] : []);
        
        parts.forEach(p => {
          if (selectedTechnician !== 'todos' && (p || '').toLowerCase().trim() !== selectedTechnician.toLowerCase().trim()) {
            return;
          }
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
              const d = safeGetActivityDate(a);
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
          const justCell = row.getCell('justifique');
          justCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
        });
      });

      sheet.columns.forEach(column => {
        if (column.key === 'justifique') {
          column.width = 50;
          return;
        }
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 0;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 12 ? 12 : maxLength + 4;
      });

      // 1. Aplicar factor de optimización estándar para la columna de Justificación
      optimizarAlturasJustificacionSGA(sheet);

      const buffer = await workbook.xlsx.writeBuffer();
      
      const fechaFiltro = new Date(selectedYear, selectedMonth, 1);
      const fileName = obtenerNombreArchivoExcel({
        tipoDoc: 'Sobretiempo',
        frecuencia: 'mensual',
        fechaFiltro: fechaFiltro,
        tecnicoSeleccionado: selectedTechnician
      });
      
      saveAs(new Blob([buffer]), fileName);

    } catch (err: any) {
      console.error("Error generating Sobretiempo Excel report:", err);
      alert("Error al generar el archivo Excel de Sobretiempo: " + (err.message || ""));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.02),0_15px_35px_rgba(0,0,0,0.06)] border border-slate-200 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full lg:w-auto min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-brand-blue to-blue-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-brand-blue/15 shrink-0">
            <Archive size={26} className="sm:size-7" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-display font-black text-slate-900 tracking-tight uppercase truncate">Historial de Reportes</h2>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gestión administrativa</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center justify-end w-full lg:w-auto ml-auto min-w-0">
          {/* Píldora de Selección de Fecha (Mes / Año) */}
          <div className="flex items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-sm shrink-0 w-full sm:w-auto justify-center sm:justify-start">
            <select 
              className="flex-1 sm:flex-initial bg-transparent border-none text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#4A4A4A] focus:ring-0 cursor-pointer px-2 py-1.5 text-center min-w-[90px] sm:min-w-[120px] appearance-none outline-none focus:outline-none w-full sm:w-auto"
              style={{ backgroundImage: 'none', paddingLeft: '8px', paddingRight: '8px', textAlignLast: 'center' }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {months
                .map((m, i) => ({ name: m, value: i }))
                .filter(opt => {
                  if (selectedYear === currentYear) {
                    return opt.value <= new Date().getMonth();
                  }
                  return true;
                })
                .map((opt) => (
                  <option key={opt.name} value={opt.value} className="bg-white text-slate-800 font-sans font-bold uppercase tracking-normal text-left">
                    {opt.name}
                  </option>
                ))
              }
            </select>
            <div className="w-px h-4 bg-slate-200 shrink-0" />
            <select 
              className="flex-1 sm:flex-initial bg-transparent border-none text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#4A4A4A] focus:ring-0 cursor-pointer px-2 py-1.5 text-center min-w-[70px] sm:min-w-[80px] appearance-none outline-none focus:outline-none block w-full sm:w-auto"
              style={{ backgroundImage: 'none', paddingLeft: '8px', paddingRight: '8px', textAlignLast: 'center' }}
              value={selectedYear}
              onChange={(e) => {
                const yr = parseInt(e.target.value);
                setSelectedYear(yr);
                if (yr === currentYear) {
                  const curMonth = new Date().getMonth();
                  if (selectedMonth > curMonth) {
                    setSelectedMonth(curMonth);
                  }
                }
              }}
            >
              {years.map(y => (
                <option key={y} value={y} className="bg-white text-slate-800 font-sans font-bold uppercase tracking-normal text-left">
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Personal */}
          <div className="flex items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-sm shrink-0 w-full sm:w-auto justify-center sm:justify-start">
            <select 
              className="flex-1 sm:flex-initial bg-transparent border-none text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#4A4A4A] focus:ring-0 cursor-pointer px-2 py-1.5 text-center min-w-[120px] sm:min-w-[170px] appearance-none outline-none focus:outline-none w-full sm:w-auto"
              style={{ backgroundImage: 'none', paddingLeft: '8px', paddingRight: '8px', textAlignLast: 'center' }}
              value={selectedTechnician}
              onChange={(e) => setSelectedTechnician(e.target.value)}
            >
              <option value="todos" className="bg-white text-slate-800 font-sans font-bold uppercase tracking-normal text-left">
                PERSONAL (TODOS)
              </option>
              {technicians.map((t) => (
                <option key={t.id} value={t.name} className="bg-white text-slate-800 font-sans font-medium tracking-normal text-left">
                  {t.name.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Resumen de Métricas de Planificación Mensual */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full pb-3 md:pb-0 shrink-0">
        <button 
          onClick={() => setMonthlySummaryDetails('total')}
          className="w-full bg-white hover:bg-slate-50/80 transition-all p-2.5 sm:p-4 rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.01),0_10px_25px_rgba(0,0,0,0.03)] border border-slate-200 text-left cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[96px] sm:min-h-[120px] h-auto select-none border-t-4 border-t-transparent hover:border-t-brand-blue"
        >
          <div className="flex items-start justify-between w-full gap-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[8px] sm:text-[10px] uppercase font-bold tracking-widest text-slate-500 leading-tight">Horas Totales</p>
              <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-display font-black text-slate-950 leading-none tracking-tight mt-1 sm:mt-2.5 whitespace-nowrap">
                {formatHours(totalHours)}
              </p>
            </div>
            <div className="w-7 h-7 sm:w-10 sm:h-10 bg-brand-blue/5 rounded-lg sm:rounded-xl flex items-center justify-center text-brand-blue shrink-0">
              <Clock size={14} className="sm:size-[18px]" />
            </div>
          </div>
          <div className="w-full pt-1.5 sm:pt-2 mt-1.5 sm:mt-2 border-t border-slate-100 flex items-center justify-between text-[8px] sm:text-[9px] font-black text-brand-blue uppercase tracking-widest leading-none opacity-0 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0 transition-all duration-300 pointer-events-none">
            <span>Ver detalles</span>
            <Eye size={10} className="sm:size-3 opacity-75 group-hover:scale-110 transition-all text-brand-blue/80" />
          </div>
        </button>

        <button 
          onClick={() => setMonthlySummaryDetails('st')}
          className="w-full bg-white hover:bg-slate-50/80 transition-all p-2.5 sm:p-4 rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.01),0_10px_25px_rgba(0,0,0,0.03)] border border-slate-200 text-left cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[96px] sm:min-h-[120px] h-auto select-none border-t-4 border-t-transparent hover:border-t-emerald-500"
        >
          <div className="flex items-start justify-between w-full gap-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[8px] sm:text-[10px] uppercase font-bold tracking-widest text-[#4A4A4A] leading-tight">Sobretiempos</p>
              <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-display font-black text-emerald-600 leading-none tracking-tight mt-1 sm:mt-2.5 whitespace-nowrap">
                +{formatHours(stHours)}
              </p>
            </div>
            <div className="w-7 h-7 sm:w-10 sm:h-10 bg-emerald-50 rounded-lg sm:rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
              <Zap size={14} className="sm:size-[18px]" />
            </div>
          </div>
          <div className="w-full pt-1.5 sm:pt-2 mt-1.5 sm:mt-2 border-t border-slate-100 flex items-center justify-between text-[8px] sm:text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none opacity-0 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0 transition-all duration-300 pointer-events-none">
            <span>Ver detalles</span>
            <Eye size={10} className="sm:size-3 opacity-75 group-hover:scale-110 transition-all text-emerald-600/80" />
          </div>
        </button>

        <button 
          onClick={() => setMonthlySummaryDetails('df')}
          className="w-full bg-white hover:bg-slate-50/80 transition-all p-2.5 sm:p-4 rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.01),0_10px_25px_rgba(0,0,0,0.03)] border border-slate-200 text-left cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[96px] sm:min-h-[120px] h-auto select-none border-t-4 border-t-transparent hover:border-t-amber-500"
        >
          <div className="flex items-start justify-between w-full gap-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[8px] sm:text-[10px] uppercase font-bold tracking-widest text-[#4A4A4A] leading-tight">Déficit ST</p>
              <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-display font-black text-amber-600 leading-none tracking-tight mt-1 sm:mt-2.5 whitespace-nowrap">
                -{formatHours(dfHours)}
              </p>
            </div>
            <div className="w-7 h-7 sm:w-10 sm:h-10 bg-amber-50 rounded-lg sm:rounded-xl flex items-center justify-center text-amber-600 shrink-0">
              <TrendingDown size={14} className="sm:size-[18px]" />
            </div>
          </div>
          <div className="w-full pt-1.5 sm:pt-2 mt-1.5 sm:mt-2 border-t border-slate-100 flex items-center justify-between text-[8px] sm:text-[9px] font-black text-amber-600 uppercase tracking-widest leading-none opacity-0 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0 transition-all duration-300 pointer-events-none">
            <span>Ver detalles</span>
            <Eye size={10} className="sm:size-3 opacity-75 group-hover:scale-110 transition-all text-amber-600/80" />
          </div>
        </button>

        <button 
          onClick={() => setMonthlySummaryDetails('exceso')}
          className="w-full bg-white hover:bg-slate-50/80 transition-all p-2.5 sm:p-4 rounded-2xl shadow-[0_4px_15px_rgba(0,0,0,0.01),0_10px_25px_rgba(0,0,0,0.03)] border border-slate-200 text-left cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[96px] sm:min-h-[120px] h-auto select-none border-t-4 border-t-transparent hover:border-t-brand-red"
        >
          <div className="flex items-start justify-between w-full gap-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[8px] sm:text-[10px] uppercase font-bold tracking-widest text-[#4A4A4A] leading-tight">Jornadas &gt; 10h</p>
              <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-display font-black text-brand-red leading-none tracking-tight mt-1 sm:mt-2.5 break-words flex items-baseline gap-1">
                <span>{excesoPersonasMensual}</span>
                <span className="text-[10px] sm:text-xs font-bold font-sans text-red-500 uppercase tracking-widest">{excesoPersonasMensual === 1 ? 'caso' : 'casos'}</span>
              </p>
            </div>
            <div className="w-7 h-7 sm:w-10 sm:h-10 bg-brand-red/5 rounded-lg sm:rounded-xl flex items-center justify-center text-brand-red shrink-0">
              <AlertOctagon size={14} className="sm:size-[18px]" />
            </div>
          </div>
          <div className="w-full pt-1.5 sm:pt-2 mt-1.5 sm:mt-2 border-t border-slate-100 flex items-center justify-between text-[8px] sm:text-[9px] font-black text-brand-red uppercase tracking-widest leading-none opacity-0 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0 transition-all duration-300 pointer-events-none">
            <span>Ver detalles</span>
            <Eye size={10} className="sm:size-3 opacity-75 group-hover:scale-110 transition-all text-brand-red/80" />
          </div>
        </button>
      </div>

      <div className="flex flex-col gap-6">
        {/* Actions Toolbar - Compact size & horizontal row on mobile (scrollable), elegant grid on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          <button 
            onClick={generateMonthlyExcel}
            className="w-full glass-card p-4 flex items-center gap-4 group hover:border-emerald-500 hover:bg-slate-50/30 transition-all border-l-4 border-l-transparent hover:border-l-emerald-500 text-left cursor-pointer"
          >
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform shrink-0">
              <Table size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block font-display font-bold text-xs sm:text-sm text-slate-800 leading-tight">Planificación Mensual</span>
              <span className="block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 leading-tight">
                {months[selectedMonth].toUpperCase()} {selectedYear}
              </span>
            </div>
          </button>

          <button 
            onClick={generateActualSobretiempoExcel}
            className="w-full glass-card p-4 flex items-center gap-4 group hover:border-teal-500 hover:bg-slate-50/30 transition-all border-l-4 border-l-transparent hover:border-l-teal-500 text-left cursor-pointer"
          >
            <div className="w-11 h-11 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 group-hover:scale-105 transition-transform shrink-0">
              <Download size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block font-display font-bold text-xs sm:text-sm text-slate-800 leading-tight">Sobretiempo de Ley</span>
              <span className="block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 leading-tight">
                {months[selectedMonth].toUpperCase()} {selectedYear}
              </span>
            </div>
          </button>

          <button 
            onClick={generateConsolidatedPDF}
            className="w-full glass-card p-4 flex items-center gap-4 group hover:border-brand-red hover:bg-slate-50/30 transition-all border-l-4 border-l-transparent hover:border-l-brand-red text-left cursor-pointer sm:col-span-2 lg:col-span-1"
          >
            <div className="w-11 h-11 bg-brand-red/5 rounded-xl flex items-center justify-center text-brand-red group-hover:scale-105 transition-transform shrink-0">
              <FileText size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block font-display font-bold text-xs sm:text-sm text-slate-800 leading-tight">Reporte Consolidado</span>
              <span className="block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 leading-tight">
                {months[selectedMonth].toUpperCase()} {selectedYear}
              </span>
            </div>
          </button>
        </div>

        {/* List of Daily Sheets in the month */}
        <div className="w-full bg-[#f1f5f9]/60 border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02),0_15px_40px_rgba(0,0,0,0.04)] rounded-[2rem] flex flex-col overflow-hidden">
          <div className="px-6 py-4.5 border-b border-slate-200 flex items-center justify-between bg-[#f8fafc]">
            <h3 className="font-display font-black text-slate-800 text-sm tracking-tight flex items-center gap-2">
              <History size={18} className="text-brand-blue" />
              Libro de Actividades: {months[selectedMonth]} {selectedYear}
            </h3>
            <span className="text-[10px] font-black text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200 uppercase tracking-widest">
              {filteredActivities.length} {filteredActivities.length === 1 ? 'Entrada Total' : 'Entradas Totales'}
            </span>
          </div>

          <div className="flex-1 p-6 bg-slate-50/50 flex flex-col justify-center items-center">
            {(() => {
              const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
              const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1);
              let startDayIndex = firstDayOfMonth.getDay() - 1; // Mon = 0, Tue = 1, ... Sun = 6
              if (startDayIndex < 0) startDayIndex = 6; // Sunday
              const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

              return (
                <div className="w-full bg-white border border-slate-200 rounded-[2rem] p-6 sm:p-8 shadow-[0_4px_15px_rgba(0,0,0,0.01)]">
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-3 text-center mb-4 w-full">
                    {daysOfWeek.map((dayName, idx) => (
                      <div key={dayName} className={cn(
                        "text-[10px] sm:text-xs font-black uppercase tracking-wider py-1.5",
                        idx >= 5 ? "text-slate-400 font-bold" : "text-slate-500"
                      )}>
                        {dayName}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 sm:gap-3 w-full">
                    {/* Trailing days of previous month */}
                    {Array.from({ length: startDayIndex }).map((_, index) => (
                      <div key={`blank-${index}`} className="w-full aspect-square bg-slate-50/40 border border-slate-100 rounded-2xl opacity-20" />
                    ))}

                    {/* Active days in the calendar */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const d = new Date(selectedYear, selectedMonth, day);
                      const dayActs = activitiesByDay.get(day) || [];
                      const hasActs = dayActs.length > 0;

                      return (
                        <button
                          key={`calendar-day-${day}`}
                          disabled={!hasActs}
                          onClick={() => hasActs && setSelectedDayActivities({ date: d, activities: dayActs })}
                          className={cn(
                            "w-full aspect-square flex flex-col justify-between p-3 rounded-2xl border transition-all text-left group select-none relative focus:outline-none focus:ring-2 focus:ring-brand-blue/30",
                            hasActs 
                              ? "bg-gradient-to-br from-brand-blue to-blue-600 border-brand-blue text-white shadow-md shadow-brand-blue/10 hover:shadow-lg hover:scale-[1.04] active:scale-95 cursor-pointer" 
                              : "bg-slate-100/50 border-slate-200/40 text-slate-300 opacity-40 hover:bg-slate-100/70"
                          )}
                        >
                          <span className="text-[11px] sm:text-sm font-sans font-black leading-none">{day}</span>
                          
                          {hasActs && (
                            <div className="flex items-center justify-between w-full mt-auto">
                              <span className="text-[9px] font-sans font-extrabold capitalize text-blue-100/80 hidden md:inline shrink-0">
                                {format(d, 'eee', { locale: es }).substring(0, 3)}
                              </span>
                              <span className="w-4.5 h-4.5 sm:w-5 bg-white text-brand-blue font-sans font-black text-[9px] sm:text-xs rounded-full flex items-center justify-center shadow-sm ml-auto shrink-0 leading-none">
                                {dayActs.length}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {filteredActivities.length === 0 && (
                    <div className="mt-8 text-center py-10">
                      <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-3 border border-slate-100 shadow-inner">
                        <Archive size={24} />
                      </div>
                      <h4 className="font-display font-black text-slate-400 tracking-tight text-sm">Sin Actividades</h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">No hay reportes inteligentes para este periodo</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Day Details Modal */}
      {selectedDayActivities && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedDayActivities(null)} />
          <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[85vh] xl:max-h-[80vh] overflow-hidden flex flex-col relative shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                  <span className="font-display font-black text-brand-blue text-lg">{format(selectedDayActivities.date, 'dd')}</span>
                </div>
                <div>
                  <h3 className="font-display font-black text-slate-900 tracking-tight text-lg capitalize">
                    {formatDateSpanish(selectedDayActivities.date, "eeee, dd 'de' MMMM")}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-brand-blue/10 text-brand-blue font-black uppercase tracking-widest text-[9px] px-2 py-0.5 rounded-full">
                      {selectedDayActivities.activities.length} Actividades registradas
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDayActivities(null)}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* List */}
            <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50/30 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedDayActivities.activities.map((activity) => (
                  <div key={activity.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-2 h-full bg-brand-blue/10 group-hover:bg-brand-blue transition-colors" />
                    
                    <div className="flex items-start justify-between mb-3">
                      <div className="space-y-1">
                        <span className="font-mono text-[10px] font-black text-brand-blue bg-brand-blue/5 px-2 py-1 rounded">
                          {activity.incidentNumber || 'S/N'}
                        </span>
                        <h4 className="font-bold text-slate-900 leading-tight pr-6">
                          {!activity.title || activity.title.trim().toLowerCase() === 's' 
                            ? 'Mantenimiento Preventivo de Enlace' 
                            : activity.title}
                        </h4>
                      </div>
                    </div>
                    
                    <DescripcionExpandible texto={activity.description || ''} />
                    
                    <div className="space-y-4 text-xs">
                      <div className="flex items-start gap-2">
                        <Clock size={14} className="text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-700">{(activity.startTimeMorning || activity.startTime) || '--:--'} a {(activity.endTimeAfternoon || activity.endTime) || '--:--'}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Horario</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 mt-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Técnicos Participantes</p>
                        <div className="flex flex-wrap gap-1">
                          {activity.participants?.map((p, pIdx) => (
                            <span key={`${activity.id}-p-${pIdx}`} className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md italic">
                              {p.split(' ')[0]}
                            </span>
                          ))}
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
      {monthlySummaryDetails === 'exceso' && (
        <LottAlertsModal 
          isOpen={true}
          onClose={() => setMonthlySummaryDetails(null)}
          activities={filteredActivities}
          technicians={technicians}
        />
      )}

      {monthlySummaryDetails && monthlySummaryDetails !== 'exceso' && (() => {
        const modalContentMap = {
          total: {
            title: 'Horas Totales (Mensual)',
            icon: Clock,
            color: 'text-brand-blue',
            bg: 'bg-brand-blue/5',
            desc: 'Suma de horas productivas y ordinarias'
          },
          st: {
            title: 'Sobretiempos (Mensual)',
            icon: Zap,
            color: 'text-emerald-500',
            bg: 'bg-emerald-50',
            desc: 'Horas acumuladas por encima de las 8h ordinarias'
          },
          df: {
            title: 'Déficits de Horas (Mensual)',
            icon: TrendingDown,
            color: 'text-amber-500',
            bg: 'bg-amber-50',
            desc: 'Registros por debajo de las 8h ordinarias'
          },
          exceso: {
            title: 'Jornadas > 10h (Mensual)',
            icon: AlertOctagon,
            color: 'text-brand-red',
            bg: 'bg-brand-red/5',
            desc: 'Casos con exceso crítico diario (límite LOTTT)'
          }
        };

        const modalInfo = modalContentMap[monthlySummaryDetails];
        const ModalIcon = modalInfo.icon;

        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMonthlySummaryDetails(null)}></div>
            <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
              {/* Dynamic Header exactly mirroring the Dashboard's SummaryModal */}
              <div className="p-5 sm:p-6 pb-4 sm:pb-5 border-b border-slate-100 shrink-0 bg-slate-50/50">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-3 rounded-2xl", modalInfo.bg, modalInfo.color)}>
                      <ModalIcon size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-display font-black text-slate-900 leading-tight">
                        {modalInfo.title}
                        {false && (
                          <span className="ml-2 text-xs font-bold font-sans bg-rose-50 border border-rose-100 text-rose-600 px-2.5 py-0.5 rounded-full inline-block align-middle">
                            {excesoPersonasMensual} {excesoPersonasMensual === 1 ? 'caso' : 'casos'}
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">{modalInfo.desc}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setMonthlySummaryDetails(null)}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* List body exactly mirroring the Dashboard's list item styles */}
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-2">
                {false ? (
                  (() => {
                    const infractionsByWeek: Record<string, Record<string, {
                      weeklyOvertime: number;
                      dailyExcesses: { total: number; date: Date; titles: string[] }[];
                      _dailyHours: Record<string, { minStart: number, maxEnd: number, hasPause: boolean, titles: string[], date: Date }>;
                    }>> = {};

                    filteredActivities.forEach(a => {
                      const dateObj = safeGetActivityDate(a);
                      const start = startOfWeek(dateObj, { weekStartsOn: 1 });
                      const end = endOfWeek(dateObj, { weekStartsOn: 1 });
                      const weekKey = `${format(start, 'dd/MM')} al ${format(end, 'dd/MM/yyyy')}`;
                      const dateKey = dateObj.toISOString().split('T')[0];

                      const { minStart, maxEnd } = getActivityBounds(a);

                      const parts = a.participants && a.participants.length > 0 ? a.participants : (a.technicianName ? [a.technicianName] : []);
                      parts.forEach(p => {
                        const name = p.trim().toLowerCase();
                        
                        if (!infractionsByWeek[weekKey]) infractionsByWeek[weekKey] = {};
                        if (!infractionsByWeek[weekKey][name]) {
                          infractionsByWeek[weekKey][name] = { weeklyOvertime: 0, dailyExcesses: [], _dailyHours: {} } as any;
                        }
                        
                        const techData = infractionsByWeek[weekKey][name] as any;

                        if (!techData._dailyHours[dateKey]) {
                          techData._dailyHours[dateKey] = { minStart: Infinity, maxEnd: -Infinity, hasPause: false, titles: [], date: dateObj };
                        }
                        
                        if (a.hasPause === 'SI') {
                          techData._dailyHours[dateKey].hasPause = true;
                        }

                        if (minStart !== Infinity) {
                          techData._dailyHours[dateKey].minStart = Math.min(techData._dailyHours[dateKey].minStart, minStart);
                        }

                        if (maxEnd !== -Infinity) {
                          techData._dailyHours[dateKey].maxEnd = Math.max(techData._dailyHours[dateKey].maxEnd, maxEnd);
                        }

                        if (!techData._dailyHours[dateKey].titles.includes(a.title)) {
                          techData._dailyHours[dateKey].titles.push(a.title);
                        }
                      });
                    });

                    const elements: React.ReactNode[] = [];
                    const sortedWeekKeys = Object.keys(infractionsByWeek).sort((a, b) => {
                      const getStartYearMonthDay = (key: string) => {
                        // key format "10/04 al 16/04/2026"
                        const match = key.match(/(\d{2})\/(\d{2}).*al.*\/(\d{4})/);
                        if (!match) return "0";
                        // match[3] = year, match[2] = month, match[1] = day
                        return `${match[3]}${match[2]}${match[1]}`;
                      };
                      return getStartYearMonthDay(b).localeCompare(getStartYearMonthDay(a));
                    });

                    sortedWeekKeys.forEach(weekKey => {
                      const techsInWeek = infractionsByWeek[weekKey];
                      const techCards: React.ReactNode[] = [];

                      Object.keys(techsInWeek).sort().forEach(techKey => {
                        const tInfo = techsInWeek[techKey] as any;
                        
                        // First compute daily real hours from boundaries
                        Object.values(tInfo._dailyHours).forEach((d: any) => {
                           let totalRealHours = calculateRealHours(d.minStart, d.maxEnd, d.hasPause);
                           d.total = totalRealHours; // Store real total
                           if (totalRealHours > 0) {
                              const dayOvertime = Math.max(0, totalRealHours - 8);
                              if (dayOvertime > 0) tInfo.weeklyOvertime += dayOvertime;
                           }
                        });

                        const dailyArr = Object.values(tInfo._dailyHours).filter((d: any) => d.total > 10.0);
                        
                        if (tInfo.weeklyOvertime > 10.0 || dailyArr.length > 0) {
                          techCards.push(
                            <div key={`${weekKey}-${techKey}`} className="mb-3 rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                              <div className="bg-slate-50/80 p-3.5 flex justify-between items-center border-b border-slate-200">
                                <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{capitalizeSentence(techKey)}</span>
                                {tInfo.weeklyOvertime > 10.0 ? (
                                  <div className="text-[10px] font-black font-mono px-2 py-0.5 rounded text-brand-red bg-brand-red/10 border border-brand-red/20 uppercase">
                                    EXCESO SEMANAL: {formatHours(tInfo.weeklyOvertime).toUpperCase()} EXTRAS
                                  </div>
                                ) : (
                                  <div className="text-[10px] font-bold font-mono px-2 py-0.5 rounded text-amber-700 bg-amber-50 border border-amber-200 uppercase">
                                    ST SEMANAL: {formatHours(tInfo.weeklyOvertime).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              {dailyArr.length > 0 && (
                                <div className="p-3 space-y-2 bg-white">
                                  {dailyArr.sort((a: any, b: any) => b.date.getTime() - a.date.getTime()).map((d: any, idx: number) => (
                                    <ReportDailyExcessRow key={`daily-${idx}`} d={d} />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }
                      });

                      if (techCards.length > 0) {
                        elements.push(
                          <div key={weekKey} className="mb-6 last:mb-0">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <span>CICLO DE NÓMINA</span>
                              <div className="flex-1 h-px bg-slate-200"></div>
                              <span className="bg-slate-100/80 text-slate-500 px-2.5 py-0.5 rounded border border-slate-200/60 font-bold">
                                {weekKey}
                              </span>
                            </h4>
                            <div className="pl-1">
                              {techCards}
                            </div>
                          </div>
                        );
                      }
                    });

                    if (elements.length === 0) {
                      return (
                        <div className="py-12 text-center text-sm font-bold text-slate-400">
                          No hay jornadas con exceso registradas
                        </div>
                      );
                    }

                    return <div className="space-y-4 pb-2">{elements}</div>;
                  })()
                ) : (() => {
                  const items = filteredActivities.filter(a => {
                    if (monthlySummaryDetails === 'total') return true;
                    if (monthlySummaryDetails === 'st') return (a.overtimeHours || 0) > 0;
                    if (monthlySummaryDetails === 'df') return (a.overtimeHours || 0) < 0;
                    return false;
                  });

                  if (items.length === 0) {
                    return (
                      <div className="py-12 text-center text-sm font-bold text-slate-400">
                        No hay registros para mostrar
                      </div>
                    );
                  }

                  return items.map((activity, idx) => {
                    let value = 0;
                    if (monthlySummaryDetails === 'total') value = activity.totalHours || ((activity.overtimeHours || 0) + 8);
                    if (monthlySummaryDetails === 'st') value = activity.overtimeHours || 0;
                    if (monthlySummaryDetails === 'df') value = Math.abs(activity.overtimeHours || 0);

                    const isSt = monthlySummaryDetails === 'st';
                    const isDf = monthlySummaryDetails === 'df';
                    const actTitle = !activity.title || activity.title.trim().toLowerCase() === 's' ? 'Mantenimiento Preventivo de Enlace' : activity.title;

                    return (
                      <div key={`monthly-summary-row-${idx}`} className="flex justify-between items-center p-3.5 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all hover:bg-slate-50 group webkit-tap-highlight-transparent">
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="text-xs font-bold text-slate-800 whitespace-normal group-hover:text-slate-900 leading-snug">
                            {capitalizeSentence(actTitle)}
                          </p>
                          <div className="flex flex-col gap-1 mt-1">
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold text-slate-400">
                              <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase shrink-0 leading-none flex items-center gap-1">
                                📅 {formatDateSpanish(safeGetActivityDate(activity), 'dd MMM')}
                              </span>
                              <span className="whitespace-normal">
                                👤 {activity.participants && activity.participants.length > 0 ? activity.participants.map(p => capitalizeSentence(p.split(' ')[0])).join(', ') : capitalizeSentence(activity.technicianName)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className={cn(
                          "text-xs font-black font-mono shrink-0 px-2.5 py-1 rounded-lg border whitespace-nowrap shadow-sm",
                          isSt ? "text-emerald-600 bg-emerald-50 border-emerald-100" :
                          isDf ? "text-amber-600 bg-amber-50 border-amber-100" :
                          "text-brand-blue bg-brand-blue/5 border-brand-blue/10"
                        )}>
                          {isSt ? '+' : ''}{formatHours(value)}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Action and Close Footer exactly mirroring the Dashboard's SummaryModal */}
              <div className="p-5 sm:p-6 pt-4 sm:pt-5 border-t border-slate-100 flex flex-col gap-2 shrink-0 bg-slate-50/50">
                <button 
                  onClick={() => setMonthlySummaryDetails(null)}
                  className="w-full py-3.5 bg-slate-950 text-white rounded-2xl font-bold text-xs hover:bg-slate-800 transition-all shadow-lg active:scale-95 cursor-pointer text-center"
                >
                  Cerrar Resumen
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
