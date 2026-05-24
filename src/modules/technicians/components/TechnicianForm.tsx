import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Technician } from '../../../types';

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

  const parts = (initialData?.name || '').split(' ');
  const initFirstName = parts.length > 1 ? parts.slice(0, Math.ceil(parts.length / 2)).join(' ') : parts[0] || '';
  const initLastName = parts.length > 1 ? parts.slice(Math.ceil(parts.length / 2)).join(' ') : '';

  const [data, setData] = React.useState({
    firstName: initFirstName,
    lastName: initLastName,
    employeeId: initialData?.employeeId || '',
    idCard: initialData?.idCard || 'V-',
    specialty: initialData?.specialty || '',
    department: (initialData?.department || '').toUpperCase(),
    phoneNumber: initialData?.phoneNumber || '',
    status: isCustomStatus ? 'otro' : initialStatusVal,
    customStatus: isCustomStatus ? (initialData?.status || '') : '',
    email: initialData?.email || '',
    systemRole: initialData?.role || 'tecnico',
    password: ''
  });
  
  const [errorPrompt, setErrorPrompt] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPrompt('');
    
    const finalStatus = data.status === 'otro' ? data.customStatus.trim() : data.status;

    // Check missing fields
    const isNew = !initialData;
    
    if (!data.firstName || !data.lastName || !data.employeeId || !data.idCard || !data.specialty || !data.department || !data.phoneNumber || !finalStatus || !data.email || (isNew && !data.password)) {
      setErrorPrompt('Por favor, rellene todos los campos requeridos del formulario (incluyendo el departamento).');
      return;
    }

    // Validation: Names only letters
    const nameRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
    if (!nameRegex.test(data.firstName) || !nameRegex.test(data.lastName)) {
      setErrorPrompt('Los nombres y apellidos solo deben contener letras.');
      return;
    }

    // Validation: POO exactly 6 digits
    if (!/^\d{6}$/.test(data.employeeId)) {
      setErrorPrompt('El POO / Carnet debe ser exactamente de 6 dígitos.');
      return;
    }

    // Validation: ID Card (V- + 8 digits)
    const idRegex = /^[VE]-\d{8}$/;
    if (!idRegex.test(data.idCard)) {
      setErrorPrompt('Cédula inválida. Debe seguir el formato exacto V-12345678 (máximo de 10 caracteres).');
      return;
    }

    // Validation: Phone Number (>= 12 chars and must have -)
    const phoneRegex = /^\d{4}-\d{7}$/;
    if (!phoneRegex.test(data.phoneNumber)) {
      setErrorPrompt('Número de teléfono inválido. Debe tener 12 caracteres incluyendo un guión (Ej: 0414-1234567).');
      return;
    }
    
    // Validation: Password strength
    if (isNew || (!isNew && data.password)) {
      const pwdVal = data.password;
      if (pwdVal.length < 10 || pwdVal.length > 64) {
        setErrorPrompt(isNew ? 'La contraseña debe tener entre 10 y 64 caracteres.' : 'La nueva contraseña debe tener entre 10 y 64 caracteres.');
        return;
      }
      const hasUpper = /[A-Z]/.test(pwdVal);
      const hasLower = /[a-z]/.test(pwdVal);
      const hasNumber = /[0-9]/.test(pwdVal);
      const hasSpecial = /[!@#\$%\^&\*\(\)_\+\-\=\[\]\{\};':"\\|,.<>\/\?¡¿]/.test(pwdVal);
      if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
        setErrorPrompt(isNew ? 'La contraseña debe contener mayúsculas, minúsculas, números y caracteres especiales.' : 'La nueva contraseña debe contener mayúsculas, minúsculas, números y caracteres especiales.');
        return;
      }
    }

    // Check duplicate ID
    const isDuplicate = technicians.some(
      t => (t.employeeId || '').toLowerCase() === (data.employeeId || '').toLowerCase() && t.id !== initialData?.id
    );

    if (isDuplicate) {
      setErrorPrompt(`El técnico con P00 "${data.employeeId}" ya existe en el sistema. Ingrese uno diferente.`);
      return;
    }

    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;

    onSubmit({
      name: fullName,
      employeeId: data.employeeId,
      idCard: data.idCard,
      specialty: data.specialty,
      department: data.department.trim(),
      phoneNumber: data.phoneNumber,
      status: finalStatus,
      email: data.email.toLowerCase().trim(),
      role: data.systemRole,
      password: data.password
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{initialData ? 'Editar Perfil' : 'Registrar Nuevo Perfil'}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition-colors shrink-0">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {errorPrompt && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-start gap-3 animate-in slide-in-from-top-2">
              <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs font-bold text-red-600">{errorPrompt}</p>
            </div>
          )}
          
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Correo Institucional</label>
            <input
              required
              type="email"
              className="input-field"
              placeholder="Ej: tecnico@cantv.com.ve"
              value={data.email}
              onChange={e => setData({ ...data, email: e.target.value })}
            />
          </div>

          <div className="space-y-1 animate-in slide-in-from-top-2">
            <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">
              {initialData ? 'Nueva Contraseña de Acceso (Opcional)' : 'Contraseña de Acceso'}
            </label>
            <input
              required={!initialData}
              type="password"
              className="input-field"
              placeholder={initialData ? 'Dejar en blanco para conservar la actual' : 'Mínimo 10 caracteres'}
              maxLength={64}
              value={data.password}
              onChange={e => setData({ ...data, password: e.target.value })}
            />
            <p className="text-[9px] text-slate-500 font-bold ml-1">
              {initialData 
                ? 'Escriba una nueva contraseña para actualizar el acceso del usuario. Debe contener mayúsculas, minúsculas, números y caracteres especiales (ej: @, #, $, *).'
                : 'Debe incluir mayúsculas, minúsculas, números y caracteres especiales (ej: @, #, $, *).'}
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Rol en el Sistema</label>
            <select
              required
              className="input-field"
              value={data.systemRole}
              onChange={e => setData({ ...data, systemRole: e.target.value as any })}
            >
              <option value="tecnico">Técnico</option>
              <option value="supervisor">Supervisor</option>
              {initialData?.role === 'admin' && <option value="admin">Administrador General</option>}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Nombres</label>
              <input
                required
                className="input-field"
                placeholder="Ej: Pedro José"
                value={data.firstName}
                onChange={e => setData({ ...data, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Apellidos</label>
              <input
                required
                className="input-field"
                placeholder="Ej: Pérez García"
                value={data.lastName}
                onChange={e => setData({ ...data, lastName: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">P00 / Carnet (Empleado)</label>
            <input
              required
              maxLength={6}
              className="input-field"
              placeholder="Ej: 107773"
              value={data.employeeId}
              onChange={e => setData({ ...data, employeeId: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Cédula de Identidad (C.I)</label>
            <input
              required
              maxLength={10}
              className="input-field"
              placeholder="Ej: V-12345678"
              value={data.idCard}
              onChange={e => {
                let val = e.target.value;
                if (!val.startsWith('V-') && !val.startsWith('E-') && val.length > 0) {
                  val = 'V-' + val.replace(/v-?/i, '');
                }
                val = val.toUpperCase().replace('v-', 'V-');
                setData({ ...data, idCard: val });
              }}
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Número de Teléfono</label>
            <input
              required
              type="tel"
              maxLength={12}
              className="input-field"
              placeholder="Ej: 0414-1234567"
              value={data.phoneNumber}
              onChange={e => {
                // Auto format phone if they just type numbers
                let val = e.target.value.replace(/[^\d-]/g, '');
                if (val.length > 4 && !val.includes('-')) {
                  val = val.slice(0,4) + '-' + val.slice(4);
                }
                setData({ ...data, phoneNumber: val });
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Especialidad / Cargo</label>
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
            <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Departamento</label>
            <input
              required
              type="text"
              className="input-field uppercase"
              placeholder="Ej: DATOS, TRANSMISION, SOPORTE, etc."
              value={data.department}
              onChange={e => setData({ ...data, department: e.target.value.toUpperCase() })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Estado Administrativo</label>
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
              <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Especificar Estado</label>
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
