import React from 'react';
import { Download, FileText, Table, Users, Filter, Calendar, ChevronRight, Archive, History, X, Clock, MapPin, Wrench } from 'lucide-react';
import { Activity, Technician } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, getYear, getMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../lib/utils';

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

  const generateSobretiempoExcel = () => {
    // 1. Prepare Data for "Registro de Labores y Horarios" Mega-Sheet
    const transmissionTechs = technicians.filter(t => t.status === 'activo' && t.specialty.toLowerCase().includes('transmisión'));
    const datosTechs = technicians.filter(t => t.status === 'activo' && t.specialty.toLowerCase().includes('datos'));
    const otherTechs = technicians.filter(t => t.status === 'activo' && !transmissionTechs.includes(t) && !datosTechs.includes(t));
    
    const allActiveTechs = [...transmissionTechs, ...datosTechs, ...otherTechs];
    
    // Header Row 1: Departments (to be merged) and empty space for the rest
    const headerRow1 = ['FECHA', 'FLOTA', 'INCIDENTE'];
    transmissionTechs.forEach((_, i) => headerRow1.push(i === 0 ? 'TRANSMISION' : ''));
    datosTechs.forEach((_, i) => headerRow1.push(i === 0 ? 'DATOS' : ''));
    otherTechs.forEach((_, i) => headerRow1.push(i === 0 ? 'OTROS' : ''));
    
    // Add empty headers for the extended tracking section
    headerRow1.push('', '', '', '', '', '', '', '');

    // Header Row 2: Tech Names & Extended Columns
    const headerRow2 = [
      'FECHA', 'FLOTA', 'INCIDENTE', 
      ...allActiveTechs.map(t => t.name.split(' ')[0].toUpperCase()),
      'DOCUMENTACION', 'SOBRETIEMPO', 'Hora Entrada Mañana', 'Hora Salida Mañana', 'Pausa', 'Hora Entrada Tarde', 'Hora Salida Tarde', 'JUSTIFIQUE'
    ];

    // Rows
    const registroData: any[][] = [];
    
    filteredActivities.forEach(a => {
      // Instead of duplicating rows for every participant, the mega sheet seems to list one activity per row, 
      // checkmarks the technicians, and tracks the times for that activity block.
      // If we put checkmarks for multiple techs in one row, we can only really list the "Hora" once for that activity.
      // Based on the PDF structure, it's one row per activity.
      const row = [
        format(a.date.toDate(), 'dd-MM-yy'),
        a.fleet || '',
        a.incidentNumber || 'S/N'
      ];
      
      // Participant checkmarks
      allActiveTechs.forEach(tech => {
        row.push(a.participants?.includes(tech.name) ? 'x' : '');
      });
      
      // Extended tracking columns
      row.push(
        a.incidentNumber ? a.incidentNumber : 'S/N', // DOCUMENTACION
        (a.overtimeHours || 0) > 0 ? 'SI' : 'no', // SOBRETIEMPO
        '', // We leave standard blank or parse real startTime if they wanted system info instead of hardcoded 7:30
        '', // Hora Salida Mañana
        '', // Pausa
        '', // Hora Entrada Tarde
        a.endTime || '', // Hora Salida Tarde
        a.title // JUSTIFIQUE
      );
      
      // If they really want system info instead of hardcoded 11:45, we leave them blank to be filled, 
      // or we put the startTime in Entrada Mañana, and endTime in Salida Tarde.
      if (a.startTime) {
        row[row.length - 6] = a.startTime; // Hora Entrada Mañana
      }
      
      registroData.push(row);
    });

    const wb = XLSX.utils.book_new();
    
    // Create Worksheet 1 with complex headers
    const ws1 = XLSX.utils.aoa_to_sheet([headerRow1, headerRow2, ...registroData]);
    
    // Define Merges for Worksheet 1
    const merges1: XLSX.Range[] = [];
    if (transmissionTechs.length > 1) {
      merges1.push({ s: { r: 0, c: 3 }, e: { r: 0, c: 3 + transmissionTechs.length - 1 } });
    }
    if (datosTechs.length > 1) {
      merges1.push({ s: { r: 0, c: 3 + transmissionTechs.length }, e: { r: 0, c: 3 + transmissionTechs.length + datosTechs.length - 1 } });
    }
    // Merge FECHA, FLOTA, INCIDENTE vertically
    [0, 1, 2].forEach(col => {
      merges1.push({ s: { r: 0, c: col }, e: { r: 1, c: col } });
    });
    ws1['!merges'] = merges1;
    XLSX.utils.book_append_sheet(wb, ws1, "Registro de Labores");

    // 2. Prepare Data for "Viáticos y Manejo" (The separate sheet from PDF 10)
    const viaticosRows = [['PERSONAL', 'HORAS', 'MANEJO', 'VIATICOS', 'DEPARTAMENTO']];
    const techStats: Record<string, any> = {};
    filteredActivities.forEach(a => {
      a.participants?.forEach(p => {
        if (!techStats[p]) techStats[p] = { horas: 0, manejo: 'no', viaticos: 'no', depto: a.type };
        techStats[p].horas += (a.overtimeHours || 0);
        if (a.fleet) techStats[p].manejo = 'SI';
        if (a.hasPerDiem) techStats[p].viaticos = 'SI';
      });
    });

    Object.entries(techStats).forEach(([name, stats]) => {
      viaticosRows.push([
        name.toUpperCase(),
        stats.horas.toFixed(1),
        stats.manejo,
        stats.viaticos,
        stats.depto.toUpperCase()
      ]);
    });
    
    const ws2 = XLSX.utils.aoa_to_sheet(viaticosRows);
    XLSX.utils.book_append_sheet(wb, ws2, "Viáticos y Manejo");

    XLSX.writeFile(wb, `SOBRETIEMPO_${months[selectedMonth].toUpperCase()}_${selectedYear}_TX_DX.xlsx`);
  };

  const generateConsolidatedPDF = () => {
    if (filteredActivities.length === 0) return;
    
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
    const totalOT = filteredActivities.reduce((acc, a) => acc + (a.overtimeHours || 0), 0);
    docPdf.text(`Horas Extra Totales: ${totalOT.toFixed(1)}h`, 14, 56);

    // Table Data
    const tableData = filteredActivities.map(a => [
      format(a.date.toDate(), 'dd/MM'),
      a.incidentNumber || 'S/N',
      a.title,
      a.participants?.join(', ').split(' ').filter((_, i) => i % 2 === 0).join(', ') || '-',
      a.overtimeHours ? `${a.overtimeHours}h` : '-',
      a.hasPerDiem ? 'SÍ' : 'NO'
    ]);

    autoTable(docPdf, {
      startY: 65,
      head: [['FECHA', 'INCIDENTE', 'LABOR REALIZADA', 'TÉCNICOS', 'ST', 'VIÁT.']],
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
  };

  const generateMonthlyExcel = () => {
    generateSobretiempoExcel();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-card p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-brand-blue rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-blue/30">
            <Archive size={28} />
          </div>
          <div>
            <h2 className="text-xl font-display font-black text-slate-900 tracking-tight">Historial de Reportes Inteligentes</h2>
            <p className="text-xs text-slate-500 font-medium">Gestión administrativa por Mes y Año · CANTV</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-200">
          <select 
            className="bg-transparent border-none text-xs font-black uppercase tracking-widest text-slate-600 focus:ring-0 cursor-pointer px-4 py-2"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          >
            {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <div className="w-px h-4 bg-slate-200" />
          <select 
            className="bg-transparent border-none text-xs font-black uppercase tracking-widest text-slate-600 focus:ring-0 cursor-pointer px-4 py-2"
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
                
                const dayActs = filteredActivities.filter(a => a.date.toDate().getDate() === day);
                
                return (
                  <div 
                    key={day} 
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
                                {(activity.overtimeHours || 0) > 0 ? '+' : ''}{(activity.overtimeHours || 0).toFixed(2)}h
                              </span>
                            )}
                            {activity.hasPerDiem && (
                              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                ${activity.perDiemAmount}
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
