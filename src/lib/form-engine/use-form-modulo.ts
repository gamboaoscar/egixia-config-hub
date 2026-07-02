import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useMiProyecto } from "@/hooks/use-mi-proyecto";

import type { DatosModulo, ModuloDefinicion } from "./tipos";
import { calcularProgreso, validarCampo, validarModulo } from "./validacion";

interface Params {
  moduloId: string;
  definicion: ModuloDefinicion;
  datosIniciales: DatosModulo;
  soloLectura?: boolean;
  debounceMs?: number;
}

export function useFormModulo({
  moduloId,
  definicion,
  datosIniciales,
  soloLectura = false,
  debounceMs = 700,
}: Params) {
  const { setSaveStatus, markSaved, refreshModulos } = useMiProyecto();
  const [datos, setDatos] = useState<DatosModulo>(datosIniciales);
  const [errores, setErrores] = useState<Record<string, string>>(() =>
    validarModulo(definicion, datosIniciales, false),
  );
  const [tocados, setTocados] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Si cambia el módulo activo, resetear estado local.
  useEffect(() => {
    setDatos(datosIniciales);
    setErrores(validarModulo(definicion, datosIniciales, false));
    setTocados({});
  }, [moduloId, definicion, datosIniciales]);

  const persistir = useCallback(
    async (nuevos: DatosModulo) => {
      const progreso = calcularProgreso(definicion, nuevos);
      setSaveStatus("saving");
      const { error } = await supabase
        .from("proyecto_modulos")
        .update({ datos: nuevos as never, progreso })
        .eq("id", moduloId);
      if (error) {
        console.error("[form-engine] autosave", error);
        setSaveStatus("error");
        return;
      }
      markSaved();
      refreshModulos();
    },
    [moduloId, definicion, setSaveStatus, markSaved, refreshModulos],
  );

  const setValor = useCallback(
    (campoKey: string, valor: unknown) => {
      if (soloLectura) return;
      setDatos((prev) => {
        const nuevos = { ...prev, [campoKey]: valor };
        // Validación en línea del campo modificado.
        const campo = definicion.secciones
          .flatMap((s) => s.campos)
          .find((c) => c.key === campoKey);
        if (campo) {
          const err = validarCampo(campo, valor, false);
          setErrores((prevErr) => {
            const next = { ...prevErr };
            if (err) next[campoKey] = err;
            else delete next[campoKey];
            return next;
          });
        }
        // Autosave con debounce (no bloqueado por errores de formato).
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          persistir(nuevos);
        }, debounceMs);
        return nuevos;
      });
    },
    [definicion, soloLectura, persistir, debounceMs],
  );

  const marcarTocado = useCallback((campoKey: string) => {
    setTocados((p) => (p[campoKey] ? p : { ...p, [campoKey]: true }));
  }, []);

  // Cleanup del debounce al desmontar.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const progreso = calcularProgreso(definicion, datos);

  return {
    datos,
    errores,
    tocados,
    setValor,
    marcarTocado,
    progreso,
  };
}