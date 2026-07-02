import type { ColumnaTabla, ModuloDefinicion } from "../tipos";

/**
 * Módulo General – Creación de Sociedades (key: 'sociedades').
 *
 * Se implementa como una única tabla dinámica; cada fila representa una
 * sociedad del grupo. No hay límite fijo de filas (capacidad mínima 8
 * reservada visualmente por la tabla al agregar filas).
 */

const OPCIONES_PAIS = [
  { valor: "CO", etiqueta: "Colombia" },
  { valor: "MX", etiqueta: "México" },
  { valor: "PE", etiqueta: "Perú" },
  { valor: "CL", etiqueta: "Chile" },
  { valor: "AR", etiqueta: "Argentina" },
  { valor: "EC", etiqueta: "Ecuador" },
  { valor: "UY", etiqueta: "Uruguay" },
  { valor: "PA", etiqueta: "Panamá" },
  { valor: "CR", etiqueta: "Costa Rica" },
  { valor: "BO", etiqueta: "Bolivia" },
  { valor: "PY", etiqueta: "Paraguay" },
  { valor: "GT", etiqueta: "Guatemala" },
  { valor: "DO", etiqueta: "República Dominicana" },
  { valor: "US", etiqueta: "Estados Unidos" },
  { valor: "ES", etiqueta: "España" },
  { valor: "OT", etiqueta: "Otro" },
];

const OPCIONES_DOCUMENTO = [
  { valor: "NIT", etiqueta: "NIT" },
  { valor: "RUC", etiqueta: "RUC" },
  { valor: "RFC", etiqueta: "RFC" },
  { valor: "RUT", etiqueta: "RUT" },
  { valor: "CUIT", etiqueta: "CUIT" },
  { valor: "OTRO", etiqueta: "Otro" },
];

const COLUMNAS: ColumnaTabla[] = [
  {
    key: "pais",
    label: "País",
    tipo: "select",
    requerido: true,
    opciones: OPCIONES_PAIS,
    ancho: 160,
    guia: {
      que: "País donde la sociedad opera legalmente.",
      formato: "Selecciona una opción. Usa 'Otro' si no aparece.",
    },
  },
  {
    key: "tipo_documento",
    label: "Tipo doc.",
    tipo: "select",
    requerido: true,
    opciones: OPCIONES_DOCUMENTO,
    ancho: 130,
    guia: {
      que: "Tipo de identificación tributaria del país.",
      formato: "NIT, RUC, RFC, RUT, CUIT u Otro.",
    },
  },
  {
    key: "numero_identificacion",
    label: "N.º identificación",
    tipo: "texto",
    requerido: true,
    ancho: 170,
    placeholder: "900123456",
    guia: {
      que: "Número de identificación tributaria de la sociedad.",
      formato: "Solo dígitos, sin puntos ni guiones.",
    },
  },
  {
    key: "digito_verificacion",
    label: "DV",
    tipo: "texto",
    ancho: 70,
    longitud: 1,
    placeholder: "0",
    guia: {
      que: "Dígito de verificación cuando aplica (Colombia).",
      formato: "Un solo carácter numérico (0–9).",
    },
  },
  {
    key: "razon_social",
    label: "Razón social",
    tipo: "texto",
    requerido: true,
    ancho: 220,
    placeholder: "Sociedad S.A.S.",
    guia: {
      que: "Nombre legal completo de la sociedad.",
      formato: "Texto tal como aparece en el registro mercantil.",
    },
  },
  {
    key: "descripcion",
    label: "Descripción",
    tipo: "texto",
    ancho: 220,
    guia: {
      que: "Descripción breve de la actividad económica.",
      formato: "Texto corto (1–2 líneas).",
    },
  },
  {
    key: "ciudad",
    label: "Ciudad",
    tipo: "texto",
    ancho: 150,
    guia: { que: "Ciudad donde se encuentra la sede principal." },
  },
  {
    key: "telefono",
    label: "Teléfono",
    tipo: "texto",
    ancho: 150,
    placeholder: "+57 300 000 0000",
    guia: {
      que: "Teléfono de contacto de la sociedad.",
      formato: "Incluye el indicativo del país.",
    },
  },
  {
    key: "correo",
    label: "Correo",
    tipo: "email",
    ancho: 200,
    placeholder: "contacto@empresa.com",
    guia: {
      que: "Correo electrónico de contacto de la sociedad.",
      formato: "nombre@empresa.com",
    },
  },
  {
    key: "logo",
    label: "Logo",
    tipo: "archivo",
    ancho: 240,
    archivo: {
      bucket: "logos-clientes",
      formatosPermitidos: ["image/png", "image/svg+xml", ".png", ".svg"],
      tamanoMaxMB: 5,
      dimensiones: { ancho: 200, alto: 200 },
    },
    guia: {
      que: "Logotipo de la sociedad.",
      formato: "PNG o SVG con fondo transparente.",
      tamano: "Se ajustará a 200×200 px. Máx. 5 MB.",
    },
  },
];

export const MODULO_SOCIEDADES: ModuloDefinicion = {
  key: "sociedades",
  nombre: "Creación de sociedades",
  descripcion:
    "Registra cada sociedad del grupo que participará en el portal. Puedes añadir y eliminar filas dinámicamente.",
  secciones: [
    {
      key: "listado",
      titulo: "Sociedades del grupo",
      descripcion:
        "Añade una fila por cada sociedad. Sin límite fijo de filas.",
      campos: [
        {
          key: "sociedades",
          label: "Listado de sociedades",
          tipo: "tabla",
          requerido: true,
          columnas: COLUMNAS,
          guia: {
            que: "Todas las sociedades del grupo que se integrarán al portal.",
            formato: "Una fila por sociedad. Añade al menos una.",
            tamano: "Capacidad mínima 8 filas; puedes añadir más.",
          },
        },
      ],
    },
  ],
};