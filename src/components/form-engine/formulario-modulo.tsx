import { forwardRef, useEffect, useImperativeHandle, useMemo } from "react";
import { toast } from "sonner";
import { CampoRenderer } from "./campo-renderer";
import { campoActivo, campoVisible } from "@/lib/form-engine/validacion";
import { useFormModulo } from "@/lib/form-engine/use-form-modulo";
import type { DatosModulo, ModuloDefinicion } from "@/lib/form-engine/tipos";

interface Props {
  moduloId: string;
  proyectoId: string;
  definicion: ModuloDefinicion;
  datosIniciales: DatosModulo;
  soloLectura?: boolean;
  /** Si se define, no autopersiste; emite cambios al padre. */
  onCambio?: (datos: DatosModulo) => void;
  /** Reporta el % de progreso calculado en tiempo real. */
  onProgreso?: (progreso: number) => void;
  /** Reporta los `campo.key` obligatorios sin completar. */
  onFaltantes?: (faltantes: string[]) => void;
}

export interface FormularioModuloHandle {
  /**
   * Marca todos los campos como tocados (para mostrar mensajes de error),
   * desplaza el foco al primer campo obligatorio faltante y devuelve la
   * lista de campos faltantes.
   */
  mostrarFaltantes: () => string[];
  /** Fuerza el guardado inmediato de los cambios pendientes. */
  flush: () => Promise<void>;
}

/**
 * Renderiza un módulo completo: cada sección como tarjeta ("cuadrito") con
 * sus campos. Gestiona autoguardado con debounce, validación en línea y
 * cálculo del % de progreso (persistido en `proyecto_modulos.progreso`).
 */
export const FormularioModulo = forwardRef<FormularioModuloHandle, Props>(function FormularioModulo(
  {
    moduloId,
    proyectoId,
    definicion,
    datosIniciales,
    soloLectura,
    onCambio,
    onProgreso,
    onFaltantes,
  },
  ref,
) {
  const {
    datos,
    errores,
    tocados,
    setValor,
    marcarTocado,
    marcarTodosTocados,
    faltantes,
    progreso,
    flush,
  } = useFormModulo({
    moduloId,
    definicion,
    datosIniciales,
    soloLectura,
    onCambio,
  });

  useEffect(() => {
    onProgreso?.(progreso);
  }, [progreso, onProgreso]);

  // `faltantes` cambia de referencia en cada render aunque su contenido
  // sea el mismo, así que dependemos de una clave serializada para no
  // provocar bucles de setState en el padre.
  const faltantesKey = useMemo(() => faltantes.join("|"), [faltantes]);
  useEffect(() => {
    onFaltantes?.(faltantes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faltantesKey, onFaltantes]);

  useImperativeHandle(
    ref,
    () => ({
      mostrarFaltantes: () => {
        marcarTodosTocados();
        if (faltantes.length > 0 && typeof document !== "undefined") {
          toast.error(
            `Aún faltan ${faltantes.length} campo(s) obligatorio(s) por completar.`,
          );
          const primero = faltantes[0];
          // Esperamos al siguiente frame para que el DOM refleje los errores.
          requestAnimationFrame(() => {
            const el =
              document.getElementById(`campo-${primero}`) ??
              document.querySelector(`[data-campo-key="${primero}"]`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              if (el instanceof HTMLElement && typeof el.focus === "function") {
                try {
                  el.focus({ preventScroll: true });
                } catch {
                  el.focus();
                }
              }
            }
          });
        }
        return faltantes;
      },
      flush,
    }),
    [faltantes, marcarTodosTocados, flush],
  );

  return (
    <div className="space-y-6">
      {!soloLectura && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Los campos marcados con{" "}
          <span className="font-semibold text-primary">*</span> son obligatorios.
          Los demás son opcionales.
        </p>
      )}
      {definicion.secciones.map((seccion) => {
        const camposVisibles = seccion.campos.filter(
          (c) => campoActivo(c) && campoVisible(c, datos),
        );
        if (camposVisibles.length === 0) return null;
        return (
          <section
            key={seccion.key}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
          >
            <header className="mb-4">
              <h3 className="text-base font-semibold text-foreground">
                {seccion.titulo}
              </h3>
              {seccion.descripcion && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {seccion.descripcion}
                </p>
              )}
            </header>
            <div className="grid gap-5">
              {camposVisibles.map((campo) => (
                <CampoRenderer
                  key={campo.key}
                  campo={campo}
                  valor={datos[campo.key]}
                  error={tocados[campo.key] ? errores[campo.key] : undefined}
                  disabled={soloLectura}
                  proyectoId={proyectoId}
                  moduloId={moduloId}
                  onChange={(v) => {
                    marcarTocado(campo.key);
                    setValor(campo.key, v);
                  }}
                  onBlur={() => marcarTocado(campo.key)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
});