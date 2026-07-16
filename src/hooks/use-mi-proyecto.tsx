import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type {
  ComportamientoVencimiento,
  ModuloEstado,
} from "@/lib/modulo-estado";
import type { CampoOverride } from "@/lib/form-engine/overrides";

export interface ProyectoLite {
  id: string;
  nombre: string;
  empresa: string;
  estado: string;
}

export interface ProyectoModulo {
  id: string;
  proyecto_id: string;
  modulo_key: string;
  estado: ModuloEstado;
  fecha_limite: string | null;
  comportamiento_vencimiento: ComportamientoVencimiento | null;
  datos: Record<string, unknown>;
  progreso: number;
  updated_at: string;
  updated_por: string | null;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface MiProyectoContextValue {
  loading: boolean;
  proyectos: ProyectoLite[];
  modulos: ProyectoModulo[];
  proyectoById: (id: string) => ProyectoLite | undefined;
  modulosDeProyecto: (proyectoId: string) => ProyectoModulo[];
  overridesDeProyecto: (proyectoId: string) => CampoOverride[];
  moduloById: (id: string) => ProyectoModulo | undefined;
  refreshModulos: () => Promise<void>;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  setSaveStatus: (s: SaveStatus) => void;
  markSaved: () => void;
}

const Ctx = createContext<MiProyectoContextValue | undefined>(undefined);

export function MiProyectoProvider({ children }: { children: ReactNode }) {
  const { profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [proyectos, setProyectos] = useState<ProyectoLite[]>([]);
  const [modulos, setModulos] = useState<ProyectoModulo[]>([]);
  const [overrides, setOverrides] = useState<
    Array<CampoOverride & { proyecto_id: string }>
  >([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const refreshProyectos = useCallback(async () => {
    if (!profile) return;
    // RLS: el invitado solo verá los proyectos donde es miembro activo.
    const { data, error } = await supabase
      .from("proyectos")
      .select("id, nombre, empresa, estado")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[mi-proyecto] error cargando proyectos", error);
      setProyectos([]);
      return;
    }
    setProyectos((data ?? []) as ProyectoLite[]);
  }, [profile]);

  const refreshModulos = useCallback(async () => {
    if (!profile) {
      setModulos([]);
      return;
    }
    const { data, error } = await supabase
      .from("proyecto_modulos")
      .select(
        "id, proyecto_id, modulo_key, estado, fecha_limite, comportamiento_vencimiento, datos, progreso, updated_at, updated_por",
      )
      .order("modulo_key");
    if (error) {
      console.error("[mi-proyecto] error cargando módulos", error);
      setModulos([]);
      return;
    }
    setModulos((data ?? []) as ProyectoModulo[]);
  }, [profile]);

  const refreshOverrides = useCallback(async () => {
    if (!profile) { setOverrides([]); return; }
    const { data } = await supabase
      .from("catalogo_overrides")
      .select("proyecto_id, modulo_key, campo_key, activo, label, requerido, guia");
    setOverrides(
      (data ?? []) as unknown as Array<CampoOverride & { proyecto_id: string }>,
    );
  }, [profile]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    Promise.all([refreshProyectos(), refreshModulos(), refreshOverrides()]).finally(
      () => setLoading(false),
    );
  }, [authLoading, refreshProyectos, refreshModulos, refreshOverrides]);

  const moduloById = useCallback(
    (id: string) => modulos.find((m) => m.id === id),
    [modulos],
  );
  const proyectoById = useCallback(
    (id: string) => proyectos.find((p) => p.id === id),
    [proyectos],
  );
  const modulosDeProyecto = useCallback(
    (id: string) => modulos.filter((m) => m.proyecto_id === id),
    [modulos],
  );
  const overridesDeProyecto = useCallback(
    (id: string) =>
      overrides
        .filter((o) => o.proyecto_id === id)
        .map(({ proyecto_id: _p, ...rest }) => rest as CampoOverride),
    [overrides],
  );

  const markSaved = useCallback(() => {
    setSaveStatus("saved");
    setLastSavedAt(new Date());
  }, []);

  const value = useMemo<MiProyectoContextValue>(
    () => ({
      loading,
      proyectos,
      modulos,
      proyectoById,
      modulosDeProyecto,
      overridesDeProyecto,
      moduloById,
      refreshModulos,
      saveStatus,
      lastSavedAt,
      setSaveStatus,
      markSaved,
    }),
    [
      loading,
      proyectos,
      modulos,
      proyectoById,
      modulosDeProyecto,
      overridesDeProyecto,
      moduloById,
      refreshModulos,
      saveStatus,
      lastSavedAt,
      markSaved,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMiProyecto() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useMiProyecto debe usarse dentro de <MiProyectoProvider>");
  return ctx;
}

/** Versión segura para componentes compartidos (p. ej. AppSidebar). */
export function useMiProyectoOptional() {
  return useContext(Ctx);
}

/**
 * Hook de autoguardado con debounce para el diligenciamiento de un módulo.
 * La Parte 5 llamará `saveDatos(datos, progreso)` cada vez que el usuario
 * modifique un campo. Aquí ya queda cableado el estado "Guardado".
 */
export function useAutosaveModulo(moduloId: string | null, debounceMs = 800) {
  const { setSaveStatus, markSaved, refreshModulos } = useMiProyecto();

  const saveDatos = useCallback(
    (datos: Record<string, unknown>, progreso?: number) => {
      if (!moduloId) return Promise.resolve();
      setSaveStatus("saving");
      return new Promise<void>((resolve) => {
        // Debounce simple: cada llamada reemplaza la anterior.
        clearTimeout((saveDatos as unknown as { _t?: number })._t);
        (saveDatos as unknown as { _t?: number })._t = window.setTimeout(async () => {
          const payload =
            typeof progreso === "number"
              ? { datos: datos as never, progreso }
              : { datos: datos as never };
          const { error } = await supabase
            .from("proyecto_modulos")
            .update(payload)
            .eq("id", moduloId);
          if (error) {
            console.error("[autosave] error", error);
            setSaveStatus("error");
          } else {
            markSaved();
            refreshModulos();
          }
          resolve();
        }, debounceMs);
      });
    },
    [moduloId, debounceMs, setSaveStatus, markSaved, refreshModulos],
  );

  return { saveDatos };
}