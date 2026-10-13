import {
  ArrowLeftRight,
  BookPlus,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  Library,
  School,
  Settings,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { Sidebar, SkipLink, ThemeToggle, useTheme, type SidebarGroup } from "../components/ui";
import { paths } from "./paths";

function isActive(pathname: string, to: string, exact = false) {
  if (to === "/" || exact) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppLayout() {
  const { pathname } = useLocation();
  const { theme, setTheme } = useTheme();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // SPA: ao trocar de rota, leva o foco para o h1 da nova página (anúncio para leitores de tela).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const active = document.activeElement;
    if (active && active !== document.body && mainRef.current?.contains(active)) return;
    const h1 = mainRef.current?.querySelector("h1");
    if (h1) {
      h1.tabIndex = -1;
      h1.focus({ preventScroll: true });
    }
  }, [pathname]);

  const item = (key: string, label: string, to: string, icon: React.ReactNode, exact = false) => ({
    key,
    label,
    to,
    icon,
    as: Link,
    active: isActive(pathname, to, exact),
  });

  const groups: SidebarGroup[] = [
    {
      items: [
        item("dashboard", "Dashboard", paths.dashboard, <LayoutDashboard />),
        item("acervo", "Acervo", paths.books, <Library />),
        item("cadastrar", "Cadastrar", paths.newBook, <BookPlus />),
      ],
    },
    {
      label: "Circulação",
      items: [
        item("emprestimos", "Empréstimos", paths.loans, <ArrowLeftRight />),
        item("leitores", "Leitores", "/leitores", <GraduationCap />),
        item("turmas", "Turmas", paths.classes, <School />),
      ],
    },
    {
      label: "Dados",
      items: [
        item("importar", "Importar / Exportar", paths.importExport, <FileSpreadsheet />),
        item("config", "Configurações", paths.settings, <Settings />),
      ],
    },
  ];

  return (
    <div className="flex h-full bg-bg-app text-text-primary">
      <SkipLink />
      <Sidebar
        groups={groups}
        footer={
          <>
            <ThemeToggle value={theme} onChange={setTheme} tone="sidebar" />
            <p className="text-caption">LiBok v0.1.0</p>
          </>
        }
      />
      <main ref={mainRef} id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
