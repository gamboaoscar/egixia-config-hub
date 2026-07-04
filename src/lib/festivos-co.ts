/**
 * Festivos oficiales de Colombia.
 *
 * Fijos: Año Nuevo (1 ene), Día del Trabajo (1 may), Independencia
 * (20 jul), Batalla de Boyacá (7 ago), Inmaculada Concepción (8 dic),
 * Navidad (25 dic).
 *
 * Trasladados al lunes siguiente (Ley Emiliani, 51/1983): Reyes,
 * San José, San Pedro y San Pablo, Asunción, Día de la Raza, Todos
 * los Santos, Independencia de Cartagena, Ascensión, Corpus Christi,
 * Sagrado Corazón.
 *
 * Basados en Semana Santa (siempre en su día original, no trasladan):
 * Jueves Santo y Viernes Santo. Los tres domingos móviles (Ascensión,
 * Corpus, Sagrado Corazón) se trasladan al lunes con Emiliani.
 */

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function siguienteLunes(d: Date): Date {
  const r = new Date(d);
  const dia = r.getDay(); // 0=dom, 1=lun
  if (dia === 1) return r;
  const suma = dia === 0 ? 1 : 8 - dia;
  r.setDate(r.getDate() + suma);
  return r;
}

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
function pascua(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, mes - 1, dia);
}

function agregar(base: Date, dias: number): Date {
  const r = new Date(base);
  r.setDate(r.getDate() + dias);
  return r;
}

/** Devuelve el Set de fechas festivas ("YYYY-MM-DD") de un año. */
export function festivosDelAno(year: number): Set<string> {
  const s = new Set<string>();
  // Fijos
  s.add(fmt(new Date(year, 0, 1))); // Año Nuevo
  s.add(fmt(new Date(year, 4, 1))); // Día del Trabajo
  s.add(fmt(new Date(year, 6, 20))); // Independencia
  s.add(fmt(new Date(year, 7, 7))); // Boyacá
  s.add(fmt(new Date(year, 11, 8))); // Inmaculada
  s.add(fmt(new Date(year, 11, 25))); // Navidad

  // Trasladados (Emiliani)
  s.add(fmt(siguienteLunes(new Date(year, 0, 6)))); // Reyes
  s.add(fmt(siguienteLunes(new Date(year, 2, 19)))); // San José
  s.add(fmt(siguienteLunes(new Date(year, 5, 29)))); // San Pedro y San Pablo
  s.add(fmt(siguienteLunes(new Date(year, 7, 15)))); // Asunción
  s.add(fmt(siguienteLunes(new Date(year, 9, 12)))); // Día de la Raza
  s.add(fmt(siguienteLunes(new Date(year, 10, 1)))); // Todos los Santos
  s.add(fmt(siguienteLunes(new Date(year, 10, 11)))); // Cartagena

  // Basados en Pascua
  const p = pascua(year);
  s.add(fmt(agregar(p, -3))); // Jueves Santo
  s.add(fmt(agregar(p, -2))); // Viernes Santo
  s.add(fmt(siguienteLunes(agregar(p, 39)))); // Ascensión
  s.add(fmt(siguienteLunes(agregar(p, 60)))); // Corpus Christi
  s.add(fmt(siguienteLunes(agregar(p, 68)))); // Sagrado Corazón
  return s;
}

const cache = new Map<number, Set<string>>();
function festivos(year: number): Set<string> {
  let r = cache.get(year);
  if (!r) {
    r = festivosDelAno(year);
    cache.set(year, r);
  }
  return r;
}

export function esFinDeSemana(d: Date): boolean {
  const g = d.getDay();
  return g === 0 || g === 6;
}

export function esFestivoCO(d: Date): boolean {
  return festivos(d.getFullYear()).has(fmt(d));
}

export function esNoHabil(d: Date): boolean {
  return esFinDeSemana(d) || esFestivoCO(d);
}

/** Convierte "YYYY-MM-DD" a Date local (sin desfase por UTC). */
export function parseISOLocal(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Formatea Date local a "YYYY-MM-DD". */
export function toISODateLocal(d: Date): string {
  return fmt(d);
}