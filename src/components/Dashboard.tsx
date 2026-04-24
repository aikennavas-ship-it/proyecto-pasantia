import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Activity } from '../types';
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, LayoutDashboard, TrendingUp, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatHours } from './ActivityForm';
import { format, subDays, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';

interface DashboardProps {
  activities: Activity[];
}

const COLORS = ['#004a99', '#e30613', '#10b981', '#f59e0b', '#6366f1', '#64748b'];

export default function Dashboard({ activities }: DashboardProps) {
  const totalOT = activities.reduce((acc, a) => acc + ((a.overtimeHours || 0) > 0 ? a.overtimeHours! : 0), 0);
  const totalDF = activities.reduce((acc, a) => acc + ((a.overtimeHours || 0) < 0 ? a.overtimeHours! : 0), 0);
  const totalPerDiemAmount = activities.reduce((acc, a) => acc + (Number(a.perDiemAmount) || 0), 0);
  const totalPerDiemCount = activities.filter(a => a.hasPerDiem).length;

  const stats = {
    total: activities.length,
    ot: totalOT,
    df: totalDF,
    perDiemCount: totalPerDiemCount,
    perDiemAmount: totalPerDiemAmount,
  };

  // Pie chart data: Dist. by Type
  const typeData = [
    { name: 'Datos', value: activities.filter(a => a.type === 'datos').length },
    { name: 'Provisión', value: activities.filter(a => a.type === 'provisión').length },
    { name: 'Transmisión', value: activities.filter(a => a.type === 'transmisión').length },
    { name: 'Otro', value: activities.filter(a => a.type === 'otro').length },
  ].filter(d => d.value > 0);

  // Area chart data: Activities last 14 days
  const fourteenDaysAgo = subDays(new Date(), 14);
  const recentActivities = activities.filter(a => isAfter(a.date.toDate(), fourteenDaysAgo));
  
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
  const techCounts = activities.reduce((acc: any, a) => {
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
    .slice(0, 5); // Top 5
    
  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/70 backdrop-blur-md p-6 rounded-[2rem] shadow-sm border border-slate-200/60">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-brand-blue rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-blue/30">
            <LayoutDashboard size={28} />
          </div>
          <div>
            <h2 className="text-xl font-display font-black text-slate-900 tracking-tight">Panel Principal</h2>
            <p className="text-xs text-slate-500 font-medium">Métricas de desempeño generales y analíticas</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard title="Total Labores" value={stats.total} icon={ClipboardList} color="text-brand-blue" bg="bg-brand-blue/5" />
        <StatCard title="ST Acumulado" value={`+${formatHours(stats.ot)}`} icon={Clock} color="text-emerald-500" bg="bg-emerald-50" />
        <StatCard title="DF Acumulado" value={formatHours(stats.df)} icon={AlertTriangle} color="text-brand-red" bg="bg-brand-red/5" />
        <StatCard 
          title={`Viáticos ($${stats.perDiemAmount.toFixed(2)})`} 
          value={stats.perDiemCount} 
          icon={CheckCircle2} 
          color="text-amber-500" 
          bg="bg-amber-50" 
        />
      </div>

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
              <p className="text-xs text-slate-500">Volumen de labores en los últimos 14 días</p>
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
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Type Distribution */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-50 rounded-lg text-orange-500">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Distribución de Trabajo</h3>
              <p className="text-xs text-slate-500">Por área de ejecución</p>
            </div>
          </div>
          <div className="h-64 flex items-center justify-center relative">
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                    wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-sm font-medium">No hay suficientes datos</p>
            )}
            {/* Inner text for Pie */}
            {typeData.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -mt-8">
                <span className="text-3xl font-black text-slate-800 tracking-tight">{stats.total}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Total</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg }: any) {
  return (
    <div className="glass-card p-4 sm:p-6 flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden group hover:scale-[1.02] border-t-4 border-t-transparent hover:border-t-brand-blue cursor-default">
      <div className={cn("w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all group-hover:-translate-y-1 shadow-sm", bg, color)}>
        <Icon size={24} className="sm:hidden" />
        <Icon size={28} className="hidden sm:block" />
      </div>
      <div className="mt-1 sm:mt-2">
        <p className="text-2xl sm:text-4xl font-display font-black text-slate-900 leading-none tracking-tight">{value}</p>
        <p className="stat-label mt-2 text-[10px] sm:text-xs text-slate-500 font-medium uppercase tracking-wider">{title}</p>
      </div>
      {/* Decorative pulse element */}
      <div className={cn("absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-[0.03] group-hover:scale-150 transition-all duration-500 pointer-events-none", bg.replace('/5', '').replace('/50', ''))} />
    </div>
  );
}
