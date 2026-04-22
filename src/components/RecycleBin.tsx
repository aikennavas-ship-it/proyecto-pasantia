import React from 'react';
import { Trash2, RotateCcw, AlertCircle, Clock, Search, Filter } from 'lucide-react';
import { Activity, Technician } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RecycleBinProps {
  deletedActivities: Activity[];
  deletedTechnicians: Technician[];
  onRestore: (type: 'activity' | 'technician', id: string) => void;
  onPermanentDelete: (type: 'activity' | 'technician', id: string) => void;
}

export default function RecycleBin({ 
  deletedActivities, 
  deletedTechnicians, 
  onRestore, 
  onPermanentDelete 
}: RecycleBinProps) {
  const [activeSubTab, setActiveSubTab] = React.useState<'activities' | 'technicians'>('activities');
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredActivities = deletedActivities.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTechnicians = deletedTechnicians.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Papelera de Reciclaje</h2>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Recupera elementos borrados en los últimos 30 días</p>
        </div>
        
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

      <div className="glass-card overflow-hidden min-h-[500px] flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder={`Buscar en la papelera...`}
              className="input-field pl-10 h-10 text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-4 py-2 rounded-xl border border-amber-100">
            <Clock size={14} />
            <span>LIMPIEZA AUTOMÁTICA EN 30 DÍAS</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {activeSubTab === 'activities' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredActivities.length > 0 ? (
                filteredActivities.map(activity => (
                  <div key={activity.id} className="relative group p-6 bg-slate-50 border border-slate-100 rounded-[2rem] hover:shadow-xl transition-all duration-300">
                    <div className="absolute top-4 right-4">
                       <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                         Borrado: {activity.deletedAt ? format(activity.deletedAt.toDate(), 'dd/MM/yy') : 'N/A'}
                       </span>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100">
                        <Trash2 size={24} />
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-black text-slate-800 mb-1 line-clamp-1">{activity.title}</h4>
                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{activity.description}</p>
                      </div>

                      <div className="pt-4 flex gap-2">
                        <button 
                          onClick={() => onRestore('activity', activity.id)}
                          className="flex-1 py-2 bg-brand-blue text-white text-[10px] font-black uppercase tracking-tighter rounded-xl hover:bg-brand-blue-dark transition-all flex items-center justify-center gap-2"
                        >
                          <RotateCcw size={14} />
                          Restaurar
                        </button>
                        <button 
                          onClick={() => onPermanentDelete('activity', activity.id)}
                          className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Eliminar permanentemente"
                        >
                          <Trash2 size={16} />
                        </button>
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
                  <div key={tech.id} className="relative group p-6 bg-slate-50 border border-slate-100 rounded-[2rem] hover:shadow-xl transition-all duration-300">
                    <div className="absolute top-4 right-4">
                       <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                         Baja: {tech.deletedAt ? format(tech.deletedAt.toDate(), 'dd/MM/yy') : 'N/A'}
                       </span>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100 shadow-sm shrink-0">
                        <Trash2 size={28} />
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        <div>
                          <h4 className="text-sm font-black text-slate-800 leading-none">{tech.name}</h4>
                          <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">{tech.employeeId}</p>
                        </div>
                        
                        <div className="flex gap-2">
                          <button 
                             onClick={() => onRestore('technician', tech.id)}
                             className="flex-1 py-2 bg-brand-blue text-white text-[10px] font-black uppercase tracking-tighter rounded-xl hover:bg-brand-blue-dark transition-all flex items-center justify-center gap-2"
                          >
                            <RotateCcw size={14} />
                            Activar
                          </button>
                          <button 
                             onClick={() => onPermanentDelete('technician', tech.id)}
                             className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
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
