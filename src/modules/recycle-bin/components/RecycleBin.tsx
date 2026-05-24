import React from 'react';
import { Trash2, RotateCcw, AlertCircle, Clock, Search, Filter, Calendar, X } from 'lucide-react';
import { Activity, Technician } from '../../../types';
import { cn } from '../../../lib/utils';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface RecycleBinProps {
  deletedActivities: Activity[];
  deletedTechnicians: Technician[];
  onRestore: (type: 'activity' | 'technician', id: string) => void;
  onPermanentDelete: (type: 'activity' | 'technician', id: string) => void;
  onRestoreAll: () => void;
  onEmptyBin: () => void;
}

export default function RecycleBin({ 
  deletedActivities, 
  deletedTechnicians, 
  onRestore, 
  onPermanentDelete,
  onRestoreAll,
  onEmptyBin
}: RecycleBinProps) {
  const [activeSubTab, setActiveSubTab] = React.useState<'activities' | 'technicians'>('activities');
  const [searchTerm, setSearchTerm] = React.useState('');
  const now = new Date();

  const getRemainingDays = (deletedAt: any) => {
    if (!deletedAt) return 0;
    const date = deletedAt.toDate ? deletedAt.toDate() : new Date(deletedAt);
    const diff = differenceInDays(now, date);
    return Math.max(0, 30 - diff);
  };

  const filteredActivities = deletedActivities.filter(a => 
    (a.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTechnicians = deletedTechnicians.filter(t => 
    (t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalItems = deletedActivities.length + deletedTechnicians.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.02),0_15px_35px_rgba(0,0,0,0.06)] border border-slate-200 animate-in fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full xl:w-auto">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-brand-blue to-blue-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-brand-blue/15 shrink-0">
            <Trash2 size={26} className="sm:size-7" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-display font-black text-slate-900 tracking-tight uppercase truncate">Papelera de Reciclaje</h2>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Elementos borrados hace menos de 30 días</p>
              <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-slate-300" />
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1">
                Central Maracay 4357
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-start xl:justify-end">
          {totalItems > 0 && (
            <div className="flex items-center gap-2">
              <button 
                onClick={onRestoreAll}
                className="btn-primary py-2 px-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-brand-blue/20 shrink-0"
              >
                <RotateCcw size={14} />
                Restaurar Todo
              </button>
              <button 
                onClick={onEmptyBin}
                className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-red-100 transition-all shrink-0"
                title="Elimina permanentemente todos los elementos de la papelera"
              >
                <Trash2 size={14} />
                Vaciar Papelera
              </button>
            </div>
          )}

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveSubTab('activities')}
              className={cn(
                "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all",
                activeSubTab === 'activities' ? "bg-white text-brand-blue shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Labores ({deletedActivities.length})
            </button>
            <button 
              onClick={() => setActiveSubTab('technicians')}
              className={cn(
                "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all",
                activeSubTab === 'technicians' ? "bg-white text-brand-blue shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Personal ({deletedTechnicians.length})
            </button>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden min-h-[500px] flex flex-col p-0">
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center flex-1 w-full max-w-2xl mx-auto bg-slate-100/80 border border-slate-300 shadow-inner hover:border-slate-400 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-brand-blue/30 focus-within:border-brand-blue focus-within:bg-white transition-all min-h-[46px]">
            <Search size={16} className="text-slate-500 mr-2 shrink-0" />
            <input 
              type="text" 
              placeholder={`Buscar en la papelera...`}
              className="bg-transparent border-none outline-none w-full text-sm font-bold text-slate-800 placeholder:text-slate-500 min-w-0"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-slate-500 hover:text-slate-800 transition-colors ml-1 shrink-0 p-1 bg-slate-200 hover:bg-slate-300 rounded-full">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 text-[8px] sm:text-[10px] font-bold text-amber-600 bg-amber-50 px-3 sm:px-4 py-2 rounded-xl border border-amber-100 shrink-0 w-full sm:w-auto text-center sm:text-left whitespace-normal sm:whitespace-nowrap">
            <Clock size={14} className="shrink-0" />
            <span>LIMPIEZA AUTOMÁTICA EN 30 DÍAS</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {activeSubTab === 'activities' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredActivities.length > 0 ? (
                filteredActivities.map(activity => (
                  <div key={activity.id} className="relative p-6 bg-white border-2 border-slate-100 rounded-[2rem] hover:shadow-2xl hover:border-brand-blue/10 transition-all duration-300 flex flex-col h-full">
                    <div className="space-y-4 mb-auto">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-500 border border-slate-100 shadow-inner group-hover:scale-110 transition-transform">
                        <Trash2 size={24} />
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-black text-slate-800 mb-1 line-clamp-1">{activity.title}</h4>
                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{activity.description}</p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-4">
                      <div className="flex items-center justify-between">
                         <div className="flex gap-2">
                          <button 
                            onClick={() => onRestore('activity', activity.id)}
                            className="px-6 py-2 bg-brand-blue text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-blue-dark transition-all flex items-center justify-center gap-2"
                          >
                            <RotateCcw size={14} />
                            Restaurar
                          </button>
                          <button 
                            onClick={() => onPermanentDelete('activity', activity.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                            title="Eliminar permanentemente"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                           {activity.deletedAt && (
                             <span className={cn(
                               "text-[9px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1",
                               getRemainingDays(activity.deletedAt) <= 5 
                                 ? "bg-red-50 text-red-600 border-red-100 animate-pulse" 
                                 : "bg-amber-50 text-amber-700 border-amber-100"
                             )}>
                               <Clock size={10} />
                               {getRemainingDays(activity.deletedAt)} DÍAS RESTANTES
                             </span>
                           )}
                           <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                             Borrado: {activity.deletedAt ? format(activity.deletedAt.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}
                           </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No hay labores en la papelera" />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTechnicians.length > 0 ? (
                filteredTechnicians.map(tech => (
                  <div key={tech.id} className="relative p-6 bg-white border-2 border-slate-100 rounded-[2rem] hover:shadow-2xl hover:border-brand-blue/10 transition-all duration-300 flex flex-col h-full">
                    <div className="flex items-start gap-4 mb-auto">
                      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-500 border border-slate-100 shadow-inner shrink-0 transition-transform">
                        <Trash2 size={28} />
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-black text-slate-800 leading-none">{tech.name}</h4>
                        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">{tech.employeeId}</p>
                      </div>
                    </div>
                    
                    <div className="mt-6 flex items-end justify-between">
                      <div className="flex gap-2">
                        <button 
                           onClick={() => onRestore('technician', tech.id)}
                           className="px-6 py-2 bg-brand-blue text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-blue-dark transition-all flex items-center justify-center gap-2"
                        >
                          <RotateCcw size={14} />
                          Activar
                        </button>
                        <button 
                           onClick={() => onPermanentDelete('technician', tech.id)}
                           className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                         {tech.deletedAt && (
                           <span className={cn(
                             "text-[9px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1",
                             getRemainingDays(tech.deletedAt) <= 5 
                               ? "bg-red-50 text-red-600 border-red-100 animate-pulse" 
                               : "bg-amber-50 text-amber-700 border-amber-100"
                           )}>
                             <Clock size={10} />
                             {getRemainingDays(tech.deletedAt)} DÍAS RESTANTES
                           </span>
                         )}
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                           Baja: {tech.deletedAt ? format(tech.deletedAt.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}
                         </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No hay personal en la papelera" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="col-span-full h-64 flex flex-col items-center justify-center text-slate-300 gap-4">
      <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center border border-dashed border-slate-200">
        <AlertCircle size={32} />
      </div>
      <p className="text-sm font-bold uppercase tracking-widest">{message}</p>
    </div>
  );
}
