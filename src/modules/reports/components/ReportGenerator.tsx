import React from 'react';
import { Download, FileText, Table, Users, Filter, Calendar, ChevronRight, Archive, History, X, Clock, MapPin, Wrench } from 'lucide-react';
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
  
  // State for the modal
  const [selectedDayActivities, setSelectedDayActivities] = React.useState<{ date: Date, activities: Activity[] } | null>(null);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const filteredActivities = activities.filter(a => {
    const date = a.date.toDate();
    return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth;
  });

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
        { header: 'DEFICIT', key: 'deficit', width: 15 },
        { header: 'Hora Entrada Mañana', key: 'he_m', width: 18 },
        { header: 'Hora Salida Mañana', key: 'hs_m', width: 18 },
        { header: 'Pausa', key: 'pausa', width: 10 },
        { header: 'Hora Entrada Tarde', key: 'he_t', width: 18 },
        { header: 'Hora Salida Tarde', key: 'hs_t', width: 18 },
        { header: 'JUSTIFIQUE', key: 'justifique', width: 45 },
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
          justifique: a.justification || ((a.overtimeHours || 0) === 0 ? 'Sin desviación de horario.' : 'No justificado.'),
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
      const fileName = `SOBRETIEMPO_${months[selectedMonth].toUpperCase()}_${selectedYear}_TX_DX.xlsx`;
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-4 sm:p-6 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.02),0_15px_35px_rgba(0,0,0,0.06)] border border-slate-200">
        <div className="flex items-center gap-4 w-full">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-brand-blue rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-blue/30 shrink-0">
            <Archive size={28} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-display font-black text-slate-900 tracking-tight truncate">Historial de Reportes</h2>
            <p className="text-xs text-slate-500 font-medium truncate">Gestión administrativa · CANTV</p>
          </div>
        </div>

        <div className="flex items-center bg-slate-50 p-1 rounded-2xl border border-slate-200 shrink-0 ml-auto">
          <select 
            className="bg-transparent border-none text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-600 focus:ring-0 cursor-pointer px-3 sm:px-4 py-2 text-center min-w-[100px] sm:min-w-[120px]"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          >
            {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <div className="w-px h-4 bg-slate-200" />
          <select 
            className="bg-transparent border-none text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-600 focus:ring-0 cursor-pointer px-3 sm:px-4 py-2 text-center min-w-[80px]"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actions Sidebar */}
        <div className="space-y-4">
          <button 
            onClick={generateMonthlyExcel}
            className="w-full glass-card p-6 flex flex-col items-center gap-4 group hover:border-emerald-500 transition-all border-b-4 border-b-transparent hover:border-b-emerald-500"
          >
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform shadow-inner shadow-emerald-600/5">
              <Table size={32} />
            </div>
            <div className="text-center">
              <span className="block font-display font-black text-slate-900">Institucional: Sobretiempo Excel</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                Formato TX y DX (TX/DX)<br/>({months[selectedMonth]} {selectedYear})
              </span>
            </div>
          </button>

          <button 
            onClick={generateConsolidatedPDF}
            className="w-full glass-card p-6 flex flex-col items-center gap-4 group hover:border-brand-red transition-all border-b-4 border-b-transparent hover:border-b-brand-red"
          >
            <div className="w-16 h-16 bg-brand-red/5 rounded-2xl flex items-center justify-center text-brand-red group-hover:scale-110 transition-transform shadow-inner shadow-brand-red/5">
              <FileText size={32} />
            </div>
            <div className="text-center">
              <span className="block font-display font-black text-slate-900">Reporte Consolidado PDF</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Formato Institucional<br/>({months[selectedMonth]} {selectedYear})
              </span>
            </div>
          </button>
        </div>

        {/* List of Daily Sheets in the month */}
        <div className="lg:col-span-2 glass-card flex flex-col h-[500px]">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-display font-black text-slate-800 text-sm tracking-tight flex items-center gap-2">
              <History size={18} className="text-brand-blue" />
              Libro de Actividades: {months[selectedMonth]} {selectedYear}
            </h3>
            <span className="text-[10px] font-black text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100 uppercase tracking-widest">
              {filteredActivities.length} Entradas Totales
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* This conceptually shows "Day Sheets" */}
              {Array.from({ length: 31 }).map((_, i) => {
                const day = i + 1;
                const d = new Date(selectedYear, selectedMonth, day);
                if (d.getMonth() !== selectedMonth) return null;
                
                const dayActs = filteredActivities.filter(a => {
                  const aDate = a.date.toDate();
                  return aDate.getDate() === day;
                });
                
                return (
                  <div 
                    key={`report-day-${selectedYear}-${selectedMonth}-${day}`} 
                    onClick={() => dayActs.length > 0 && setSelectedDayActivities({ date: d, activities: dayActs })}
                    className={cn(
                    "p-4 rounded-2xl border transition-all flex items-center justify-between group",
                    dayActs.length > 0 
                      ? "bg-white border-slate-100 hover:border-brand-blue shadow-sm hover:shadow-md cursor-pointer" 
                      : "bg-slate-50 border-transparent opacity-40 select-none"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-display font-black",
                        dayActs.length > 0 ? "bg-brand-blue text-white" : "bg-slate-200 text-slate-400"
                      )}>
                        {day}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-700 capitalize">
                          {format(d, 'eeee', { locale: es })}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {dayActs.length} registros
                        </p>
                      </div>
                    </div>
                    {dayActs.length > 0 && <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-blue" />}
                  </div>
                );
              })}
            </div>
            {filteredActivities.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4 border border-slate-100">
                  <Archive size={32} />
                </div>
                <h4 className="font-display font-black text-slate-300 tracking-tight">Archivo Vacío</h4>
                <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">No hay reportes inteligentes para este periodo</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Day Details Modal */}
      {selectedDayActivities && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                    {format(selectedDayActivities.date, "eeee, dd 'de' MMMM", { locale: es })}
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
                        <h4 className="font-bold text-slate-900 leading-tight pr-6">{activity.title}</h4>
                      </div>
                    </div>
                    
                    <p className="text-xs text-slate-500 line-clamp-2 mb-4 pr-4">{activity.description}</p>
                    
                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
                      <div className="flex items-start gap-2">
                        <Clock size={14} className="text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-700">{activity.startTime || '--:--'} a {activity.endTime || '--:--'}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Horario</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <Wrench size={14} className="text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-700 capitalize">{activity.type}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tipo</p>
                        </div>
                      </div>

                      <div className="col-span-2 pt-3 border-t border-slate-100 mt-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-1">
                            {activity.participants?.map((p, pIdx) => (
                              <span key={`${activity.id}-p-${pIdx}`} className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md italic">
                                {p.split(' ')[0]}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            {(activity.overtimeHours || 0) !== 0 && (
                              <span className={cn(
                                "text-[10px] font-black px-2 py-0.5 rounded border border-transparent",
                                (activity.overtimeHours || 0) > 0 
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                                  : "bg-red-50 text-red-600 border-red-100"
                              )}>
                                {(activity.overtimeHours || 0) > 0 ? '+' : ''}{formatHours(activity.overtimeHours || 0)}
                              </span>
                            )}
                            {activity.hasPerDiem && (
                              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                Bs.{activity.perDiemAmount}
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
    </div>
  );
}
