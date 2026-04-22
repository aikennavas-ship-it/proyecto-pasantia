import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity } from '../types';
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, LayoutDashboard } from 'lucide-react';
import { cn } from '../lib/utils';

interface DashboardProps {
  activities: Activity[];
}

const COLORS = ['#004a99', '#e30613', '#64748b', '#1e293b'];

export default function Dashboard({ activities }: DashboardProps) {
  const stats = {
    total: activities.length,
    totalOvertime: activities.reduce((acc, a) => acc + (a.overtimeHours || 0), 0),
    totalPerDiem: activities.filter(a => a.hasPerDiem).length,
    alerts: activities.filter(a => a.status === 'pendiente').length, // Count pending as alerts
  };

  const typeData = [
    { name: 'Datos', value: activities.filter(a => a.type === 'datos').length },
    { name: 'Provisión', value: activities.filter(a => a.type === 'provisión').length },
    { name: 'Transmisión', value: activities.filter(a => a.type === 'transmisión').length },
    { name: 'Otro', value: activities.filter(a => a.type === 'otro').length },
  ].filter(d => d.value > 0);

  const statusData = [
    { name: 'Pendiente', value: activities.filter(a => a.status === 'pendiente').length },
    { name: 'En Curso', value: activities.filter(a => a.status === 'en curso').length },
    { name: 'Completado', value: activities.filter(a => a.status === 'completado').length },
  ].filter(d => d.value > 0);

  const STATUS_COLORS = ['#004a99', '#e30613', '#64748b'];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/70 backdrop-blur-md p-6 rounded-[2rem] shadow-sm border border-slate-200/60">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-brand-blue rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-blue/30">
            <LayoutDashboard size={28} />
          </div>
          <div>
            <h2 className="text-xl font-display font-black text-slate-900 tracking-tight">Panel Principal</h2>
            <p className="text-xs text-slate-500 font-medium">Métricas de desempeño generales</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Labores" value={stats.total} icon={ClipboardList} color="text-brand-blue" bg="bg-brand-blue/5" />
        <StatCard title="Horas Extra" value={`${stats.totalOvertime.toFixed(1)}h`} icon={Clock} color="text-slate-600" bg="bg-slate-100" />
        <StatCard title="Viáticos" value={stats.totalPerDiem} icon={CheckCircle2} color="text-slate-600" bg="bg-slate-100" />
        <StatCard title="Alertas" value={stats.alerts} icon={AlertTriangle} color="text-brand-red" bg="bg-brand-red/5" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Type Distribution */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Distribución por Tipo</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="value" fill="#004a99" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution (Pie Chart) */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Estado de Actividades</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {statusData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[i % STATUS_COLORS.length] }} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg }: any) {
  return (
    <div className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden group hover:scale-[1.02]">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-sm", bg, color)}>
        <Icon size={24} />
      </div>
      <div>
        <p className="stat-label mb-1">{title}</p>
        <p className="text-3xl font-display font-black text-slate-900">{value}</p>
      </div>
      {/* Decorative pulse element */}
      <div className={cn("absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-5 group-hover:opacity-10 transition-opacity", bg)} />
    </div>
  );
}
