import { fechaISOBogota } from "@/lib/fechas";

export type ModuloEstado =
  | "sin_iniciar"
  | "en_diligenciamiento"
  | "en_revision"
  | "con_observaciones"
  | "aprobado";

export type ComportamientoVencimiento =
  | "bloquear"
  | "editable_avisar"
  | "solo_avisar"
  | "extension_implementador";

export const ESTADO_LABEL: Record<ModuloEstado, string> = {
  sin_iniciar: "Sin iniciar",
  en_diligenciamiento: "En diligenciamiento",
  en_revision: "En revisión",
  con_observaciones: "Con observaciones",
  aprobado: "Aprobado",
};

/** Colores de la pastilla de estado (tokens de Tailwind, sin hardcodes de tema). */
export const ESTADO_CLASSES: Record<ModuloEstado, string> = {
  sin_iniciar: "bg-slate-100 text-slate-700 border-slate-200",
  en_diligenciamiento: "bg-blue-50 text-blue-700 border-blue-200",
  en_revision: "bg-sky-50 text-sky-700 border-sky-200",
  con_observaciones: "bg-amber-50 text-amber-800 border-amber-200",
  aprobado: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

/** Estados en los que un invitado puede editar el módulo. */
export const ESTADOS_EDITABLES: ModuloEstado[] = [
  "sin_iniciar",
  "en_diligenciamiento",
  "con_observaciones",
];

export function esEditablePorInvitado(estado: ModuloEstado): boolean {
  return ESTADOS_EDITABLES.includes(estado);
}

/**
 * Etiqueta contextual del botón principal del módulo desde el dashboard.
 */
export function botonAccionModulo(estado: ModuloEstado): string {
  switch (estado) {
    case "sin_iniciar":
      return "Comenzar";
    case "en_diligenciamiento":
      return "Continuar";
    case "con_observaciones":
      return "Corregir observaciones";
    case "en_revision":
    case "aprobado":
      return "Ver";
  }
}

/** Días hasta la fecha límite (negativo si ya venció). */
export function diasHasta(fecha: string | null | undefined): number | null {
  if (!fecha) return null;
  // "Hoy" se calcula en zona America/Bogota y el diff en UTC puro:
  // nada de `new Date()` local, que cambia de día según la zona del
  // navegador o del servidor.
  const hoy = fechaISOBogota();
  const [hy, hm, hd] = hoy.split("-").map(Number);
  const [fy, fm, fd] = fecha.split("-").map(Number);
  const diff = Date.UTC(fy, fm - 1, fd) - Date.UTC(hy, hm - 1, hd);
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

/** ¿El módulo ya venció según su fecha límite? */
export function moduloVencido(fechaLimite: string | null | undefined): boolean {
  const dias = diasHasta(fechaLimite);
  return dias !== null && dias < 0;
}

/**
 * Devuelve true si el módulo debe forzarse a solo lectura por vencimiento.
 *
 * Bloquean la edición al vencer:
 *   - `bloquear`: bloqueo definitivo (solo un interno cambia la fecha).
 *   - `extension_implementador`: bloqueo hasta que el implementador
 *     conceda una extensión (el cliente puede solicitarla desde su
 *     portal). Antes se comportaba igual que `solo_avisar`, lo que
 *     dejaba el comportamiento sin efecto real.
 */
export function vencimientoBloqueaEdicion(
  fechaLimite: string | null,
  comportamiento: ComportamientoVencimiento | null,
): boolean {
  if (
    !fechaLimite ||
    (comportamiento !== "bloquear" && comportamiento !== "extension_implementador")
  ) {
    return false;
  }
  return moduloVencido(fechaLimite);
}