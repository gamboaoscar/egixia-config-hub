import type { LucideIcon } from "lucide-react";

/**
 * Motor de formularios EGIXIA — definición declarativa de módulos.
 *
 * Un módulo describe secciones y campos; el renderizador
 * (`<FormularioModulo />`) pinta la UI y gestiona el estado.
 */

export type TipoCampo =
  | "texto"
  | "textarea"
  | "numero"
  | "email"
  | "url"
  | "select"
  | "radio_tarjetas"
  | "color"
  | "archivo"
  | "tabla";

/** Reglas de validación soportadas por el motor. */
export interface ReglasValidacion {
  /** URL debe comenzar con https:// */
  url_https?: boolean;
  /** Formato de email válido */
  email?: boolean;
  /** Mínimo (número) o longitud mínima (texto) */
  min?: number;
  /** Máximo (número) o longitud máxima (texto) */
  max?: number;
  /** Longitud exacta (texto) */
  longitud?: number;
}

/** Guía contextual del botón "i" al lado de la etiqueta. */
export interface GuiaCampo {
  /** Qué debe ingresar el usuario en el campo. */
  que: string;
  /** Formato esperado del valor (ej. "PNG con transparencia"). */
  formato?: string;
  /** Tamaño / medida recomendada (ej. "512x512 px", "máx 2 MB"). */
  tamano?: string;
}

export interface OpcionCampo {
  valor: string;
  etiqueta: string;
  descripcion?: string;
  /** Para tipo 'color': valor hex mostrado en la ficha. */
  hex?: string;
}

/** Definición de una columna para el tipo 'tabla'. */
export interface ColumnaTabla {
  key: string;
  label: string;
  tipo: "texto" | "email" | "url" | "numero";
  requerido?: boolean;
}

export interface CampoDefinicion {
  key: string;
  label: string;
  tipo: TipoCampo;
  requerido?: boolean;
  guia?: GuiaCampo;
  opciones?: OpcionCampo[];
  validacion?: ReglasValidacion;
  /** Placeholder del input, cuando aplique. */
  placeholder?: string;
  /** Configuración de tabla dinámica (tipo 'tabla'). */
  columnas?: ColumnaTabla[];
  /**
   * Si `false`, el campo está desactivado por configuración del proyecto:
   * no se renderiza y no cuenta para el progreso. Por defecto: `true`.
   */
  activo?: boolean;
}

export interface SeccionDefinicion {
  key: string;
  titulo: string;
  descripcion?: string;
  campos: CampoDefinicion[];
}

export interface ModuloDefinicion {
  key: string;
  nombre: string;
  icono?: LucideIcon;
  descripcion?: string;
  secciones: SeccionDefinicion[];
}

/** Datos de un módulo tal como se guardan en `proyecto_modulos.datos`. */
export type DatosModulo = Record<string, unknown>;