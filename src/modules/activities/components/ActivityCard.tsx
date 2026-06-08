import React, { useState } from 'react';
import { Clock, Calendar, Shield, ChevronDown, ChevronUp, User } from 'lucide-react';
import { Activity } from '../../../types';
import { cn, formatDate } from '../../../lib/utils';

interface ActivityCardProps {
  activity: Activity;
  onEdit?: (activity: Activity) => void;
}

export default function ActivityCard({ activity, onEdit }: ActivityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const descriptionLength = activity.description?.length || 0;
  const isExpandable = descriptionLength > 120;

  return (
    <div 
      onClick={() => onEdit?.(activity)}
      className="glass-card p-0 group flex flex-col h-full relative overflow-hidden cursor-pointer transition-all duration-400 hover:-translate-y-1.5 shadow-sm hover:shadow-xl hover:shadow-brand-blue/5"
    >
      {/* Dynamic Hover Gradient Border */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-transparent group-hover:bg-gradient-to-r group-hover:from-brand-blue group-hover:via-brand-red group-hover:to-brand-blue bg-[length:200%_auto] animate-gradient-x transition-all duration-500 opacity-0 group-hover:opacity-100" />
      
      <div className="p-6 flex flex-col flex-grow">
        {/* Top Header: Identity & Status */}
        <div className="flex items-center gap-3 mb-4">
          {activity.incidentNumber && (
            <span className="text-[9px] uppercase tracking-widest font-black px-2.5 py-1 rounded-lg bg-slate-900 text-white shadow-sm flex items-center gap-1.5">
              <Shield size={10} className="text-brand-red" />
              {activity.incidentNumber.startsWith('INC-') ? activity.incidentNumber : `INC-${activity.incidentNumber}`}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-display font-black text-slate-900 group-hover:text-brand-blue transition-colors leading-tight mb-3">
          {activity.title}
        </h3>

        {/* Description: Expandable Section */}
        <div className="flex-grow relative">
          <div 
            className={cn(
              "text-[13px] text-slate-500 leading-relaxed transition-all duration-500 ease-in-out relative",
              !isExpanded && "line-clamp-3 max-h-[4.5rem] overflow-hidden"
            )}
          >
            {activity.description}
            {!isExpanded && isExpandable && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/90 to-transparent pointer-events-none group-hover:from-white/60 transition-all duration-300" />
            )}
          </div>
          
          {isExpandable && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className={cn(
                "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] mt-2 transition-all duration-300 py-1 px-2 rounded-lg",
                isExpanded 
                  ? "text-brand-red bg-red-50 hover:bg-red-100" 
                  : "text-brand-blue bg-brand-blue/5 hover:bg-brand-blue/10"
              )}
            >
              {isExpanded ? (
                <>Contraer descripción <ChevronUp size={12} /></>
              ) : (
                <>Ver descripción completa <ChevronDown size={12} className="animate-pulse" /></>
              )}
            </button>
          )}
        </div>

        {/* Metrics Section: Visually Differentiated */}
        <div className="mt-6 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 group-hover:bg-white group-hover:border-brand-blue/10 transition-all duration-300">
          <div className="space-y-1">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Horario Central</span>
            <div className="flex flex-col gap-1 text-[10px] font-bold text-slate-700 font-mono">
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-brand-blue shrink-0" />
                <span>AM: {activity.startTimeMorning || '07:30'} - {activity.endTimeMorning || '11:45'}</span>
              </div>
              <div className="flex items-center gap-1.5 opacity-70">
                <Clock size={12} className="text-brand-blue shrink-0" />
                <span>PM: {activity.startTimeAfternoon || '12:45'} - {activity.endTimeAfternoon || activity.endTime || '16:00'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Tech & Metadata */}
        <div className="mt-6 pt-5 border-t border-slate-100/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border border-slate-200 group-hover:border-brand-blue/20 group-hover:bg-brand-blue/5 transition-all">
              <User size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-slate-900 truncate leading-none mb-1 uppercase tracking-tight">
                {activity.technicianName}
              </p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Responsable</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center justify-end gap-1 text-brand-blue/60 group-hover:text-brand-blue transition-colors mb-1">
              <Calendar size={12} />
              <span className="text-[10px] font-black uppercase tracking-tighter">{formatDate(typeof activity.date.toDate === 'function' ? activity.date.toDate() : new Date(activity.date as any))}</span>
            </div>
            <p className="text-[9px] font-bold text-slate-300 uppercase">Central Maracay</p>
          </div>
        </div>
      </div>
    </div>
  );
}
