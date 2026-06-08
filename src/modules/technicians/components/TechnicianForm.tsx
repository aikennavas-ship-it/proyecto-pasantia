import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Technician } from '../../../types';
import { cn } from '../../../lib/utils';

interface TechnicianFormProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: Technician | null;
  technicians: Technician[];
}

const formatCapitalized = (text: string) => {
  return text
    .split(' ')
    .map(word => {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

const formatSentenceCase = (text: string) => {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

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
    password: '',
    tallaBotas: initialData?.tallaBotas || '',
    tallaCamisa: initialData?.tallaCamisa || '',
    tallaPantalon: initialData?.tallaPantalon || '',
    fechaNacimiento: initialData?.fechaNacimiento || '',
    fechaIngreso: initialData?.fechaIngreso || '',
    direccion: initialData?.direccion || ''
  });
  
  const [errorPrompt, setErrorPrompt] = React.useState('');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = React.useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPrompt('');
    
    const finalStatus = data.status === 'otro' ? data.customStatus.trim() : data.status;

    // Check missing fields
    const isNew = !initialData;
    
    if (!data.firstName || !data.lastName || !data.employeeId || !data.idCard || !data.specialty || !data.department || !data.phoneNumber || !finalStatus || !data.email || (isNew && !data.password) || !data.fechaNacimiento || !data.fechaIngreso || !data.direccion) {
      setErrorPrompt('Por favor, rellene todos los campos requeridos del formulario (incluyendo el departamento, fechas y dirección).');
      return;
    }

    // Validation: Names only letters
    const nameRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
    if (!nameRegex.test(data.firstName) || !nameRegex.test(data.lastName)) {
      setErrorPrompt('Los nombres y apellidos solo deben contener letras.');
      return;
    }

    // Validation: P00 exactly 6 digits
    if (!/^\d{6}$/.test(data.employeeId)) {
      setErrorPrompt('El P00 / CARNET debe ser exactamente de 6 dígitos.');
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

    try {
      setIsSubmitting(true);
      await onSubmit({
        name: fullName,
        employeeId: data.employeeId,
        idCard: data.idCard,
        specialty: data.specialty,
        department: data.department.trim(),
        phoneNumber: data.phoneNumber,
        status: finalStatus,
        email: data.email.toLowerCase().trim(),
        role: data.systemRole,
        password: data.password,
        tallaBotas: data.tallaBotas.trim().toUpperCase(),
        tallaCamisa: data.tallaCamisa.trim().toUpperCase(),
        tallaPantalon: data.tallaPantalon.trim().toUpperCase(),
        fechaNacimiento: data.fechaNacimiento,
        fechaIngreso: data.fechaIngreso,
        direccion: data.direccion.trim()
      });
      // onClose is handled by the parent if successful, but we can also call it here
      onClose();
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use' || (err.message && err.message.includes('email-already-in-use'))) {
        setErrorPrompt('Atención: El correo institucional ingresado ya se encuentra registrado. Utilice uno diferente.');
      } else {
        setErrorPrompt('Error al guardar: ' + (err.message || String(err)));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md md:max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{initialData ? 'Editar Perfil' : 'Registrar Nuevo Perfil'}</h3>
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* COLUMNA IZQUIERDA: SEGURIDAD Y ACCESO */}
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest">Información de Cuenta y Seguridad</span>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Correo Institucional</label>
                <input
                  required
                  type="email"
                  className="input-field"
                  placeholder="tecnico@cantv.com.ve"
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
                <p className="text-[9px] text-slate-500 font-bold ml-1 leading-relaxed">
                  {initialData 
                    ? 'Escriba una nueva contraseña para actualizar el acceso. Debe contener mayúsculas, minúsculas, números y símbolos.'
                    : 'Debe incluir mayúsculas, minúsculas, números y caracteres especiales (ej: @, #, $, *).'}
                </p>
              </div>

              {/* ROL EN EL SISTEMA (CUSTOM DROPDOWN) */}
              <div className="space-y-1 relative">
                <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Rol</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsRoleDropdownOpen(!isRoleDropdownOpen);
                    setIsStatusDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between input-field bg-white text-left focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
                >
                  <span className="font-bold text-slate-800 uppercase tracking-wide text-xs">
                    {data.systemRole === 'tecnico' ? 'Técnico' : data.systemRole === 'supervisor' ? 'Supervisor' : data.systemRole === 'admin' ? 'Administrador General' : data.systemRole}
                  </span>
                  <span className="text-slate-400 text-[10px]">▼</span>
                </button>
                {isRoleDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsRoleDropdownOpen(false)}></div>
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-slate-50">
                      {[
                        { value: 'tecnico', label: 'Técnico' },
                        { value: 'supervisor', label: 'Supervisor' },
                        { value: 'admin', label: 'Administrador General' }
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setData({ ...data, systemRole: opt.value as any });
                            setIsRoleDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-slate-50",
                            data.systemRole === opt.value ? "text-brand-blue bg-blue-50/50" : "text-slate-700"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* ESTADO ADMINISTRATIVO (CUSTOM DROPDOWN) */}
              <div className="space-y-1 relative">
                <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Estado</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsStatusDropdownOpen(!isStatusDropdownOpen);
                    setIsRoleDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between input-field bg-white text-left focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
                >
                  <span className="font-bold text-slate-800 uppercase tracking-wide text-xs">
                    {data.status === 'activo' ? 'Activo' : 
                     data.status === 'inactivo' ? 'Inactivo' : 
                     data.status === 'baja' ? 'Baja' : 
                     data.status === 'reposo' ? 'Reposo' : 
                     data.status === 'vacaciones' ? 'Vacaciones' : 
                     data.status === 'otro' ? `Otro (${data.customStatus || 'Especificar'})` : data.status}
                  </span>
                  <span className="text-slate-400 text-[10px]">▼</span>
                </button>
                {isStatusDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsStatusDropdownOpen(false)}></div>
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-slate-50 max-h-48 overflow-y-auto custom-scrollbar">
                      {[
                        { value: 'activo', label: 'Activo' },
                        { value: 'inactivo', label: 'Inactivo' },
                        { value: 'baja', label: 'Baja' },
                        { value: 'reposo', label: 'Reposo' },
                        { value: 'vacaciones', label: 'Vacaciones' },
                        { value: 'otro', label: 'Otro (Especificar)' }
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setData({ ...data, status: opt.value as any });
                            setIsStatusDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-slate-50",
                            data.status === opt.value ? "text-brand-blue bg-blue-50/50" : "text-slate-700"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              
              {data.status === 'otro' && (
                <div className="space-y-1 animate-in slide-in-from-top-2">
                  <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Especificar Estado</label>
                  <input
                    required
                    type="text"
                    className="input-field"
                    placeholder="Permiso no remunerado..."
                    value={data.customStatus}
                    onChange={e => setData({ ...data, customStatus: e.target.value })}
                  />
                </div>
              )}

              {/* GRID HORIZONTAL PARA FECHAS (2 Columnas) - Integrado para balancear la altura */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-2">
                
                {/* Fecha de Nacimiento */}
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">
                    Fecha de Nacimiento
                  </label>
                  <input 
                    type="date" 
                    name="fechaNacimiento"
                    value={data.fechaNacimiento}
                    onChange={e => setData({ ...data, fechaNacimiento: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                {/* Fecha de Ingreso */}
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">
                    Fecha de Ingreso
                  </label>
                  <input 
                    type="date" 
                    name="fechaIngreso"
                    value={data.fechaIngreso}
                    onChange={e => setData({ ...data, fechaIngreso: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

              </div>
            </div>

            {/* COLUMNA DERECHA: DATOS PERSONALES */}
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest">Información de Datos Personales</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Nombres</label>
                  <input
                    required
                    className="input-field"
                    placeholder="Pedro José"
                    value={data.firstName}
                    onChange={e => {
                      const value = e.target.value;
                      if (/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]*$/.test(value)) {
                        setData({ ...data, firstName: formatCapitalized(value) });
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Apellidos</label>
                  <input
                    required
                    className="input-field"
                    placeholder="Pérez García"
                    value={data.lastName}
                    onChange={e => {
                      const value = e.target.value;
                      if (/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]*$/.test(value)) {
                        setData({ ...data, lastName: formatCapitalized(value) });
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Carnet</label>
                  <input
                    required
                    maxLength={6}
                    className="input-field"
                    placeholder="107773"
                    value={data.employeeId}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setData({ ...data, employeeId: val });
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Cédula</label>
                  <input
                    required
                    maxLength={10}
                    className="input-field font-mono"
                    placeholder="V-12345678"
                    value={data.idCard}
                    onChange={e => {
                      let val = e.target.value.toUpperCase();
                      const isForeigner = val.startsWith('E');
                      const prefix = isForeigner ? 'E-' : 'V-';
                      const cleanNumbers = val.replace(/[^\d]/g, '');
                      const limitedNumbers = cleanNumbers.slice(0, 8);
                      const formattedId = limitedNumbers ? `${prefix}${limitedNumbers}` : prefix;
                      setData({ ...data, idCard: formattedId });
                    }}
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Teléfono</label>
                <input
                  required
                  type="tel"
                  maxLength={12}
                  className="input-field font-mono"
                  placeholder="0414-1234567"
                  value={data.phoneNumber}
                  onChange={e => {
                    let val = e.target.value.replace(/[^\d-]/g, '');
                    if (val.length > 4 && !val.includes('-')) {
                      val = val.slice(0,4) + '-' + val.slice(4);
                    }
                    setData({ ...data, phoneNumber: val });
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Cargo</label>
                <input
                  required
                  type="text"
                  className="input-field"
                  placeholder="Programador, Soporte Técnico"
                  value={data.specialty}
                  onChange={e => {
                    let cleanValue = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
                    if (cleanValue.length > 0) {
                      cleanValue = cleanValue.charAt(0).toUpperCase() + cleanValue.slice(1).toLowerCase();
                    }
                    setData({ ...data, specialty: cleanValue });
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">Departamento</label>
                <input
                  required
                  type="text"
                  className="input-field uppercase"
                  placeholder="DATOS, TRANSMISION o SOPORTE"
                  value={data.department}
                  onChange={e => {
                    let cleanValue = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
                    setData({ ...data, department: cleanValue.toUpperCase() });
                  }}
                />
              </div>

              {/* SECCIÓN DE DOTACIÓN Y UNIFORMES (Grid horizontal de 3 columnas) */}
              <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 mt-2">
                {/* Talla Botas */}
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">
                    Talla Botas
                  </label>
                  <input 
                    type="text" 
                    name="tallaBotas"
                    value={data.tallaBotas}
                    onChange={e => setData({ ...data, tallaBotas: e.target.value })}
                    placeholder="42"
                    className="input-field uppercase"
                    maxLength={5}
                  />
                </div>

                {/* Talla Camisa */}
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">
                    Talla Camisa
                  </label>
                  <input 
                    type="text" 
                    name="tallaCamisa"
                    value={data.tallaCamisa}
                    onChange={e => setData({ ...data, tallaCamisa: e.target.value })}
                    placeholder="M"
                    className="input-field uppercase"
                    maxLength={5}
                  />
                </div>

                {/* Talla Pantalón */}
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">
                    Talla Pantalón
                  </label>
                  <input 
                    type="text" 
                    name="tallaPantalon"
                    value={data.tallaPantalon}
                    onChange={e => setData({ ...data, tallaPantalon: e.target.value })}
                    placeholder="32"
                    className="input-field uppercase"
                    maxLength={5}
                  />
                </div>
              </div>

              {/* DIRECCIÓN DE HABITACIÓN */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider ml-1">
                  Dirección
                </label>
                <textarea 
                  name="direccion"
                  value={data.direccion}
                  onChange={e => setData({ ...data, direccion: e.target.value })}
                  rows={2}
                  maxLength={200}
                  placeholder="Calle, Sector, Edificio/Casa, Maracay, Edo. Aragua"
                  className="input-field py-2 h-16 resize-none leading-relaxed"
                  required
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 btn-primary py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Guardando...' : (initialData ? 'Guardar Cambios' : 'Registrar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
