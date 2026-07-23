import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Paginación estándar de grids/listas de EGIXIA Configurator.
//
// Reglas de negocio:
// - Tamaño de página por defecto = 5.
// - Selector con opciones 5 / 10 / 20 en cada grid.
// - Al cambiar el tamaño se vuelve a la página 1.
// - Controles Anterior/Siguiente + indicador "X–Y de N · Página X de Y".
// - La preferencia de tamaño se recuerda por grid vía localStorage con
//   clave estable `egixia:pageSize:<gridId>` y fallback a 5 si no hay valor
//   o es inválido.
//
// Es paginación en cliente sobre listas ya cargadas en memoria: se aplica
// SIEMPRE después del filtro/orden que haga cada grid.

export const TAMANOS_PAGINA = [5, 10, 20] as const;
export type TamanoPagina = (typeof TAMANOS_PAGINA)[number];

export const TAMANO_PAGINA_DEFAULT: TamanoPagina = 5;

function claveTamano(gridId: string): string {
  return `egixia:pageSize:${gridId}`;
}

function esTamanoValido(n: number): n is TamanoPagina {
  return (TAMANOS_PAGINA as readonly number[]).includes(n);
}

function leerTamano(gridId: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(claveTamano(gridId));
    if (!raw) return fallback;
    const n = Number(raw);
    return esTamanoValido(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function guardarTamano(gridId: string, n: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(claveTamano(gridId), String(n));
  } catch {
    // localStorage puede no estar disponible (modo privado, cuota, SSR).
  }
}

export interface Paginacion<T> {
  /** Página actual (1-based), ya "clampeada" al total disponible. */
  pagina: number;
  /** Cambia la página; el valor se acota automáticamente al rango válido. */
  setPagina: (pagina: number) => void;
  /** Tamaño de página actual (5, 10 o 20). */
  tamano: number;
  /** Cambia el tamaño, persiste la preferencia y vuelve a la página 1. */
  setTamano: (tamano: number) => void;
  /** Número total de páginas (mínimo 1). */
  totalPaginas: number;
  /** Los ítems de la página actual. */
  itemsPagina: T[];
  /** Texto "X–Y de N · Página X de Y" para el indicador. */
  rangoTexto: string;
  /** Total de ítems (antes de paginar, después de filtrar). */
  total: number;
}

/**
 * Hook de paginación en cliente para una lista ya cargada en memoria.
 *
 * @param items Lista completa (ya filtrada/ordenada por el grid).
 * @param gridId Identificador estable y único del grid (clave de persistencia).
 * @param defaultSize Tamaño inicial si no hay preferencia guardada (por defecto 5).
 */
export function usePaginacion<T>(
  items: T[],
  gridId: string,
  defaultSize: number = TAMANO_PAGINA_DEFAULT,
): Paginacion<T> {
  const [tamano, setTamanoState] = React.useState<number>(() =>
    leerTamano(gridId, defaultSize),
  );
  const [pagina, setPaginaState] = React.useState(1);

  const total = items.length;
  const totalPaginas = Math.max(1, Math.ceil(total / tamano));
  const paginaClamped = Math.min(Math.max(1, pagina), totalPaginas);

  // Si el total se reduce y la página actual queda fuera de rango, sincroniza
  // el estado con la página acotada.
  React.useEffect(() => {
    if (pagina !== paginaClamped) setPaginaState(paginaClamped);
  }, [pagina, paginaClamped]);

  const itemsPagina = React.useMemo(
    () => items.slice((paginaClamped - 1) * tamano, paginaClamped * tamano),
    [items, paginaClamped, tamano],
  );

  const setTamano = React.useCallback(
    (nuevo: number) => {
      setTamanoState(nuevo);
      guardarTamano(gridId, nuevo);
      setPaginaState(1);
    },
    [gridId],
  );

  const setPagina = React.useCallback((p: number) => {
    setPaginaState(Math.max(1, p));
  }, []);

  const desde = total === 0 ? 0 : (paginaClamped - 1) * tamano + 1;
  const hasta = Math.min(paginaClamped * tamano, total);
  const rangoTexto = `${desde}–${hasta} de ${total} · Página ${paginaClamped} de ${totalPaginas}`;

  return {
    pagina: paginaClamped,
    setPagina,
    tamano,
    setTamano,
    totalPaginas,
    itemsPagina,
    rangoTexto,
    total,
  };
}

export interface ControlesPaginacionProps {
  pagina: number;
  setPagina: (pagina: number) => void;
  tamano: number;
  setTamano: (tamano: number) => void;
  totalPaginas: number;
  rangoTexto: string;
  className?: string;
}

/**
 * Barra de controles de paginación: selector de tamaño (5/10/20),
 * indicador de rango y botones Anterior/Siguiente.
 *
 * Uso típico: `<ControlesPaginacion {...pag} />` donde `pag` es el retorno
 * de `usePaginacion`. Los campos extra del hook (itemsPagina, total) se
 * ignoran sin problema.
 */
export function ControlesPaginacion({
  pagina,
  setPagina,
  tamano,
  setTamano,
  totalPaginas,
  rangoTexto,
  className,
}: ControlesPaginacionProps) {
  return (
    <div
      className={
        "mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" +
        (className ? ` ${className}` : "")
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={String(tamano)}
          onValueChange={(v) => setTamano(Number(v))}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="Filas por página">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TAMANOS_PAGINA.map((n) => (
              <SelectItem key={n} value={String(n)} className="text-xs">
                {n} por página
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{rangoTexto}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPagina(pagina - 1)}
          disabled={pagina <= 1}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Anterior
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPagina(pagina + 1)}
          disabled={pagina >= totalPaginas}
        >
          Siguiente
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
