import React, { useState, useMemo } from 'react';
import { Activity, UserProfile, Technician } from '../../../types';
import { Clock, Calendar, MapPin, CheckCircle, XCircle, AlertCircle, Users, Truck } from 'lucide-react';
import { parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { getActivityBounds, calculateRealHours } from '../../../lib/utils';

interface TechHistoryViewProps {
  activities: Activity[];
  user: UserProfile | null;
  onEdit?: (activity: Activity) => void;
}

export function DescripcionExpandible({ texto, limite = 90 }: { texto: string; limite?: number }) {
  const [expandido, setExpandido] = React.useState(false);

  if (!texto || texto.length <= limite) {
    return <p className="text-xs font-medium text-slate-500 leading-relaxed">{texto}</p>;
  }

  const textoTruncado = `${texto.slice(0, limite)}...`;

  return (
    <p className="text-xs font-medium text-slate-500 leading-relaxed transition-all duration-200">
      {expandido ? texto : textoTruncado}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation(); // Evita disparar clics accidentales en la tarjeta
          setExpandido(!expandido);
        }}
        className="text-blue-600 font-semibold italic hover:underline ml-1 focus:outline-none inline-block"
      >
        {expandido ? 'ver menos' : 'ver más...'}
      </button>
    </p>
  );
}

export default function TechHistoryView({ activities, user, onEdit }: TechHistoryViewProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const years = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => currentYear - i);

  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      if (!activity.date) return false;
      const actDate = typeof activity.date === 'string' ? parseISO(activity.date) : activity.date.toDate();
      return actDate.getFullYear() === selectedYear && actDate.getMonth() === selectedMonth;
    }).sort((a, b) => {
      const aDate = typeof a.date === 'string' ? parseISO(a.date).getTime() : a.date.toDate().getTime();
      const bDate = typeof b.date === 'string' ? parseISO(b.date).getTime() : b.date.toDate().getTime();
      return bDate - aDate;
    });
  }, [activities, selectedYear, selectedMonth]);

  const weeklyOvertimeTracker = useMemo(() => {
    const now = new Date();
    const currWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const currWeekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const dailyHours: Record<string, { minStart: number, maxEnd: number, hasPause: boolean }> = {};

    activities.forEach(a => {
      if (!a.date) return;
      const actDate = typeof a.date === 'string' ? parseISO(a.date) : a.date.toDate();
      if (isWithinInterval(actDate, { start: currWeekStart, end: currWeekEnd })) {
        const dateKey = actDate.toISOString().split('T')[0];
        if (!dailyHours[dateKey]) {
           dailyHours[dateKey] = { minStart: Infinity, maxEnd: -Infinity, hasPause: false };
        }
        if (a.hasPause === 'SI') dailyHours[dateKey].hasPause = true;

        const { minStart, maxEnd } = getActivityBounds(a);
        if (minStart !== Infinity) dailyHours[dateKey].minStart = Math.min(dailyHours[dateKey].minStart, minStart);
        if (maxEnd !== -Infinity) dailyHours[dateKey].maxEnd = Math.max(dailyHours[dateKey].maxEnd, maxEnd);
      }
    });

    let totalWeeklyOvertime = 0;
    Object.values(dailyHours).forEach(d => {
       let totalRealHours = calculateRealHours(d.minStart, d.maxEnd, d.hasPause);
       if (totalRealHours > 0) {
          const dayOvertime = Math.max(0, totalRealHours - 8);
          totalWeeklyOvertime += dayOvertime;
       }
    });

    return totalWeeklyOvertime;
  }, [activities]);



  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* CABECERA "MI HISTORIAL DE JORNADAS" EN ANCHO COMPLETO (100% de ancho) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full relative overflow-hidden">
        {/* Decorativo de fondo */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
        
        <div className="relative z-10 space-y-1">
          <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase">MI HISTORIAL DE JORNADAS</h1>
          <p className="text-xs text-slate-400 font-medium">Consulta el desglose de horas, sobretiempos y viáticos asociados a tus participaciones del período.</p>
        </div>
        
        {/* Selectores de Período compactos en la extrema derecha */}
        <div className="flex gap-2 shrink-0 relative z-10">
          <div className="flex flex-col relative min-w-[100px]">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="appearance-none h-9 pl-3 pr-8 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand-blue/20 transition-all cursor-pointer w-full"
            >
              {months
                .map((month, index) => ({ name: month, index }))
                .filter(opt => {
                  if (selectedYear === currentYear) {
                    return opt.index <= currentMonth;
                  }
                  return true;
                })
                .map((opt) => (
                  <option key={opt.name} value={opt.index}>{opt.name}</option>
                ))
              }
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
               <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          
          <div className="flex flex-col relative min-w-[80px]">
            <select
              value={selectedYear}
              onChange={(e) => {
                const yr = Number(e.target.value);
                setSelectedYear(yr);
                if (yr === currentYear) {
                  if (selectedMonth > currentMonth) {
                    setSelectedMonth(currentMonth);
                  }
                }
              }}
              className="appearance-none h-9 pl-3 pr-8 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand-blue/20 transition-all cursor-pointer w-full"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
               <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredActivities.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center shadow-sm border border-slate-200/60 overflow-hidden relative">
            <div className="absolute inset-0 bg-grid-slate-100/[0.04] bg-[length:16px_16px]"></div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 flex items-center justify-center rounded-2xl mb-6 shadow-inner ring-1 ring-slate-100">
                <Calendar size={32} className="text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">Trimestre en Blanco</h3>
              <p className="text-sm font-medium text-slate-500 max-w-sm">
                No hay asignaciones ni jornadas registradas para este período. Mantente alerta a la planificación.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {filteredActivities.map(activity => {
              const dateStr = activity.date ? (typeof activity.date === 'string' ? parseISO(activity.date).toLocaleDateString('es-VE') : activity.date.toDate().toLocaleDateString('es-VE')) : 'Fecha desconocida';
              
              // LOTTT True Hours calculation
              const { minStart, maxEnd } = getActivityBounds(activity);
              let realTotalHours = calculateRealHours(minStart, maxEnd, activity.hasPause === 'SI');
              const totalHours = activity.totalHours || realTotalHours || 0;
              
              return (
                <div 
                  key={activity.id} 
                  className={`bg-white rounded-[20px] shadow-sm border p-5 flex flex-col justify-between transition-all group relative overflow-hidden ${
                    onEdit ? 'cursor-pointer hover:shadow-md hover:border-brand-blue/30 active:scale-[0.99]' : ''
                  } border-slate-200`} 
                  onClick={() => { if (onEdit) onEdit(activity) }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div className="bg-slate-100 px-2 py-1 rounded inline-flex items-center gap-1.5 shadow-inner">
                      <span className="font-mono text-[11px] font-bold tracking-wider text-slate-700">
                        {activity.incidentNumber || 'SIN-TICKET'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest bg-white/80 px-2 py-1 rounded-full border border-slate-100">
                      <Calendar size={12} />
                      {dateStr}
                    </div>
                  </div>

                  <div className="mb-5 flex-1 p-2">
                    <h3 className="text-base font-black text-slate-800 leading-tight mb-2">{activity.title}</h3>
                    <DescripcionExpandible texto={activity.description || ''} />
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-slate-50 rounded-xl p-2 md:p-3 border border-slate-100 flex flex-col items-center justify-center text-center">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 relative after:content-[''] after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-4 after:h-0.5 after:bg-slate-200">Total</span>
                        <div className="text-sm md:text-base font-black text-slate-800 mt-1">{totalHours.toFixed(1)}<span className="text-[10px] font-bold text-slate-400 ml-0.5">h</span></div>
                      </div>
                      
                      <div className="bg-emerald-50 rounded-xl p-2 md:p-3 border border-emerald-100 flex flex-col items-center justify-center text-center">
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1 relative after:content-[''] after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-4 after:h-0.5 after:bg-emerald-200">Extra</span>
                        <div className="text-sm md:text-base font-black text-emerald-700 mt-1">
                          {(activity.overtimeHours || 0) > 0 ? `+${(activity.overtimeHours || 0).toFixed(1)}` : '0'}<span className="text-[10px] font-bold text-emerald-500/70 ml-0.5">h</span>
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 rounded-xl p-2 md:p-3 border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 relative after:content-[''] after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-4 after:h-0.5 after:bg-slate-200">Viático</span>
                        <div className="text-sm md:text-base font-black text-brand-blue mt-1">
                          {activity.perDiemAmount && activity.perDiemAmount > 0 ? (
                             <span className="flex items-center justify-center gap-0.5">
                               <span className="text-[10px] font-extrabold text-slate-400 mr-0.5">Bs.</span>
                               {activity.perDiemAmount.toFixed(0)}
                             </span>
                          ) : (
                             <span className="text-slate-400">N/A</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100/80 pt-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex gap-3">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                          <Users size={12} className="text-slate-400" />
                          <span className="truncate max-w-[100px]" title={activity.participants?.join(', ')}>
                             {activity.participants?.length ? `${activity.participants.length} Participante${activity.participants.length > 1 ? 's' : ''}` : 'Sólo tú'}
                          </span>
                        </div>
                        {activity.driver && (
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                            <Truck size={12} className="text-slate-400" />
                            <span className="truncate max-w-[80px]" title={activity.driver}>{activity.driver}</span>
                          </div>
                        )}
                      </div>
                      
                      {realTotalHours > 10.0 && (
                         <div className="w-full mt-2 pt-2 border-t border-slate-50 flex items-center gap-1.5 text-[10px] text-red-600 font-bold bg-red-50/50 px-2 py-1.5 rounded-lg">
                           <AlertCircle size={12} className="text-red-500 flex-shrink-0" />
                           <span className="uppercase tracking-widest">⚠️ Exceso de Jornada (LOTTT)</span>
                         </div>
                      )}

                    </div>
                  </div>
                  
                  {onEdit && (
                    <div className="absolute inset-0 bg-brand-blue/[0.03] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-end justify-center pb-2">
                       <span className="inline-flex items-center gap-1 bg-white px-3 py-1 rounded-full shadow-sm text-[10px] font-black uppercase tracking-widest text-brand-blue translate-y-4 group-hover:translate-y-0 transition-transform duration-200">Toca para revisar <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg></span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
