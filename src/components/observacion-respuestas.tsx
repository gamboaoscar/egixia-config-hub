import { useState } from "react";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatoFechaHoraCO } from "@/lib/fechas";
import type { RespuestaObservacion } from "@/lib/revision.functions";

/**
 * Hilo de respuestas bajo una observación (canal bidireccional cliente ↔
 * EGIXIA). Se usa en ambos portales: `/app/modulo/:id` y
 * `/mi-proyecto/modulo/:id`. Las respuestas del equipo EGIXIA se
 * distinguen visualmente de las del cliente.
 */
export function HiloRespuestasObservacion({
  respuestas,
  puedeResponder,
  onResponder,
}: {
  respuestas: RespuestaObservacion[];
  /** true solo cuando la observación está `abierta`. */
  puedeResponder: boolean;
  /** Envía la respuesta; debe lanzar en caso de error. */
  onResponder?: (mensaje: string) => Promise<void>;
}) {
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (respuestas.length === 0 && !puedeResponder) return null;

  const handleEnviar = async () => {
    const texto = mensaje.trim();
    if (!texto || !onResponder) return;
    setEnviando(true);
    try {
      await onResponder(texto);
      setMensaje("");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
      {respuestas.map((r) => (
        <div
          key={r.id}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            r.autor_interno
              ? "border-primary/20 bg-primary-soft"
              : "border-border bg-background",
          )}
        >
          <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
            <span
              className={cn(
                "font-medium",
                r.autor_interno ? "text-primary" : "text-foreground",
              )}
            >
              {r.autor_nombre}
              {r.autor_interno ? " · EGIXIA" : ""}
            </span>
            <span>{formatoFechaHoraCO(r.created_at)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {r.mensaje}
          </p>
        </div>
      ))}

      {puedeResponder && onResponder && (
        <div className="flex items-end gap-2">
          <Textarea
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="Responder…"
            rows={2}
            maxLength={2000}
            className="min-h-0 flex-1 bg-background text-sm"
            disabled={enviando}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleEnviar}
            disabled={enviando || mensaje.trim().length === 0}
            aria-label="Enviar respuesta"
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
