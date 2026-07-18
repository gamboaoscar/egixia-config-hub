import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useMiProyectoOptional } from "@/hooks/use-mi-proyecto";

import type { DatosModulo, ModuloDefinicion } from "./tipos";
import {
  calcularProgreso,
  camposRequeridosFaltantes,
  validarCampo,
  validarModulo,
} from "./validacion";

interface Params {
  moduloId: string;
  definicion: ModuloDefinicion;
  datosIniciales: DatosModulo;
  soloLectura?: boolean;
  debounceMs?: number;
  /**
   * Si se define, el hook NO autopersiste en Supabase; en su lugar emite
   * los datos actualizados hacia el padre (usado por el flujo de edición
   * del implementador, que guarda vía server function con auditoría).
   */
  onCambio?: (datos: DatosModulo) => void;
}

export function useFormModulo({
  moduloId,
  definicion,
  datosIniciales,
  soloLectura = false,
  debounceMs = 700,
  onCambio,
}: Params) {
  const mi = useMiProyectoOptional();
  const setSaveStatus = mi?.setSaveStatus ?? (() => {});
  const markSaved = mi?.markSaved ?? (() => {});
  const refreshModulos = mi?.refreshModulos ?? (() => {});
  const [datos, setDatos] = useState<DatosModulo>(datosIniciales);
  const [errores, setErrores] = useState<Record<string, string>>(() =>
    validarModulo(definicion, datosIniciales, false),
  );
  const [tocados, setTocados] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moduloIdRef = useRef<string>(moduloId);
  const definicionRef = useRef<ModuloDefinicion>(definicion);
  const datosRef = useRef<DatosModulo>(datosIniciales);
  useEffect(() => {
    definicionRef.current = definicion;
  }, [definicion]);

  // Reset del estado local SÓLO cuando cambia el módulo activo. Antes
  // dependíamos también de `definicion`/`datosIniciales`; como el padre
  // re-crea esas referencias en cada render, el estado se reseteaba
  // durante los autosaves y se perdían datos ya escritos por el usuario.
  useEffect(() => {
    if (moduloIdRef.current === moduloId) return;
    moduloIdRef.current = moduloId;
    setDatos(datosIniciales);
    datosRef.current = datosIniciales;
    setErrores(validarModulo(definicion, datosIniciales, false));
    setTocados({});
  }, [moduloId, definicion, datosIniciales]);

  const persistir = useCallback(
    async (nuevos: DatosModulo) => {
      if (onCambio) return; // el padre se encarga de guardar
      const progreso = calcularProgreso(definicionRef.current, nuevos);
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
    [moduloId, setSaveStatus, markSaved, refreshModulos, onCambio],
  );

  const setValor = useCallback(
    (campoKey: string, valor: unknown) => {
      if (soloLectura) return;
      setDatos((prev) => {
        const nuevos = { ...prev, [campoKey]: valor };
        datosRef.current = nuevos;
        // Validación en línea del campo modificado.
        const campo = definicionRef.current.secciones
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
        if (onCambio) {
          onCambio(nuevos);
        } else {
          // Autosave con debounce (no bloqueado por errores de formato).
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            persistir(nuevos);
          }, debounceMs);
        }
        return nuevos;
      });
    },
    [soloLectura, persistir, debounceMs, onCambio],
  );

  /**
   * Fuerza el guardado inmediato de los datos actuales, cancelando el
   * debounce pendiente. Se usa antes de acciones críticas (enviar a
   * revisión, previsualizar acta) para no perder cambios en vuelo.
   */
  const flush = useCallback(async () => {
    if (onCambio) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await persistir(datosRef.current);
  }, [onCambio, persistir]);

  const marcarTocado = useCallback((campoKey: string) => {
    setTocados((p) => (p[campoKey] ? p : { ...p, [campoKey]: true }));
  }, []);

  const marcarTodosTocados = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const s of definicion.secciones) {
      for (const c of s.campos) {
        if (c.tipo !== "info") next[c.key] = true;
      }
    }
    setTocados(next);
  }, [definicion]);

  // Cleanup del debounce al desmontar.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const progreso = calcularProgreso(definicion, datos);
  const faltantes = camposRequeridosFaltantes(definicion, datos);

  return {
    datos,
    errores,
    tocados,
    setValor,
    marcarTocado,
    marcarTodosTocados,
    faltantes,
    progreso,
    flush,
  };
}