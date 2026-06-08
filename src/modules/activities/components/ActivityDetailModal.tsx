import React from 'react';
import { Activity } from '../../../types';
import { Shield, Clock, AlignLeft, X, Users } from 'lucide-react';

interface ActivityDetailModalProps {
  activity: Activity;
  onClose: () => void;
}

export default function ActivityDetailModal({ activity, onClose }: ActivityDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* DETALLES DE LA LABOR: FORMATO BOLETÍN OFICIAL DE SOLO LECTURA */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase font-black tracking-widest text-white bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1.5 shadow-sm">
                <Shield size={10} className="text-brand-blue" />
                {activity.incidentNumber 
                  ? (activity.incidentNumber.startsWith('INC-') ? activity.incidentNumber : `INC-${activity.incidentNumber}`) 
                  : 'SIN TICKET'}
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase">Detalles de la Labor</h3>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo del Detalle (Diseño de lectura plano, sin inputs) */}
        <div className="flex-1 overflow-y-auto space-y-5 text-left pr-2">
          
          {/* Título */}
          <div>
            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
              TÍTULO DE LA LABOR
            </span>
            <p className="text-sm font-bold text-slate-800 bg-slate-50/50 p-3.5 border border-slate-100 rounded-2xl">
              {activity.title}
            </p>
          </div>

          {/* Descripción enmarcada en una caja de lectura suave */}
          <div>
            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
              DESCRIPCIÓN DE LA LABOR
            </span>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-slate-600 leading-relaxed font-semibold whitespace-pre-wrap">
              {activity.description || 'Sin descripción detallada.'}
            </div>
          </div>

          {/* Horario Ejecutado */}
          <div>
            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
              <Clock size={12} className="text-slate-400" /> HORARIO EJECUTADO
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-3.5 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 font-bold flex items-center gap-1.5">
                <span className="text-[9px] font-black text-slate-400 bg-slate-200/50 px-1.5 py-0.5 rounded leading-none">AM</span>
                {activity.startTimeMorning || '07:30'} - {activity.endTimeMorning || '11:45'}
              </span>
              <span className="px-3.5 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 font-bold flex items-center gap-1.5">
                <span className="text-[9px] font-black text-slate-400 bg-slate-200/50 px-1.5 py-0.5 rounded leading-none">PM</span>
                {activity.startTimeAfternoon || '12:45'} - {activity.endTimeAfternoon || activity.endTime || '16:00'}
              </span>
            </div>
          </div>

          {/* Cuadrilla */}
          <div>
            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
              <Users size={12} className="text-slate-400" /> TÉCNICOS PARTICIPANTES (CUADRILLA)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {!activity.participants || activity.participants.length === 0 ? (
                <span className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">Solo tú</span>
              ) : (
                activity.participants.map((tecnico: string) => (
                  <span 
                    key={tecnico} 
                    className="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-[10px] font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-blue/50"></span>
                    {tecnico}
                  </span>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Botón de cierre discreto al final */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="w-full sm:w-auto px-6 h-11 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            Cerrar Detalles
          </button>
        </div>

      </div>
    </div>
  );
}
