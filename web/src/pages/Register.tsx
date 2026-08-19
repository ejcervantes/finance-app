import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, Field, Input, Spinner } from "../components/ui";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    country: "CR",
    base_currency: "CRC",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({
        ...form,
        country: form.country.toUpperCase(),
        base_currency: form.base_currency.toUpperCase(),
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo />
          <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-fg">
            Crea tu cuenta
          </h1>
          <p className="mt-1 text-sm text-muted">
            Empieza a organizar tus finanzas hoy.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre">
              <Input value={form.first_name} onChange={set("first_name")} required />
            </Field>
            <Field label="Apellido">
              <Input value={form.last_name} onChange={set("last_name")} required />
            </Field>
          </div>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set("email")} required />
          </Field>
          <Field label="Contraseña (mín. 8)">
            <Input
              type="password"
              value={form.password}
              onChange={set("password")}
              minLength={8}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="País">
              <Input value={form.country} onChange={set("country")} maxLength={2} required />
            </Field>
            <Field label="Divisa">
              <Input value={form.base_currency} onChange={set("base_currency")} maxLength={3} required />
            </Field>
          </div>

          {error && <p className="text-sm font-medium text-danger">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Spinner /> : "Crear cuenta"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-semibold text-fg underline-offset-4 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
