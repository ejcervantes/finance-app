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
- [x] Importar estado de cuenta: modal → subir **PDF** → la IA reconoce cada
      movimiento → revisar grilla → `POST /transactions/bulk` (atómico)

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
- [x] **Filtro por mes (global).** Navegador ◀ mes ▶ que filtra dashboard y
      movimientos (`MonthProvider`).
- [x] **Etiquetas de meses en la mini-línea del hero.**
- [x] Gráficos portados a React (barras mensuales, dona, barra apilada de
      naturaleza, progreso de presupuestos con semáforo, área, mini-línea).
- [ ] Hover/tooltips propios en los gráficos (hoy solo `<title>` nativo).

### Formulario de movimientos
- [x] **[#3] Editar movimientos.** Clic en un movimiento → editar/eliminar.
- [x] **[#5] Categorías por tipo (ingreso/gasto).** El formulario filtra las
      categorías según el tipo elegido.
- [x] **[#6] Naturaleza por defecto según categoría.** Al elegir la categoría se
      pre-selecciona su naturaleza (editable).
- [x] **[#4] Escaneo de recibos en la web.** Botón 📷 Escanear → sube la imagen →
      Gemini extrae → modal 'Confirmar recibo' pre-llenado (con receipt_id).

### Nuevas pantallas
- [x] **[#1] Presupuestos.** Pantalla CRUD (crear/editar/eliminar) con progreso y
      semáforo por categoría. Alimenta también la tarjeta del dashboard.
- [x] **[#2] Asesor de IA (chat).** Pantalla /asesor: chat con historial, insights
      (Análisis del mes), y evaluación de compras ("¿me alcanza?").
- [x] **[#7] Menú de perfil / Ajustes.** El avatar lleva a `/perfil`: datos
      personales editables (email de solo lectura), tema claro/oscuro (movido de la
      barra), cambio de contraseña y cerrar sesión.
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
      El frontend la usa para pre-seleccionar la naturaleza.
- [x] **[#2] Asesor con contexto temporal ("¿me alcanza para esto?").** Nueva
      herramienta `get_savings_trend` (12 meses) + instrucciones para evaluar
      compras pequeñas (¿cabe en el mes?) y grandes (¿en cuántos meses de ahorro?).

---

## Pulido / ideas para después (no bloquean)

- Medidor (gauge) de tasa de ahorro.
- Top 3 gastos del mes / mayores variaciones vs. mes anterior.
- Racha de meses ahorrando > X%.
- Íconos y colores por categoría (el backend ya guarda `icon`/`color`).
- Equilibrar alturas de tarjetas en la fila (la de naturaleza queda corta).
- Animaciones sutiles de entrada / transición al cambiar de mes.
- Restringir CORS al dominio de la web (hoy abierto).
