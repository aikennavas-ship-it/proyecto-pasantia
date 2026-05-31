import React from 'react';
import { Activity } from '../../../types';
import { Shield, Clock, Calendar, MapPin, Truck, User, AlignLeft, HelpCircle, XCircle } from 'lucide-react';
import { formatHours } from './ActivityForm';
import { formatDate } from '../../../lib/utils';
import { Timestamp } from 'firebase/firestore';

interface ActivityDetailModalProps {
  activity: Activity;
  onClose: () => void;
}

export default function ActivityDetailModal({ activity, onClose }: ActivityDetailModalProps) {
  const dateStr = activity.date 
    ? (typeof (activity.date as any).toDate === 'function'
      ? (activity.date as any).toDate().toLocaleDateString('es-VE')
      : formatDate(new Date(activity.date as any)))
    : 'Fecha desconocida';

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Encabezado */}
        <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 shrink-0">
          <div className="space-y-1">
             <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-white bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1.5 shadow-sm">
                  <Shield size={10} className="text-brand-blue" />
                  {activity.incidentNumber 
                    ? (activity.incidentNumber.startsWith('INC-') ? activity.incidentNumber : `INC-${activity.incidentNumber}`) 
                    : 'SIN TICKET'}
                </span>
             </div>
             <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight leading-tight">Detalles de la Labor</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-8 flex-grow">
          {/* Título */}
           <div>
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-1.5"><AlignLeft size={12} /> Título de la Labor</h3>
             <p className="text-sm font-bold text-slate-700 bg-slate-50/50 p-4 border border-slate-100 rounded-2xl">{activity.title}</p>
           </div>
           
           {/* Datos Generales Grid */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border border-slate-100 rounded-3xl bg-white shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
             
             <div className="space-y-1.5">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-1.5"><Calendar size={12} /> Fecha de Ejecución</h3>
               <p className="text-sm font-bold text-slate-700 pl-1">{dateStr}</p>
             </div>

             <div className="space-y-1.5">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-1.5"><MapPin size={12} /> Región</h3>
               <p className="text-sm font-bold text-slate-700 pl-1">Central (Maracay)</p>
             </div>

             <div className="space-y-1.5">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-1.5"><Truck size={12} /> Vehículo Asignado</h3>
               <p className="text-sm font-bold text-slate-700 pl-1">
                 {activity.fleet ? activity.fleet : 'Ninguno'}
               </p>
             </div>

             <div className="space-y-1.5">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-1.5"><User size={12} /> Manejo (Chofer)</h3>
               <p className="text-sm font-bold text-slate-700 pl-1">
                 {activity.driver || 'No asignado'}
               </p>
             </div>

             <div className="space-y-1.5">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Código de Pago</h3>
               <p className="text-sm font-bold text-slate-700 pl-1 uppercase">
                 {activity.code || 'N/A'}
               </p>
             </div>
           </div>

           {/* Descripciones Textuales */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-1.5"><AlignLeft size={12} /> Descripción de la Labor</h3>
                 <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 min-h-[120px]">
                   <p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">{activity.description}</p>
                 </div>
              </div>
              <div className="space-y-2">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-1.5"><HelpCircle size={12} /> Justificación</h3>
                 <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 min-h-[120px]">
                   <p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">{activity.justification || 'Sin justificación provista.'}</p>
                 </div>
              </div>
           </div>

           {/* Participantes */}
           <div className="space-y-2">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 flex items-center gap-1.5">Compañeros de Cuadrilla</h3>
             <div className="flex flex-wrap gap-2">
               {!activity.participants || activity.participants.length === 0 ? (
                 <span className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">Sin cuadrilla adicional</span>
               ) : (
                 activity.participants.map(p => (
                   <span key={p} className="text-xs font-bold text-slate-700 bg-white shadow-sm border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-brand-blue/50"></span>
                     {p}
                   </span>
                 ))
               )}
             </div>
           </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 shrink-0">
          <button 
            onClick={onClose}
            className="w-full h-12 bg-brand-blue hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md shadow-brand-blue/20 flex items-center justify-center gap-2"
          >
            Cerrar Detalles
          </button>
        </div>
      </div>
    </div>
  );
}
