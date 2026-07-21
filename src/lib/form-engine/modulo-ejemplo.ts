import { moduloCatalogo } from "@/lib/modulos-catalogo";

import type { ModuloDefinicion } from "./tipos";
import { MODULO_IMAGEN } from "./modulos/imagen";
import { MODULO_SOCIEDADES } from "./modulos/sociedades";
import { MODULO_SEGURIDAD } from "./modulos/seguridad";
import { MODULO_USUARIOS_INTERNOS } from "./modulos/usuarios-internos";
import { MODULO_MATRIZ_DOCUMENTAL } from "./modulos/matriz-documental";

/**
 * Registro de definiciones de módulos disponibles en el motor de
 * formularios: Imagen, Sociedades, Seguridad, Usuarios internos y
 * Matriz documental de proveedores.
 */
const REGISTRO: Record<string, ModuloDefinicion> = {
  imagen: MODULO_IMAGEN,
  sociedades: MODULO_SOCIEDADES,
  seguridad: MODULO_SEGURIDAD,
  usuarios_internos: MODULO_USUARIOS_INTERNOS,
  matriz_documental: MODULO_MATRIZ_DOCUMENTAL,
};

/**
 * Obtiene la definición del formulario a renderizar para un `modulo_key`.
 * Si no hay definición registrada, devuelve un módulo mínimo derivado del
 * catálogo para que la UI no se rompa.
 */
export function definicionModulo(moduloKey: string): ModuloDefinicion {
  if (REGISTRO[moduloKey]) return REGISTRO[moduloKey];
  const cat = moduloCatalogo(moduloKey);
  return {
    key: moduloKey,
    nombre: cat.nombre,
    descripcion: cat.descripcion,
    secciones: [
      {
        key: "pendiente",
        titulo: "Contenido en preparación",
        descripcion:
          "El contenido de este módulo se cargará próximamente.",
        campos: [],
      },
    ],
  };
}