import React from 'react';
import { X } from 'lucide-react';
import { Technician } from '../types';

interface TechnicianFormProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: Technician | null;
}

export default function TechnicianForm({ onClose, onSubmit, initialData }: TechnicianFormProps) {
  const [data, setData] = React.useState({
    name: initialData?.name || '',
    employeeId: initialData?.employeeId || '',
    specialty: initialData?.specialty || 'Datos',
    status: initialData?.status || 'activo'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="text-xl font-bold text-slate-900">{initialData ? 'Editar Técnico' : 'Registrar Nuevo Técnico'}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Nombre Completo</label>
            <input
              required
              className="input-field"
              placeholder="Ej: Pedro José Pérez"
              value={data.name}
              onChange={e => setData({ ...data, name: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Carnet / Cédula</label>
            <input
              required
              className="input-field"
              placeholder="Ej: V-12345678"
              value={data.employeeId}
              onChange={e => setData({ ...data, employeeId: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Especialidad</label>
            <select
              className="input-field"
              value={data.specialty}
              onChange={e => setData({ ...data, specialty: e.target.value })}
            >
              <option value="Datos">Datos</option>
              <option value="Transmisión">Transmisión</option>
              <option value="Provisión">Provisión</option>
              <option value="Servicios Auxiliares">Servicios Auxiliares</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Estado Administrativo</label>
            <select
              className="input-field"
              value={data.status}
              onChange={e => setData({ ...data, status: e.target.value as any })}
            >
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo / Baja</option>
            </select>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary py-2.5 rounded-xl"
            >
              {initialData ? 'Guardar Cambios' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
