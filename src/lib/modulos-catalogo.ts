import {
  Image,
  Building2,
  ShieldCheck,
  Users,
  FileCheck2,
  Coins,
  Plug,
  Bell,
  type LucideIcon,
} from "lucide-react";

export type ModuloKey =
  | "imagen"
  | "sociedades"
  | "seguridad"
  | "usuarios_internos"
  | "matriz_documental"
  | "verificacion_cumplimiento"
  | "maestros_compras"
  | "integracion_erp"
  | "notificaciones";

export interface ModuloCatalogo {
  key: ModuloKey;
  nombre: string;
  descripcion: string;
  icon: LucideIcon;
  /** Secciones que se renderizarán como marcadores hasta la Parte 5. */
  secciones: string[];
}

export const MODULOS_CATALOGO: Record<ModuloKey, ModuloCatalogo> = {
  imagen: {
    key: "imagen",
    nombre: "Imagen corporativa",
    descripcion: "Logotipos, colores y datos de marca de tu empresa.",
    icon: Image,
    secciones: ["Identidad", "Logotipos y aplicaciones", "Contactos de marca"],
  },
  sociedades: {
    key: "sociedades",
    nombre: "Creación de Sociedades",
    descripcion: "Sociedades del grupo que participarán en el portal.",
    icon: Building2,
    secciones: [
      "Datos generales del grupo",
      "Listado de sociedades",
      "Documentos legales",
    ],
  },
  seguridad: {
    key: "seguridad",
    nombre: "Seguridad",
    descripcion: "Políticas, roles y responsables de seguridad de la información.",
    icon: ShieldCheck,
    secciones: [
      "Políticas y estándares",
      "Roles y responsables",
      "Requisitos técnicos",
    ],
  },
  usuarios_internos: {
    key: "usuarios_internos",
    nombre: "Usuarios internos",
    descripcion: "Personas de tu equipo que usarán el portal y su rol.",
    icon: Users,
    secciones: ["Usuarios del portal", "Responsable del portal"],
  },
  matriz_documental: {
    key: "matriz_documental",
    nombre: "Registro de Proveedores",
    descripcion:
      "Define cómo se registran tus proveedores en el portal: formularios por tipo, documentos exigidos, preguntas PEP y responsables.",
    icon: FileCheck2,
    secciones: [
      "Tipos de proveedor",
      "Plantilla de proveedores",
      "Documentos exigidos",
      "Tipos de formulario",
      "Tipo de acceso",
      "Preguntas PEP",
      "Términos de registro",
      "Correos responsables",
      "Políticas de la matriz",
    ],
  },
  verificacion_cumplimiento: {
    key: "verificacion_cumplimiento",
    nombre: "Verificación y Cumplimiento",
    descripcion:
      "Verificación de proveedores contra listas restrictivas (LAFT/SAGRILAFT) y reglas de alerta.",
    icon: ShieldCheck,
    secciones: [
      "Servicio de verificación",
      "Entidades a verificar",
      "Reglas y alertas",
      "Parámetros técnicos",
    ],
  },
  maestros_compras: {
    key: "maestros_compras",
    nombre: "Maestros de compras",
    descripcion:
      "Categorías, monedas, condiciones de pago e impuestos del portal.",
    icon: Coins,
    secciones: [
      "Categorías / familias de compra",
      "Monedas",
      "Condiciones de pago",
      "Impuestos y retenciones",
    ],
  },
  integracion_erp: {
    key: "integracion_erp",
    nombre: "Integración ERP / SAP",
    descripcion:
      "Datos técnicos para conectar el portal con tu ERP (SAP u otro).",
    icon: Plug,
    secciones: ["Tu ERP", "Alcance de la integración", "Ambientes y conexión"],
  },
  notificaciones: {
    key: "notificaciones",
    nombre: "Notificaciones y comunicaciones",
    descripcion: "Remitente, eventos y textos de los correos del portal.",
    icon: Bell,
    secciones: [
      "Remitente de los correos",
      "Eventos que notifican",
      "Textos personalizados",
    ],
  },
};

export function moduloCatalogo(key: string): ModuloCatalogo {
  return (
    MODULOS_CATALOGO[key as ModuloKey] ?? {
      key: key as ModuloKey,
      nombre: key,
      descripcion: "",
      icon: Building2,
      secciones: [],
    }
  );
}