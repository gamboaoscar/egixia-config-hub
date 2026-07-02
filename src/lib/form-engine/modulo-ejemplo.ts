import { moduloCatalogo } from "@/lib/modulos-catalogo";

import type { ModuloDefinicion } from "./tipos";

/**
 * Definición de ejemplo (Parte 5). El contenido real de los módulos
 * llega en las Partes 7–9 (Imagen, Sociedades, Seguridad).
 *
 * Aquí solo se muestran algunos campos representativos para probar el
 * motor: uno con guía, uno requerido, y varios tipos distintos.
 */

const DEMO_IMAGEN: ModuloDefinicion = {
  key: "imagen",
  nombre: "Imagen corporativa",
  descripcion: "Datos básicos de identidad de tu empresa.",
  secciones: [
    {
      key: "identidad",
      titulo: "Identidad de la empresa",
      descripcion: "Información visible en el portal de proveedores.",
      campos: [
        {
          key: "nombre_comercial",
          label: "Nombre comercial",
          tipo: "texto",
          requerido: true,
          placeholder: "Ej. Distribuciones ACME",
          guia: {
            que: "El nombre con el que tus proveedores reconocen a la empresa.",
            formato: "Texto corto, sin siglas legales (S.A.S., LTDA, etc.).",
          },
        },
        {
          key: "sitio_web",
          label: "Sitio web oficial",
          tipo: "url",
          requerido: true,
          guia: {
            que: "Dirección pública del sitio web corporativo.",
            formato: "URL completa comenzando con https://",
          },
        },
        {
          key: "color_marca",
          label: "Color principal de marca",
          tipo: "color",
          opciones: [
            { valor: "azul", etiqueta: "Azul corporativo", hex: "#0F2B8E" },
            { valor: "verde", etiqueta: "Verde bosque", hex: "#0E7C4A" },
            { valor: "grafito", etiqueta: "Grafito", hex: "#1F2937" },
          ],
          guia: {
            que: "Selecciona el color dominante de tu marca.",
          },
        },
        {
          key: "logo",
          label: "Logotipo principal",
          tipo: "archivo",
          guia: {
            que: "Logotipo que aparecerá en el portal de proveedores.",
            formato: "PNG con transparencia o SVG.",
            tamano: "512×512 px, máximo 2 MB.",
          },
        },
      ],
    },
  ],
};

const DEMO_SOCIEDADES: ModuloDefinicion = {
  key: "sociedades",
  nombre: "Sociedades",
  secciones: [
    {
      key: "listado",
      titulo: "Sociedades del grupo",
      campos: [
        {
          key: "sociedades",
          label: "Listado de sociedades",
          tipo: "tabla",
          requerido: true,
          columnas: [
            { key: "razon_social", label: "Razón social", tipo: "texto", requerido: true },
            { key: "nit", label: "NIT / RUT", tipo: "texto", requerido: true },
            { key: "contacto", label: "Correo de contacto", tipo: "email" },
          ],
          guia: {
            que: "Todas las sociedades del grupo que participarán en el portal.",
          },
        },
      ],
    },
  ],
};

const DEMO_SEGURIDAD: ModuloDefinicion = {
  key: "seguridad",
  nombre: "Seguridad",
  secciones: [
    {
      key: "politicas",
      titulo: "Políticas y responsables",
      campos: [
        {
          key: "nivel_madurez",
          label: "Nivel de madurez del programa de seguridad",
          tipo: "radio_tarjetas",
          requerido: true,
          opciones: [
            {
              valor: "inicial",
              etiqueta: "Inicial",
              descripcion: "Procesos ad hoc, sin políticas formales.",
            },
            {
              valor: "gestionado",
              etiqueta: "Gestionado",
              descripcion: "Políticas documentadas y responsables asignados.",
            },
            {
              valor: "optimizado",
              etiqueta: "Optimizado",
              descripcion: "Programa maduro, con métricas y mejora continua.",
            },
          ],
        },
        {
          key: "email_responsable",
          label: "Correo del responsable de seguridad",
          tipo: "email",
          requerido: true,
          guia: {
            que: "Persona a la que EGIXIA escribirá para temas de seguridad.",
          },
        },
        {
          key: "observaciones",
          label: "Notas adicionales",
          tipo: "textarea",
          placeholder: "Contexto adicional útil para el equipo de EGIXIA.",
        },
      ],
    },
  ],
};

const REGISTRO: Record<string, ModuloDefinicion> = {
  imagen: DEMO_IMAGEN,
  sociedades: DEMO_SOCIEDADES,
  seguridad: DEMO_SEGURIDAD,
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