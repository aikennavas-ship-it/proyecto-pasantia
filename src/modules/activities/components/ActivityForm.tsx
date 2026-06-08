import React from 'react';
import { ActivityType, Technician, UserProfile } from '../../../types';
import { X, AlertCircle } from 'lucide-react';
import { cn, formatIncidentNumber } from '../../../lib/utils';
import { obtenerDatosUsuarioReactivo, obtenerDatosPorIdSecuencial, inicializarTecnicosIdsSeguro } from '../../../utils/resolver';

export function formatHours(decimalHours: number): string {
  if (!decimalHours || decimalHours === 0) return '0h';
  const isNegative = decimalHours < 0;
  const absoluteDecimal = Math.abs(decimalHours);
  const hours = Math.floor(absoluteDecimal);
  const minutes = Math.round((absoluteDecimal - hours) * 60);
  
  const sign = isNegative ? '-' : '';
  if (hours > 0 && minutes > 0) return `${sign}${hours}h ${minutes}min`;
  if (hours > 0) return `${sign}${hours}h`;
  return `${sign}${minutes}min`;
}

interface ActivityFormProps {
  onSubmit: (data: any) => void;
  onClose: () => void;
  initialData?: any;
  technicians?: Technician[];
  initialDate?: Date;
  user?: UserProfile | null;
}

export default function ActivityForm({ onSubmit, onClose, initialData, technicians = [], initialDate, user }: ActivityFormProps) {
  const [formData, setFormData] = React.useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    incidentNumber: initialData?.incidentNumber ? formatIncidentNumber(initialData.incidentNumber) : '',
    fleet: initialData?.fleet || '',
    region: initialData?.region || '',
    technicianName: initialData?.technicianName || '',
    startTimeMorning: initialData?.startTimeMorning || initialData?.startTime || '07:30',
    endTimeMorning: initialData?.endTimeMorning || '11:45',
    hasPause: initialData?.hasPause || 'SI',
    startTimeAfternoon: initialData?.startTimeAfternoon || '12:45',
    endTimeAfternoon: initialData?.endTimeAfternoon || initialData?.endTime || '16:00',
    hasPerDiem: initialData?.hasPerDiem || false,
    perDiemAmount: initialData?.perDiemAmount?.toString() || '',
    tecnicosIds: (function() {
      return inicializarTecnicosIdsSeguro(initialData || {}, technicians);
    })(),
    participants: (initialData?.participants && initialData.participants.length > 0) 
      ? initialData.participants 
      : (initialData?.technicianName ? [initialData.technicianName] : []) as string[],
    justification: initialData?.justification || '',
    driver: initialData?.driver || '',
    code: initialData?.code && initialData.code !== 'HORA' ? initialData.code : 'PRIM',
    cause: initialData?.cause || (initialData?.code && initialData.code !== 'HORA' ? initialData.cause : 'Horas Product. Con Manejo'),
    status: initialData?.status || 'aprobado',
    rejectionReason: initialData?.rejectionReason || '',
    date: (function() {
      if (!initialData?.date) return initialDate || new Date();
      if (typeof initialData.date.toDate === 'function') return initialData.date.toDate();
      const d = new Date(initialData.date);
      return isNaN(d.getTime()) ? (initialDate || new Date()) : d;
    })(),
  });

  const [errorPrompt, setErrorPrompt] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const esSinManejo = formData.cause.toLowerCase().includes('sin manejo');

  React.useEffect(() => {
    if (esSinManejo) {
      setFormData(prev => ({
        ...prev,
        fleet: '',
        driver: 'Ninguno'
      }));
    }
  }, [esSinManejo]);

  const activeTechnicians = React.useMemo(() => {
    return (technicians || []).filter(tech => {
      const isCurrentlySelected = formData.tecnicosIds.includes(tech.uid || tech.id);
      const isActive = tech.status?.toLowerCase().trim() === 'activo';
      return isActive || isCurrentlySelected;
    });
  }, [technicians, formData.tecnicosIds]);

  const toggleParticipant = (techUid: string) => {
    const current = [...formData.tecnicosIds];
    const index = current.indexOf(techUid);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(techUid);
    }
    
    // In addition to updating tecnicosIds, update participants names list for full backward compatibility!
    const resolvedNames = current.map(uid => {
      const u = obtenerDatosUsuarioReactivo(uid, technicians);
      return u.nombreCompleto;
    }).filter(name => name !== "Técnico Desincorporado");

    setFormData({ 
      ...formData, 
      tecnicosIds: current,
      participants: resolvedNames
    });
  };

  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
        virtualMorning = em - sm;
    }

    let virtualAfternoon = 0;
    if (formData.startTimeAfternoon && formData.endTimeAfternoon) {
        let saTime = parseTime(formData.startTimeAfternoon);
        let ea = parseTime(formData.endTimeAfternoon);
        if (ea < saTime) ea += 24;
        virtualAfternoon = ea - saTime;
    }

    let virtualTotal = virtualMorning + virtualAfternoon;
    if (formData.hasPause === 'NO' && virtualMorning > 0 && virtualAfternoon > 0) {
        virtualTotal += 1;
    }

    let otHours = virtualTotal - 7.5; // Jornada de 7.5h (450 min)

    return Number(otHours.toFixed(4));
  }, [formData.startTimeMorning, formData.endTimeMorning, formData.startTimeAfternoon, formData.endTimeAfternoon, formData.hasPause]);

  const hasExtraTime = currentOT !== 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPrompt('');

    // Extra strict check
    if (!formData.title || !formData.incidentNumber || !formData.region || !formData.date || !formData.description || !formData.startTimeMorning || !formData.endTimeMorning || (!esSinManejo && !formData.fleet)) {
      setErrorPrompt('Todos los campos son obligatorios. Por favor, rellena los datos faltantes.');
      return;
    }

    const selectedDateStr = (function() {
      try {
        return formData.date instanceof Date && !isNaN(formData.date.getTime()) 
          ? formData.date.toISOString().split('T')[0] 
          : '';
      } catch (e) {
        return '';
      }
    })();

    if (selectedDateStr && selectedDateStr > todayStr) {
      setErrorPrompt('Límite de Control de CANTV: No se permite registrar ni editar labores en fechas futuras.');
      return;
    }

    if (formData.hasPerDiem) {
      if (!formData.perDiemAmount || formData.perDiemAmount.trim() === '') {
        setErrorPrompt('Si hay viáticos, debes especificar el monto estimado.');
        return;
      }
      const perDiemNum = Number(formData.perDiemAmount);
      if (isNaN(perDiemNum) || perDiemNum < 0) {
        setErrorPrompt('El monto del viático no puede ser un valor negativo o inválido.');
        return;
      }
    }

    if (formData.tecnicosIds.length === 0) {
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
    let virtualMorning = 0;
    if (formData.startTimeMorning && formData.endTimeMorning) {
        let em = parseTime(formData.endTimeMorning);
        let sm = parseTime(formData.startTimeMorning);
        if (em < sm) em += 24;
        virtualMorning = em - sm;
    }

    let virtualAfternoon = 0;
    if (formData.startTimeAfternoon && formData.endTimeAfternoon) {
        let ea = parseTime(formData.endTimeAfternoon);
        if (ea < saTime) ea += 24;
        virtualAfternoon = ea - saTime;
    }

    let virtualTotal = virtualMorning + virtualAfternoon;
    if (formData.hasPause === 'NO' && virtualMorning > 0 && virtualAfternoon > 0) {
        virtualTotal += 1;
    }

    let otHours = virtualTotal - 7.5; // Jornada de 7.5h (450 min)

    let overtimeHours = Number(otHours.toFixed(4));

    
    // Sanity check for extremely high values (> 24h)
    if (totalWorkedHours > 20) {
        setErrorPrompt("La jornada total excede las 20 horas. Verifique los horarios (AM/PM).");
        return;
    }

    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onSubmit({
        ...formData,
        fleet: formData.fleet || (esSinManejo ? 'S/V' : ''),
        driver: formData.driver || (esSinManejo ? 'Ninguno' : ''),
        startTime: formData.startTimeMorning,
        endTime: formData.endTimeAfternoon,
        justification: hasExtraTime ? formData.justification : 'Jornada estándar sin sobretiempo ni déficit.',
        perDiemAmount: formData.perDiemAmount ? Number(formData.perDiemAmount) : 0,
        overtimeHours,
        totalHours: Number(totalWorkedHours.toFixed(4)),
        technicianName: formData.participants[0] || 'Sin asignar', // Primario
      });
      onClose();
    } catch (err) {
      console.error("Error submitting form:", err);
      setIsSubmitting(false);
      setErrorPrompt("Error al guardar la actividad. Verifique la conexión o intente recargar la página.");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4">
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

        <form id="activity-form" onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/10">
          {errorPrompt && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-start gap-3 animate-in slide-in-from-top-2">
              <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs font-bold text-red-600">{errorPrompt}</p>
            </div>
          )}

          {/* Bloque 1: Ficha Técnica (Mantenimiento e Incidentes) */}
          <div className="bg-slate-50/50 border border-slate-200/60 p-5 rounded-xl shadow-sm space-y-4">
            <div className="border-b border-slate-200/60 pb-2 mb-1">
              <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                Detalles de la Labor
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Título de la Actividad */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider mb-1.5 uppercase block">Título de la Actividad</label>
                <input
                  required
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="Ej: Mantenimiento de Fibra Óptica"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              {/* Nro de Incidente */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider mb-1.5 uppercase block">Nro de Incidente</label>
                <input
                  required
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors font-mono"
                  placeholder="INC-2026-05105"
                  value={formData.incidentNumber}
                  onChange={e => setFormData({ ...formData, incidentNumber: formatIncidentNumber(e.target.value) })}
                />
              </div>

              {/* Flota (Vehículo) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider mb-1.5 uppercase block">Flota (Vehículo)</label>
                <input
                  type="text"
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-colors ${esSinManejo ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200 focus:border-slate-200 focus:ring-0' : 'bg-white text-slate-800 border-slate-200 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500'}`}
                  placeholder="Hilux V-21 / V-456"
                  disabled={esSinManejo}
                  value={formData.fleet}
                  onChange={e => setFormData({ ...formData, fleet: e.target.value })}
                />
              </div>

              {/* Región */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider mb-1.5 uppercase block">Región</label>
                <input
                  required
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="Central"
                  value={formData.region}
                  onChange={e => setFormData({ ...formData, region: e.target.value })}
                />
              </div>

              {/* Fecha de Ejecución */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider mb-1.5 uppercase block">Fecha de Ejecución</label>
                <input
                  required
                  type="date"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
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

              {/* Manejo (Chofer) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider mb-1.5 uppercase block">Manejo (Chofer)</label>
                <input
                  type="text"
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-colors ${esSinManejo ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200 focus:border-slate-200 focus:ring-0' : 'bg-white text-slate-800 border-slate-200 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500'}`}
                  placeholder="Carlos Rodríguez"
                  disabled={esSinManejo}
                  value={formData.driver}
                  onChange={e => setFormData({ ...formData, driver: e.target.value })}
                />
              </div>

              {/* Código */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider mb-1.5 uppercase block">Código</label>
                <select 
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors select-with-arrow text-slate-700" 
                  value={formData.code} 
                  onChange={e => {
                    const selectedCode = e.target.value;
                    let preCause = formData.cause;
                    if (selectedCode === 'PRIM') preCause = "Horas Product. Con Manejo";
                    else if (selectedCode === 'PREM') preCause = "Horas Solo Manejo";
                    else if (selectedCode === 'HORS') preCause = "Horas Product. Sin manejo";
                    else if (selectedCode === 'HRDM') preCause = "Horario Dia Libre con Manejo";
                    else if (selectedCode === 'HRDL') preCause = "Horario Día Libre sin Manejo";
                    setFormData({ ...formData, code: selectedCode, cause: preCause });
                  }}
                >
                  <option value="PRIM">PRIM</option>
                  <option value="PREM">PREM</option>
                  <option value="HRDM">HRDM</option>
                  <option value="HRDL">HRDL</option>
                  <option value="HORS">HORS</option>
                </select>
              </div>

              {/* Causa */}
              <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider mb-1.5 uppercase block">Causa</label>
                <input
                  type="text"
                  required
                  readOnly
                  className="w-full max-w-[280px] bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-600 font-bold cursor-not-allowed transition-all"
                  value={formData.cause}
                  placeholder="Seleccione un código..."
                />
              </div>
            </div>
          </div>

          {/* Bloque 2: Control de Horarios y Viáticos (Tiempos y Nómina) */}
          <div className="bg-slate-50/50 border border-slate-200/60 p-5 rounded-xl shadow-sm space-y-4">
            <div className="border-b border-slate-200/60 pb-2 mb-1">
              <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                Control de Horas y Viáticos
              </h4>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Horas de la Jornada */}
              <div className="lg:col-span-9 grid grid-cols-2 sm:grid-cols-5 gap-3 w-full">
                <div className="space-y-1.5">
                  <label className="text-[9.5px] font-bold text-slate-500 tracking-tight uppercase block truncate" title="Entrada AM">Entrada AM</label>
                  <input required type="time" className="w-full bg-white border border-slate-200 rounded-xl pl-2.5 pr-1.5 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors min-w-[125px]" value={formData.startTimeMorning} onChange={e => setFormData({ ...formData, startTimeMorning: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9.5px] font-bold text-slate-500 tracking-tight uppercase block truncate" title="Salida AM">Salida AM</label>
                  <input required type="time" className="w-full bg-white border border-slate-200 rounded-xl pl-2.5 pr-1.5 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors min-w-[125px]" value={formData.endTimeMorning} onChange={e => setFormData({ ...formData, endTimeMorning: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9.5px] font-bold text-slate-500 tracking-tight uppercase block truncate" title="Pausa">Pausa</label>
                  <select className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors select-with-arrow text-slate-700 min-w-[80px]" value={formData.hasPause} onChange={e => setFormData({ ...formData, hasPause: e.target.value })}>
                    <option value="SI">SI</option>
                    <option value="NO">NO</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9.5px] font-bold text-slate-500 tracking-tight uppercase block truncate" title="Entrada PM">Entrada PM</label>
                  <input required type="time" className="w-full bg-white border border-slate-200 rounded-xl pl-2.5 pr-1.5 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors min-w-[125px]" value={formData.startTimeAfternoon} onChange={e => setFormData({ ...formData, startTimeAfternoon: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9.5px] font-bold text-slate-500 tracking-tight uppercase block truncate" title="Salida PM">Salida PM</label>
                  <input required type="time" className="w-full bg-white border border-slate-200 rounded-xl pl-2.5 pr-1.5 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors min-w-[125px]" value={formData.endTimeAfternoon} onChange={e => setFormData({ ...formData, endTimeAfternoon: e.target.value })} />
                </div>
              </div>

              {/* Viáticos Container */}
              <div className="lg:col-span-3 p-4 bg-white border border-slate-200 rounded-xl flex flex-col justify-center space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">VIÁTICO</label>
                    <span className="text-[9px] text-slate-400 font-medium leading-none block mt-0.5">¿Aplica viático estimado?</span>
                  </div>
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded-lg text-brand-blue border-slate-300 focus:ring-brand-blue/20 cursor-pointer"
                    checked={formData.hasPerDiem}
                    onChange={e => setFormData({ ...formData, hasPerDiem: e.target.checked })}
                  />
                </div>
                {formData.hasPerDiem && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Monto Estimado (Bs.)</label>
                    <input
                      required
                      type="text"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-bold placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      placeholder="0.00"
                      value={formData.perDiemAmount}
                      onKeyDown={e => {
                        const allowedKeys = [
                          'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 
                          'Tab', 'Home', 'End'
                        ];
                        if (allowedKeys.includes(e.key)) {
                          return;
                        }
                        if (!/[0-9.,]/.test(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      onChange={e => {
                        let val = e.target.value;
                        val = val.replace(',', '.');
                        const regex = /^[0-9]*\.?[0-9]{0,2}$/;
                        if (val === '') {
                          setFormData({ ...formData, perDiemAmount: '' });
                          return;
                        }
                        if (regex.test(val)) {
                          setFormData({ ...formData, perDiemAmount: val });
                        }
                      }}
                      onBlur={() => {
                        const val = formData.perDiemAmount;
                        if (val === '' || isNaN(parseFloat(val))) {
                          setFormData({ ...formData, perDiemAmount: '0.00' });
                          return;
                        }
                        const formatted = parseFloat(val).toFixed(2);
                        setFormData({ ...formData, perDiemAmount: formatted });
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bloque 3: Bitácora Técnica y Personal (Operaciones) */}
          <div className="bg-slate-50/50 border border-slate-200/60 p-5 rounded-xl shadow-sm space-y-4 mb-4">
            <div className="border-b border-slate-200/60 pb-2 mb-1">
              <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                Descripción y Personal Asignado
              </h4>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Bitácoras de texto */}
              <div className="lg:col-span-2 space-y-4">
                {/* Descripción de Labores */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Descripción de las Labores</label>
                    <span className={cn(
                      "text-[9px] font-bold",
                      formData.description.length > 750 ? "text-red-500" : "text-slate-400"
                    )}>
                      {formData.description.length} / 800
                    </span>
                  </div>
                  <textarea
                    required
                    rows={4}
                    maxLength={800}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors h-28 resize-none"
                    placeholder="Describa las labores realizadas con precisión técnica para el reporte administrativo..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Justificación */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className={cn(
                      "text-[10px] font-bold tracking-wider uppercase block",
                      hasExtraTime ? "text-blue-600 font-extrabold" : "text-slate-500"
                    )}>
                      Justificación {hasExtraTime && (currentOT > 0 ? '(Sobretiempo)' : '(Déficit)')}
                    </label>
                    <span className={cn(
                      "text-[9px] font-bold",
                      formData.justification.length > 450 ? "text-red-500" : "text-slate-400"
                    )}>
                      {formData.justification.length} / 500
                    </span>
                  </div>
                  <textarea
                    required={hasExtraTime}
                    disabled={!hasExtraTime}
                    rows={3}
                    maxLength={500}
                    className={cn(
                      "w-full rounded-xl px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-1 h-20 resize-none",
                      hasExtraTime
                        ? "bg-white border text-slate-800 border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                        : "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                    )}
                    placeholder={hasExtraTime ? `Explique el motivo del ${currentOT > 0 ? 'sobretiempo' : 'déficit'}...` : "El tiempo calculado es estándar. No requiere justificación."}
                    value={hasExtraTime ? formData.justification : 'Jornada estándar sin sobretiempo ni déficit.'}
                    onChange={e => setFormData({ ...formData, justification: e.target.value })}
                  />
                </div>
              </div>

              {/* Técnicos Participantes */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Técnicos Participantes</label>
                <div className="p-4 border border-slate-200 rounded-xl bg-white max-h-56 overflow-y-auto custom-scrollbar flex flex-col gap-2 shadow-sm">
                  {activeTechnicians.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2 col-span-full">No hay técnicos activos registrados para asignar.</p>
                  ) : (
                    activeTechnicians.map(tech => {
                      const llaveTecnico = tech.uid || tech.id;
                      const isSelected = formData.tecnicosIds.includes(llaveTecnico);
                      return (
                        <button
                          key={tech.id}
                          type="button"
                          onClick={() => toggleParticipant(llaveTecnico)}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-xl border text-left transition-all",
                            isSelected
                              ? "bg-brand-blue text-white border-brand-blue shadow-md shadow-brand-blue/10"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100"
                          )}
                        >
                          <div className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            isSelected ? "bg-white" : "bg-slate-300"
                          )} />
                          <div className="flex flex-col overflow-hidden w-full">
                            <div className="flex items-center gap-1.5 justify-between w-full">
                              <span className="text-xs font-bold truncate leading-tight mr-1">{tech.name}</span>
                              <span className={cn(
                                "text-[8px] font-black uppercase px-1 py-0.5 rounded tracking-wider shrink-0 leading-none",
                                tech.role === 'supervisor'
                                  ? (isSelected ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700 border border-amber-200")
                                  : tech.role === 'admin'
                                    ? (isSelected ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700 border border-purple-200")
                                    : (isSelected ? "bg-white/20 text-white" : "bg-blue-50 text-blue-700 border border-blue-100")
                              )}>
                                {tech.role === 'supervisor' ? 'SUP' : tech.role === 'admin' ? 'ADM' : 'TEC'}
                              </span>
                            </div>
                            <span className={cn(
                              "text-[9px] font-mono mt-0.5 block",
                              isSelected ? "text-white/80" : "text-slate-400"
                            )}>{tech.employeeId}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                <p className="text-[9px] text-slate-400 italic leading-snug">
                  * Seleccione cada técnico que participó en la labor realizada.
                </p>
              </div>
            </div>
          </div>
        </form>

        {/* Botones de acción del pie en formato centrado y compacto (Fuera del scroll) */}
        <div className="flex justify-end gap-3 p-4 border-t border-slate-100 bg-white shrink-0">
          <button 
            type="button" 
            onClick={onClose}
            disabled={isSubmitting} // Deshabilitar cancelar durante el envío
            className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            form="activity-form" 
            disabled={isSubmitting || formData.tecnicosIds.length === 0}
            className={`px-5 py-2.5 bg-[#004a99] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all ${isSubmitting ? 'bg-blue-800 cursor-not-allowed opacity-80' : 'hover:bg-blue-800'}`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Procesando...
              </>
            ) : (
              initialData ? 'Guardar Cambios' : 'Confirmar Reporte Técnico'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

