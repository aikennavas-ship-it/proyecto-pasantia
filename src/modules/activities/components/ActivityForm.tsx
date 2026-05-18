import React from 'react';
import { ActivityType, Technician } from '../../../types';
import { X, AlertCircle } from 'lucide-react';
import { cn, formatIncidentNumber } from '../../../lib/utils';

export function formatHours(decimalHours: number): string {
  if (!decimalHours || decimalHours === 0) return '0h';
  const isNegative = decimalHours < 0;
  const absoluteDecimal = Math.abs(decimalHours);
  const hours = Math.floor(absoluteDecimal);
  const minutes = Math.round((absoluteDecimal - hours) * 60);
  
  const sign = isNegative ? '-' : '';
  if (hours > 0 && minutes > 0) return `${sign}${hours}h ${minutes}m`;
  if (hours > 0) return `${sign}${hours}h`;
  return `${sign}${minutes}m`;
}

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
    incidentNumber: initialData?.incidentNumber ? formatIncidentNumber(initialData.incidentNumber) : '',
    fleet: initialData?.fleet || '',
    region: initialData?.region || 'Central',
    technicianName: initialData?.technicianName || '',
    startTimeMorning: initialData?.startTimeMorning || initialData?.startTime || '07:45',
    endTimeMorning: initialData?.endTimeMorning || '11:45',
    hasPause: initialData?.hasPause || 'SI',
    startTimeAfternoon: initialData?.startTimeAfternoon || '12:45',
    endTimeAfternoon: initialData?.endTimeAfternoon || initialData?.endTime || '16:00',
    hasPerDiem: initialData?.hasPerDiem || false,
    perDiemAmount: initialData?.perDiemAmount?.toString() || '',
    participants: (initialData?.participants && initialData.participants.length > 0) 
      ? initialData.participants 
      : (initialData?.technicianName ? [initialData.technicianName] : []) as string[],
    justification: initialData?.justification || '',
    documentation: initialData?.documentation || 'NO', // 'SI' o 'NO'
    driver: initialData?.driver || '',
    date: (function() {
      if (!initialData?.date) return initialDate || new Date();
      if (typeof initialData.date.toDate === 'function') return initialData.date.toDate();
      const d = new Date(initialData.date);
      return isNaN(d.getTime()) ? (initialDate || new Date()) : d;
    })(),
  });

  const [errorPrompt, setErrorPrompt] = React.useState('');

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

  const getTodayStr = () => {
    const now = new Date();
    const offset = -4; // UTC-4 Maracay
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const maracayTime = new Date(utc + (3600000 * offset));
    return maracayTime.toISOString().split('T')[0];
  };

  const todayStr = getTodayStr();

  // Helper to robustly parse "HH:MM" to decimal hours
  const parseTime = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) + (m || 0) / 60;
  };

  // Calculate current OT for justification validation
  const currentOT = React.useMemo(() => {
    let virtualMorning = 0;
    if (formData.startTimeMorning && formData.endTimeMorning) {
        let em = parseTime(formData.endTimeMorning);
        let sm = parseTime(formData.startTimeMorning);
        if (em < sm) em += 24;
        virtualMorning = (em - 11.75) + 4; // Base de 4h
    }

    let virtualAfternoon = 0;
    let saTime = 0;
    if (formData.startTimeAfternoon && formData.endTimeAfternoon) {
        saTime = parseTime(formData.startTimeAfternoon);
        let ea = parseTime(formData.endTimeAfternoon);
        if (ea < saTime) ea += 24;
        virtualAfternoon = (ea - 16) + 3.25; // Base de 3.25h
    }

    let virtualTotal = virtualMorning + virtualAfternoon;
    let otHours = virtualTotal - 7.25; // Jornada de 7.25h

    if (formData.hasPause === 'NO' && virtualMorning > 0 && virtualAfternoon > 0) {
        otHours += 1;
    }

    return Number(otHours.toFixed(4));
  }, [formData.startTimeMorning, formData.endTimeMorning, formData.startTimeAfternoon, formData.endTimeAfternoon, formData.hasPause]);

  const hasExtraTime = currentOT !== 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPrompt('');

    // Extra strict check
    if (!formData.title || !formData.incidentNumber || !formData.fleet || !formData.region || !formData.date || !formData.description || !formData.startTimeMorning || !formData.endTimeMorning) {
      setErrorPrompt('Todos los campos son obligatorios. Por favor, rellena los datos faltantes.');
      return;
    }

    if (formData.hasPerDiem && !formData.perDiemAmount) {
      setErrorPrompt('Si hay viáticos, debes especificar el monto estimado.');
      return;
    }

    if (formData.participants.length === 0) {
      setErrorPrompt('Debes seleccionar al menos un técnico participante.');
      return;
    }
    
    if (hasExtraTime && (!formData.justification || formData.justification.trim().length === 0)) {
      setErrorPrompt(currentOT > 0 
        ? 'Existe un sobretiempo calculado. Debes justificarlo obligatoriamente.'
        : 'Existe un déficit de horas. Debes justificar el motivo obligatoriamente.'
      );
      return;
    }

    let totalWorkedHours = 0;
    let emTime = 0;
    let saTime = 0;
    
    // 1. Morning Shift
    if (formData.startTimeMorning && formData.endTimeMorning) {
      const sm = parseTime(formData.startTimeMorning);
      let em = parseTime(formData.endTimeMorning);
      
      emTime = em;

      if (em >= 15 && sm < 12) {
         setErrorPrompt(`Ha colocado "Salida Mañana" en horario PM (${formData.endTimeMorning}). Revise si debió ser AM.`);
         return;
      }

      if (em < sm) {
          em += 24;
      }
      totalWorkedHours += (em - sm);
    }

    // 2. Afternoon Shift
    if (formData.startTimeAfternoon && formData.endTimeAfternoon) {
      saTime = parseTime(formData.startTimeAfternoon);
      let ea = parseTime(formData.endTimeAfternoon);

      if (ea < saTime) {
          ea += 24;
      }
      totalWorkedHours += (ea - saTime);
    }

    // 3. Pause Logic
    if (formData.hasPause === 'NO' && emTime > 0 && saTime > 0) {
      let gap = saTime - emTime;
      if (gap < 0) gap += 24;
      totalWorkedHours += gap;
    }

    // Safety checks
    if (isNaN(totalWorkedHours)) {
      setErrorPrompt('Error al calcular las horas. Revise los formatos de tiempo.');
      return;
    }
    
    // 4. Overtime (ST) and Deficit (DF) calculation
    // Según instrucciones: Al llegar a las 4:00 PM no hay DF ni ST importando la hora de entrada.
    // Solo las salidas temprano generan DF, y las salidas tarde generan ST.
    let virtualMorning = 0;
    if (formData.startTimeMorning && formData.endTimeMorning) {
        let em = parseTime(formData.endTimeMorning);
        if (em < parseTime(formData.startTimeMorning)) em += 24;
        virtualMorning = (em - 11.75) + 4; // Base de 4h
    }

    let virtualAfternoon = 0;
    if (formData.startTimeAfternoon && formData.endTimeAfternoon) {
        let ea = parseTime(formData.endTimeAfternoon);
        if (ea < saTime) ea += 24;
        virtualAfternoon = (ea - 16) + 3.25; // Base de 3.25h
    }

    let virtualTotal = virtualMorning + virtualAfternoon;
    let otHours = virtualTotal - 7.25; // Jornada de 7.25h

    if (formData.hasPause === 'NO' && virtualMorning > 0 && virtualAfternoon > 0) {
        otHours += 1;
    }

    let overtimeHours = Number(otHours.toFixed(4));

    
    // Sanity check for extremely high values (> 24h)
    if (totalWorkedHours > 20) {
        setErrorPrompt("La jornada total excede las 20 horas. Verifique los horarios (AM/PM).");
        return;
    }

    try {
      await onSubmit({
        ...formData,
        justification: hasExtraTime ? formData.justification : 'No aplica. Jornada estándar sin sobretiempo ni déficit.',
        perDiemAmount: formData.perDiemAmount ? Number(formData.perDiemAmount) : 0,
        overtimeHours,
        totalHours: Number(totalWorkedHours.toFixed(4)),
        technicianName: formData.participants[0] || 'Sin asignar', // Primario
      });
    } catch (err) {
      console.error("Error submitting form:", err);
      setErrorPrompt("Error al guardar la actividad. Verifique la conexión o intente recargar la página.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="min-w-0 pr-4">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
              {initialData ? 'Editar Actividad' : 'Nueva Actividad'}
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Labores, sobretiempos y viáticos</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition-colors shrink-0">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {errorPrompt && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-start gap-3 animate-in slide-in-from-top-2">
              <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs font-bold text-red-600">{errorPrompt}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1 md:col-span-2">
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
                required
                type="text"
                className="input-field font-mono text-sm"
                placeholder="INC-2024-001"
                value={formData.incidentNumber}
                onChange={e => setFormData({ ...formData, incidentNumber: formatIncidentNumber(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Flota (Vehículo)</label>
              <input
                required
                type="text"
                className="input-field"
                placeholder="Ej: Hilux 21 / V-456"
                value={formData.fleet}
                onChange={e => setFormData({ ...formData, fleet: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Región</label>
              <input
                required
                type="text"
                className="input-field"
                placeholder="Ej: Central"
                value={formData.region}
                onChange={e => setFormData({ ...formData, region: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Fecha de Ejecución</label>
              <input
                required
                type="date"
                className="input-field"
                max={todayStr}
                value={(function() {
                  try {
                    return formData.date instanceof Date && !isNaN(formData.date.getTime()) 
                      ? formData.date.toISOString().split('T')[0] 
                      : '';
                  } catch (e) {
                    return '';
                  }
                })()}
                onChange={e => {
                  const val = e.target.value;
                  if (val) {
                    setFormData({ ...formData, date: new Date(val + 'T00:00:00') });
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Documentación</label>
              <select 
                className="input-field" 
                value={formData.documentation} 
                onChange={e => setFormData({ ...formData, documentation: e.target.value })}
              >
                <option value="NO">NO</option>
                <option value="SI">SI</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Manejo (Chofer)</label>
              <input
                type="text"
                className="input-field"
                placeholder="Nombre de quien manejó"
                value={formData.driver}
                onChange={e => setFormData({ ...formData, driver: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Descripción de las Labores</label>
              <span className={cn(
                "text-[10px] font-bold",
                formData.description.length > 1400 ? "text-red-500" : "text-slate-400"
              )}>
                {formData.description.length} / 1500
              </span>
            </div>
            <textarea
              required
              rows={4}
              maxLength={1500}
              className="input-field resize-none h-32"
              placeholder="Describa las labores realizadas con precisión técnica para el reporte administrativo..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className={cn(
                "text-[11px] font-bold uppercase tracking-wider ml-1",
                hasExtraTime ? "text-brand-blue" : "text-slate-400"
              )}>
                Justificación {hasExtraTime && (currentOT > 0 ? '(Sobretiempo)' : '(Déficit)')}
              </label>
              <span className={cn(
                "text-[10px] font-bold",
                formData.justification.length > 1400 ? "text-red-500" : "text-slate-400"
              )}>
                {formData.justification.length} / 1500
              </span>
            </div>
            <textarea
              required={hasExtraTime}
              disabled={!hasExtraTime}
              rows={3}
              maxLength={1500}
              className={cn(
                "input-field resize-none h-24 transition-opacity",
                !hasExtraTime && "opacity-50 bg-slate-50 cursor-not-allowed"
              )}
              placeholder={hasExtraTime ? `Explique el motivo del ${currentOT > 0 ? 'sobretiempo' : 'déficit'}...` : "El tiempo calculado es estándar. No requiere justificación."}
              value={hasExtraTime ? formData.justification : 'Jornada estándar sin sobretiempo ni déficit.'}
              onChange={e => setFormData({ ...formData, justification: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Entrada Mañana</label>
              <input required type="time" className="input-field text-sm" value={formData.startTimeMorning} onChange={e => setFormData({ ...formData, startTimeMorning: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Salida Mañana</label>
              <input required type="time" className="input-field text-sm" value={formData.endTimeMorning} onChange={e => setFormData({ ...formData, endTimeMorning: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Pausa</label>
              <select className="input-field text-sm" value={formData.hasPause} onChange={e => setFormData({ ...formData, hasPause: e.target.value })}>
                <option value="SI">SI</option>
                <option value="NO">NO</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Entrada Tarde</label>
              <input required type="time" className="input-field text-sm" value={formData.startTimeAfternoon} onChange={e => setFormData({ ...formData, startTimeAfternoon: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Salida Tarde</label>
              <input required type="time" className="input-field text-sm" value={formData.endTimeAfternoon} onChange={e => setFormData({ ...formData, endTimeAfternoon: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  <label className="text-[10px] font-bold text-slate-400 italic">Monto Estimado (Bs.)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="input-field h-10 text-sm font-bold"
                    placeholder="0.00"
                    value={formData.perDiemAmount}
                    onChange={e => {
                      setFormData({ ...formData, perDiemAmount: e.target.value });
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
                        "w-2 h-2 rounded-full shrink-0",
                        formData.participants.includes(tech.name) ? "bg-white" : "bg-slate-300"
                      )} />
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-xs font-bold truncate">{tech.name}</span>
                        <span className={cn(
                          "text-[9px] font-mono",
                          formData.participants.includes(tech.name) ? "text-white/80" : "text-slate-400"
                        )}>{tech.employeeId}</span>
                      </div>
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

