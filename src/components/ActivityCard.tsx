import React from 'react';
import { Clock, AlertCircle, CheckCircle2, MoreVertical, MessageSquare, Plus } from 'lucide-react';
import { Activity } from '../types';
import { cn, formatDate } from '../lib/utils';

interface ActivityCardProps {
  activity: Activity;
  onEdit?: (activity: Activity) => void;
}

const statusConfig = {
  'pendiente': 'bg-slate-100 text-slate-600',
  'en curso': 'bg-brand-blue/10 text-brand-blue',
  'completado': 'bg-emerald-100 text-emerald-700',
};

export default function ActivityCard({ activity, onEdit }: ActivityCardProps) {
  return (
    <div className="glass-card p-6 group flex flex-col h-full border-b-4 border-b-transparent hover:border-b-brand-blue hover:-translate-y-1">
      <div className="flex justify-between items-start mb-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {activity.status && (
              <span className={cn("text-[8px] uppercase tracking-[0.2em] font-black px-2 py-0.5 rounded shadow-sm", statusConfig[activity.status])}>
                {activity.status}
              </span>
            )}
            <span className="text-[8px] uppercase tracking-[0.2em] font-black px-2 py-0.5 rounded bg-slate-900 text-white leading-none">
              {activity.type}
            </span>
            {activity.incidentNumber && (
              <span className="text-[8px] uppercase tracking-[0.2em] font-black px-2 py-0.5 rounded bg-brand-red text-white leading-none">
                INC-{activity.incidentNumber}
              </span>
            )}
          </div>
          <h3 className="text-lg font-display font-black text-slate-900 group-hover:text-brand-blue transition-colors line-clamp-2 leading-tight">
            {activity.title}
          </h3>
        </div>
      </div>

      <p className="text-sm text-slate-500 line-clamp-3 mb-6 leading-relaxed flex-grow">
        {activity.description}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <div>
          <p className="stat-label mb-1">Horario</p>
          <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 font-mono">
            <Clock size={14} className="text-brand-blue" />
            {activity.startTime} — {activity.endTime}
          </p>
        </div>
        <div>
          <p className="stat-label mb-1">Métricas</p>
          <div className="flex flex-wrap gap-2">
            {activity.overtimeHours && activity.overtimeHours > 0 ? (
              <span className="text-[10px] font-black text-brand-blue bg-brand-blue/10 px-1.5 py-0.5 rounded">
                +{activity.overtimeHours}h S.T
              </span>
            ) : (
              <span className="text-[10px] font-black text-slate-300">SIN S.T</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end pt-5 border-t border-slate-100">
        <div className="text-right">
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter mb-0.5">{formatDate(activity.date.toDate())}</p>
          <p className="text-xs text-slate-900 font-bold font-display">{activity.technicianName}</p>
        </div>
      </div>
    </div>
  );
}
