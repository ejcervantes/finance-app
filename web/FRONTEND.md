# Frontend web — Roadmap y mejoras

Documento vivo del frontend web (`web/`). Complementa a
[`../ARQUITECTURA.md`](../ARQUITECTURA.md) con el detalle de UI/UX.

Stack: **React + Vite + TypeScript + Tailwind v4**, React Router, TanStack Query.
Paleta: **#FFE9CF** (melocotón) + **#134F5C** (teal). Fuente: **Plus Jakarta Sans**.

---

## Estado actual

- [x] Login / registro
- [x] Dashboard v1 (balance, ingresos/gastos, barras por categoría, recientes)
- [x] Movimientos (lista + alta + borrar)
- [x] Tema claro/oscuro + responsivo
- [x] Deploy en Cloudflare (Workers static assets) apuntando al backend en Render

---

## Rediseño de la página de inicio (aprobado — maqueta revisada)

La home debe **contar cómo voy en un vistazo**, respondiendo 4 preguntas.
Composición de arriba hacia abajo:

1. **Veredicto del mes** — balance grande + tasa de ahorro + delta vs. mes
   anterior (▲/▼) + mini-línea de balance de los últimos 6 meses.
2. **Cómo vengo** ⭐ — barras **ingresos vs. gastos** por mes (últimos 6).
3. **Esencial vs. prescindible** — barra apilada fijo / variable / prescindible.
4. **A dónde va tu dinero** — dona por categoría con etiquetas directas.
5. **Presupuestos** — barras de progreso con **semáforo** (en orden / ajustado / excedido).
6. **Ahorro acumulado** — área en el tiempo.

Notas de diseño: colores de la dona **validados para daltonismo** (claro y oscuro);
estado codificado en **color + texto** (nunca solo color); resumen primero.

---

## Mejoras pendientes (priorizadas)

### Rediseño de la home
- [ ] **Filtro por mes (global).** Navegar mes a mes (◀ Agosto 2026 ▶) y que todo
      el dashboard (y movimientos) se filtre a ese mes. Pasa `date_from`/`date_to`.
- [ ] **Etiquetas de meses en la mini-línea del hero.** Hoy la línea de "balance de
      los últimos 6 meses" no muestra los meses abajo — no se sabe a qué punto
      corresponde cada mes. Agregar etiquetas (Mar…Ago) o tooltips.
- [ ] Portar los gráficos de la maqueta a componentes React (barras mensuales,
      dona, barra apilada de naturaleza, progreso de presupuestos, área, mini-línea).
- [ ] Hover/tooltips propios en los gráficos (no solo `<title>` nativo).

### Formulario de movimientos
- [ ] **[#3] Editar movimientos.** Hoy solo se crea/borra; falta editar
      (el backend ya tiene `PATCH /transactions/{id}`).
- [ ] **[#5] Categorías por tipo (ingreso/gasto).** No tiene sentido "ingreso +
      categoría Comida". El formulario debe mostrar solo las categorías del tipo
      elegido. **Requiere backend** (ver abajo).
- [ ] **[#6] Naturaleza por defecto según categoría.** Al elegir una categoría
      (ej. Restaurantes → prescindible) pre-seleccionar su naturaleza, editable.
      **Requiere backend** (ver abajo).
- [ ] **[#4] Escaneo de recibos en la web.** Subir/arrastrar una imagen →
      `/transactions/scan` → pre-llenar el formulario (el backend ya existe).

### Nuevas pantallas
- [ ] **[#1] Presupuestos.** Pantalla para crear/editar topes por categoría (CRUD).
- [ ] **[#2] Asesor de IA (chat).** Consultas al asesor + análisis del mes. Ver la
      mejora de contexto temporal en "Cambios de backend".
- [ ] **[#7] Menú de perfil / Ajustes.** Al hacer clic en el ícono de perfil, abrir
      un menú/página con: datos personales (nombre, apellido, email…) editables, y
      **mover ahí** el interruptor de modo claro/oscuro (sacarlo de la barra).
- [ ] **Cuentas** (efectivo, banco, tarjeta…) — CRUD en la UI.

---

## Cambios de backend requeridos

- [x] **Endpoint de tendencia mensual** — `GET /reports/trend?months=6`: por mes
      `income`, `expense`, `balance`, `cumulative`. Para los gráficos 2, 6 y el hero.
- [x] **[#5] Categorías con tipo.** Columna `type` (income/expense) en `categories`
      + seed tipado + filtro `GET /categories?type=…` + validación de coherencia
      categoría↔tipo al crear/editar movimientos.
- [x] **[#6] Naturaleza por defecto.** Columna `default_nature` (nullable) en
      `categories` + valores en el seed. La devuelve `GET /categories`.
      **Falta el frontend**: usar `default_nature` para pre-seleccionar la naturaleza.
- [ ] **[#2] Asesor con contexto temporal ("¿me alcanza para esto?").** Que el
      asesor evalúe una compra prospectiva: si es pequeña, ver si cabe en el mes;
      si es grande (ej. un carro), mirar cuánto has ahorrado en los últimos años y
      qué tan bien podrías asumir ese gasto. Requiere darle herramientas de
      histórico multi-mes/año y un modo "evaluar compra".

---

## Pulido / ideas para después (no bloquean)

- Medidor (gauge) de tasa de ahorro.
- Top 3 gastos del mes / mayores variaciones vs. mes anterior.
- Racha de meses ahorrando > X%.
- Íconos y colores por categoría (el backend ya guarda `icon`/`color`).
- Equilibrar alturas de tarjetas en la fila (la de naturaleza queda corta).
- Animaciones sutiles de entrada / transición al cambiar de mes.
- Restringir CORS al dominio de la web (hoy abierto).
