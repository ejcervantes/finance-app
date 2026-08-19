import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Logo } from "./Logo";
import { ChartIcon, ListIcon, TargetIcon } from "./icons";
import type { ReactNode } from "react";

const navItems = [
  { to: "/", label: "Resumen", icon: <ChartIcon />, end: true },
  { to: "/movimientos", label: "Movimientos", icon: <ListIcon /> },
  { to: "/presupuestos", label: "Presupuestos", icon: <TargetIcon /> },
];

function NavItem({
  to,
  label,
  icon,
  end,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
          isActive
            ? "bg-primary text-primary-fg"
            : "text-muted hover:bg-surface-2 hover:text-fg"
        }`
      }
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </NavLink>
  );
}

export function AppLayout() {
  const { user } = useAuth();
  const initials = user
    ? `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase()
    : "";

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>
          <NavLink
            to="/perfil"
            title="Ajustes"
            aria-label="Ajustes"
            className={({ isActive }) =>
              `grid h-10 w-10 place-items-center rounded-full bg-accent/20 text-sm font-bold text-fg transition ${
                isActive ? "ring-2 ring-primary" : "hover:ring-2 hover:ring-primary/40"
              }`
            }
          >
            {initials}
          </NavLink>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
