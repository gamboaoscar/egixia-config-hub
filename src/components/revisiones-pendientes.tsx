import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Inbox } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { moduloCatalogo } from "@/lib/modulos-catalogo";
import { EstadoPastilla } from "@/components/estado-pastilla";

interface Fila {
  id: string;
  modulo_key: string;
  estado: "en_revision" | "con_observaciones";
  progreso: number;
  enviado_at: string | null;
  proyectos: { nombre: string; empresa: string | null } | null;
}

export function RevisionesPendientes() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("proyecto_modulos")
      .select(
        "id, modulo_key, estado, progreso, enviado_at, proyectos(nombre, empresa)",
      )
      .in("estado", ["en_revision"])
      .order("enviado_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error("[revisiones] cargar", error);
        setFilas((data ?? []) as unknown as Fila[]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="mx-auto h-40 max-w-4xl animate-pulse rounded-2xl bg-muted" />;
  }

  if (filas.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
          <Inbox className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            Sin módulos por revisar
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Cuando un proveedor envíe un módulo a revisión aparecerá aquí.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      {filas.map((f) => {
        const cat = moduloCatalogo(f.modulo_key);
        const Icon = cat.icon;
        return (
          <Link
            key={f.id}
            to="/app/modulo/$moduloId"
            params={{ moduloId: f.id }}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {cat.nombre}
                </h3>
                <EstadoPastilla estado={f.estado} />
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {f.proyectos?.nombre}
                {f.proyectos?.empresa ? ` · ${f.proyectos.empresa}` : ""}
                {f.enviado_at
                  ? ` · enviado el ${new Date(f.enviado_at).toLocaleDateString("es-CO")}`
                  : ""}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        );
      })}
    </div>
  );
}