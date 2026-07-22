import type { ModuloDefinicion } from "../tipos";

/**
 * Módulo General — Maestros de compras.
 *
 * Define los catálogos base que el Portal de Proveedores usará de forma
 * transversal en solicitudes, órdenes y facturación: categorías/familias
 * de compra, monedas, condiciones de pago e impuestos/retenciones. Cada
 * catálogo se captura como tabla dinámica para que el cliente lo adapte a
 * su operación; los impuestos parten del marco tributario colombiano.
 */
export const MODULO_MAESTROS_COMPRAS: ModuloDefinicion = {
  key: "maestros_compras",
  nombre: "Maestros de compras",
  descripcion:
    "Define las categorías, monedas, condiciones de pago e impuestos que usará tu Portal de Proveedores en solicitudes, órdenes y facturación.",
  secciones: [
    // -------- 1. Categorías / familias de compra --------
    {
      key: "categorias",
      titulo: "Categorías / familias de compra",
      descripcion:
        "Cómo agrupas lo que compras. Se usarán para clasificar solicitudes y proveedores.",
      campos: [
        {
          key: "categorias_info",
          label: "Ejemplos de categorías",
          tipo: "info",
          aviso:
            "Ejemplos: Materia prima, Servicios profesionales, Tecnología, Mantenimiento, Logística.",
        },
        {
          key: "tabla_categorias",
          label: "Categorías de compra",
          tipo: "tabla",
          requerido: true,
          columnas: [
            {
              key: "nombre",
              label: "Nombre",
              tipo: "texto",
              requerido: true,
              placeholder: "Ej.: Materia prima",
              guia: {
                que: "Nombre de la categoría o familia de compra con la que agrupas lo que adquieres.",
              },
            },
            {
              key: "codigo",
              label: "Código",
              tipo: "texto",
              guia: {
                que: "Código interno si manejas uno (opcional).",
              },
            },
            {
              key: "descripcion",
              label: "Descripción",
              tipo: "texto",
            },
          ],
          guia: {
            que: "Una fila por cada categoría o familia de compra que maneja tu organización.",
            formato: "Añade al menos una categoría.",
          },
        },
      ],
    },
    // -------- 2. Monedas --------
    {
      key: "monedas",
      titulo: "Monedas",
      descripcion:
        "Monedas en las que se manejarán cotizaciones, órdenes y facturas.",
      campos: [
        {
          key: "moneda_principal",
          label: "Moneda principal",
          tipo: "select",
          requerido: true,
          opciones: [
            { valor: "COP", etiqueta: "Peso colombiano (COP)" },
            { valor: "USD", etiqueta: "Dólar (USD)" },
            { valor: "EUR", etiqueta: "Euro (EUR)" },
          ],
          guia: {
            que: "Moneda por defecto del portal.",
          },
        },
        {
          key: "tabla_monedas_adicionales",
          label: "Otras monedas habilitadas (opcional)",
          tipo: "tabla",
          columnas: [
            {
              key: "moneda",
              label: "Moneda",
              tipo: "select",
              opciones: [
                { valor: "COP", etiqueta: "Peso colombiano (COP)" },
                { valor: "USD", etiqueta: "Dólar (USD)" },
                { valor: "EUR", etiqueta: "Euro (EUR)" },
                { valor: "MXN", etiqueta: "Peso mexicano (MXN)" },
                { valor: "BRL", etiqueta: "Real (BRL)" },
                { valor: "PEN", etiqueta: "Sol (PEN)" },
                { valor: "CLP", etiqueta: "Peso chileno (CLP)" },
              ],
            },
            {
              key: "uso",
              label: "Uso",
              tipo: "texto",
              guia: {
                que: "Para qué se usará esta moneda.",
              },
            },
          ],
        },
      ],
    },
    // -------- 3. Condiciones de pago --------
    {
      key: "condiciones_pago",
      titulo: "Condiciones de pago",
      descripcion: "Plazos de pago que ofrecerás a tus proveedores.",
      campos: [
        {
          key: "condiciones_info",
          label: "Ejemplos de condiciones",
          tipo: "info",
          aviso:
            "Ejemplos frecuentes: Contado, 30 días, 60 días, 90 días.",
        },
        {
          key: "tabla_condiciones",
          label: "Condiciones de pago",
          tipo: "tabla",
          requerido: true,
          columnas: [
            {
              key: "nombre",
              label: "Nombre",
              tipo: "texto",
              requerido: true,
              placeholder: "Ej.: 30 días",
              guia: {
                que: "Nombre de la condición de pago tal como se mostrará en el portal.",
              },
            },
            {
              key: "dias",
              label: "Días",
              tipo: "numero",
              requerido: true,
              guia: {
                que: "Días de plazo desde la fecha de factura.",
              },
            },
            {
              key: "notas",
              label: "Notas",
              tipo: "texto",
            },
          ],
          guia: {
            que: "Una fila por cada condición de pago que ofrecerás a tus proveedores.",
            formato: "Añade al menos una condición.",
          },
        },
      ],
    },
    // -------- 4. Impuestos y retenciones (Colombia) --------
    {
      key: "impuestos",
      titulo: "Impuestos y retenciones (Colombia)",
      descripcion:
        "Impuestos y retenciones que el portal debe calcular o registrar.",
      campos: [
        {
          key: "impuestos_info",
          label: "Impuestos y retenciones habituales",
          tipo: "info",
          aviso:
            "En Colombia lo habitual: IVA (19%), ReteFuente, ReteIVA, ReteICA. Ajusta según tu operación.",
        },
        {
          key: "tabla_impuestos",
          label: "Impuestos y retenciones",
          tipo: "tabla",
          requerido: true,
          columnas: [
            {
              key: "nombre",
              label: "Nombre",
              tipo: "texto",
              requerido: true,
              placeholder: "Ej.: IVA",
              guia: {
                que: "Nombre del impuesto o retención que el portal debe calcular o registrar.",
              },
            },
            {
              key: "tipo",
              label: "Tipo",
              tipo: "select",
              requerido: true,
              opciones: [
                { valor: "impuesto", etiqueta: "Impuesto" },
                { valor: "retencion", etiqueta: "Retención" },
              ],
              guia: {
                que: "Si corresponde a un impuesto o a una retención.",
              },
            },
            {
              key: "tarifa",
              label: "Tarifa",
              tipo: "texto",
              requerido: true,
              guia: {
                que: "Porcentaje o base. Ej.: 19% o 2.5%",
              },
            },
            {
              key: "aplica_a",
              label: "Aplica a",
              tipo: "texto",
              guia: {
                que: "Bienes, servicios, o casos donde aplica.",
              },
            },
          ],
          guia: {
            que: "Una fila por cada impuesto o retención que el portal debe manejar.",
            formato: "Añade al menos un impuesto o retención.",
          },
        },
        {
          key: "responsable_tributario_correo",
          label: "Correo del responsable tributario",
          tipo: "email",
          guia: {
            que: "Correo del responsable tributario en tu equipo, para dudas de configuración.",
            formato: "Correo corporativo válido.",
          },
        },
      ],
    },
  ],
};
