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
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, LayoutDashboard, TrendingUp, Users, ShieldCheck, Eye, X, ArrowUpRight, DollarSign } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { formatHours } from '../../activities/components/ActivityForm';
import { format, subDays, isAfter, startOfWeek, isSameWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  activities: Activity[];
  technicians?: Technician[];
  onSeeDetails?: (tab: string) => void;
}

const COLORS = ['#004a99', '#e30613', '#10b981', '#f59e0b', '#6366f1', '#64748b'];

type SummaryType = 'labores' | 'st' | 'df' | 'viaticos' | 'fatiga' | 'personal' | null;

export default function Dashboard({ activities, technicians = [], onSeeDetails }: DashboardProps) {
  const [activeSummary, setActiveSummary] = useState<SummaryType>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const filteredActivities = activities.filter(a => {
    const date = a.date.toDate();
    return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth;
  });

  // Fatigue Alert Logic
  const fatigueAlerts: any[] = [];
  const techActivitiesRecord: Record<string, Activity[]> = {};
  
  filteredActivities.forEach(a => {
    const techs = a.participants && a.participants.length > 0 ? a.participants : [a.technicianName];
    techs.forEach(t => {
      if (t && t !== 'Sin asignar') {
        if (!techActivitiesRecord[t]) techActivitiesRecord[t] = [];
        techActivitiesRecord[t].push(a);
      }
    });
  });

  Object.entries(techActivitiesRecord).forEach(([name, acts]) => {
    const weeklyOT: Record<string, number> = {};
    acts.forEach(a => {
      if (a.overtimeHours && a.overtimeHours > 0) {
        const weekKey = format(startOfWeek(a.date.toDate(), { weekStartsOn: 1 }), 'ww');
        weeklyOT[weekKey] = (weeklyOT[weekKey] || 0) + a.overtimeHours;
      }
      
      if (a.overtimeHours && a.overtimeHours > 2) {
        fatigueAlerts.push({
          technician: name,
          type: 'diaria',
          value: a.overtimeHours,
          date: format(a.date.toDate(), 'dd/MM'),
          description: `Exceso jornada diaria (${formatHours(a.overtimeHours + 8)}h)`
        });
      }
    });

    Object.entries(weeklyOT).forEach(([week, total]) => {
      if (total > 10) {
        fatigueAlerts.push({
          technician: name,
          type: 'semanal',
          value: total,
          week: `Semana ${week}`,
          description: `Exceso semanal LOTTT (${formatHours(total)}h extra)`
        });
      }
    });
  });

  const totalOT = filteredActivities.reduce((acc, a) => acc + ((a.overtimeHours || 0) > 0 ? a.overtimeHours! : 0), 0);
  const totalDF = filteredActivities.reduce((acc, a) => acc + ((a.overtimeHours || 0) < 0 ? a.overtimeHours! : 0), 0);
  const totalPerDiemAmount = filteredActivities.reduce((acc, a) => acc + (Number(a.perDiemAmount) || 0), 0);
  const totalPerDiemCount = filteredActivities.filter(a => a.hasPerDiem).length;
  const totalTechnicians = technicians.length;

  const stats = {
    total: filteredActivities.length,
    technicians: totalTechnicians,
    ot: totalOT,
    df: totalDF,
    perDiemCount: totalPerDiemCount,
    perDiemAmount: totalPerDiemAmount,
  };

  // Specialty Data Distribution for Pie chart
  const specialtyCounts: Record<string, number> = {};
  filteredActivities.forEach(a => {
    const participantNames = a.participants && a.participants.length > 0 ? a.participants : [a.technicianName];
    const uniquesInActivity = new Set<string>();
    participantNames.forEach(name => {
      const tech = technicians.find(t => t.name === name);
      const spec = tech?.specialty || 'DATOS';
      uniquesInActivity.add(spec);
    });
    uniquesInActivity.forEach(spec => {
      specialtyCounts[spec] = (specialtyCounts[spec] || 0) + 1;
    });
  });

  const chartSpecialtyData = Object.entries(specialtyCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Area chart data: Activities last 14 days
  const fourteenDaysAgo = subDays(new Date(), 14);
  const recentActivities = filteredActivities.filter(a => isAfter(a.date.toDate(), fourteenDaysAgo));
  
  const activitiesByDate = recentActivities.reduce((acc: any, act) => {
    const d = format(act.date.toDate(), 'dd MMM', { locale: es });
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  const chronologicalDates = Array.from({ length: 14 }).map((_, i) => {
    const d = subDays(new Date(), 13 - i);
    return format(d, 'dd MMM', { locale: es });
  });

  const timelineData = chronologicalDates.map(dateStr => ({
    date: dateStr,
    actividades: activitiesByDate[dateStr] || 0
  }));

  // Bar chart data: Top technicians
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

  const topTechsData = Object.entries(techCounts)
    .map(([name, count]) => ({ name, labores: count as number }))
    .sort((a, b) => b.labores - a.labores)
    .slice(0, 5);

  // Per Diem distribution data
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

  const perDiemChartData = Object.entries(perDiemByTech)
    .map(([name, monto]) => ({ name, monto: monto as number }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5);
    
  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.02),0_15px_35px_rgba(0,0,0,0.06)] border border-slate-200">
        <div className="flex items-center gap-4 w-full">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-brand-blue rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-blue/30 shrink-0">
            <LayoutDashboard size={28} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-display font-black text-slate-900 tracking-tight truncate">Panel Principal</h2>
            <p className="text-xs text-slate-500 font-medium truncate">Métricas para {months[selectedMonth]} {selectedYear}</p>
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
          color="text-emerald-500" 
          bg="bg-emerald-50" 
          onClick={() => setActiveSummary('st')}
        />
        <StatCard 
          title="DF Acumulado" 
          value={formatHours(stats.df)} 
          icon={AlertTriangle} 
          color="text-brand-red" 
          bg="bg-brand-red/5" 
          onClick={() => setActiveSummary('df')}
        />
        <StatCard 
          title={`Viáticos (Bs.${stats.perDiemAmount.toFixed(2)})`} 
          value={stats.perDiemCount} 
          icon={CheckCircle2} 
          color="text-amber-500" 
          bg="bg-amber-50" 
          onClick={() => setActiveSummary('viaticos')}
        />
      </div>

      {fatigueAlerts.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-red/5 border-l-4 border-l-brand-red p-4 sm:p-6 rounded-r-[2rem] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer group gap-4"
          onClick={() => setActiveSummary('fatiga')}
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-red text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-brand-red/20 shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">Alertas de Fatiga Laboral (LOTTT)</h3>
              <p className="text-[10px] sm:text-xs text-brand-red font-bold">Se han detectado {fatigueAlerts.length} casos de exceso de jornada</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-brand-red font-black text-[10px] uppercase tracking-[0.2em] group-hover:translate-x-1 transition-transform self-end sm:self-auto">
            Ver detalles <ArrowUpRight size={14} />
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline Chart */}
        <div className="glass-card p-6 lg:col-span-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-blue/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:bg-brand-blue/10 transition-colors duration-700" />
          <div className="flex items-center gap-3 mb-6 relative">
            <div className="p-2 bg-brand-blue/10 rounded-lg text-brand-blue">
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Actividad Reciente</h3>
              <p className="text-xs text-slate-500">Volumen de labores en {months[selectedMonth]}</p>
            </div>
          </div>
          <div className="h-72 relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorActividades" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#004a99" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#004a99" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '12px 20px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="actividades" name="Labores" stroke="#004a99" strokeWidth={3} fillOpacity={1} fill="url(#colorActividades)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Per Diem Distribution Chart */}
        <div className="glass-card p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-500">
              <DollarSign size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Distribución de Viáticos</h3>
              <p className="text-xs text-slate-500">Monto acumulado (Bs.) por técnico en {months[selectedMonth]}</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perDiemChartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 700}} height={40} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => [`Bs.${(value as number).toFixed(2)}`, 'Monto Total']}
                />
                <Bar dataKey="monto" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Technicians */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-500">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Top Técnicos</h3>
              <p className="text-xs text-slate-500">Con más labores de campo</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTechsData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 11, fontWeight: 600}} width={100} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)' }}
                />
                <Bar dataKey="labores" name="Labores Totales" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={24}>
                  {topTechsData.map((entry, index) => (
                    <Cell key={`cell-top-tech-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Specialty Distribution Pie Chart */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-50 rounded-lg text-orange-500">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Distribución de Trabajo</h3>
              <p className="text-xs text-slate-500">Proporción por especialidad técnica</p>
            </div>
          </div>
          <div className="h-64 flex items-center justify-center relative">
            {chartSpecialtyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartSpecialtyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartSpecialtyData.map((entry, index) => (
                      <Cell key={`cell-specialty-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle" 
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-sm font-medium">No hay suficientes datos</p>
            )}
            {chartSpecialtyData.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -mt-8">
                <span className="text-3xl font-black text-slate-800 tracking-tight">{stats.total}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Labores</span>
              </div>
            )}
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
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryModal({ type, onClose, activities, topTechs, technicians, onSeeDetails, fatigueAlerts = [] }: { 
  type: SummaryType, 
  onClose: () => void, 
  activities: Activity[],
  topTechs: any[],
  technicians: Technician[],
  onSeeDetails?: (tab: string) => void,
  fatigueAlerts?: any[]
}) {
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
            sub: t.phoneNumber || 'S/N'
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
            value: format(a.createdAt ? a.createdAt.toDate() : a.date.toDate(), 'dd/MM/yyyy'),
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
            sub: format(a.createdAt ? a.createdAt.toDate() : a.date.toDate(), 'dd/MM/yyyy')
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
            sub: format(a.createdAt ? a.createdAt.toDate() : a.date.toDate(), 'dd/MM/yyyy')
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
            value: `Bs.${Number(a.perDiemAmount || 0).toFixed(1)}`,
            sub: format(a.createdAt ? a.createdAt.toDate() : a.date.toDate(), 'dd/MM/yyyy')
          })),
          extra: (
            <div className="mt-4 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-center">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Total Devengado</p>
              <p className="text-2xl font-black text-amber-600">Bs.{total.toFixed(2)}</p>
            </div>
          )
        };
      case 'fatiga':
        return {
          title: "Alertas de Fatiga",
          icon: ShieldCheck,
          color: "text-brand-red",
          bg: "bg-brand-red/10",
          items: fatigueAlerts.map((a: any) => ({
            label: a.technician,
            value: a.type === 'semanal' ? a.week : a.date,
            sub: a.description
          })),
          extra: (
            <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <AlertTriangle size={12} className="text-brand-red" />
                Normativa LOTTT
              </p>
              <p className="text-[10px] text-slate-500 leading-tight">
                El límite legal en Venezuela es de 10 horas extras semanales. Superar este tope aumenta riesgos laborales y es una violación de la norma de seguridad y salud laboral.
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
    if (type === 'viaticos') {
      onSeeDetails?.('reports');
    } else if (type === 'labores' || type === 'st' || type === 'df') {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/40"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className={cn("p-3 rounded-2xl", content.bg, content.color)}>
                <Icon size={24} />
              </div>
              <div>
                <h3 className="text-xl font-display font-black text-slate-900 leading-tight">{content.title}</h3>
                <p className="text-xs text-slate-400 font-medium tracking-tight">Resumen técnico específico</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-2 max-h-[350px] overflow-y-auto px-1 custom-scrollbar">
            {content.items.map((item, i) => (
              <div key={`summary-item-${type}-${i}-${item.label}`} className="flex justify-between items-center p-3 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all hover:bg-slate-50 group">
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-xs font-bold text-slate-700 truncate group-hover:text-slate-900">{item.label}</p>
                  <p className="text-[10px] font-mono text-slate-400 font-black">{item.sub}</p>
                </div>
                <div className={cn("text-sm font-black font-mono shrink-0", content.color)}>
                  {item.value}
                </div>
              </div>
            ))}
            {content.items.length === 0 && (
              <div className="py-12 text-center space-y-3">
                <p className="text-sm font-bold text-slate-400">Sin datos registrados</p>
              </div>
            )}
          </div>

          {content.extra}

          <div className="mt-6 flex flex-col gap-2">
            <button 
              onClick={handleSeeDetails}
              className="w-full py-4 bg-brand-blue/10 text-brand-blue rounded-2xl font-bold text-xs hover:bg-brand-blue/20 transition-all flex items-center justify-center gap-2"
            >
              Ver detalles completos
              <ArrowUpRight size={14} />
            </button>
            <button 
              onClick={onClose}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs hover:bg-slate-800 transition-all shadow-lg active:scale-95"
            >
              Cerrar Resumen
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg, onClick }: any) {
  return (
    <div 
      className="glass-card p-4 sm:p-6 flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden group hover:scale-[1.02] border-t-4 border-t-transparent hover:border-t-brand-blue cursor-pointer transition-all"
      onClick={onClick}
    >
      <div className={cn("w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all group-hover:-translate-y-1 shadow-sm", bg, color)}>
        <Icon size={24} className="sm:hidden" />
        <Icon size={28} className="hidden sm:block" />
      </div>
      <div className="mt-1 sm:mt-2">
        <p className="text-2xl sm:text-4xl font-display font-black text-slate-900 leading-none tracking-tight">{value}</p>
        <p className="stat-label mt-2 text-[10px] sm:text-xs text-slate-500 font-medium uppercase tracking-wider">{title}</p>
      </div>
      
      {onClick && (
        <div className="mt-2 flex items-center gap-1 text-[9px] font-bold text-brand-blue opacity-0 group-hover:opacity-100 transition-opacity">
          <span>Ver resumen</span>
          <Eye size={10} />
        </div>
      )}

      <div className={cn("absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-[0.03] group-hover:scale-150 transition-all duration-500 pointer-events-none", bg.replace('/5', '').replace('/50', ''))} />
    </div>
  );
}
