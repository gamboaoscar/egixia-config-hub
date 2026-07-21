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
  | "checkbox_multiple"
  | "color"
  | "archivo"
  | "tabla"
  | "info";

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

/**
 * Origen dinámico de opciones: filtra las `opciones` estáticas dejando
 * solo las seleccionadas en el campo `checkbox_multiple` de otro módulo
 * del mismo proyecto (p. ej. los roles internos marcados en Seguridad).
 * Si el módulo origen no existe o su selección está vacía, se muestran
 * las opciones completas.
 */
export interface OpcionesDesde {
  moduloKey: string;
  campoKey: string;
}

/** Definición de una columna para el tipo 'tabla'. */
export interface ColumnaTabla {
  key: string;
  label: string;
  tipo: "texto" | "email" | "url" | "numero" | "select" | "archivo";
  requerido?: boolean;
  /** Opciones para `tipo === 'select'`. */
  opciones?: OpcionCampo[];
  /**
   * Filtra las `opciones` estáticas dejando solo las seleccionadas en el
   * campo checkbox_multiple de otro módulo del mismo proyecto.
   */
  opcionesDesde?: OpcionesDesde;
  /** Configuración para `tipo === 'archivo'`. */
  archivo?: ConfigArchivo;
  /** Guía contextual mostrada como popover en el encabezado. */
  guia?: GuiaCampo;
  /** Longitud exacta para texto (ej. 1 carácter para dígito de verificación). */
  longitud?: number;
  /** Placeholder del input. */
  placeholder?: string;
  /** Ancho sugerido en px para la celda. */
  ancho?: number;
}

/** Configuración específica para campos tipo `archivo`. */
export type BucketArchivo = "logos-clientes" | "documentos";

export interface ConfigArchivo {
  /** Bucket privado donde se persiste el binario. */
  bucket: BucketArchivo;
  /**
   * Formatos aceptados. Puede incluir mimes (`image/png`) o
   * extensiones (`.svg`, `.ico`, `.pdf`).
   */
  formatosPermitidos: string[];
  /** Tamaño máximo del archivo en MB. Por defecto 5. */
  tamanoMaxMB?: number;
  /**
   * Dimensiones exactas requeridas para imágenes rasterizadas
   * (PNG/JPG/WEBP). Si se declaran y la imagen no coincide, el motor
   * redimensiona con recorte centrado ("cover") antes de subir.
   */
  dimensiones?: { ancho: number; alto: number };
  /**
   * Renderiza la previsualización dentro de un mockup del portal
   * (pantalla de login del Portal de Proveedores), para que el cliente
   * vea cómo quedará la imagen en contexto:
   * - `login_logo`: la imagen ocupa el slot del logo sobre la tarjeta.
   * - `login_fondo`: la imagen es el fondo detrás de la tarjeta.
   */
  previewContexto?: "login_logo" | "login_fondo";
}

export interface CampoDefinicion {
  key: string;
  label: string;
  tipo: TipoCampo;
  requerido?: boolean;
  guia?: GuiaCampo;
  opciones?: OpcionCampo[];
  /**
   * Filtra las `opciones` estáticas dejando solo las seleccionadas en el
   * campo checkbox_multiple de otro módulo del mismo proyecto.
   */
  opcionesDesde?: OpcionesDesde;
  validacion?: ReglasValidacion;
  /** Placeholder del input, cuando aplique. */
  placeholder?: string;
  /** Configuración de tabla dinámica (tipo 'tabla'). */
  columnas?: ColumnaTabla[];
  /** Configuración del campo cuando `tipo === 'archivo'`. */
  archivo?: ConfigArchivo;
  /**
   * Visibilidad condicional: el campo solo se renderiza (y solo cuenta
   * para validación / progreso) cuando el valor del campo `campo` es
   * igual a `igualA` (string) o está incluido en `igualA` (string[]).
   */
  mostrarSi?: { campo: string; igualA: string | string[] };
  /** Aviso informativo suave que se muestra debajo del control. */
  aviso?: string;
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