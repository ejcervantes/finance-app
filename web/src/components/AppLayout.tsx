import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { ChartIcon, ListIcon, LogoutIcon, TargetIcon } from "./icons";
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
  const { user, logout } = useAuth();
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
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden items-center gap-2 sm:flex">
              <span
                className="grid h-10 w-10 place-items-center rounded-full bg-accent/20 text-sm font-bold text-fg"
                title={`${user?.first_name} ${user?.last_name}`}
              >
                {initials}
              </span>
            </div>
            <button
              onClick={logout}
              aria-label="Cerrar sesión"
              className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface-2 text-fg transition hover:border-danger/50 hover:text-danger"
            >
              <LogoutIcon />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
