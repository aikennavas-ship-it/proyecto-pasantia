/**
 * Extrae dinámicamente el primer nombre y el primer apellido
 * para optimizar el espacio horizontal en el Header de la aplicación.
 */
/**
 * Capitaliza cada palabra de un nombre para darle formato humano.
 */
export const capitalizarNombre = (nombre: string): string => {
  if (!nombre) return '';
  return nombre
    .toLowerCase()
    .split(/\s+/)
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(' ');
};

/**
 * Genera un mensaje de inicio de sesión natural y humano.
 */
export const generarMensajeLogin = (nombre: string, rol: string): string => {
  const nombreFormateado = capitalizarNombre(nombre);
  return `${nombreFormateado} inició sesión en el sistema.`;
};
export const obtenerNombreCorto = (nombreCompleto: string | null | undefined): string => {
  if (!nombreCompleto) return 'Usuario';
  
  // 1. Limpiar espacios en blanco al inicio/final y dividir por cualquier espacio interno
  const partes = nombreCompleto.trim().split(/\s+/);
  
  if (partes.length === 1) return partes[0];
  
  // 2. Extraer de forma segura el primer nombre y el primer apellido
  // Asumiendo formato "Nombres Apellidos" unidos en una sola cadena.
  const primerNombre = partes[0] || '';
  
  // heurística para apellido: tomando la palabra justo después de la mitad (funciona para 2, 3 o 4 palabras)
  const indexApellido = partes.length > 2 ? Math.floor(partes.length / 2) : 1;
  const primerApellido = partes[indexApellido] || '';

  // 3. Retornar el nombre corto combinado (ej: "Ackerley Navas")
  return `${primerNombre} ${primerApellido}`.trim();
};

const mesesEspanolAbv = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'
];

/**
 * Formatea un rango de fechas semanal de manera compacta e inteligente.
 */
export const formatearRangoSemanal = (fechaInicio: Date, fechaFin: Date): string => {
  const diaI = String(fechaInicio.getDate()).padStart(2, '0');
  const mesI = mesesEspanolAbv[fechaInicio.getMonth()];
  const anioI = fechaInicio.getFullYear();

  const diaF = String(fechaFin.getDate()).padStart(2, '0');
  const mesF = mesesEspanolAbv[fechaFin.getMonth()];
  const anioF = fechaFin.getFullYear();

  // Caso A: Mismo mes y mismo año (ej: 01 - 07 JUN)
  if (fechaInicio.getMonth() === fechaFin.getMonth() && anioI === anioF) {
    return `${diaI} - ${diaF} ${mesF}`;
  }

  // Caso B: Distinto mes, mismo año (ej: 27 ABR - 03 MAY)
  if (anioI === anioF) {
    return `${diaI} ${mesI} - ${diaF} ${mesF}`;
  }

  // Caso C: Distinto año (ej: 29 DIC 2025 - 04 ENE 2026)
  return `${diaI} ${mesI} ${String(anioI).slice(-2)} - ${diaF} ${mesF} ${String(anioF).slice(-2)}`;
};


