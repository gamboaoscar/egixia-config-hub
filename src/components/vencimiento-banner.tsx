import { AlertTriangle, CalendarClock, Info, Timer } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatoFechaPlanaCortaCO } from "@/lib/fechas";
import { diasHasta, type ComportamientoVencimiento } from "@/lib/modulo-estado";

interface Props {
  fechaLimite: string | null;
  comportamiento: ComportamientoVencimiento | null;
  className?: string;
}

function formatoFecha(iso: string) {
  // Fecha plana sin corrimiento de zona (helper centralizado).
  return formatoFechaPlanaCortaCO(iso);
}

export function VencimientoBanner({ fechaLimite, comportamiento, className }: Props) {
  if (!fechaLimite) return null;
  const dias = diasHasta(fechaLimite);
  if (dias === null) return null;

  const vencido = dias < 0;
  const proximo = dias >= 0 && dias <= 3;

  // Nada que decir si aún queda tiempo cómodo y no hay comportamiento estricto.
  if (!vencido && !proximo) return null;

  let tono = "bg-slate-50 border-slate-200 text-slate-700";
  let icono = <Info className="h-4 w-4" />;
  let mensaje = "";

  if (vencido) {
    switch (comportamiento) {
      case "bloquear":
        tono = "bg-red-50 border-red-200 text-red-800";
        icono = <AlertTriangle className="h-4 w-4" />;
        mensaje = `El plazo venció el ${formatoFecha(fechaLimite)}. El módulo quedó en solo lectura.`;
        break;
      case "editable_avisar":
        tono = "bg-amber-50 border-amber-200 text-amber-800";
        icono = <AlertTriangle className="h-4 w-4" />;
        mensaje = `El plazo venció el ${formatoFecha(fechaLimite)}, pero aún puedes continuar diligenciando.`;
        break;
      case "extension_implementador":
        tono = "bg-amber-50 border-amber-200 text-amber-800";
        icono = <CalendarClock className="h-4 w-4" />;
        mensaje = `El plazo venció el ${formatoFecha(fechaLimite)}. El equipo de EGIXIA puede extender el plazo si lo necesitas.`;
        break;
      case "solo_avisar":
      default:
        tono = "bg-amber-50 border-amber-200 text-amber-800";
        icono = <Info className="h-4 w-4" />;
        mensaje = `El plazo venció el ${formatoFecha(fechaLimite)}.`;
        break;
    }
  } else if (proximo) {
    tono = "bg-blue-50 border-blue-200 text-blue-800";
    icono = <Timer className="h-4 w-4" />;
    mensaje =
      dias === 0
        ? `Hoy es la fecha límite (${formatoFecha(fechaLimite)}).`
        : `Faltan ${dias} día${dias === 1 ? "" : "s"} para el cierre (${formatoFecha(fechaLimite)}).`;
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
        tono,
        className,
      )}
      role="status"
    >
      <span className="mt-0.5">{icono}</span>
      <span>{mensaje}</span>
    </div>
  );
}

/** Devuelve true si el módulo debe forzarse a solo lectura por vencimiento. */
export function vencimientoBloqueaEdicion(
  fechaLimite: string | null,
  comportamiento: ComportamientoVencimiento | null,
): boolean {
  if (!fechaLimite || comportamiento !== "bloquear") return false;
  const dias = diasHasta(fechaLimite);
  return dias !== null && dias < 0;
}