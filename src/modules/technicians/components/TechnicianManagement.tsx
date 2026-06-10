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
import { UserPlus, Search, Shield, BadgeCheck, X, Briefcase, Trash2, Edit2, Phone, Calendar, MapPin } from 'lucide-react';
import { Technician } from '../../../types';
import { cn } from '../../../lib/utils';
import TechnicianForm from './TechnicianForm';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const exportarPersonalExcel = async (listaPersonal: Technician[]) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('INVENTARIO_PERSONAL_2026');

  // 1. Estructura de columnas del reporte de personal (14 columnas totales) de acuerdo a requerimiento
  worksheet.columns = [
    { header: 'NOMBRES Y APELLIDOS', key: 'nombreCompleto', width: 30 },
    { header: 'CARGO', key: 'cargo', width: 20 },
    { header: 'DEPARTAMENTO', key: 'departamento', width: 18 },
    { header: 'ROL', key: 'rol', width: 15 },
    { header: 'P00 (CARNET)', key: 'carnet', width: 15 },
    { header: 'CÉDULA', key: 'cedula', width: 15 },
    { header: 'TELÉFONO', key: 'telefono', width: 16 },
    { header: 'F. NACIMIENTO', key: 'fechaNacimiento', width: 16 },
    { header: 'DIRECCIÓN', key: 'direccion', width: 35 },
    { header: 'F. INGRESO', key: 'fechaIngreso', width: 16 },
    { header: 'TALLA BOTAS', key: 'tallaBotas', width: 14 },
    { header: 'TALLA CAMISA', key: 'tallaCamisa', width: 14 },
    { header: 'TALLA PANTALÓN', key: 'tallaPantalon', width: 16 },
    { header: 'ESTADO', key: 'estado', width: 12 }
  ];

  // Estilo estético del encabezado (CANTV Blue #004a99)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28; // Alto de cabecera más holgado
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '004A99' }
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  // Helper para formatear fechas a formato estándar DD/MM/YYYY
  const formatearFecha = (fechaStr?: string) => {
    if (!fechaStr) return 'Sin registrar';
    const parts = fechaStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return fechaStr;
  };

  // 2. Población de filas
  listaPersonal.forEach((usuario, index) => {
    const row = worksheet.addRow({
      nombreCompleto: usuario.name.trim(),
      cargo: usuario.specialty,
      departamento: usuario.department,
      rol: (usuario.role || 'tecnico').toUpperCase(),
      carnet: usuario.employeeId,
      cedula: usuario.idCard,
      telefono: usuario.phoneNumber || 'Sin registrar',
      fechaNacimiento: formatearFecha(usuario.fechaNacimiento),
      direccion: usuario.direccion || 'Sin registrar',
      fechaIngreso: formatearFecha(usuario.fechaIngreso),
      tallaBotas: usuario.tallaBotas || 'N/R',
      tallaCamisa: usuario.tallaCamisa || 'N/R',
      tallaPantalon: usuario.tallaPantalon || 'N/R',
      estado: usuario.status.toUpperCase()
    });

    row.height = 22; // Alto de fila espacioso

    // Determinar color de fondo para zebra-striping (Alternar filas grises suaves)
    const esPar = index % 2 === 0;
    const colorFondoFila = esPar ? 'F8FAFC' : 'FFFFFFFF'; // Gris muy suave en filas pares

    // Alineación central de datos de control, izquierda para nombres (columna 1) y dirección (columna 9)
    row.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colorFondoFila }
      };
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: (colNumber === 1 || colNumber === 9) ? 'left' : 'center'
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });
  });

  // 3. ALGORITMO DE AUTO-AJUSTE DINÁMICO DE ANCHO DE COLUMNAS (Previene nombres cortados)
  worksheet.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const valText = cell.value ? cell.value.toString() : '';
      if (valText.length > maxLen) {
        maxLen = valText.length;
      }
    });
    // Añadimos un padding de seguridad de 4 caracteres
    column.width = Math.max(maxLen + 4, 12);
  });

  // Descarga del documento
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `Nomina_Personal_CANTV_2026.xlsx`);
};

const formatSentenceCaseKey = (text: string) => {
  if (!text) return "";
  const clean = text.trim();
  // Capitalize first, lowercase the rest
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
};

const getDeptBadgeClass = (dept: string) => {
  const d = (dept || '').toUpperCase();
  if (d.includes('TRANSMISIÓN') || d.includes('TRANSMISION')) {
    return 'bg-blue-50 text-blue-600 font-semibold rounded-lg text-xs py-1 px-2.5 whitespace-nowrap border border-blue-100';
  }
  if (d.includes('DATOS')) {
    return 'bg-emerald-50 text-emerald-600 font-semibold rounded-lg text-xs py-1 px-2.5 whitespace-nowrap border border-emerald-100';
  }
  if (d.includes('ENERGÍA') || d.includes('ENERGIA')) {
    return 'bg-amber-50 text-amber-600 font-semibold rounded-lg text-xs py-1 px-2.5 whitespace-nowrap border border-amber-100';
  }
  return 'bg-slate-100 text-slate-600 font-medium rounded-lg text-xs py-1 px-2.5 whitespace-nowrap border border-slate-250';
};

const formatearFechaTabla = (fechaStr?: string): string => {
  if (!fechaStr) return 'Sin registrar';
  const parts = fechaStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return fechaStr;
};

interface TechnicianManagementProps {
  technicians: Technician[];
  onAddTechnician?: (data: any) => void;
  onEditTechnician?: (tech: Technician) => void;
  onDeleteTechnician?: (id: string, name: string) => void;
  isLoading: boolean;
  currentUserId?: string;
  currentUserEmail?: string;
}

export default function TechnicianManagement({ 
  technicians, 
  onAddTechnician, 
  onEditTechnician, 
  onDeleteTechnician, 
  isLoading,
  currentUserId,
  currentUserEmail
}: TechnicianManagementProps) {
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredTechs = React.useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return technicians;

    // 1. C.I. (Cedula): If query starts with "v-" (or "v" followed by numbers/dash)
    const isCISearch = query.startsWith('v-') || (query.startsWith('v') && (query === 'v' || /\d/.test(query)));

    // 2. P00: If query contains only numbers directly
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
        // Search by P00 (employeeId) directly
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
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
        
        {/* LADO IZQUIERDO: TÍTULO */}
        <div className="flex items-center gap-3">
          <span className="p-3 bg-blue-600 text-white rounded-2xl shadow-md">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-800">PERSONAL Y ACCESOS</h2>
            <p className="text-xs text-slate-400">CONTROL DE USUARIOS Y ROLES</p>
          </div>
        </div>

        {/* LADO DERECHO: ACCIONES RESPONSIVAS (Fin del comportamiento tirano) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto shrink-0">
          
          {/* BOTÓN SECUNDARIO: EXPORTAR NÓMINA (Con icono de Excel) */}
          <button 
            onClick={() => exportarPersonalExcel(technicians)}
            className="w-full sm:w-auto px-6 py-2.5 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] shrink-0"
          >
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Exportar Nómina</span>
          </button>

          {/* BOTÓN PRINCIPAL: REGISTRAR NUEVO */}
          {onAddTechnician && (
            <button 
              onClick={() => setIsFormOpen(true)}
              className="w-full sm:w-auto px-6 py-2.5 bg-brand-blue text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:shadow-xl hover:bg-brand-blue-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <span className="text-sm leading-none shrink-0">+</span> 
              <span>Registrar Nuevo</span>
            </button>
          )}

        </div>
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
        <div className="hidden md:block overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-[11px] font-extrabold text-slate-900 uppercase tracking-widest border-b-2 border-slate-300">
                <th className="px-6 py-4 whitespace-nowrap text-left">Nombres y Apellidos</th>
                <th className="px-6 py-4 whitespace-nowrap text-center">Cargo</th>
                <th className="px-6 py-4 whitespace-nowrap text-center">Departamento</th>
                <th className="px-6 py-4 whitespace-nowrap text-center">Rol</th>
                <th className="px-6 py-4 whitespace-nowrap text-center">P00 (Carnet)</th>
                <th className="px-6 py-4 whitespace-nowrap text-center">Cédula</th>
                <th className="px-6 py-4 whitespace-nowrap text-center">Teléfono</th>
                <th className="px-6 py-4 whitespace-nowrap text-center">F. Nacimiento</th>
                <th className="px-6 py-4 whitespace-nowrap text-center">Dirección</th>
                <th className="px-6 py-4 whitespace-nowrap text-center">F. Ingreso</th>
                <th className="px-6 py-4 whitespace-nowrap text-center">Dotación</th>
                <th className="px-6 py-4 whitespace-nowrap text-center">Estado</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [1,2,3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={13} className="px-6 py-4 h-16 bg-slate-50/30"></td>
                  </tr>
                ))
              ) : filteredTechs.length === 0 ? (
                <tr>
                   <td colSpan={13} className="px-6 py-12 text-center text-slate-400 italic">
                    No se encontraron técnicos registrados.
                  </td>
                </tr>
              ) : (
                filteredTechs.map(tech => {
                  const esMiPropioPerfil = tech.uid === currentUserId || (tech.email && tech.email.toLowerCase().trim() === currentUserEmail?.toLowerCase().trim());
                  const esFilaAdmin = tech.role === 'admin';
                  const esOtroAdmin = esFilaAdmin && !esMiPropioPerfil && tech.uid !== currentUserId && tech.email?.toLowerCase().trim() !== currentUserEmail?.toLowerCase().trim();
                  return (
                    <tr key={tech.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-left">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue shrink-0">
                            <BadgeCheck size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 leading-none">{tech.name}</p>
                            <p className="text-xs text-slate-400 font-mono mt-1">{tech.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="bg-slate-50 text-slate-600 text-xs py-1 px-2.5 rounded-lg border border-slate-200/50 inline-block font-sans">
                          {formatSentenceCaseKey(tech.specialty || 'Soporte técnico')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={getDeptBadgeClass(tech.department || 'General')}>
                          {tech.department || 'General'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border",
                          tech.role === 'admin' ? "bg-purple-50 text-purple-600 border-purple-100" : 
                          tech.role === 'supervisor' ? "bg-brand-blue/5 text-brand-blue border-brand-blue/10" : 
                          "bg-slate-50 text-slate-500 border-slate-100"
                        )}>
                          {tech.role === 'admin' ? 'Administrador' : tech.role === 'supervisor' ? 'Supervisor' : 'Técnico'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {tech.employeeId || 'S/N'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {tech.idCard || 'S/N'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {tech.phoneNumber || 'S/N'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-xs text-slate-600 font-medium">
                        {formatearFechaTabla(tech.fechaNacimiento)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-xs text-slate-500 font-medium max-w-[150px] truncate" title={tech.direccion || 'Sin registrar'}>
                        {tech.direccion || 'Sin registrar'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-xs text-slate-600 font-medium">
                        {formatearFechaTabla(tech.fechaIngreso)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-xs">
                        {tech.tallaBotas || tech.tallaCamisa || tech.tallaPantalon ? (
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100/80 border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">
                              <span className="text-slate-400 mr-0.5">B:</span>{tech.tallaBotas || '-'}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100/80 border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">
                              <span className="text-slate-400 mr-0.5">C:</span>{tech.tallaCamisa || '-'}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100/80 border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">
                              <span className="text-slate-400 mr-0.5">P:</span>{tech.tallaPantalon || '-'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Sin registrar</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                          tech.status === 'activo' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                        )}>
                          {tech.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {esMiPropioPerfil ? (
                            <>
                              {onEditTechnician && (
                                <button 
                                  disabled
                                  className="p-1.5 text-slate-300 cursor-not-allowed opacity-50 rounded-lg bg-white border border-slate-200 shadow-sm"
                                  title="Edición disponible únicamente en tu menú de Configuración"
                                >
                                  <svg className="w-4 h-4 mx-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                </button>
                              )}
                              {onDeleteTechnician && (
                                <button 
                                  disabled
                                  className="p-1.5 text-slate-300 cursor-not-allowed opacity-50 rounded-lg bg-white border border-slate-200 shadow-sm"
                                  title="Acción protegida. Eliminación solo disponible mediante Zona de Peligro"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </>
                          ) : esOtroAdmin ? (
                            <span 
                              className="px-2.5 py-1.5 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase rounded-lg border border-slate-200 flex items-center justify-center gap-1 cursor-not-allowed select-none shadow-sm"
                              title="Este perfil pertenece a otro Administrador General y está protegido contra modificaciones externas."
                            >
                              🔒 Protegido
                            </span>
                          ) : (
                            <>
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
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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
            filteredTechs.map(tech => {
              const esMiPropioPerfil = tech.uid === currentUserId || (tech.email && tech.email.toLowerCase().trim() === currentUserEmail?.toLowerCase().trim());
              const esFilaAdmin = tech.role === 'admin';
              const esOtroAdmin = esFilaAdmin && !esMiPropioPerfil && tech.uid !== currentUserId && tech.email?.toLowerCase().trim() !== currentUserEmail?.toLowerCase().trim();
              return (
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
                        {/* Mobile Dotación */}
                        {(tech.tallaBotas || tech.tallaCamisa || tech.tallaPantalon) && (
                          <div className="mt-1.5 inline-flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[9px] font-bold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm relative z-10">
                              <span className="text-slate-400 mr-0.5">B:</span>{tech.tallaBotas || '-'}
                            </span>
                            <span className="font-mono text-[9px] font-bold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm relative z-10">
                              <span className="text-slate-400 mr-0.5">C:</span>{tech.tallaCamisa || '-'}
                            </span>
                            <span className="font-mono text-[9px] font-bold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm relative z-10">
                              <span className="text-slate-400 mr-0.5">P:</span>{tech.tallaPantalon || '-'}
                            </span>
                          </div>
                        )}
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
                    </div>
                    <div className="flex items-center gap-2">
                      {esMiPropioPerfil ? (
                        <>
                          {onEditTechnician && (
                            <button 
                              disabled
                              className="p-2 text-slate-300 cursor-not-allowed opacity-50 rounded-lg bg-slate-100 border border-slate-200"
                              title="Edición disponible únicamente en tu menú de Configuración"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            </button>
                          )}
                          {onDeleteTechnician && (
                            <button 
                              disabled
                              className="p-2 text-slate-300 cursor-not-allowed opacity-50 rounded-lg bg-slate-100 border border-slate-200"
                              title="Acción protegida. Eliminación solo disponible mediante Zona de Peligro"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </>
                      ) : esOtroAdmin ? (
                        <span 
                          className="px-2.5 py-1 bg-slate-100 text-slate-500 text-[9px] font-bold uppercase rounded-md border border-slate-200 flex items-center gap-1 cursor-not-allowed select-none shadow-sm"
                          title="Este perfil pertenece a otro Administrador General y está protegido contra modificaciones externas."
                        >
                          🔒 Protegido
                        </span>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
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
