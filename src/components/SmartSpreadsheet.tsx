import React from 'react';
import { Download, Table, Calendar, ChevronLeft, ChevronRight, FileText, Plus, Database, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { Activity, Technician } from '../types';
import { cn } from '../lib/utils';
import { format, startOfDay, endOfDay, isSameDay, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface SmartSpreadsheetProps {
  activities: Activity[];
  technicians: Technician[];
  onAddActivity?: () => void;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onEdit?: (activity: Activity) => void;
  onDelete?: (id: string, title: string) => void;
}

export default function SmartSpreadsheet({ activities, technicians, onAddActivity, selectedDate, onDateChange, onEdit, onDelete }: SmartSpreadsheetProps) {
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
    const activityDate = a.date.toDate();
    const isToday = isSameDay(activityDate, selectedDate);
    const matchesSearch = searchTerm === '' || 
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.incidentNumber && a.incidentNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      a.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.technicianName && a.technicianName.toLowerCase().includes(searchTerm.toLowerCase()));
    
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

  const handleSort = (key: any) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: any }) => {
    if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="opacity-20 group-hover:opacity-50 transition-opacity" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={12} className="text-brand-blue" /> 
      : <ArrowDown size={12} className="text-brand-blue" />;
  };

  const exportDayToExcel = () => {
    // Array to hold the final rows
    const data: any[] = [];
    
    sortedActivities.forEach(a => {
      const parts = a.participants && a.participants.length > 0 ? a.participants : (a.technicianName ? [a.technicianName] : []);
      
      parts.forEach(p => {
        // Find technician info in system
        const techMatch = technicians.find(t => t.name.toLowerCase() === p.toLowerCase());
        
        data.push({
          'AREA': techMatch ? techMatch.specialty.toUpperCase() : a.type.toUpperCase(),
          'P00': techMatch ? techMatch.employeeId : 'S/N',
          'Nombres y Apellidos': p.toUpperCase(),
          'Cedula': techMatch ? techMatch.employeeId : 'S/N',
          'Región': 'Central',
          'Fecha': format(a.date.toDate(), 'M/d/yyyy'),
          'Codigo': 'PRIM',
          'Causa': 'Horas Product. Con Manejo', // Defaulting since this is an administrative column, can be edited manually
          'Hora Entrada Mañana': '7:30', 
          'Hora Salida Mañana': '11:45',
          'Pausa': 'NO', 
          'Hora Entrada Tarde': '12:45',
          'Hora Salida Tarde': a.endTime || '16:00', // Real end time from system
          'JUSTIFIQUE': `${a.incidentNumber ? a.incidentNumber + ' ' : ''}${a.title}`.trim() // Real activity info from system
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, format(selectedDate, 'dd-MM-yyyy'));
    XLSX.writeFile(wb, `Registro_Diario_CANTV_${format(selectedDate, 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Excel Header Control */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 glass-card p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
            <Table size={28} />
          </div>
          <div>
            <h2 className="text-xl font-display font-black text-slate-900 tracking-tight">Registro Diario Inteligente</h2>
            <p className="text-xs text-slate-500 font-medium">Formato Microsoft Excel - Central 4357</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Date Selector */}
          <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-200 shadow-sm relative group/date">
            <button 
              onClick={() => onDateChange(subDays(selectedDate, 1))}
              className="p-2 hover:bg-white hover:text-brand-blue rounded-xl transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            
            <div className="px-4 flex items-center gap-2 min-w-[200px] justify-center cursor-pointer relative">
              <Calendar size={14} className="text-brand-blue" />
              <span className="text-sm font-black text-slate-700 capitalize flex items-center gap-1.5">
                {isSameDay(selectedDate, today) && (
                  <span className="px-1.5 py-0.5 bg-brand-blue text-white text-[8px] rounded uppercase tracking-wider">Hoy</span>
                )}
                {format(selectedDate, "eeee dd 'de' MMMM", { locale: es })}
              </span>
              <input 
                type="date"
                className="absolute inset-0 opacity-0 cursor-pointer"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => {
                  const date = new Date(e.target.value + 'T00:00:00');
                  if (!isNaN(date.getTime())) onDateChange(date);
                }}
                max={format(today, 'yyyy-MM-dd')}
              />
            </div>

            <button 
              onClick={() => onDateChange(addDays(selectedDate, 1))}
              disabled={isFuture}
              className={cn(
                "p-2 rounded-xl transition-all",
                isFuture ? "text-slate-300 cursor-not-allowed" : "hover:bg-white hover:text-brand-blue"
              )}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Local Search Input */}
          <div className="relative group/search w-full xl:w-64">
            <input 
              type="text"
              placeholder="Buscar en esta fecha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={14} />
            </div>
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <Plus size={14} className="rotate-45" />
              </button>
            )}
          </div>

          <div className="flex gap-2 ml-auto">
            {onAddActivity && (
              <button 
                onClick={onAddActivity}
                className="px-6 py-2.5 bg-brand-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:bg-brand-blue-dark active:scale-[0.98] transition-all flex items-center gap-2"
              >
                <Plus size={16} />
                <span>Nueva Entrada</span>
              </button>
            )}
            <button 
              onClick={exportDayToExcel}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <Download size={16} />
              <span>Microsoft Excel</span>
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
          <table className="w-full text-left border-collapse border-slate-200">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-200">
                <th className="px-4 py-4 w-12 text-center text-[10px] font-black text-slate-400 bg-slate-100 uppercase tracking-widest">#</th>
                <th 
                  onClick={() => handleSort('incidentNumber')}
                  className="px-6 py-4 border-r border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    Incidente <SortIcon columnKey="incidentNumber" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('title')}
                  className="px-6 py-4 border-r border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    Actividad / Labor Realizada <SortIcon columnKey="title" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('participantsCount')}
                  className="px-6 py-4 border-r border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    Técnicos <SortIcon columnKey="participantsCount" />
                  </div>
                </th>
                <th className="px-6 py-4 border-r border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center min-w-[200px]">
                  Horario (Ejecución y ST)
                </th>
                <th 
                  onClick={() => handleSort('perDiem')}
                  className="px-6 py-4 border-r border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                >
                  <div className="flex items-center justify-center gap-2">
                    Viático <SortIcon columnKey="perDiem" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('fleet')}
                  className="px-6 py-4 border-r border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center cursor-pointer hover:bg-slate-100 transition-colors group"
                >
                  <div className="flex items-center justify-center gap-2">
                    Flota <SortIcon columnKey="fleet" />
                  </div>
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sortedActivities.length > 0 ? (
                sortedActivities.map((activity, index) => (
                  <tr key={activity.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-4 py-4 text-center text-slate-400 font-mono text-[10px] bg-slate-50/50">{index + 1}</td>
                    <td className="px-6 py-4 border-r border-slate-50">
                      <span className="font-mono text-[10px] font-black text-brand-blue bg-brand-blue/5 px-2 py-1 rounded">
                        {activity.incidentNumber || 'S/N'}
                      </span>
                    </td>
                    <td className="px-6 py-4 border-r border-slate-50">
                      <p className="text-sm font-bold text-slate-900 mb-0.5">{activity.title}</p>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{activity.description}</p>
                    </td>
                    <td className="px-6 py-4 border-r border-slate-50">
                      <div className="flex flex-wrap gap-1">
                        {activity.participants?.map((p, pIdx) => (
                          <span key={`${activity.id}-p-${pIdx}`} className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded italic">
                            {p.split(' ')[0]}
                          </span>
                        )) || <span className="text-[10px] text-slate-300">N/A</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 border-r border-slate-50">
                      <div className="flex items-center justify-center gap-4">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Entrada</span>
                          <span className="text-sm font-mono font-black text-slate-700">{activity.startTime || '--:--'}</span>
                        </div>
                        <div className="h-6 w-px bg-slate-200"></div>
                        <div className="flex flex-col items-start">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Salida</span>
                          <span className="text-sm font-mono font-black text-slate-700">{activity.endTime || '--:--'}</span>
                        </div>
                        
                        {(activity.overtimeHours || 0) !== 0 && (
                          <div className={cn("ml-2 pl-3 border-l-2 flex flex-col items-center", (activity.overtimeHours || 0) > 0 ? "border-emerald-100" : "border-red-100")}>
                            <span className={cn("text-[9px] font-bold uppercase tracking-wider leading-none mb-1", (activity.overtimeHours || 0) > 0 ? "text-emerald-500" : "text-red-500")}>
                              {(activity.overtimeHours || 0) > 0 ? "Sobretiempo" : "Déficit"}
                            </span>
                            <span className={cn(
                              "text-[11px] font-black px-2 py-0.5 rounded-full border shadow-sm leading-none",
                              (activity.overtimeHours || 0) > 0 
                                ? "text-emerald-600 bg-emerald-50 border-emerald-100" 
                                : "text-red-600 bg-red-50 border-red-100"
                            )}>
                              {(activity.overtimeHours || 0) > 0 ? '+' : ''}{(activity.overtimeHours || 0).toFixed(2)}h
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 border-r border-slate-50 text-center">
                      {activity.hasPerDiem ? (
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">SÍ</span>
                          <span className="text-[9px] text-slate-400 font-bold">${activity.perDiemAmount}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">NO</span>
                      )}
                    </td>
                    <td className="px-6 py-4 border-r border-slate-50 text-center">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">
                        {activity.fleet || '---'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {onEdit && (
                          <button 
                            onClick={() => onEdit(activity)}
                            className="p-1.5 text-slate-400 hover:text-brand-blue transition-colors rounded-lg hover:bg-white border border-transparent hover:border-slate-100"
                          >
                             <FileText size={14} />
                          </button>
                        )}
                        {onDelete && (
                          <button 
                            onClick={() => onDelete(activity.id, activity.title)}
                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100"
                          >
                             <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="opacity-40">
                    <td className="px-4 py-6 text-center text-slate-200 font-mono text-[10px] bg-slate-50/30">{sortedActivities.length + i + 1}</td>
                    <td className="px-6 py-6 border-r border-slate-50 bg-slate-50/10"></td>
                    <td className="px-6 py-6 border-r border-slate-50"></td>
                    <td className="px-6 py-6 border-r border-slate-50"></td>
                    <td className="px-6 py-6 border-r border-slate-50"></td>
                    <td className="px-6 py-6 border-r border-slate-50"></td>
                    <td className="px-6 py-6 border-r border-slate-50"></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden p-4 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
          {sortedActivities.length > 0 ? (
            sortedActivities.map((activity, index) => (
              <div key={activity.id} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 space-y-3 relative overflow-hidden">
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

                <p className="text-[10px] text-slate-500 line-clamp-2">{activity.description}</p>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Personal</p>
                    <div className="flex flex-wrap gap-1">
                      {activity.participants?.slice(0, 2).map((p, pIdx) => (
                        <span key={`${activity.id}-pm-${pIdx}`} className="text-[9px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-100 whitespace-nowrap">
                          {p.split(' ')[0]}
                        </span>
                      ))}
                      {(activity.participants?.length || 0) > 2 && (
                        <span className="text-[8px] font-bold text-slate-400">+{activity.participants!.length - 2}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">ST / Viático</p>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[9px] font-mono text-slate-500 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-100">
                        {activity.startTime || '-'} a {activity.endTime || '-'}
                      </span>
                      {(activity.overtimeHours || 0) !== 0 ? (
                        <span className={cn(
                          "text-[9px] font-black px-1.5 py-0.5 rounded border", 
                          (activity.overtimeHours || 0) > 0 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                            : "bg-red-50 text-red-600 border-red-100"
                        )}>
                          {(activity.overtimeHours || 0) > 0 ? '+' : ''}{(activity.overtimeHours || 0).toFixed(2)}h
                        </span>
                      ) : (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-slate-300">0.00h</span>
                      )}
                      <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded", activity.hasPerDiem ? "bg-emerald-50 text-emerald-600" : "text-slate-300")}>
                        {activity.hasPerDiem ? `$${activity.perDiemAmount}` : 'No'}
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
                        onClick={() => onDelete(activity.id, activity.title)}
                        className="p-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-600 hover:text-white transition-all flex items-center gap-1.5"
                      >
                        <Trash2 size={12} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Eliminar</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-slate-50/30 rounded-2xl border border-dashed border-slate-100 animate-pulse" />
            ))
          )}
        </div>

        {sortedActivities.length === 0 && (
          <div className="absolute inset-x-0 bottom-1/2 translate-y-1/2 flex flex-col items-center justify-center pointer-events-none">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4 border border-slate-100 shadow-inner">
              <Database size={32} />
            </div>
            <h4 className="text-lg font-display font-black text-slate-300 tracking-tight">Planilla Disponible</h4>
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Sin registros para esta fecha técnica</p>
          </div>
        ) }
      </div>

      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl text-white shadow-xl">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Registros Totales</span>
            <span className="text-xl font-display font-black">{sortedActivities.length}</span>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">ST Acumulado</span>
            <span className="text-xl font-display font-black text-emerald-400">
              {sortedActivities.reduce((acc, a) => acc + (a.overtimeHours || 0), 0).toFixed(1)}h
            </span>
          </div>
        </div>
        <div className="hidden md:block">
          <p className="text-[10px] font-bold text-white/60 italic">CANTV · Departamento de Datos y Transmisión · Central 4357</p>
        </div>
      </div>
    </div>
  );
}
