import { CampoRenderer } from "./campo-renderer";
import { campoActivo } from "@/lib/form-engine/validacion";
import { useFormModulo } from "@/lib/form-engine/use-form-modulo";
import type { DatosModulo, ModuloDefinicion } from "@/lib/form-engine/tipos";

interface Props {
  moduloId: string;
  definicion: ModuloDefinicion;
  datosIniciales: DatosModulo;
  soloLectura?: boolean;
}

/**
 * Renderiza un módulo completo: cada sección como tarjeta ("cuadrito") con
 * sus campos. Gestiona autoguardado con debounce, validación en línea y
 * cálculo del % de progreso (persistido en `proyecto_modulos.progreso`).
 */
export function FormularioModulo({
  moduloId,
  definicion,
  datosIniciales,
  soloLectura,
}: Props) {
  const { datos, errores, tocados, setValor, marcarTocado } = useFormModulo({
    moduloId,
    definicion,
    datosIniciales,
    soloLectura,
  });

  return (
    <div className="space-y-6">
      {definicion.secciones.map((seccion) => {
        const camposVisibles = seccion.campos.filter(campoActivo);
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
}