import { endOfWeek } from 'date-fns';

const normalizarNombreTecnico = (nombre: string): string => {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remueve acentos de letras (ej. 'María' -> 'Maria')
    .replace(/\s+/g, '_')            // Reemplaza múltiples espacios por un guion bajo
    .trim();
};

const mesesEspanol = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface GenerarNombreParams {
  tipoDoc: 'Sobretiempo' | 'Planificacion';
  frecuencia: 'diario' | 'semanal' | 'mensual';
  fechaFiltro: Date; // La fecha seleccionada en el selector del frontend, NO new Date()
  fechaFiltroFin?: Date; // Requerida de forma opcional; se calculará si falta para semanal
  tecnicoSeleccionado?: string | null; // Nombre completo del técnico si hay filtro activo, o null si es global
}

const obtenerRangoSemanaCompleta = (fechaFiltro: Date): { lunes: Date; domingo: Date } => {
  const fecha = new Date(fechaFiltro);
  const diaSemana = fecha.getDay(); // 0: Domingo, 1: Lunes, etc.
  
  // Ajuste matemático para que el lunes sea el día de inicio de semana
  const distanciaALunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() + distanciaALunes);
  
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  
  return { lunes, domingo };
};

export const obtenerNombreArchivoExcel = ({
  tipoDoc,
  frecuencia,
  fechaFiltro,
  fechaFiltroFin,
  tecnicoSeleccionado = null
}: GenerarNombreParams): string => {
  
  // 1. Identificador de Tipo de Documento
  const prefijoDoc = tipoDoc === 'Sobretiempo' ? 'Sobretiempo_CANTV' : 'Planificacion_CANTV';

  // 2. Identificador del Técnico (si el filtro no está en "Todos")
  const seccionTecnico = tecnicoSeleccionado && tecnicoSeleccionado.toLowerCase() !== 'todos'
    ? `${normalizarNombreTecnico(tecnicoSeleccionado)}_` 
    : '';

  // 3. Formateo temporal según la frecuencia seleccionada
  let seccionTemporal = '';

  const anio = fechaFiltro.getFullYear();
  const mesTexto = mesesEspanol[fechaFiltro.getMonth()];

  if (frecuencia === 'diario') {
    const dia = String(fechaFiltro.getDate()).padStart(2, '0');
    // Resultado ej: 11_Mayo_2026
    seccionTemporal = `${dia}_${mesTexto}_${anio}`;

  } else if (frecuencia === 'semanal') {
    // Calculamos el lunes y domingo reales de la semana seleccionada
    const { lunes, domingo } = obtenerRangoSemanaCompleta(fechaFiltro);
    
    const diaInicio = String(lunes.getDate()).padStart(2, '0');
    const mesInicio = String(lunes.getMonth() + 1).padStart(2, '0');
    
    const diaFin = String(domingo.getDate()).padStart(2, '0');
    const mesFin = String(domingo.getMonth() + 1).padStart(2, '0');
    const anioFin = domingo.getFullYear();

    // Resultado garantizado siempre: Semana_Del_01-06_Al_07-06_2026
    seccionTemporal = `Semana_Del_${diaInicio}-${mesInicio}_Al_${diaFin}-${mesFin}_${anioFin}`;

  } else if (frecuencia === 'mensual') {
    // Resultado ej: Mayo_2026
    seccionTemporal = `${mesTexto}_${anio}`;
  }

  // 4. Ensamble final del nombre del archivo
  return `${prefijoDoc}_${seccionTecnico}${seccionTemporal}.xlsx`;
};
