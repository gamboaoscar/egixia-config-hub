import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardCheck,
  Mail,
  Users,
  BookMarked,
  ShieldCheck,
  Settings,
  LogOut,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth, type Rol } from "@/hooks/use-auth";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

const menusPorRol: Record<Rol, NavItem[]> = {
  cliente: [
    { title: "Inicio", url: "/mi-proyecto", icon: LayoutDashboard },
    { title: "Proyectos", url: "/mi-proyecto/proyectos", icon: FolderKanban },
  ],
  implementador: [
    { title: "Inicio", url: "/app", icon: LayoutDashboard },
    { title: "Proyectos", url: "/app/proyectos", icon: FolderKanban },
    { title: "Revisiones pendientes", url: "/app/revisiones", icon: ClipboardCheck },
    { title: "Invitaciones", url: "/app/invitaciones", icon: Mail },
    { title: "Catálogo de módulos", url: "/app/catalogo", icon: BookMarked },
    { title: "Mi perfil", url: "/app/mi-perfil", icon: UserRound },
  ],
  admin: [
    { title: "Inicio", url: "/app", icon: LayoutDashboard },
    { title: "Proyectos", url: "/app/proyectos", icon: FolderKanban },
    { title: "Revisiones pendientes", url: "/app/revisiones", icon: ClipboardCheck },
    { title: "Invitaciones", url: "/app/invitaciones", icon: Mail },
    { title: "Usuarios", url: "/app/usuarios", icon: Users },
    { title: "Catálogo de módulos", url: "/app/catalogo", icon: BookMarked },
    { title: "Auditoría", url: "/app/auditoria", icon: ShieldCheck },
    { title: "Configuración", url: "/app/configuracion", icon: Settings },
    { title: "Mi perfil", url: "/app/mi-perfil", icon: UserRound },
  ],
};

function initials(nombre?: string | null, apellido?: string | null, email?: string | null) {
  const n = (nombre?.[0] ?? "").toUpperCase();
  const a = (apellido?.[0] ?? "").toUpperCase();
  if (n || a) return `${n}${a}` || n || a;
  return (email?.[0] ?? "U").toUpperCase();
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { profile, avatarUrl, signOut } = useAuth();

  const rol: Rol = profile?.rol ?? "cliente";
  const items = menusPorRol[rol];
  const perfilUrl = rol === "cliente" ? "/mi-proyecto/mi-perfil" : "/app/mi-perfil";

  const isActive = (path: string) => {
    if (path === "/app" || path === "/mi-proyecto") return currentPath === path;
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };

  const nombreCompleto = profile
    ? `${profile.nombre} ${profile.apellido}`.trim() || profile.email
    : "Cargando…";

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Sesión cerrada");
      window.location.href = "/login";
    } catch (err) {
      toast.error("No se pudo cerrar sesión");
      console.error(err);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-foreground font-bold">
            E
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-sidebar-foreground">EGIXIA</span>
              <span className="text-xs text-sidebar-foreground/60">Configurator</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-sidebar-foreground/60">
              Menú
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive(perfilUrl)}
              tooltip={nombreCompleto}
              className="h-auto py-2"
            >
              <Link to={perfilUrl} className="flex items-center gap-2">
                <Avatar className="h-7 w-7 shrink-0">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={nombreCompleto} /> : null}
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs">
                    {initials(profile?.nombre, profile?.apellido, profile?.email)}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-medium text-sidebar-foreground">
                      {nombreCompleto}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/60 capitalize">
                      {rol}
                    </span>
                  </div>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip="Cerrar sesión">
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}