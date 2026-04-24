import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Technician } from '../types';

interface TechnicianFormProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: Technician | null;
  technicians: Technician[];
}

export default function TechnicianForm({ onClose, onSubmit, initialData, technicians }: TechnicianFormProps) {
  const predefinedStatuses = ['activo', 'inactivo', 'baja', 'reposo', 'vacaciones'];
  
  // Parse initial status to handle custom 'otro' logic safely
  const initialStatusVal = (initialData?.status || 'activo').toLowerCase();
  const isCustomStatus = !predefinedStatuses.includes(initialStatusVal);

  const [data, setData] = React.useState({
    name: initialData?.name || '',
    employeeId: initialData?.employeeId || 'V-',
    specialty: initialData?.specialty || '', // Empty by default since it is free text now
    phoneNumber: initialData?.phoneNumber || '',
    status: isCustomStatus ? 'otro' : initialStatusVal,
    customStatus: isCustomStatus ? (initialData?.status || '') : ''
  });
  
  const [errorPrompt, setErrorPrompt] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPrompt('');
    
    const finalStatus = data.status === 'otro' ? data.customStatus.trim() : data.status;

    // Check missing fields
    if (!data.name || !data.employeeId || !data.specialty || !data.phoneNumber || !finalStatus) {
      setErrorPrompt('Por favor, rellene todos los campos requeridos del formulario.');
      return;
    }

    // Check duplicate ID
    const isDuplicate = technicians.some(
      t => (t.employeeId || '').toLowerCase() === (data.employeeId || '').toLowerCase() && t.id !== initialData?.id
    );

    if (isDuplicate) {
      setErrorPrompt(`El técnico con número de Carnet/Cédula "${data.employeeId}" ya existe en el sistema. Ingrese uno diferente.`);
      return;
    }

    onSubmit({
      name: data.name,
      employeeId: data.employeeId,
      specialty: data.specialty,
      phoneNumber: data.phoneNumber,
      status: finalStatus
    });
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

        <form onSubmit={handleSubmit} className="p-8 space-y-5 max-h-[85vh] overflow-y-auto custom-scrollbar">
          {errorPrompt && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-start gap-3 animate-in slide-in-from-top-2">
              <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs font-bold text-red-600">{errorPrompt}</p>
            </div>
          )}
          
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
              onChange={e => {
                let val = e.target.value;
                if (!val.startsWith('V-')) {
                  // If they deleted V-, just put it back for them or let them type correctly
                  val = 'V-' + val.replace(/v-?/i, '');
                }
                // Also uppercase the v just in case
                val = val.toUpperCase().replace('v-', 'V-');
                setData({ ...data, employeeId: val });
              }}
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Número de Teléfono</label>
            <input
              required
              type="tel"
              className="input-field"
              placeholder="Ej: 0412-1234567"
              value={data.phoneNumber}
              onChange={e => setData({ ...data, phoneNumber: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Especialidad / Cargo</label>
            <input
              required
              type="text"
              className="input-field"
              placeholder="Especifique el cargo o especialidad..."
              value={data.specialty}
              onChange={e => setData({ ...data, specialty: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Estado Administrativo</label>
            <select
              required
              className="input-field"
              value={data.status}
              onChange={e => setData({ ...data, status: e.target.value })}
            >
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="baja">Baja</option>
              <option value="reposo">Reposo</option>
              <option value="vacaciones">Vacaciones</option>
              <option value="otro">Otro (Especificar)</option>
            </select>
          </div>
          
          {data.status === 'otro' && (
            <div className="space-y-1 animate-in slide-in-from-top-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Especificar Estado</label>
              <input
                required
                type="text"
                className="input-field"
                placeholder="Ej: Permiso no remunerado..."
                value={data.customStatus}
                onChange={e => setData({ ...data, customStatus: e.target.value })}
              />
            </div>
          )}

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
