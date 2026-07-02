import { Image, Building2, ShieldCheck, type LucideIcon } from "lucide-react";

export type ModuloKey = "imagen" | "sociedades" | "seguridad";

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
    nombre: "Sociedades",
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