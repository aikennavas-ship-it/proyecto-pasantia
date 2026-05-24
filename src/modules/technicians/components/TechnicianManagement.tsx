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

  const filteredTechs = React.useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return technicians;

    // 1. C.I. (Cedula): If query starts with "v-" (or "v" followed by numbers/dash)
    const isCISearch = query.startsWith('v-') || (query.startsWith('v') && (query === 'v' || /\d/.test(query)));

    // 2. POO: If query contains only numbers directly
    const isNumeric = /^\d+$/.test(query);

    return technicians.filter(t => {
      const name = (t.name || '').toLowerCase();
      const idCard = (t.idCard || '').toLowerCase();
      const employeeId = (t.employeeId || '').toLowerCase();

      if (isCISearch) {
        // Compare stripped characters for matching e.g., 'v-12.345.678' easily
        const cleanQuery = query.replace(/[^a-z0-9]/g, '');
        const cleanIdCard = idCard.replace(/[^a-z0-9]/g, '');
        return cleanIdCard.includes(cleanQuery);
      }

      if (isNumeric) {
        // Search by POO (employeeId) directly
        const cleanQuery = query.replace(/[^0-9]/g, '');
        const cleanEmployeeId = employeeId.replace(/[^0-9]/g, '');
        return cleanEmployeeId.includes(cleanQuery);
      }

      // Default: Search by Name when typing letters
      return name.includes(query);
    });
  }, [technicians, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.02),0_15px_35px_rgba(0,0,0,0.06)] border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full xl:w-auto">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-brand-blue to-blue-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-brand-blue/15 shrink-0">
            <Shield size={26} className="sm:size-7" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-display font-black text-slate-900 tracking-tight uppercase truncate">Personal y Accesos</h2>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Control de Usuarios y ROLES</p>
              <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-slate-300" />
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1">
                Central Maracay 4357
              </p>
            </div>
          </div>
        </div>
        {onAddTechnician && (
          <button 
            onClick={() => setIsFormOpen(true)}
            className="w-full xl:w-auto px-6 py-2.5 bg-brand-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:bg-brand-blue-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <UserPlus size={18} />
            <span>Registrar Nuevo</span>
          </button>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="flex items-center w-full max-w-md bg-slate-100/80 border border-slate-300 shadow-inner hover:border-slate-400 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-brand-blue/30 focus-within:border-brand-blue focus-within:bg-white transition-all min-h-[46px]">
            <Search size={16} className="text-slate-500 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Buscar por nombre, C.I o P00..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-sm font-bold text-slate-800 placeholder:text-slate-500 min-w-0"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-slate-500 hover:text-slate-800 transition-colors ml-1 shrink-0 p-1 bg-slate-200 hover:bg-slate-300 rounded-full">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-[11px] font-extrabold text-slate-900 uppercase tracking-widest border-b-2 border-slate-300">
                <th className="px-6 py-4">Usuario / Técnico</th>
                <th className="px-6 py-4">Rol Sistema</th>
                <th className="px-6 py-4">P00</th>
                <th className="px-6 py-4 whitespace-nowrap">C.I</th>
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
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-500 mt-1.5 font-medium items-center">
                            <span className="font-mono">{tech.email}</span>
                            <span>•</span>
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold">{tech.specialty}</span>
                            {tech.department && (
                              <>
                                <span>•</span>
                                <span className="bg-blue-50 text-brand-blue border border-blue-100 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">{tech.department}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border",
                        tech.role === 'admin' ? "bg-purple-50 text-purple-600 border-purple-100" : 
                        tech.role === 'supervisor' ? "bg-brand-blue/5 text-brand-blue border-brand-blue/10" : 
                        "bg-slate-50 text-slate-500 border-slate-100"
                      )}>
                        {tech.role === 'admin' ? 'Administrador' : tech.role === 'supervisor' ? 'Supervisor' : 'Técnico'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                        {tech.employeeId || 'S/N'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded whitespace-nowrap inline-block">
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
                      <div className="flex items-center justify-end gap-2">
                        {onEditTechnician && (
                          <button 
                            onClick={() => onEditTechnician(tech)}
                            className="p-1.5 text-slate-500 hover:text-brand-blue transition-all rounded-lg bg-white border border-slate-200 shadow-sm hover:border-brand-blue/30 hover:shadow"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {onDeleteTechnician && (
                          <button 
                            onClick={() => onDeleteTechnician(tech.id, tech.name)}
                            className="p-1.5 text-slate-500 hover:text-red-500 transition-all rounded-lg bg-white border border-slate-200 shadow-sm hover:border-red-500/30 hover:shadow hover:bg-red-50"
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
                      <span className="text-[11px] font-bold text-slate-600">
                        {tech.specialty}
                        {tech.department && <span className="text-brand-blue font-extrabold uppercase"> [{tech.department}]</span>}
                      </span>
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
