import type { ModuloDefinicion, OpcionCampo } from "../tipos";

/**
 * Módulo General — Seguridad (Parte 9).
 *
 * Cubre: política de contraseñas (7 numéricos requeridos con valor estándar
 * como placeholder/ayuda), selección múltiple de roles internos, selección
 * múltiple de roles de proveedor (máx. 5) y nota informativa sobre roles
 * personalizados adicionales.
 */

const ROLES_INTERNOS: OpcionCampo[] = [
  { valor: "configuracion", etiqueta: "Gestor de configuración", descripcion: "Administra parámetros generales del portal." },
  { valor: "contenido", etiqueta: "Gestor de contenido", descripcion: "Publica y mantiene textos, documentos y noticias." },
  { valor: "usuarios", etiqueta: "Gestor de usuarios", descripcion: "Crea, habilita e inhabilita usuarios internos." },
  { valor: "proveedores", etiqueta: "Gestor de proveedores", descripcion: "Administra registro y estado de proveedores." },
  { valor: "riesgos", etiqueta: "Gestor de riesgos", descripcion: "Evalúa y monitorea riesgos de terceros." },
  { valor: "maestros", etiqueta: "Gestor de datos maestros", descripcion: "Cuida catálogos, categorías y datos base." },
  { valor: "solicitudes", etiqueta: "Gestor de solicitudes", descripcion: "Recibe y canaliza solicitudes de compra." },
  { valor: "negociaciones", etiqueta: "Gestor de negociaciones", descripcion: "Conduce cotizaciones, RFx y subastas." },
  { valor: "evaluaciones", etiqueta: "Gestor de evaluaciones", descripcion: "Diseña y publica evaluaciones a proveedores." },
  { valor: "colaborador_evaluaciones", etiqueta: "Colaborador de evaluaciones", descripcion: "Responde y aporta a evaluaciones asignadas." },
  { valor: "ordenes", etiqueta: "Gestor de órdenes de compra", descripcion: "Emite, aprueba y controla órdenes de compra." },
  { valor: "contabilidad", etiqueta: "Gestor de contabilidad", descripcion: "Concilia y contabiliza documentos." },
  { valor: "facturas", etiqueta: "Gestor de facturas", descripcion: "Recibe y valida facturas de proveedores." },
  { valor: "pagos", etiqueta: "Gestor de pagos", descripcion: "Programa y ejecuta pagos a proveedores." },
  { valor: "contratos", etiqueta: "Gestor de contratos", descripcion: "Administra el ciclo de vida de los contratos." },
  { valor: "soporte", etiqueta: "Gestor de soporte", descripcion: "Atiende mesa de servicio y casos del portal." },
];

const ROLES_PROVEEDOR: OpcionCampo[] = [
  { valor: "principal", etiqueta: "Contacto Principal", descripcion: "Representante único de la empresa proveedora." },
  { valor: "solicitudes", etiqueta: "Contacto solicitudes", descripcion: "Recibe y responde solicitudes de cotización." },
  { valor: "comercial", etiqueta: "Contacto comercial", descripcion: "Gestiona relación comercial y negociaciones." },
  { valor: "pedidos", etiqueta: "Contacto pedidos", descripcion: "Atiende órdenes de compra y despachos." },
  { valor: "financiero", etiqueta: "Contacto financiero", descripcion: "Coordina temas de pagos y estado de cuenta." },
  { valor: "contabilidad", etiqueta: "Contacto contabilidad", descripcion: "Emite y concilia facturas y notas contables." },
];

export const MODULO_SEGURIDAD: ModuloDefinicion = {
  key: "seguridad",
  nombre: "Seguridad",
  descripcion:
    "Define la política de contraseñas del portal y los roles disponibles para usuarios internos y proveedores.",
  secciones: [
    {
      key: "politica_password",
      titulo: "Política de contraseñas",
      descripcion:
        "Los valores mostrados como referencia corresponden al estándar recomendado por EGIXIA.",
      campos: [
        {
          key: "pass_dias",
          label: "Periodo de cambio (días)",
          tipo: "numero",
          requerido: true,
          placeholder: "180",
          validacion: { min: 1 },
          guia: {
            que: "Cada cuántos días el usuario debe cambiar su contraseña.",
            formato: "Número entero de días.",
            tamano: "Estándar recomendado: 180.",
          },
        },
        {
          key: "pass_espera",
          label: "Tiempo mínimo entre cambios (días)",
          tipo: "numero",
          requerido: true,
          placeholder: "0",
          validacion: { min: 0 },
          guia: {
            que: "Días que deben transcurrir antes de que el usuario pueda cambiar la contraseña nuevamente.",
            formato: "Número entero de días (0 = sin espera).",
            tamano: "Estándar recomendado: 0.",
          },
        },
        {
          key: "pass_largo",
          label: "Largo mínimo",
          tipo: "numero",
          requerido: true,
          placeholder: "12",
          validacion: { min: 6 },
          guia: {
            que: "Cantidad mínima de caracteres que debe tener la contraseña.",
            formato: "Número entero de caracteres.",
            tamano: "Estándar recomendado: 12.",
          },
        },
        {
          key: "pass_numeros",
          label: "Mínimo de caracteres numéricos",
          tipo: "numero",
          requerido: true,
          placeholder: "1",
          validacion: { min: 0 },
          guia: {
            que: "Cuántos dígitos (0–9) debe incluir la contraseña como mínimo.",
            tamano: "Estándar recomendado: 1.",
          },
        },
        {
          key: "pass_mayusculas",
          label: "Mínimo de mayúsculas",
          tipo: "numero",
          requerido: true,
          placeholder: "1",
          validacion: { min: 0 },
          guia: {
            que: "Cuántas letras mayúsculas (A–Z) debe incluir la contraseña.",
            tamano: "Estándar recomendado: 1.",
          },
        },
        {
          key: "pass_especiales",
          label: "Mínimo de caracteres especiales",
          tipo: "numero",
          requerido: true,
          placeholder: "1",
          validacion: { min: 0 },
          guia: {
            que: "Cuántos símbolos especiales (por ejemplo !, @, #, $, %) debe incluir la contraseña.",
            tamano: "Estándar recomendado: 1.",
          },
        },
        {
          key: "pass_historial",
          label: "Historial de contraseñas",
          tipo: "numero",
          requerido: true,
          placeholder: "6",
          validacion: { min: 0 },
          guia: {
            que: "Cantidad de contraseñas anteriores que el sistema recuerda para impedir su reutilización.",
            tamano: "Estándar recomendado: 6.",
          },
        },
      ],
    },
    {
      key: "roles_internos",
      titulo: "Roles internos",
      descripcion:
        "Selecciona los perfiles predefinidos que estarán disponibles para los usuarios internos del portal.",
      campos: [
        {
          key: "roles_internos_seleccion",
          label: "Perfiles disponibles",
          tipo: "checkbox_multiple",
          opciones: ROLES_INTERNOS,
          guia: {
            que: "Marca los perfiles que se habilitarán para asignar a usuarios internos.",
          },
        },
      ],
    },
    {
      key: "roles_proveedor",
      titulo: "Roles de proveedor",
      descripcion:
        "Selecciona hasta 5 roles que las empresas proveedoras podrán asignar a sus contactos.",
      campos: [
        {
          key: "roles_proveedor_seleccion",
          label: "Roles disponibles (máx. 5 por empresa)",
          tipo: "checkbox_multiple",
          opciones: ROLES_PROVEEDOR,
          aviso:
            "Cada empresa proveedora podrá asignar como máximo 5 de estos roles a sus contactos.",
          guia: {
            que: "Marca los roles que estarán disponibles para los contactos de las empresas proveedoras.",
            tamano: "Cada proveedor puede usar hasta 5 en su empresa.",
          },
        },
      ],
    },
    {
      key: "roles_personalizados",
      titulo: "Roles personalizados",
      campos: [
        {
          key: "roles_personalizados_info",
          label: "Roles personalizados adicionales",
          tipo: "info",
          aviso:
            "Se pueden habilitar hasta 3 roles personalizados adicionales. Solicítalos por la mesa de servicio de EGIXIA indicando nombre y permisos requeridos.",
        },
      ],
    },
  ],
};