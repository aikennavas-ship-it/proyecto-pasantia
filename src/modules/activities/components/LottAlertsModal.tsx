import React, { useState, useMemo, useCallback } from 'react';
import { Calendar, User, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, formatDateSpanish, capitalizeSentence, getActivityBounds, calculateRealHours, formatHours } from '../../../lib/utils';
import { Activity, Technician } from '../../../types';
import { obtenerDatosUsuarioReactivo, obtenerDatosPorIdSecuencial, inicializarTecnicosIdsSeguro } from '../../../utils/resolver';

interface LottAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activities: Activity[];
  technicians: Technician[];
}

export const formatearExcesoTiempo = (totalMinutos: number): string => {
  const horas = Math.floor(totalMinutos / 60);
  const minutos = Math.round(totalMinutos % 60);

  if (minutos === 0) {
    return `${horas}h`;
  }
  
  return `${horas}h ${minutos}min`;
};

function DailyExcessRow({ daily }: { daily: { dayFormatted: string; totalHours: number; activityTitle: string } }) {
  const [expanded, setExpanded] = useState(false);
  const textToRender = capitalizeSentence(daily.activityTitle || 'Mantenimiento Preventivo de Enlace');
  const isLongText = textToRender.length > 30;

  return (
    <div className="py-2.5 first:pt-1 last:pb-1 flex items-start justify-between gap-4 text-[11px] font-bold text-slate-500">
      <div className="flex-1 min-w-0">
        <span className="flex items-center gap-2 font-bold text-slate-800">
          <Calendar size={12} className="text-blue-600 opacity-100 shrink-0" />
          <span>{daily.dayFormatted}</span>
        </span>
        {daily.activityTitle && (
          <div className="mt-1 pl-5 text-[10.5px] font-medium leading-normal">
            <p className="text-xs text-slate-500 font-medium">
              <span className={expanded ? "whitespace-normal text-slate-600 font-semibold" : "line-clamp-1 text-slate-500 italic"}>
                {textToRender}
              </span>
              {isLongText && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(!expanded);
                  }}
                  className="text-blue-600 hover:text-blue-800 ml-1.5 font-bold inline-block cursor-pointer focus:outline-none"
                >
                  {expanded ? "ver menos" : "ver más..."}
                </button>
              )}
            </p>
          </div>
        )}
      </div>
      <span className="px-2 py-0.5 bg-red-50 border border-red-100 rounded text-[10px] font-bold text-red-600 uppercase tracking-wider whitespace-nowrap self-start mt-0.5">
        EXCESO DIARIO: <span className="lowercase">{formatearExcesoTiempo(Math.round(daily.totalHours * 60))}</span>
      </span>
    </div>
  );
}

export default function LottAlertsModal({ isOpen, onClose, activities, technicians = [] }: LottAlertsModalProps) {
  const safeGetActivityDate = useCallback((a: Activity): Date => {
    try {
      if (!a || !a.date) return new Date();
      if (typeof a.date.toDate === 'function') {
        return a.date.toDate();
      }
      return new Date(a.date as any);
    } catch {
      return new Date();
    }
  }, []);

  const groupedWeeklyInfractions = useMemo(() => {
    // 1. Map technicians to their activities in the current filtered set
    const techActivities: Record<string, Activity[]> = {};
    activities.forEach(a => {
      const listUids = inicializarTecnicosIdsSeguro(a, technicians);

      // Unificar para evitar duplicados en la misma actividad
      const uniqueUids = Array.from(new Set(listUids));

      uniqueUids.forEach(uid => {
        const u = obtenerDatosUsuarioReactivo(uid, technicians);
        if (u && u.nombreCompleto !== "Técnico Desincorporado") {
          const tName = u.nombreCompleto.toUpperCase();
          if (!techActivities[tName]) techActivities[tName] = [];
          techActivities[tName].push(a);
        }
      });
    });

    // 2. Group by week
    const weeksMap: Record<number, {
      weekStart: Date;
      weekEnd: Date;
      weekLabel: string;
      technicians: Record<string, {
        name: string;
        weeklyOvertime: number;
        dailyExcesses: Array<{
          date: Date;
          dayFormatted: string;
          totalHours: number;
          overtime: number;
          activityTitle: string;
        }>;
      }>;
    }> = {};

    Object.entries(techActivities).forEach(([name, acts]) => {
      // Collect activities by day first for this tech
      const dailyHoursForTech: Record<string, { 
        date: Date, 
        titles: string[], 
        minStart: number, 
        maxEnd: number, 
        hasPause: boolean 
      }> = {};
      
      acts.forEach(a => {
        const aDate = safeGetActivityDate(a);
        const dateKey = aDate.toISOString().split('T')[0];
        
        if (!dailyHoursForTech[dateKey]) {
          dailyHoursForTech[dateKey] = { 
            date: aDate, 
            titles: [], 
            minStart: Infinity, 
            maxEnd: -Infinity, 
            hasPause: false 
          };
        }
        
        const dayData = dailyHoursForTech[dateKey];
        if (a.hasPause === 'SI') {
          dayData.hasPause = true;
        }
        
        const { minStart, maxEnd } = getActivityBounds(a);
        if (minStart !== Infinity) {
          dayData.minStart = Math.min(dayData.minStart, minStart);
        }
        if (maxEnd !== -Infinity) {
          dayData.maxEnd = Math.max(dayData.maxEnd, maxEnd);
        }

        if (!dayData.titles.includes(a.title)) {
          dayData.titles.push(a.title);
        }
      });

      // Now process by day to update weeksMap
      Object.entries(dailyHoursForTech).forEach(([dateKey, dayData]) => {
        let totalRealHours = calculateRealHours(dayData.minStart, dayData.maxEnd, dayData.hasPause);
        let dayOvertime = Math.max(0, totalRealHours - 8);

        const aDate = dayData.date;
        const start = startOfWeek(aDate, { weekStartsOn: 1 }); // Monday
        const end = endOfWeek(aDate, { weekStartsOn: 1 }); // Sunday
        const weekKey = start.getTime();

        if (!weeksMap[weekKey]) {
          const weekLabel = `Semana del ${format(start, 'dd/MM')} al ${format(end, 'dd/MM')}`;
          weeksMap[weekKey] = {
            weekStart: start,
            weekEnd: end,
            weekLabel,
            technicians: {}
          };
        }

        if (!weeksMap[weekKey].technicians[name]) {
          weeksMap[weekKey].technicians[name] = {
            name,
            weeklyOvertime: 0,
            dailyExcesses: []
          };
        }

        const techWeek = weeksMap[weekKey].technicians[name];

        // Sum positive overtime hours for the week
        if (dayOvertime > 0) {
          techWeek.weeklyOvertime += dayOvertime;
        }

        // Daily excess check: total hours worked > 10.0
        if (totalRealHours > 10.0) {
          const rawDay = format(aDate, 'eeee, dd/MM/yyyy', { locale: es });
          const dayFormatted = rawDay.charAt(0).toUpperCase() + rawDay.slice(1);

          techWeek.dailyExcesses.push({
            date: aDate,
            dayFormatted,
            totalHours: totalRealHours,
            overtime: dayOvertime,
            activityTitle: dayData.titles.join(', ')
          });
        }
      });
    });

    const result: Array<{
      weekKey: number;
      weekLabel: string;
      weekStart: Date;
      technicians: Array<{
        name: string;
        weeklyOvertime: number;
        hasWeeklyExcess: boolean;
        dailyExcesses: Array<{
          dayFormatted: string;
          totalHours: number;
          activityTitle: string;
        }>;
      }>;
    }> = [];

    Object.entries(weeksMap).forEach(([keyStr, weekData]) => {
      const weekKey = parseInt(keyStr);
      const filteredTechs: typeof result[0]['technicians'] = [];

      Object.entries(weekData.technicians).forEach(([techName, techData]) => {
        const hasWeeklyExcess = techData.weeklyOvertime > 10;
        const hasDailyExcess = techData.dailyExcesses.length > 0;

        if (hasWeeklyExcess || hasDailyExcess) {
          techData.dailyExcesses.sort((x, y) => x.date.getTime() - y.date.getTime());

          filteredTechs.push({
            name: techName,
            weeklyOvertime: techData.weeklyOvertime,
            hasWeeklyExcess,
            dailyExcesses: techData.dailyExcesses.map(d => ({
              dayFormatted: d.dayFormatted,
              totalHours: d.totalHours,
              activityTitle: d.activityTitle
            }))
          });
        }
      });

      if (filteredTechs.length > 0) {
        result.push({
          weekKey,
          weekLabel: weekData.weekLabel,
          weekStart: weekData.weekStart,
          technicians: filteredTechs
        });
      }
    });

    result.sort((x, y) => y.weekKey - x.weekKey);
    return result;
  }, [activities, safeGetActivityDate]);

  const totalCases = useMemo(() => {
    let count = 0;
    groupedWeeklyInfractions.forEach(w => {
      w.technicians.forEach(t => {
        count += t.dailyExcesses.length;
      });
    });
    return count;
  }, [groupedWeeklyInfractions]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 transition-all duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 pb-4 sm:pb-5 border-b border-slate-100 shrink-0 bg-slate-50/50">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-600">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-xl font-display font-black text-slate-900 leading-tight flex items-center gap-2">
                  Infracciones LOTTT
                  <span className="text-xs font-bold font-sans bg-rose-50 border border-rose-100 text-rose-600 px-2.5 py-0.5 rounded-full inline-block">
                    {totalCases} {totalCases === 1 ? 'CASO' : 'CASOS'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-medium tracking-tight">
                  Fiscalización e infracciones acumuladas
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-5">
          {groupedWeeklyInfractions.map((weekGroup) => (
            <div key={`week-group-${weekGroup.weekKey}`} className="border border-slate-200 rounded-[22px] bg-slate-50/40 p-4 sm:p-5 space-y-4 shadow-sm">
              <div>
                <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Ciclo de Nómina</p>
                <h4 className="text-xs sm:text-sm font-black text-slate-800 tracking-tight mt-0.5">{weekGroup.weekLabel}</h4>
              </div>

              <div className="space-y-4 divide-y divide-slate-100/80">
                {weekGroup.technicians.map((tech) => (
                  <div key={`tech-${weekGroup.weekKey}-${tech.name}`} className="pt-3 first:pt-0 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-y-1 gap-x-2">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <User size={12} className="text-slate-600 opacity-100 shrink-0" />
                        {tech.name}
                      </span>
                      {tech.hasWeeklyExcess && (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 rounded-md border border-red-100/80 uppercase tracking-wide">
                          ⚠️ Exceso Semanal: <span className="lowercase">{formatearExcesoTiempo(Math.round(tech.weeklyOvertime * 60))}</span> extras
                        </span>
                      )}
                    </div>

                    {tech.dailyExcesses.length > 0 && (
                      <div className="pl-3.5 space-y-1 border-l-2 border-slate-200">
                        {tech.dailyExcesses.map((daily, idx) => (
                          <DailyExcessRow key={`daily-${idx}`} daily={daily} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {groupedWeeklyInfractions.length === 0 && (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-500 font-bold">
                ✓
              </div>
              <p className="text-[13px] font-black text-slate-700 uppercase tracking-wider">Sin Infracciones</p>
              <p className="text-[11px] font-medium text-slate-500 mt-1">No hay jornadas con exceso registradas para este periodo.</p>
            </div>
          )}

          <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
              <AlertTriangle size={12} className="text-rose-500" />
              Normativa LOTTT
            </p>
            <p className="text-[10px] text-slate-500 leading-tight">
              El límite legal en Venezuela es de 10 horas extras semanales. Superar este tope aumenta los riesgos laborales y representa una infracción a la norma de seguridad y salud laboral.
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-slate-900 border border-slate-950 font-black text-xs text-white uppercase tracking-wider hover:bg-slate-800 transition-colors shadow-md shadow-slate-950/20 active:scale-95"
          >
            Cerrar Resumen
          </button>
        </div>
      </motion.div>
    </div>
  );
}
