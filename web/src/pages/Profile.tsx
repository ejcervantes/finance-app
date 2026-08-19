import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Button, Card, Field, Input, Spinner } from "../components/ui";
import { SunIcon, MoonIcon, LogoutIcon } from "../components/icons";

export function Profile() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-fg">Ajustes</h1>

      <PersonalData />
      <Appearance />
      <Security />

      <Card>
        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/10"
        >
          <LogoutIcon width={18} height={18} />
          Cerrar sesión
        </button>
      </Card>
    </div>
  );
}

function PersonalData() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({
    first_name: user!.first_name,
    last_name: user!.last_name,
    country: user!.country,
    base_currency: user!.base_currency,
  });
  const [state, setState] = useState<{ saving: boolean; msg: string | null; error: boolean }>({ saving: false, msg: null, error: false });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setState({ saving: true, msg: null, error: false });
    try {
      await updateProfile({
        ...form,
        country: form.country.toUpperCase(),
        base_currency: form.base_currency.toUpperCase(),
      });
      setState({ saving: false, msg: "Datos guardados.", error: false });
    } catch (e) {
      setState({ saving: false, msg: e instanceof Error ? e.message : "Error", error: true });
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-fg">Datos personales</h2>
        <p className="text-sm text-muted">Tu información de cuenta.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre"><Input value={form.first_name} onChange={set("first_name")} /></Field>
        <Field label="Apellido"><Input value={form.last_name} onChange={set("last_name")} /></Field>
      </div>
      <Field label="Email">
        <Input value={user!.email} disabled className="opacity-60" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="País"><Input value={form.country} onChange={set("country")} maxLength={2} /></Field>
        <Field label="Divisa"><Input value={form.base_currency} onChange={set("base_currency")} maxLength={3} /></Field>
      </div>
      {state.msg && <p className={`text-sm font-medium ${state.error ? "text-danger" : "text-success"}`}>{state.msg}</p>}
      <div className="flex justify-end">
        <Button onClick={save} disabled={state.saving}>{state.saving ? <Spinner /> : "Guardar cambios"}</Button>
      </div>
    </Card>
  );
}

function Appearance() {
  const { theme, toggle } = useTheme();
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-fg">Apariencia</h2>
        <p className="text-sm text-muted">Elige el tema de la aplicación.</p>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
        {([["light", "Claro", <SunIcon key="s" width={16} height={16} />], ["dark", "Oscuro", <MoonIcon key="m" width={16} height={16} />]] as const).map(([value, label, icon]) => (
          <button
            key={value}
            onClick={() => { if (theme !== value) toggle(); }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${theme === value ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"}`}
          >
            {icon}{label}
          </button>
        ))}
      </div>
    </Card>
  );
}

function Security() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [state, setState] = useState<{ saving: boolean; msg: string | null; error: boolean }>({ saving: false, msg: null, error: false });

  async function change() {
    setState({ saving: true, msg: null, error: false });
    try {
      await api.patch("/users/me/password", { current_password: current, new_password: next });
      setCurrent(""); setNext("");
      setState({ saving: false, msg: "Contraseña actualizada.", error: false });
    } catch (e) {
      setState({ saving: false, msg: e instanceof Error ? e.message : "Error", error: true });
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-fg">Seguridad</h2>
        <p className="text-sm text-muted">Cambia tu contraseña.</p>
      </div>
      <Field label="Contraseña actual"><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
      <Field label="Nueva contraseña (mín. 8)"><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      {state.msg && <p className={`text-sm font-medium ${state.error ? "text-danger" : "text-success"}`}>{state.msg}</p>}
      <div className="flex justify-end">
        <Button variant="secondary" onClick={change} disabled={state.saving || !current || next.length < 8}>
          {state.saving ? <Spinner /> : "Cambiar contraseña"}
        </Button>
      </div>
    </Card>
  );
}
