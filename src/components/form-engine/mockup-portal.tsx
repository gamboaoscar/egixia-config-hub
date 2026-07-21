import type { ReactNode } from "react";

/**
 * Mockup CSS sobrio y liviano de la pantalla de login del Portal de
 * Proveedores (sin imágenes externas). Se usa para previsualizar EN
 * CONTEXTO las imágenes del módulo Imagen Corporativa:
 *
 * - `variante="logo"`: el `children` se renderiza en el slot del logo,
 *   arriba de la tarjeta de login (proporción 400×110).
 * - `variante="fondo"`: el `children` ES el fondo (cubre el área detrás
 *   de la tarjeta de login).
 *
 * El mockup es responsive: escala dentro de su contenedor (medidas en
 * porcentajes + `aspect-ratio`). El `children` debe ocupar el 100% de su
 * slot (p. ej. un `<img className="h-full w-full object-cover" />`).
 */

const AZUL_EGIXIA = "#0F2B8E";

export function MockupLogin({
  children,
  variante,
}: {
  children: ReactNode;
  variante: "logo" | "fondo";
}) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      {/* Marco de navegador: barra superior con 3 puntos */}
      <div className="flex items-center gap-1.5 border-b border-border bg-muted px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
        <div className="ml-3 h-4 w-1/2 max-w-[240px] rounded-full border border-border bg-background/80" />
      </div>

      {/* Área de la pantalla de login */}
      <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-slate-100 to-slate-200">
        {variante === "fondo" && (
          <div className="absolute inset-0 h-full w-full" aria-hidden={false}>
            {children}
          </div>
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3.5%] p-[5%]">
          {variante === "logo" && (
            <div
              className="flex items-center justify-center overflow-hidden"
              style={{ width: "38%", aspectRatio: "400 / 110" }}
            >
              {children}
            </div>
          )}

          {/* Tarjeta de login con placeholders */}
          <div className="w-[46%] min-w-[150px] rounded-lg bg-white p-[3%] shadow-lg ring-1 ring-black/5">
            {/* Título */}
            <div className="mx-auto h-[7px] w-3/5 rounded-full bg-slate-300" />
            <div className="mx-auto mt-[5%] h-[5px] w-4/5 rounded-full bg-slate-200" />
            {/* Dos inputs grises */}
            <div className="mt-[8%] h-[14px] w-full rounded-md border border-slate-200 bg-slate-100" />
            <div className="mt-[5%] h-[14px] w-full rounded-md border border-slate-200 bg-slate-100" />
            {/* Botón azul EGIXIA */}
            <div
              className="mt-[8%] flex h-[16px] w-full items-center justify-center rounded-md"
              style={{ backgroundColor: AZUL_EGIXIA }}
            >
              <div className="h-[4px] w-2/5 rounded-full bg-white/80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
