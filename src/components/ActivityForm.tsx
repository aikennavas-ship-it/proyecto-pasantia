import React from 'react';
import { ActivityType, Technician } from '../types';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ActivityFormProps {
  onSubmit: (data: any) => void;
  onClose: () => void;
  initialData?: any;
  technicians?: Technician[];
  initialDate?: Date;
}

export default function ActivityForm({ onSubmit, onClose, initialData, technicians = [], initialDate }: ActivityFormProps) {
  const [formData, setFormData] = React.useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    incidentNumber: initialData?.incidentNumber || '',
    fleet: initialData?.fleet || '',
    type: initialData?.type || 'datos',
    technicianName: initialData?.technicianName || '',
    startTime: initialData?.startTime || '08:00',
    endTime: initialData?.endTime || '16:00',
    hasPerDiem: initialData?.hasPerDiem || false,
    perDiemAmount: initialData?.perDiemAmount?.toString() || '',
    participants: initialData?.participants || [] as string[],
    date: initialData?.date ? initialData.date.toDate() : (initialDate || new Date()),
  });

  const toggleParticipant = (name: string) => {
    const current = [...formData.participants];
    const index = current.indexOf(name);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(name);
    }
    setFormData({ ...formData, participants: current });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate overtime if both times are present
    let overtimeHours = 0;
    if (formData.startTime && formData.endTime) {
      const start = new Date(`2000-01-01T${formData.startTime}`);
      const end = new Date(`2000-01-01T${formData.endTime}`);
      
      let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (diff < 0) diff += 24; // Handle shift crossing midnight
      
      const STANDARD_HOURS = 8;
      let rawOvertime = diff - STANDARD_HOURS;
      
      // Umbral de tolerancia de 15 minutos (0.25 horas) para evitar registrar sobretiempo/deficit minúsculo
      const GRACE_PERIOD = 15 / 60; 
      
      if (Math.abs(rawOvertime) <= GRACE_PERIOD) {
        overtimeHours = 0;
      } else {
        overtimeHours = Number(rawOvertime.toFixed(2));
      }
    }

    onSubmit({
      ...formData,
      perDiemAmount: formData.perDiemAmount ? Number(formData.perDiemAmount) : 0,
      overtimeHours,
      technicianName: formData.participants[0] || 'Sin asignar', // Primario
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {initialData ? 'Editar Actividad' : 'Nueva Actividad'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">Registro de labores, sobretiempos y viáticos - Central 4357</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Título de la Actividad</label>
              <input
                required
                type="text"
                className="input-field"
                placeholder="Ej: Mantenimiento de Fibra Óptica"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Nro de Incidente</label>
              <input
                type="text"
                className="input-field font-mono text-sm"
                placeholder="Ej: INC-2024-001"
                value={formData.incidentNumber}
                onChange={e => setFormData({ ...formData, incidentNumber: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Flota (Vehículo)</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej: Hilux 21 / V-456"
                value={formData.fleet}
                onChange={e => setFormData({ ...formData, fleet: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Fecha de Ejecución</label>
              <input
                required
                type="date"
                className="input-field"
                value={formData.date instanceof Date ? formData.date.toISOString().split('T')[0] : ''}
                onChange={e => setFormData({ ...formData, date: new Date(e.target.value + 'T00:00:00') })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Descripción de las Labores</label>
            <textarea
              required
              rows={3}
              className="input-field resize-none"
              placeholder="Describa las labores realizadas con precisión técnica para el reporte administrativo..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Tipo</label>
              <select className="input-field" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })}>
                <option value="datos">Datos</option>
                <option value="provisión">Provisión</option>
                <option value="transmisión">Transmisión</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Hora Inicio</label>
              <input type="time" className="input-field" value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Hora Fin</label>
              <input type="time" className="input-field" value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 border border-slate-100 rounded-3xl bg-slate-50/50 space-y-4 md:col-span-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-widest">Viáticos</label>
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded-lg text-brand-blue border-slate-200 focus:ring-brand-blue/20"
                  checked={formData.hasPerDiem}
                  onChange={e => setFormData({ ...formData, hasPerDiem: e.target.checked })}
                />
              </div>
              {formData.hasPerDiem && (
                <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-bold text-slate-400 italic">Monto Estimado</label>
                  <input
                    type="number"
                    className="input-field h-10 text-sm font-bold"
                    placeholder="0.00"
                    value={formData.perDiemAmount}
                    onChange={e => {
                      const val = e.target.value;
                      // Remove leading zeros formatting issue
                      const cleanedVal = val.replace(/^0+/, '') || (val === '0' ? '0' : '');
                      setFormData({ ...formData, perDiemAmount: cleanedVal });
                    }}
                  />
                </div>
              )}
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Técnicos Participantes</label>
              <div className="p-4 border border-slate-200 rounded-2xl bg-white max-h-40 overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 gap-2">
                {technicians.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2 col-span-full">No hay técnicos registrados. Regístralos en la sección 'Personal'.</p>
                ) : (
                  technicians.map(tech => (
                    <button
                      key={tech.id}
                      type="button"
                      onClick={() => toggleParticipant(tech.name)}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-xl border text-left transition-all",
                        formData.participants.includes(tech.name)
                          ? "bg-brand-blue text-white border-brand-blue shadow-md shadow-brand-blue/10"
                          : "bg-white text-slate-600 border-slate-100 hover:border-slate-300"
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        formData.participants.includes(tech.name) ? "bg-white" : "bg-slate-300"
                      )} />
                      <span className="text-xs font-bold truncate">{tech.name}</span>
                    </button>
                  ))
                )}
              </div>
              <p className="text-[10px] text-slate-400 italic font-medium mt-1">* Seleccione todos los técnicos que colaboraron en esta labor.</p>
            </div>
          </div>

          <div className="pt-6 flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-3.5 text-slate-600 font-bold hover:bg-slate-100 rounded-2xl transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={formData.participants.length === 0} className="flex-1 btn-primary py-3.5 rounded-2xl shadow-xl shadow-brand-blue/20 disabled:opacity-50">
              {initialData ? 'Guardar Cambios' : 'Confirmar Reporte Técnico'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

