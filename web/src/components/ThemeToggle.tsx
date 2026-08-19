import { useTheme } from "../context/ThemeContext";
import { SunIcon, MoonIcon } from "./icons";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Modo claro" : "Modo oscuro"}
      className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface-2 text-fg transition hover:border-primary/40"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
