/**
 * src/modules/dashboard/components/Dashboard.tsx
 * 
 * DASHBOARD MODULE - Panel de Control Analítico
 * -----------------------------------------
 * Este componente pertenece al módulo de Dashboard y presenta las métricas consolidadas.
 * Consume los datos agregados y los inyecta en gráficas Recharts (gráficos de barras, 
 * áreas, donas) para mostrar tendencias temporales, horas extra y distribución por área.
 * 
 * Propósito estructural: Proveer la vista gerencial "at-a-glance" para administradores.
 */
import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Activity, Technician } from '../../../types';
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, LayoutDashboard, TrendingUp, Users, ShieldCheck, Eye, X, ArrowUpRight, DollarSign, Timer, FileText, Truck } from 'lucide-react';
import { cn, formatDateSpanish, capitalizeSentence, getActivityBounds, calculateRealHours, parseTime } from '../../../lib/utils';
import { formatHours } from '../../activities/components/ActivityForm';
import { format, subDays, isAfter, startOfWeek, endOfWeek, isSameWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  activities: Activity[];
  technicians?: Technician[];
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
  onSeeDetails?: (tab: string) => void;
  user?: any;
}

const COLORS = ['#004a99', '#e30613', '#10b981', '#f59e0b', '#6366f1', '#64748b'];

type SummaryType = 'labores' | 'st' | 'df' | 'viaticos' | 'fatiga' | 'personal' | 'promedio' | 'documentos' | 'flota' | null;

export default function Dashboard({ 
  activities, 
  technicians = [], 
  selectedDate,
  onDateChange,
  onSeeDetails,
  user
}: DashboardProps) {
  const [activeSummary, setActiveSummary] = useState<SummaryType>(null);
  const [selectedYear, setSelectedYear] = useState(() => selectedDate ? selectedDate.getFullYear() : new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => selectedDate ? selectedDate.getMonth() : new Date().getMonth());

  // Sync selectedMonth and selectedYear when selectedDate prop changes
  React.useEffect(() => {
    if (selectedDate) {
      setSelectedYear(selectedDate.getFullYear());
      setSelectedMonth(selectedDate.getMonth());
    }
  }, [selectedDate]);

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const currentYear = new Date().getFullYear();
  const startYear = 2024;
  const numYears = currentYear - startYear + 1;
  const years = Array.from({ length: numYears }, (_, i) => currentYear - i);

  // Safe Date parsing helper to avoid timezone offset shifts and NaN issues
  const safeGetActivityDate = React.useCallback((a: Activity): Date => {
    try {
      if (!a || !a.date) return new Date();
      if (typeof a.date.toDate === 'function') {
        return a.date.toDate();
      }
      if (a.date instanceof Date) {
        return a.date;
      }
      const dateVal = a.date as any;
      if (dateVal && dateVal.seconds !== undefined) {
        return new Date(dateVal.seconds * 1000);
      }
      if (typeof dateVal === 'string') {
        if (dateVal.includes('-')) {
          const parts = dateVal.split('T')[0].split('-');
          if (parts.length === 3) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
        }
      }
      const parsed = new Date(dateVal);
      if (isNaN(parsed.getTime())) {
        return new Date();
      }
      return parsed;
    } catch {
      return new Date();
    }
  }, []);

  const isManager = user?.role === 'admin' || user?.role === 'supervisor';

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    if (onDateChange) {
      const newD = new Date(selectedYear, month, 1);
      onDateChange(newD);
    }
  };

  const handleYearChange = (year: number) => {
    let month = selectedMonth;
    if (year === currentYear) {
      const curMonth = new Date().getMonth();
      if (month > curMonth) {
        month = curMonth;
        setSelectedMonth(curMonth);
      }
    }
    setSelectedYear(year);
    if (onDateChange) {
      const newD = new Date(year, month, 1);
      onDateChange(newD);
    }
  };

  const filteredActivities = React.useMemo(() => {
    return activities.filter(a => {
      const date = safeGetActivityDate(a);
      return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth;
    });
  }, [activities, selectedYear, selectedMonth, safeGetActivityDate]);

  // Fatigue Alert Logic Group
  const { fatigueAlerts, techActivitiesRecord } = React.useMemo(() => {
    const alerts: any[] = [];
    const record: Record<string, Activity[]> = {};
    
    filteredActivities.forEach(a => {
      const techs = a.participants && a.participants.length > 0 ? a.participants : [a.technicianName];
      techs.forEach(t => {
        if (t && t !== 'Sin asignar') {
          if (!record[t]) record[t] = [];
          record[t].push(a);
        }
      });
    });

    Object.entries(record).forEach(([name, acts]) => {
      const weeklyOT: Record<string, number> = {};
      const dailyHours: Record<string, number> = {};

      acts.forEach(a => {
        const aDate = safeGetActivityDate(a);
        const dateKey = aDate.toISOString().split('T')[0];

        if (a.overtimeHours && a.overtimeHours > 0) {
          const start = startOfWeek(aDate, { weekStartsOn: 1 });
          const end = endOfWeek(aDate, { weekStartsOn: 1 });
          const weekKey = `${format(start, 'dd/MM/yyyy')} al ${format(end, 'dd/MM/yyyy')}`;
          weeklyOT[weekKey] = (weeklyOT[weekKey] || 0) + a.overtimeHours;
        }

        dailyHours[dateKey] = (dailyHours[dateKey] || 0) + (a.totalHours || 0);
      });

      Object.entries(dailyHours).forEach(([dateKey, total]) => {
        if (total > 10.0) {
          const aDate = new Date(`${dateKey}T12:00:00Z`);
          alerts.push({
            technician: name,
            type: 'diaria',
            value: total - 8,
            date: format(aDate, 'dd/MM/yyyy'),
            description: `EXCESO DIARIO: ${formatHours(total).toUpperCase()}`,
            totalHours: total
          });
        }
      });

      Object.entries(weeklyOT).forEach(([weekKey, total]) => {
        if (total > 10) {
          // weekKey format: "dd/MM/yyyy al dd/MM/yyyy"
          const dateParts = weekKey.split(' al ');
          const formattedWeek = `Semana del ${dateParts[0].substring(0, 5)} al ${dateParts[1].substring(0, 5)}`;
          alerts.push({
            technician: name,
            type: 'semanal',
            value: total,
            week: formattedWeek,
            description: `EXCESO SEMANAL: ${formatHours(total).toUpperCase()} EXTRAS`
          });
        }
      });
    });

    return { fatigueAlerts: alerts, techActivitiesRecord: record };
  }, [filteredActivities, safeGetActivityDate]);

  const stats = React.useMemo(() => {
    const totalOT = filteredActivities.reduce((acc, a) => acc + ((a.overtimeHours || 0) > 0 ? a.overtimeHours! : 0), 0);
    const totalDF = filteredActivities.reduce((acc, a) => acc + ((a.overtimeHours || 0) < 0 ? a.overtimeHours! : 0), 0);
    const totalPerDiemAmount = filteredActivities.reduce((acc, a) => acc + (Number(a.perDiemAmount) || 0), 0);
    const totalPerDiemCount = filteredActivities.filter(a => a.hasPerDiem).length;
    const totalTechnicians = technicians.length;

    const totalActivityHours = filteredActivities.reduce((acc, a) => acc + (a.totalHours || 0), 0);
    const avgHours = filteredActivities.length > 0 ? (totalActivityHours / filteredActivities.length) : 0;
    
    const documentedCount = filteredActivities.filter(a => a.documentation === 'SI').length;
    const undocumentedCount = filteredActivities.filter(a => a.documentation === 'NO').length;

    const fleetCount = [...new Set(filteredActivities.map(a => a.fleet).filter(f => f && f.trim() !== 'N/A' && f.trim() !== ''))].length;

    return {
      total: filteredActivities.length,
      technicians: totalTechnicians,
      ot: totalOT,
      df: totalDF,
      perDiemCount: totalPerDiemCount,
      perDiemAmount: totalPerDiemAmount,
      avgHours: avgHours,
      documentedCount: documentedCount,
      fleetCount
    };
  }, [filteredActivities, technicians.length]);

  // Specialty Data Distribution for Pie chart
  const chartSpecialtyData = React.useMemo(() => {
    const specialtyCounts: Record<string, number> = {};
    filteredActivities.forEach(a => {
      const participantNames = a.participants && a.participants.length > 0 ? a.participants : [a.technicianName];
      const uniquesInActivity = new Set<string>();
      participantNames.forEach(name => {
        if (!name) return;
        const tech = technicians.find(t => t.name.trim().toLowerCase() === name.trim().toLowerCase());
        const rawSpec = tech?.specialty || a.type || 'DATOS';
        const spec = rawSpec.trim().toUpperCase();
        uniquesInActivity.add(spec);
      });
      uniquesInActivity.forEach(spec => {
        specialtyCounts[spec] = (specialtyCounts[spec] || 0) + 1;
      });
    });

    return Object.entries(specialtyCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredActivities, technicians]);

  // Area chart data: Activities in selected month
  const timelineData = React.useMemo(() => {
    const activitiesByDate = filteredActivities.reduce((acc: any, act) => {
      const parsedDate = safeGetActivityDate(act);
      const d = formatDateSpanish(parsedDate, 'dd MMM');
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {});

    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const chronologicalDates = Array.from({ length: daysInMonth }).map((_, i) => {
      const d = new Date(selectedYear, selectedMonth, i + 1);
      return formatDateSpanish(d, 'dd MMM');
    });

    return chronologicalDates.map(dateStr => ({
      date: dateStr,
      actividades: activitiesByDate[dateStr] || 0
    }));
  }, [filteredActivities, selectedYear, selectedMonth, safeGetActivityDate]);

  // Bar chart data: Top technicians
  const topTechsData = React.useMemo(() => {
    const techCounts = filteredActivities.reduce((acc: any, a) => {
      const techs = a.participants && a.participants.length > 0 ? a.participants : [a.technicianName];
      techs.forEach(t => {
        if (t && t !== 'Sin asignar') {
          const shortName = t.split(' ').slice(0, 2).join(' ');
          acc[shortName] = (acc[shortName] || 0) + 1;
        }
      });
      return acc;
    }, {});

    return Object.entries(techCounts)
      .map(([name, count]) => ({ name, labores: count as number }))
      .sort((a, b) => b.labores - a.labores)
      .slice(0, 5);
  }, [filteredActivities]);

  // Per Diem distribution data
  const perDiemChartData = React.useMemo(() => {
    const perDiemByTech = filteredActivities.reduce((acc: any, a) => {
      if (a.hasPerDiem && a.perDiemAmount) {
        const techs = a.participants && a.participants.length > 0 ? a.participants : [a.technicianName];
        techs.forEach(t => {
          if (t && t !== 'Sin asignar') {
            const shortName = t.split(' ').slice(0, 2).join(' ');
            acc[shortName] = (acc[shortName] || 0) + Number(a.perDiemAmount);
          }
        });
      }
      return acc;
    }, {});

    return Object.entries(perDiemByTech)
      .map(([name, monto]) => ({ name, monto: monto as number }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 5);
  }, [filteredActivities]);
    
  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.02),0_15px_35px_rgba(0,0,0,0.06)] border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full xl:w-auto">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-brand-blue to-blue-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-brand-blue/15 shrink-0">
            <LayoutDashboard size={26} className="sm:size-7" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-display font-black text-slate-900 tracking-tight uppercase truncate">Panel Principal</h2>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Métricas para {months[selectedMonth]} {selectedYear}</p>
              <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-slate-300" />
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1">
                Central Maracay 4357
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-sm shrink-0 w-fit">
          <select 
            className="flex-1 sm:flex-initial bg-transparent border-none text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-600 focus:ring-0 cursor-pointer px-2 py-1.5 text-center min-w-[90px] sm:min-w-[120px] appearance-none outline-none focus:outline-none"
            style={{ backgroundImage: 'none', paddingLeft: '8px', paddingRight: '8px', textAlignLast: 'center' }}
            value={selectedMonth}
            onChange={(e) => handleMonthChange(parseInt(e.target.value))}
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
            className="flex-1 sm:flex-initial bg-transparent border-none text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-600 focus:ring-0 cursor-pointer px-2 py-1.5 text-center min-w-[70px] sm:min-w-[80px] appearance-none outline-none focus:outline-none block"
            style={{ backgroundImage: 'none', paddingLeft: '8px', paddingRight: '8px', textAlignLast: 'center' }}
            value={selectedYear}
            onChange={(e) => handleYearChange(parseInt(e.target.value))}
          >
            {years.map(y => (
              <option key={y} value={y} className="bg-white text-slate-800 font-sans font-bold uppercase tracking-normal text-left">
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title="Total Labores" 
          value={stats.total} 
          icon={ClipboardList} 
          color="text-brand-blue" 
          bg="bg-brand-blue/5" 
          onClick={() => setActiveSummary('labores')}
        />
        <StatCard 
          title="Personal Activo" 
          value={stats.technicians} 
          icon={Users} 
          color="text-indigo-500" 
          bg="bg-indigo-50" 
          onClick={() => setActiveSummary('personal')}
        />
        <StatCard 
          title="ST Acumulado" 
          value={`+${formatHours(stats.ot)}`} 
          icon={Clock} 
          color="text-emerald-600" 
          bg="bg-emerald-50"
          borderClass="border-l-emerald-500" 
          onClick={() => setActiveSummary('st')}
        />
        <StatCard 
          title="DF Acumulado" 
          value={formatHours(stats.df)} 
          icon={AlertTriangle} 
          color="text-rose-600" 
          bg="bg-rose-50"
          borderClass="border-l-rose-500"
          onClick={() => setActiveSummary('df')}
        />
        <StatCard 
          title={`Viáticos (Bs. ${stats.perDiemAmount.toFixed(2)})`} 
          value={stats.perDiemCount} 
          icon={CheckCircle2} 
          color="text-emerald-600" 
          bg="bg-emerald-50" 
          borderClass="border-l-emerald-500"
          onClick={() => setActiveSummary('viaticos')}
        />
        <StatCard 
          title="Promedio por Labor" 
          value={`${stats.avgHours.toFixed(1)}h`} 
          icon={Timer} 
          color="text-cyan-500" 
          bg="bg-cyan-50" 
          onClick={() => setActiveSummary('promedio')}
        />
        <StatCard 
          title="Documentadas" 
          value={stats.documentedCount} 
          icon={FileText} 
          color="text-teal-500" 
          bg="bg-teal-50" 
          onClick={() => setActiveSummary('documentos')}
        />
        <StatCard 
          title="Flota Activa" 
          value={stats.fleetCount} 
          icon={Truck} 
          color="text-slate-600" 
          bg="bg-slate-100" 
          onClick={() => setActiveSummary('flota')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Timeline Chart */}
          <div className="glass-card p-5 sm:p-6 relative overflow-hidden group h-[380px] flex flex-col">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-blue/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:bg-brand-blue/10 transition-colors duration-700 pointer-events-none" />
            <div className="flex items-center gap-3 mb-6 relative">
              <div className="p-2 bg-brand-blue/10 rounded-lg text-brand-blue shadow-inner">
                <TrendingUp size={20} />
              </div>
              <div>
                <h3 className="text-[15px] font-black text-slate-800 uppercase tracking-tight">Actividad Reciente</h3>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">Volumen de labores en {months[selectedMonth]}</p>
              </div>
            </div>
            <div className="flex-1 relative min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorActividades" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#004a99" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#004a99" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} dy={10} minTickGap={20} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '8px 14px', fontWeight: 'bold', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="actividades" name="Labores" stroke="#004a99" strokeWidth={3} fillOpacity={1} fill="url(#colorActividades)" animationDuration={1000} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per Diem Distribution Chart */}
          <div className="glass-card p-5 sm:p-6 h-[380px] flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 shadow-inner">
                <DollarSign size={20} />
              </div>
              <div>
                <h3 className="text-[15px] font-black text-slate-800 uppercase tracking-tight">Distribución de Viáticos</h3>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">Top 5: Monto acumulado por técnico</p>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perDiemChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 9, fontWeight: 700}} height={30} interval={0} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`Bs. ${(value as number).toFixed(2)}`, 'Monto Total']}
                  />
                  <Bar dataKey="monto" fill="#10b981" radius={[6, 6, 0, 0]} barSize={36} animationDuration={1000} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Bandeja de Acciones Inmediatas */}
          <div className="glass-card p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
            <div className="flex items-center gap-3 mb-6">
               <div className="p-2 bg-amber-50 rounded-lg text-amber-500 shadow-inner">
                 <AlertTriangle size={20} />
               </div>
               <div>
                  <h3 className="text-[15px] font-black text-slate-800 uppercase tracking-tight">Acciones Inmediatas</h3>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">Alertas de prevención y fatiga</p>
               </div>
            </div>
            <div className="space-y-3">

               {fatigueAlerts.length > 0 && (
                 <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-3 cursor-pointer hover:bg-rose-100 transition-colors group" onClick={() => setActiveSummary('fatiga')}>
                   <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm border border-rose-50 group-hover:scale-105 transition-transform">
                     <ShieldCheck className="text-rose-500" size={16} />
                   </div>
                   <div>
                     <p className="text-xs font-bold text-slate-800">Riesgo de Fatiga LOTTT</p>
                     <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
                       <strong className="text-rose-700 font-black">{fatigueAlerts.length} técnicos</strong> identificados con exceso de jornada.
                     </p>
                   </div>
                 </div>
               )}

               {fatigueAlerts.length === 0 && (
                 <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-center flex flex-col items-center">
                   <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                     <CheckCircle2 size={24} className="text-emerald-500" />
                   </div>
                   <p className="text-[13px] font-black text-slate-700 uppercase tracking-wider">Todo al día</p>
                   <p className="text-[11px] font-medium text-slate-500 mt-1">No hay tareas urgentes en cola.</p>
                 </div>
               )}
            </div>
          </div>
           {/* Specialty Distribution Pie Chart */}
          <div className="glass-card p-5 sm:p-6 flex flex-col min-h-[320px] sm:min-h-[280px] min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-500 shadow-inner">
                <LayoutDashboard size={20} />
              </div>
              <div>
                <h3 className="text-[15px] font-black text-slate-800 uppercase tracking-tight">Distribución</h3>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">Trabajo por especialidad</p>
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-between w-full h-full min-w-0 gap-4 py-1 mt-4">
              {/* Contenedor Superior (Ancho Fijo 130px) exclusivo para la dona */}
              <div className="w-[130px] h-[130px] relative flex-shrink-0 flex items-center justify-center">
                {chartSpecialtyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartSpecialtyData}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={58}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartSpecialtyData.map((entry, index) => (
                          <Cell key={`cell-specialty-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11.5px', fontWeight: 'bold' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-slate-400 text-sm font-medium">No hay suficientes datos</p>
                  </div>
                )}
                {chartSpecialtyData.length > 0 && (
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{stats.total}</span>
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">Labores</span>
                  </div>
                )}
              </div>

              {/* Divisor sutil */}
              <div className="w-full border-t border-slate-100" />

              {/* Contenedor Inferior (Rejilla de 2 columnas) */}
              <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-mono pt-2">
                {chartSpecialtyData.map((entry, index) => (
                  <div key={`legend-${entry.name}`} className="flex items-center justify-between min-w-0 w-full">
                    <div className="flex items-center min-w-0">
                      <span 
                        className="w-2 h-2 rounded-full mr-1.5 shrink-0" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                      />
                      <span className="truncate text-slate-600 uppercase font-extrabold tracking-wide">{entry.name}</span>
                    </div>
                    <span className="text-slate-400 shrink-0 ml-1 font-bold select-none">
                      {entry.value} {entry.value === 1 ? 'labor' : 'labores'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Summary Overlays */}
      <AnimatePresence>
        {activeSummary && (
          <SummaryModal 
            type={activeSummary} 
            onClose={() => setActiveSummary(null)} 
            activities={filteredActivities}
            topTechs={topTechsData}
            technicians={technicians}
            onSeeDetails={onSeeDetails}
            fatigueAlerts={fatigueAlerts}
            user={user}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const formatActivityDate = (a: any) => {
  let d;
  if (a.createdAt) {
    d = typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate() : new Date(a.createdAt);
  } else {
    d = typeof a.date.toDate === 'function' ? a.date.toDate() : new Date(a.date);
  }
  return format(d, 'dd/MM/yyyy');
};

function SummaryItemRow({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const isDate = /^\d{2}\/\d{2}\/\d{4}$/.test(sub);
  let displaySub = sub;
  if (isDate) {
    displaySub = `📅 ${sub}`;
  } else if (sub && (sub.toLowerCase().includes('ene') || sub.toLowerCase().includes('feb') || sub.toLowerCase().includes('mar') || sub.toLowerCase().includes('abr') || sub.toLowerCase().includes('may') || sub.toLowerCase().includes('jun') || sub.toLowerCase().includes('jul') || sub.toLowerCase().includes('ago') || sub.toLowerCase().includes('sep') || sub.toLowerCase().includes('oct') || sub.toLowerCase().includes('nov') || sub.toLowerCase().includes('dic'))) {
    displaySub = `📅 ${sub}`;
  }

  let customBadgeStyle = "";
  if (value === "EN CAMPO") {
    customBadgeStyle = "bg-blue-50 text-blue-600 border-blue-100";
  } else if (value === "DISPONIBLE") {
    customBadgeStyle = "bg-emerald-50 text-emerald-600 border-emerald-100";
  } else if (value === "MANTENIMIENTO") {
    customBadgeStyle = "bg-amber-50 text-amber-600 border-amber-100";
  } else if (value === "Sin Uso" || value === "0 Servicios" || value === "0 Labores") {
    customBadgeStyle = "bg-slate-50 text-slate-400 border-slate-200/50 font-medium";
  } else if (value && (value.includes("Servicio") || value.includes("Servicios") || value.includes("Labor") || value.includes("Labores"))) {
    customBadgeStyle = "bg-slate-100 text-slate-600 border-slate-200/80 font-bold";
  }

  const badgeColor = cn(
    "text-xs font-black font-mono shrink-0 px-2.5 py-1 rounded-lg border whitespace-nowrap shadow-sm transition-all duration-300",
    customBadgeStyle ? customBadgeStyle : (
      color.includes("emerald") ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
      color.includes("red") || color.includes("rose") ? "bg-red-50 text-red-600 border-red-100 animate-pulse" :
      color.includes("indigo") ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
      color.includes("amber") ? "bg-amber-50 text-amber-600 border-amber-100" :
      color.includes("cyan") ? "bg-cyan-50 text-cyan-600 border-cyan-100" :
      color.includes("teal") ? "bg-teal-50 text-teal-600 border-teal-100" :
      "bg-brand-blue/5 text-brand-blue border-brand-blue/10"
    )
  );

  return (
    <div className="flex items-center justify-between gap-4 p-3.5 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all hover:bg-slate-50/80 group">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-800 group-hover:text-slate-900 whitespace-normal leading-snug">
          {capitalizeSentence(label)}
        </p>
        {displaySub && (
          <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1 flex-wrap whitespace-normal">
            {displaySub}
          </p>
        )}
      </div>
      {value && (
        <div className={badgeColor}>
          {value}
        </div>
      )}
    </div>
  );
}

function SummaryModal({ type, onClose, activities, topTechs, technicians, onSeeDetails, fatigueAlerts = [], user }: { 
  type: SummaryType, 
  onClose: () => void, 
  activities: Activity[],
  topTechs: any[],
  technicians: Technician[],
  onSeeDetails?: (tab: string) => void,
  fatigueAlerts?: any[],
  user?: any
}) {
  // Safe Date parsing helper to avoid timezone offset shifts and NaN issues
  const safeGetActivityDate = React.useCallback((a: Activity): Date => {
    try {
      if (!a || !a.date) return new Date();
      if (typeof a.date.toDate === 'function') {
        return a.date.toDate();
      }
      if (a.date instanceof Date) {
        return a.date;
      }
      const dateVal = a.date as any;
      if (dateVal && dateVal.seconds !== undefined) {
        return new Date(dateVal.seconds * 1000);
      }
      if (typeof dateVal === 'string') {
        if (dateVal.includes('-')) {
          const parts = dateVal.split('T')[0].split('-');
          if (parts.length === 3) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
        }
      }
      const parsed = new Date(dateVal);
      if (isNaN(parsed.getTime())) {
        return new Date();
      }
      return parsed;
    } catch {
      return new Date();
    }
  }, []);

  const groupedWeeklyInfractions = React.useMemo(() => {
    // 1. Map technicians to their activities in the current filtered set
    const techActivities: Record<string, Activity[]> = {};
    activities.forEach(a => {
      const techs = a.participants && a.participants.length > 0 ? a.participants : [a.technicianName];
      techs.forEach(t => {
        if (t && t !== 'Sin asignar') {
          if (!techActivities[t]) techActivities[t] = [];
          techActivities[t].push(a);
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

  const getSummaryContent = () => {
    switch(type) {
      case 'personal':
        return {
          title: "Personal Activo",
          icon: Users,
          color: "text-indigo-500",
          bg: "bg-indigo-50",
          items: technicians.map(t => ({
            label: t.name,
            value: t.specialty || 'DATOS',
            sub: `${t.employeeId || 'P00-XXXXXX'} • Tel: ${t.phoneNumber || 'S/N'}`
          })),
          extra: (
            <div className="mt-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Registrados</span>
                <span className="text-xs font-black text-indigo-600">{technicians.length}</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
          )
        };
      case 'labores':
        return {
          title: "Resumen de Labores",
          icon: ClipboardList,
          color: "text-brand-blue",
          bg: "bg-brand-blue/10",
          items: activities.slice(0, 10).map(a => ({
            label: a.title,
            value: formatActivityDate(a),
            sub: a.incidentNumber || 'S/N'
          })),
          extra: (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Líderes de Campo</p>
              <div className="space-y-2">
                {topTechs.map((t) => (
                  <div key={`top-leader-${t.name}`} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                    <span className="text-xs font-bold text-slate-700">{t.name}</span>
                    <span className="text-xs font-black text-brand-blue">{t.labores}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        };
      case 'st':
        const stActivities = activities.filter(a => (a.overtimeHours || 0) > 0).slice(0, 10);
        return {
          title: "ST Acumulado",
          icon: Clock,
          color: "text-emerald-500",
          bg: "bg-emerald-50",
          items: stActivities.map(a => ({
            label: a.title,
            value: `+${formatHours(a.overtimeHours!)}`,
            sub: formatActivityDate(a)
          })),
          extra: <p className="mt-4 text-[10px] text-center text-slate-400 font-medium">Mostrando las últimas incidencias con tiempo extra productivo.</p>
        };
      case 'df':
        const dfActivities = activities.filter(a => (a.overtimeHours || 0) < 0).slice(0, 10);
        return {
          title: "Déficits Acumulados",
          icon: AlertTriangle,
          color: "text-brand-red",
          bg: "bg-brand-red/5",
          items: dfActivities.map(a => ({
            label: a.title,
            value: formatHours(a.overtimeHours!),
            sub: formatActivityDate(a)
          })),
          extra: <p className="mt-4 text-[10px] text-center text-slate-400 font-medium">Registro de labores con tiempo por debajo del estándar de 8h.</p>
        };
      case 'viaticos':
        const vActivities = activities.filter(a => a.hasPerDiem).slice(0, 10);
        const total = activities.reduce((acc, a) => acc + (Number(a.perDiemAmount) || 0), 0);
        return {
          title: "Resumen Viáticos",
          icon: CheckCircle2,
          color: "text-amber-500",
          bg: "bg-amber-50",
          items: vActivities.map(a => ({
            label: a.title,
            value: `Bs. ${Number(a.perDiemAmount || 0).toFixed(2)}`,
            sub: formatActivityDate(a)
          })),
          extra: (
            <div className="mt-4 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-center">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Total Devengado</p>
              <p className="text-2xl font-black text-amber-600 whitespace-nowrap">Bs. {total.toFixed(2)}</p>
            </div>
          )
        };
      case 'promedio':
        return {
          title: "Promedio de Horas por Labor",
          icon: Timer,
          color: "text-cyan-500",
          bg: "bg-cyan-50",
          items: activities.slice(0, 10).map(a => ({
            label: a.title,
            value: formatHours(a.totalHours || 0),
            sub: formatActivityDate(a)
          })),
          extra: <p className="mt-4 text-[10px] text-center text-slate-400 font-medium">Refleja el tiempo promedio que toma cada actividad registrada.</p>
        };
      case 'documentos':
        const docActivities = activities.filter(a => a.documentation === 'SI').slice(0, 10);
        return {
          title: "Labores Documentadas",
          icon: FileText,
          color: "text-teal-500",
          bg: "bg-teal-50",
          items: docActivities.map(a => ({
            label: a.title,
            value: "Documentado",
            sub: formatActivityDate(a)
          })),
          extra: (
            <div className="mt-4 p-3 bg-teal-50 rounded-xl border border-teal-100 flex justify-around">
               <div className="text-center">
                 <p className="text-[10px] uppercase font-bold text-teal-600">Documentadas</p>
                 <p className="text-xl font-black text-teal-700">{activities.filter(a => a.documentation === 'SI').length}</p>
               </div>
               <div className="text-center">
                 <p className="text-[10px] uppercase font-bold text-slate-500">Sin Documentar</p>
                 <p className="text-xl font-black text-slate-700">{activities.filter(a => a.documentation === 'NO').length}</p>
               </div>
            </div>
          )
        };
      case 'flota':
        // Calculate dynamic counts based on the activities array
        const fleetUses: Record<string, number> = {};
        const uniqueFleets: string[] = [];
        
        const normalizeFleet = (n: string) => n.toLowerCase().replace(/[\s\-_]/g, '');
        activities.forEach(a => {
          if (a.fleet && a.fleet !== 'N/A' && a.fleet.trim() !== '') {
            const normActivityFleet = normalizeFleet(a.fleet);
            
            // Find if we already have this fleet in our list (using normalized comparison)
            const existingFleet = uniqueFleets.find(rf => normalizeFleet(rf) === normActivityFleet);
            const key = existingFleet ? existingFleet : a.fleet.trim();
            
            if (!existingFleet) {
              uniqueFleets.push(key);
            }
            
            fleetUses[key] = (fleetUses[key] || 0) + 1;
          }
        });

        // Sort uniqueFleets based on uses (descending)
        uniqueFleets.sort((a, b) => (fleetUses[b] || 0) - (fleetUses[a] || 0));

        return {
          title: "Flota Vehicular",
          icon: Truck,
          color: "text-slate-600",
          bg: "bg-slate-100",
          items: uniqueFleets.map(f => {
            const count = fleetUses[f] || 0;
            return {
              label: f,
              value: count > 0 ? `${count} ${count === 1 ? 'Servicio' : 'Servicios'}` : 'Sin Uso',
              sub: 'Vehículo Operativo'
            };
          }),
          extra: null
        };
      case 'fatiga':
        return {
          title: "Infracciones LOTTT",
          icon: ShieldCheck,
          color: "text-rose-600",
          bg: "bg-rose-50",
          items: fatigueAlerts.map((a: any) => ({
            label: a.technician,
            value: a.type === 'semanal' ? a.week : a.date,
            sub: a.description
          })),
          extra: (
            <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <AlertTriangle size={12} className="text-rose-500" />
                Normativa LOTTT
              </p>
              <p className="text-[10px] text-slate-500 leading-tight">
                El límite legal en Venezuela es de 10 horas extras semanales. Superar este tope aumenta los riesgos laborales y representa una infracción a la norma de seguridad y salud laboral.
              </p>
            </div>
          )
        };
      default: return null;
    }
  };

  const content = getSummaryContent();
  if (!content) return null;

  const Icon = content.icon;

  const handleSeeDetails = () => {
    onClose();
    if (type === 'viaticos' || type === 'labores' || type === 'st' || type === 'df' || type === 'promedio' || type === 'documentos' || type === 'flota' || type === 'fatiga') {
      onSeeDetails?.('activities');
    } else if (type === 'personal') {
      onSeeDetails?.('technicians');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className={cn(
          "bg-white rounded-[2.5rem] shadow-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 transition-all duration-300",
          type === 'fatiga' ? 'max-w-xl' : 'max-w-md'
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 pb-4 sm:pb-5 border-b border-slate-100 shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className={cn("p-3 rounded-2xl", content.bg, content.color)}>
                <Icon size={24} />
              </div>
              <div>
                <h3 className="text-xl font-display font-black text-slate-900 leading-tight">{content.title}</h3>
                <p className="text-xs text-slate-400 font-medium tracking-tight">
                  {type === 'fatiga' ? 'Fiscalización e infracciones acumuladas' : 'Resumen técnico específico'}
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

        <div className="p-5 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">
          {type === 'fatiga' ? (
            <div className="space-y-5">
              {groupedWeeklyInfractions.map((weekGroup) => (
                <div key={`week-group-${weekGroup.weekKey}`} className="border border-slate-250/20 rounded-[22px] bg-slate-50/40 p-4 sm:p-5 space-y-4 shadow-sm">
                  {/* Cabecera del Bloque Semanal */}
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 flex-wrap gap-2">
                    <div>
                      <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Ciclo de Nómina</p>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 tracking-tight mt-0.5">{weekGroup.weekLabel}</h4>
                    </div>
                  </div>

                  {/* Técnicos dentro de la Semana */}
                  <div className="space-y-4 divide-y divide-slate-100/80">
                    {weekGroup.technicians.map((tech) => (
                      <div key={`tech-${weekGroup.weekKey}-${tech.name}`} className="pt-3 first:pt-0 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-y-1 gap-x-2">
                          <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                            {tech.name}
                          </span>
                          {tech.hasWeeklyExcess && (
                            <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 rounded-md border border-red-100/80 uppercase tracking-wide">
                              ⚠️ Exceso Semanal: {formatHours(tech.weeklyOvertime)} extras
                            </span>
                          )}
                        </div>

                        {/* Desglose de Infracciones Diarias Anidadas (Hijos) */}
                        {tech.dailyExcesses.length > 0 && (
                          <div className="pl-3.5 space-y-1 border-l-2 border-slate-200">
                            {tech.dailyExcesses.map((daily, idx) => (
                              <div key={`daily-${idx}`} className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
                                <span className="flex items-center gap-2">
                                  <span className="text-rose-400 shrink-0 opacity-70">•</span>
                                  <span>{daily.dayFormatted}</span>
                                </span>
                                <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100/55 uppercase tracking-wider whitespace-nowrap">
                                  Exceso diario: {formatHours(daily.totalHours).toUpperCase()}
                                </span>
                              </div>
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
                  <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-500">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="text-xs font-black text-slate-705 uppercase tracking-wider">Sin Infracciones LOTTT</h4>
                  <p className="text-[11px] font-medium text-slate-500 max-w-xs mx-auto">
                    No se han registrado excesos acumulados semanales ni jornadas que superen las 10 horas de trabajo durante este período.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {type === 'flota' && (() => {
                let totalServicios = 0;
                const uniqueFleets = new Set<string>();
                
                const normalizeFleet = (n: string) => n.toLowerCase().replace(/[\s\-_]/g, '');
                const normToOriginal: Record<string, string> = {};

                activities.forEach(a => {
                  if (a.fleet && a.fleet !== 'N/A' && a.fleet.trim() !== '') {
                    totalServicios++;
                    const norm = normalizeFleet(a.fleet);
                    if (!normToOriginal[norm]) {
                      normToOriginal[norm] = a.fleet.trim();
                    }
                    uniqueFleets.add(norm);
                  }
                });
                const totalFlota = uniqueFleets.size;

                return (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-50 border border-slate-200/40 rounded-2xl p-4 text-center shadow-sm">
                      <p className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Total Flota</p>
                      <p className="text-xl font-black text-slate-700 mt-1">{totalFlota}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/40 rounded-2xl p-4 text-center shadow-sm">
                      <p className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Servicios</p>
                      <p className="text-xl font-black text-brand-blue mt-1">{totalServicios}</p>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                {content.items.map((item, i) => (
                  <SummaryItemRow 
                    key={`summary-item-${type}-${i}-${item.label}`}
                    label={item.label}
                    value={item.value}
                    sub={item.sub}
                    color={content.color}
                  />
                ))}
                {content.items.length === 0 && (
                  <div className="py-12 text-center space-y-3">
                    <p className="text-sm font-bold text-slate-400">Sin datos registrados</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {content.extra}
        </div>

        <div className="p-5 sm:p-6 pt-4 sm:pt-5 border-t border-slate-100 flex flex-col gap-2 shrink-0 bg-slate-50/50">
          {!(type === 'personal' && user?.role !== 'admin') && (
            <button 
              onClick={handleSeeDetails}
              className="w-full py-4 bg-brand-blue/10 text-brand-blue rounded-2xl font-bold text-xs hover:bg-brand-blue/20 transition-all flex items-center justify-center gap-2"
            >
              Ver detalles completos
              <ArrowUpRight size={14} />
            </button>
          )}
          <button 
            onClick={onClose}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs hover:bg-slate-800 transition-all shadow-lg active:scale-95"
          >
            Cerrar Resumen
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg, onClick, borderClass }: any) {
  return (
    <div 
      className={cn(
        "glass-card p-4 sm:p-5 flex flex-col items-start justify-between gap-3 relative overflow-hidden group hover:scale-[1.02] cursor-pointer transition-all border-l-4",
        borderClass || "border-l-transparent hover:border-l-slate-300"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between w-full">
        <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shadow-sm", bg, color)}>
          <Icon size={20} className="sm:hidden" />
          <Icon size={22} className="hidden sm:block" />
        </div>
        {onClick && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-brand-blue/5">
            <ArrowUpRight size={14} />
          </div>
        )}
      </div>
      
      <div className="mt-1 w-full relative z-10">
        <p className="text-2xl sm:text-3xl font-display font-black text-slate-900 leading-none tracking-tight whitespace-nowrap">{value}</p>
        <p className="stat-label mt-1.5 text-[10px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider line-clamp-1">{title}</p>
      </div>

      <div className={cn("absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-[0.03] group-hover:scale-[2] transition-transform duration-700 pointer-events-none", bg.replace('/5', '').replace('/50', ''))} />
    </div>
  );
}
