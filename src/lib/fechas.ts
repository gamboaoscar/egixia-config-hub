/**
 * Helpers de fecha centralizados: TODAS las horas visibles al usuario se
 * formatean en zona horaria America/Bogota para evitar sorpresas al de
 * noche (donde UTC ya es el día siguiente).
 */
const TZ = "America/Bogota";

function asDate(input: Date | string | number): Date {
  return input instanceof Date ? input : new Date(input);
}

/** Fecha + hora larga en español, en hora de Colombia. */
export function formatoFechaHoraCO(input: Date | string | number): string {
  return asDate(input).toLocaleString("es-CO", {
    timeZone: TZ,
    dateStyle: "long",
    timeStyle: "short",
  });
}

/** Solo hora HH:mm en hora de Colombia. */
export function formatoHoraCO(input: Date | string | number): string {
  return asDate(input).toLocaleTimeString("es-CO", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Solo fecha, formato largo, en hora de Colombia. */
export function formatoFechaCO(input: Date | string | number): string {
  return asDate(input).toLocaleDateString("es-CO", {
    timeZone: TZ,
    dateStyle: "long",
  });
}

/** Fecha corta (dd/mm/yyyy) en hora de Colombia. */
export function formatoFechaCortaCO(input: Date | string | number): string {
  return asDate(input).toLocaleDateString("es-CO", { timeZone: TZ });
}

/** Devuelve YYYY-MM-DD según la zona America/Bogota (no UTC). */
export function fechaISOBogota(input: Date | string | number = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA produce YYYY-MM-DD.
  return fmt.format(asDate(input));
}

/**
 * Fecha "plana" (YYYY-MM-DD, sin componente horario, ej. `fecha_limite`)
 * en formato largo es-CO SIN corrimiento de zona: se parsea y/m/d a mano
 * y se formatea en UTC, de modo que "2026-07-19" siempre se muestre como
 * "19 de julio de 2026" sin importar la zona del navegador.
 */
export function formatoFechaPlanaCO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    dateStyle: "long",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Versión corta de `formatoFechaPlanaCO` (ej. "19 jul 2026"). */
export function formatoFechaPlanaCortaCO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}