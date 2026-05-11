/**
 * src/modules/technicians/components/TechnicianManagement.tsx
 * 
 * TECHNICIANS MODULE - Gestión de Personal
 * -----------------------------------------
 * Componente principal del módulo de Técnicos. Permite crear, listar, editar
 * y dar de baja (eliminación lógica) al personal.
 * 
 * Nota: Siguiendo Screaming Architecture, este módulo aísla por completo 
 * la manipulación de la colección 'technicians'.
 */
import React from 'react';
import { UserPlus, Search, Shield, BadgeCheck, X, Briefcase, Trash2, Edit2, Phone } from 'lucide-react';
import { Technician } from '../../../types';
import { cn } from '../../../lib/utils';
import TechnicianForm from './TechnicianForm';

interface TechnicianManagementProps {
  technicians: Technician[];
  onAddTechnician?: (data: any) => void;
  onEditTechnician?: (tech: Technician) => void;
  onDeleteTechnician?: (id: string, name: string) => void;
  isLoading: boolean;
}

export default function TechnicianManagement({ technicians, onAddTechnician, onEditTechnician, onDeleteTechnician, isLoading }: TechnicianManagementProps) {
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredTechs = technicians.filter(t => 
    (t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.02),0_15px_35px_rgba(0,0,0,0.06)] border border-slate-200">
        <div className="flex items-center gap-4 w-full">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-brand-blue rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-blue/30 shrink-0">
            <Shield size={28} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-display font-black text-slate-900 tracking-tight truncate">Personal y Accesos</h2>
            <p className="text-xs text-slate-500 font-medium truncate">Control de Usuarios - Gerencia de Datos</p>
          </div>
        </div>
        {onAddTechnician && (
          <button 
            onClick={() => setIsFormOpen(true)}
            className="w-full sm:w-auto px-6 py-2.5 bg-brand-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:bg-brand-blue-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <UserPlus size={18} />
            <span>Registrar Nuevo</span>
          </button>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nombre o carnet..."
              className="input-field pl-10 h-10 text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b-2 border-slate-200">
                <th className="px-6 py-4">Usuario / Técnico</th>
                <th className="px-6 py-4">Rol Sistema</th>
                <th className="px-6 py-4">P00</th>
                <th className="px-6 py-4">C.I</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [1,2,3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4 h-16 bg-slate-50/30"></td>
                  </tr>
                ))
              ) : filteredTechs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                    No se encontraron técnicos registrados.
                  </td>
                </tr>
              ) : (
                filteredTechs.map(tech => (
                  <tr key={tech.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                          <BadgeCheck size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-none">{tech.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-1">{tech.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border",
                        tech.role === 'admin' ? "bg-purple-50 text-purple-600 border-purple-100" : 
                        tech.role === 'supervisor' ? "bg-brand-blue/5 text-brand-blue border-brand-blue/10" : 
                        tech.role === 'none' ? "bg-amber-50 text-amber-600 border-amber-100" :
                        "bg-slate-50 text-slate-500 border-slate-100"
                      )}>
                        {tech.role === 'admin' ? 'Administrador' : tech.role === 'supervisor' ? 'Supervisor' : tech.role === 'none' ? 'Estadística' : 'Técnico'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                        {tech.employeeId || 'S/N'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                        {tech.idCard || 'S/N'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                        tech.status === 'activo' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      )}>
                        {tech.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {onEditTechnician && (
                          <button 
                            onClick={() => onEditTechnician(tech)}
                            className="p-1.5 text-slate-400 hover:text-brand-blue transition-colors rounded-lg hover:bg-white border border-slate-100"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {onDeleteTechnician && (
                          <button 
                            onClick={() => onDeleteTechnician(tech.id, tech.name)}
                            className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden p-4 space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-slate-50 animate-pulse rounded-2xl" />
            ))
          ) : filteredTechs.length === 0 ? (
            <p className="text-center text-slate-400 py-8 italic text-sm">No hay técnicos registrados.</p>
          ) : (
            filteredTechs.map(tech => (
              <div key={tech.id} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                      <BadgeCheck size={20} />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 leading-none">{tech.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">
                        P00: {tech.employeeId || 'S/N'} <span className="opacity-50">|</span> C.I: {tech.idCard || 'S/N'}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full",
                    (tech.status || '').toLowerCase() === 'activo' ? "bg-emerald-50 text-emerald-600" :
                    (tech.status || '').toLowerCase() === 'inactivo' || (tech.status || '').toLowerCase() === 'baja' ? "bg-red-50 text-red-600" :
                    "bg-amber-50 text-amber-600"
                  )}>
                    {tech.status}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Briefcase size={12} className="text-slate-400" />
                      <span className="text-[11px] font-bold text-slate-600">{tech.specialty}</span>
                    </div>
                    {tech.phoneNumber && (
                      <div className="flex items-center gap-2">
                        <Phone size={12} className="text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-600">{tech.phoneNumber}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                     {onEditTechnician && (
                       <button 
                        onClick={() => onEditTechnician(tech)}
                        className="p-2 text-brand-blue bg-brand-blue/5 rounded-lg"
                       >
                        <Edit2 size={14} />
                       </button>
                     )}
                    {onDeleteTechnician && (
                      <button 
                         onClick={() => onDeleteTechnician(tech.id, tech.name)}
                         className="p-2 text-red-500 bg-red-50 rounded-lg"
                      >
                         <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {isFormOpen && (
        <TechnicianForm 
          onClose={() => setIsFormOpen(false)} 
          onSubmit={onAddTechnician}
          technicians={technicians}
        />
      )}
    </div>
  );
}
