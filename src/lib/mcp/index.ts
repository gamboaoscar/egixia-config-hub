import { auth, defineMcp } from "@lovable.dev/mcp-js";

import listProyectosTool from "./tools/list-proyectos";
import getProyectoTool from "./tools/get-proyecto";
import listRevisionesPendientesTool from "./tools/list-revisiones-pendientes";

// El issuer OAuth debe apuntar al host directo de Supabase; en producción
// SUPABASE_URL se reescribe al proxy .lovable.cloud, que mcp-js rechaza por
// mismatch (RFC 8414). VITE_SUPABASE_PROJECT_ID lo inyecta Vite en tiempo de
// build como literal y sobrevive al publish.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "egixia-configurator-mcp",
  title: "EGIXIA Configurator",
  version: "0.1.0",
  instructions:
    "Herramientas para consultar proyectos, módulos y revisiones pendientes del Portal de Proveedores EGIXIA. Cada cliente actúa como el usuario autenticado; RLS filtra los resultados según su rol (cliente, implementador o admin).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProyectosTool, getProyectoTool, listRevisionesPendientesTool],
});