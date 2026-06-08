import React from 'react';
import { Trash2, RotateCcw, AlertCircle, Clock, Search, X } from 'lucide-react';
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

  const formatDeletedDate = (deletedAt: any) => {
    if (!deletedAt) return 'N/A';
    try {
      const d = deletedAt.toDate ? deletedAt.toDate() : new Date(deletedAt);
      return format(d, "dd/MM/yyyy 'a las' hh:mm a", { locale: es });
    } catch (e) {
      return 'N/A';
    }
  };

  const filteredActivities = deletedActivities.filter(a => 
    (a.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.incidentNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.region || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTechnicians = deletedTechnicians.filter(t => 
    (t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.idCard || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.specialty || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalItems = deletedActivities.length + deletedTechnicians.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Container */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.02),0_15px_35px_rgba(0,0,0,0.06)] border border-slate-200 animate-in fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full xl:w-auto">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-brand-blue to-blue-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-brand-blue/15 shrink-0">
            <Trash2 size={26} className="sm:size-7" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-display font-black text-slate-900 tracking-tight uppercase truncate">Papelera de Reciclaje</h2>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Elementos borrados hace menos de 30 días</p>
            </div>
          </div>
        </div>
        
        {/* Header Action Buttons & Tabs */}
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
                className="bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-red-600 hover:border-red-700 transition-all shrink-0 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                title="Elimina permanentemente todos los elementos de la papelera de forma irreversible"
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

      {/* Main Container */}
      <div className="glass-card overflow-hidden min-h-[500px] flex flex-col p-0 bg-white">
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full pb-4">
          <div className="flex items-center w-full max-w-md bg-slate-100/80 border border-slate-300 shadow-inner hover:border-slate-400 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-brand-blue/30 focus-within:border-brand-blue focus-within:bg-white transition-all min-h-[46px]">
            <Search size={16} className="text-slate-500 mr-2 shrink-0" />
            <input 
              type="text" 
              placeholder="Buscar en la papelera..."
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
          <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-3.5 py-2 rounded-xl border border-amber-100 shrink-0 w-full sm:w-auto text-center sm:text-left tracking-wider uppercase">
            <Clock size={14} className="shrink-0" />
            <span>LIMPIEZA AUTOMÁTICA EN 30 DÍAS</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/20">
          {activeSubTab === 'activities' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
              {filteredActivities.length > 0 ? (
                filteredActivities.map(activity => (
                  <div key={activity.id} className="relative p-5 bg-slate-50 border border-slate-200 shadow-sm rounded-2xl hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col h-full justify-between">
                    <div>
                      {/* Top Header Row of Card */}
                      <div className="w-full">
                        <h4 className="text-sm font-bold text-slate-800 tracking-tight leading-snug truncate" title={activity.title}>{activity.title}</h4>
                      </div>
                      
                      {/* Content Area */}
                      <div className="space-y-3 mt-3">
                        {/* Audit context (incident, region, and remaining days) */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[9px] font-black px-2 py-0.5 bg-slate-100 border border-slate-200/80 text-slate-600 rounded">
                            {activity.incidentNumber ? `${activity.incidentNumber}` : 'LABOR SIN INC.'}
                          </span>
                          <span className="text-[9px] font-black px-2 py-0.5 bg-blue-50 border border-blue-100/60 text-brand-blue rounded uppercase tracking-wider">
                            {activity.region || 'Central'}
                          </span>
                          {activity.deletedAt && (
                            <span className="text-amber-700 bg-amber-50 border border-amber-200/60 text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                              ⚠️ {getRemainingDays(activity.deletedAt)} días restantes
                            </span>
                          )}
                        </div>
 
                        <div className="bg-white border border-slate-100 rounded-xl p-3.5 text-xs text-slate-500 leading-relaxed mt-4 font-medium min-h-[72px] line-clamp-4">
                          {activity.description}
                        </div>
                      </div>
 
                      {/* Audit Details */}
                      <div className="mt-4 flex flex-col gap-0.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                        <div>Borrado por: <span className="text-slate-500">{activity.deletedBy || 'Aiken Navas'}</span></div>
                        <div>Fecha de borrado: <span className="text-slate-500">{formatDeletedDate(activity.deletedAt)}</span></div>
                      </div>
                    </div>
 
                    {/* Action buttons footer with base line */}
                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
                      <button 
                        onClick={() => onRestore('activity', activity.id)}
                        className="px-4 py-2 bg-[#004a99] hover:bg-blue-800 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm flex items-center gap-1.5 transition-colors focus:outline-none"
                      >
                        <RotateCcw size={12} />
                        Restaurar
                      </button>
                      <button 
                        onClick={() => onPermanentDelete('activity', activity.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar permanentemente de la base de datos"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No hay labores en la papelera" />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
              {filteredTechnicians.length > 0 ? (
                filteredTechnicians.map(tech => (
                  <div key={tech.id} className="relative p-5 bg-slate-50 border border-slate-200 shadow-sm rounded-2xl hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col h-full justify-between">
                    <div>
                      {/* Top Header Row representing technician card */}
                      <div className="w-full">
                        <h4 className="text-sm font-bold text-slate-800 tracking-tight leading-snug truncate" title={tech.name}>
                          {tech.name}
                        </h4>
                      </div>
 
                      {/* Content Area */}
                      <div className="space-y-3 mt-3">
                        {/* Name and IDs */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[9px] font-black px-2 py-0.5 bg-slate-100 border border-slate-200/80 text-slate-600 rounded" title="P00 / CARNET">
                            P00: {tech.employeeId}
                          </span>
                          <span className="font-mono text-[9px] font-black px-2 py-0.5 bg-blue-50 border border-blue-100/60 text-brand-blue rounded" title="Cédula de Identidad">
                            C.I.: {tech.idCard || 'V-S/N'}
                          </span>
                        </div>
 
                        {/* Structural Department/Specialty */}
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100/50 rounded-md shrink-0">
                            {tech.specialty || 'General'}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100/50 rounded-md shrink-0">
                            {tech.department || 'DATOS'}
                          </span>
                          {tech.deletedAt && (
                            <span className="text-amber-700 bg-amber-50 border border-amber-200/60 text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                              ⚠️ {getRemainingDays(tech.deletedAt)} días
                            </span>
                          )}
                        </div>
                      </div>
 
                      {/* Audit Details */}
                      <div className="mt-4 flex flex-col gap-0.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                        <div>Dado de baja por: <span className="text-slate-500">{tech.deletedBy || 'Aiken Navas'}</span></div>
                        <div>Fecha de baja: <span className="text-slate-500">{formatDeletedDate(tech.deletedAt)}</span></div>
                      </div>
                    </div>
 
                    {/* Action buttons footer with base line */}
                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
                      <button 
                        onClick={() => onRestore('technician', tech.id)}
                        className="px-4 py-2 bg-[#004a99] hover:bg-blue-800 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm flex items-center gap-1.5 transition-colors focus:outline-none"
                      >
                        <RotateCcw size={12} />
                        Restaurar
                      </button>
                      <button 
                        onClick={() => onPermanentDelete('technician', tech.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar permanentemente de la base de datos"
                      >
                        <Trash2 size={16} />
                      </button>
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
