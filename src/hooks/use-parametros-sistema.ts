import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ParametrosSistema {
  dias_alerta_vencimiento: number;
  autoguardado_debounce_ms: number;
  bloquear_fines_semana_festivos: boolean;
}

const DEFAULTS: ParametrosSistema = {
  dias_alerta_vencimiento: 3,
  autoguardado_debounce_ms: 800,
  bloquear_fines_semana_festivos: false,
};

/**
 * Lee la fila `parametros` de `configuracion_sistema`. Devuelve valores
 * por defecto mientras carga y si la consulta falla.
 */
export function useParametrosSistema(): ParametrosSistema {
  const [p, setP] = useState<ParametrosSistema>(DEFAULTS);
  useEffect(() => {
    let cancelado = false;
    supabase
      .from("configuracion_sistema")
      .select("valor")
      .eq("clave", "parametros")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelado || !data) return;
        const v = (data.valor ?? {}) as Partial<ParametrosSistema>;
        setP({ ...DEFAULTS, ...v });
      });
    return () => {
      cancelado = true;
    };
  }, []);
  return p;
}