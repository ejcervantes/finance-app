# Plataforma de Finanzas Personales — Documento de Arquitectura

> Hoja de ruta y registro de decisiones de diseño.
> Última actualización: 2026-08-17

---

## 1. Visión general

Plataforma para llevar finanzas personales, accesible desde **web** y **app móvil**.
Un **único backend (API)** centraliza toda la lógica y datos; cada frontend consume la misma API.

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Web (SPA)  │   │  App móvil  │   │  Futuro:    │
│             │   │             │   │  CLI/otros  │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                 │                 │
       └────────────┬────┴─────────────────┘
                    │  HTTPS · REST + OpenAPI · JWT
             ┌──────▼───────┐
             │   Backend    │  ← una sola API para todos
             │   (FastAPI)  │
             │ Auth · Lógica│
             └──────┬───────┘
                    │
             ┌──────▼───────┐
             │  PostgreSQL  │
             └──────────────┘
```

**Principio clave:** un backend, varios frontends. La lógica (cálculos, reglas,
categorización) vive solo en el backend; los frontends solo presentan.

---

## 2. Stack tecnológico

| Capa | Elección | Motivo |
|------|----------|--------|
| **Backend** | Python + **FastAPI** | Rápido, tipado, genera documentación OpenAPI automática |
| **Base de datos** | **PostgreSQL** | Robusta, tipo `NUMERIC` exacto para dinero, transacciones ACID |
| **ORM / Migraciones** | **SQLAlchemy + Alembic** | Estándar en Python; Alembic versiona los cambios de esquema |
| **Autenticación** | **JWT** (access + refresh token) | Sin estado, funciona igual para web y móvil |
| **Contrato API** | **REST + OpenAPI** | FastAPI lo genera solo; contrato único para todos los frontends |
| **IA (visión + asesor)** | **Google Gemini Flash** (vía capa `AIProvider`) | Multimodal, tool-calling, barato y rápido; intercambiable por diseño |
| **Frontend web** | *Por definir* (React / Vue) | — |
| **Frontend móvil** | *Por definir* (React Native / Flutter) | — |

### Decisiones transversales
- **Multiusuario desde el día uno:** cada tabla de datos lleva `user_id` y la API
  filtra siempre por el usuario autenticado. Volverse "público" después solo agrega
  cosas periféricas (verificación de email, rate-limiting, legales), no rediseño.
- **Dinero exacto:** `amount` se guarda como `NUMERIC(14,2)` con `Decimal` de Python.
  **Nunca `float`** (evita errores como `0.1 + 0.2 = 0.30000000000000004`).
- **Borrado suave (`is_archived`):** los catálogos (categorías, cuentas) no se borran
  de verdad para no romper el historial de transacciones que los referencian.

---

## 3. Modelo de datos

### Diagrama de relaciones

```
  User (usuario)
    │
    ├──< Account ......... cuentas: efectivo, banco, tarjeta, ahorro, inversión
    │                       (account_id es OPCIONAL en las transacciones)
    │
    ├──< Category ........ categorías: comida, salario, renta...
    │                       user_id NULL = del sistema (predefinida, para todos)
    │                       user_id = X  = propia del usuario X
    │
    ├──< Transaction ..... el movimiento: gasto o ingreso (corazón del sistema)
    │       │               (monto, fecha, descripción, tipo, naturaleza)
    │       ├── pertenece a una Account   (opcional, NULL permitido)
    │       └── pertenece a una Category  (OBLIGATORIO)
    │
    └──< Budget .......... presupuesto por categoría y período
            └── se compara contra las Transactions de esa categoría
```

**Idea central:** una sola tabla `transactions` maneja **ingresos y gastos**.
La columna `type` los distingue. Simplifica reportes y el modelo.

---

### Tablas

#### 👤 `users`
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID | PK |
| `email` | VARCHAR, único | login |
| `password_hash` | VARCHAR | hash (bcrypt/argon2), nunca texto plano |
| `first_name` | VARCHAR | nombre |
| `last_name` | VARCHAR | apellido |
| `country` | CHAR(2) | país de origen, ISO ej. `MX`, `CR` |
| `base_currency` | CHAR(3) | divisa por defecto, ej. `MXN`, `USD` |
| `created_at` / `updated_at` | TIMESTAMP | auditoría |

#### 🏦 `accounts`
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID | PK |
| `user_id` | FK → users | dueño |
| `name` | VARCHAR | ej. "BBVA débito", "Efectivo" |
| `type` | ENUM | `cash`, `bank`, `credit_card`, `savings`, `investment`, `other` |
| `currency` | CHAR(3) | divisa de la cuenta |
| `is_archived` | BOOLEAN | ocultar sin borrar |
| `created_at` / `updated_at` | TIMESTAMP | |

#### 🏷️ `categories`
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID | PK |
| `user_id` | FK → users, **NULL** | NULL = categoría del sistema (para todos); si no, del usuario |
| `name` | VARCHAR | ej. "Comida", "Salario" |
| `icon` / `color` | VARCHAR | opcional, para la UI |
| `is_archived` | BOOLEAN | ocultar sin borrar |
| `created_at` / `updated_at` | TIMESTAMP | |

> **Predefinidas sin duplicar:** las categorías del sistema existen **una sola vez**
> (`user_id = NULL`). Consulta para un usuario: `WHERE user_id = :yo OR user_id IS NULL`.
> `type` (ingreso/gasto) **no** vive aquí — vive en la transacción.

#### 💸 `transactions` (corazón del sistema)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID | PK |
| `user_id` | FK → users | dueño |
| `type` | ENUM `income` / `expense` | fuente de verdad del signo |
| `amount` | **NUMERIC(14,2)** | dinero exacto, nunca float |
| `currency` | CHAR(3) | por si difiere de la base |
| `expense_nature` | ENUM `fixed` / `variable` / `discretionary` | **NULL si es ingreso** |
| `description` | VARCHAR | ej. "Súper de la semana" |
| `transaction_date` | DATE | cuándo ocurrió (≠ cuándo se registró) |
| `account_id` | FK → accounts, **NULL** | opcional |
| `category_id` | FK → categories, **NOT NULL** | obligatorio |
| `notes` | TEXT | opcional |
| `source` | ENUM `manual` / `receipt_scan` | cómo se creó la transacción |
| `nature_source` | ENUM `user` / `ai`, **NULL** | quién decidió el `expense_nature` (para medir aciertos de la IA) |
| `receipt_id` | FK → receipts, **NULL** | recibo escaneado que la originó |
| `created_at` / `updated_at` | TIMESTAMP | |

> **`expense_nature` (naturaleza del gasto):**
> - `fixed` — fijo/esencial: alquiler, comida esencial, seguros
> - `variable` — variable necesario: gasolina, servicios
> - `discretionary` — prescindible: restaurante, cine, compra compulsiva
>
> Va en la transacción (no en la categoría) porque una misma categoría
> puede ser fija o variable según el caso.

#### 🎯 `budgets`
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID | PK |
| `user_id` | FK → users | dueño |
| `category_id` | FK → categories | qué categoría limita |
| `amount` | NUMERIC(14,2) | monto tope |
| `period` | ENUM | `weekly`, `monthly`, `yearly` |
| `start_date` | DATE | desde cuándo aplica |
| `created_at` / `updated_at` | TIMESTAMP | |

> El presupuesto **no guarda** cuánto llevas gastado; se calcula sumando las
> `transactions` de esa categoría en el período (evita totales duplicados/inconsistentes).

#### 🧾 `receipts` (para escaneo con IA)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID | PK |
| `user_id` | FK → users | dueño |
| `image_url` | VARCHAR | ubicación de la imagen guardada (storage) |
| `raw_extraction` | JSONB | lo que la IA detectó: monto, fecha, categoría/naturaleza sugerida, razonamiento, items |
| `created_at` | TIMESTAMP | |

> Guardar `raw_extraction` permite calcular `transactions.nature_source`:
> al confirmar, se compara el `expense_nature` final contra el sugerido por la IA.
> Igual → `ai`; distinto → `user`.

#### 💬 `assistant_messages` (historial del asesor IA)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID | PK |
| `user_id` | FK → users | dueño |
| `role` | ENUM `user` / `assistant` | quién habló |
| `content` | TEXT | el mensaje |
| `created_at` | TIMESTAMP | |

> Da contexto entre sesiones al asistente conversacional.

---

## 4. Cálculos derivados (sin tablas nuevas)

- **Balance / ahorro del período:** `ingresos − gastos` en el rango de fechas.
  No requiere tabla nueva; se calcula al vuelo.
- **Rendimiento:** índice compuesto `(user_id, transaction_date)` hace que las
  consultas por período sean instantáneas a escala personal (miles de filas).
- **Gasto ejecutado vs. presupuesto:** suma de `transactions` de la categoría en el período.

---

## 5. Índices previstos

- `transactions (user_id, transaction_date)` — consultas por período
- `transactions (user_id, category_id)` — gasto por categoría / presupuestos
- `categories (user_id)` — categorías del usuario + sistema
- `users (email)` UNIQUE — login
- `assistant_messages (user_id, created_at)` — historial del asesor

---

## 6. Alcance por versión

### v1 (actual) — backend completo
- [x] Modelo de datos definido
- [x] Registro de ingresos y gastos
- [x] Cuentas (opcionales)
- [x] Categorías (sistema + propias)
- [x] Presupuestos por categoría
- [x] Balance / ahorro calculado por período
- [x] Autenticación JWT
- [x] Escaneo de recibos con IA
- [x] Asesor de finanzas con IA
- [ ] Escaneo de recibos con IA (visión → borrador → confirmación)
- [ ] Asesor de finanzas con IA (conversacional + proactivo)

### Anotado para después (no v1)
- Transferencias entre cuentas
- Metas de ahorro (entidad `goals`)
- Tabla de resúmenes mensuales (`monthly_summary`) — optimización si crece el volumen
- Ocultar categorías del sistema por usuario (`user_hidden_categories`)
- Múltiples divisas con conversión
- Adjuntos (recibos) en transacciones
- Cosas de "hacerse público": verificación de email, recuperación de contraseña,
  rate-limiting, términos legales

---

## 7. Diseño de la API (REST)

**Convenciones**
- Base path: `/api/v1` (versionado desde el inicio)
- Auth: header `Authorization: Bearer <access_token>`
- **Aislamiento:** el usuario se toma del token, nunca de la URL. El backend siempre
  filtra por el usuario autenticado.
- Formato JSON. Errores uniformes: `{ "detail": "...", "code": "..." }` con status HTTP correcto.
- Paginación: **offset** (`page` / `page_size`).
- Borrado de transacciones: **real** (no soft). Los catálogos (categorías, cuentas) sí se archivan.

### 🔐 Auth
| Método | Endpoint | Qué hace | Auth |
|--------|----------|----------|------|
| POST | `/auth/register` | Crea usuario | Público |
| POST | `/auth/login` | Devuelve `access_token` + `refresh_token` | Público |
| POST | `/auth/refresh` | Nuevo `access_token` desde el `refresh_token` | Refresh token |
| POST | `/auth/logout` | Invalida el refresh token actual | Sí |

### 👤 Usuario
| Método | Endpoint | Qué hace |
|--------|----------|----------|
| GET | `/users/me` | Perfil del usuario autenticado |
| PATCH | `/users/me` | Actualiza `first_name`, `last_name`, `country`, `base_currency` |
| PATCH | `/users/me/password` | Cambia contraseña (pide la actual) |

### 🏷️ Categorías
| Método | Endpoint | Qué hace |
|--------|----------|----------|
| GET | `/categories` | Lista sistema + propias. `?include_archived=false` |
| POST | `/categories` | Crea categoría propia |
| GET | `/categories/{id}` | Detalle |
| PATCH | `/categories/{id}` | Edita — solo propias (sistema → 403) |
| DELETE | `/categories/{id}` | Archiva (soft), solo propias |

### 🏦 Cuentas
| Método | Endpoint | Qué hace |
|--------|----------|----------|
| GET | `/accounts` | Lista. `?include_archived=false` |
| POST | `/accounts` | Crea cuenta |
| GET | `/accounts/{id}` | Detalle |
| PATCH | `/accounts/{id}` | Edita |
| DELETE | `/accounts/{id}` | Archiva |

### 💸 Transacciones
| Método | Endpoint | Qué hace |
|--------|----------|----------|
| GET | `/transactions` | Lista con filtros y paginación |
| POST | `/transactions` | Crea ingreso o gasto |
| GET | `/transactions/{id}` | Detalle |
| PATCH | `/transactions/{id}` | Edita |
| DELETE | `/transactions/{id}` | Borra (real) |

Filtros del listado (opcionales, combinables):
```
?date_from=2026-08-01 &date_to=2026-08-31
&type=expense &category_id=uuid &account_id=uuid
&expense_nature=discretionary &search=super
&page=1 &page_size=50 &sort=-transaction_date
```
Respuesta paginada: `{ "items": [...], "total": N, "page": 1, "page_size": 50 }`

### 🎯 Presupuestos
| Método | Endpoint | Qué hace |
|--------|----------|----------|
| GET | `/budgets` | Lista |
| POST | `/budgets` | Crea (categoría + monto + período) |
| GET | `/budgets/{id}` | Detalle |
| PATCH | `/budgets/{id}` | Edita |
| DELETE | `/budgets/{id}` | Borra |

### 📊 Reportes (dedicados)
| Método | Endpoint | Qué devuelve |
|--------|----------|--------------|
| GET | `/reports/summary` | Totales de ingresos, gastos y ahorro del período (+ `savings_rate`) |
| GET | `/reports/by-category` | Gasto/ingreso agrupado por categoría |
| GET | `/reports/by-nature` | Desglose fijo / variable / discrecional |
| GET | `/reports/budgets` | Presupuesto vs. ejecutado por categoría |

### 📸 Escaneo de recibos (IA)
| Método | Endpoint | Qué hace |
|--------|----------|----------|
| POST | `/transactions/scan` | Sube imagen, la procesa con IA de visión, guarda `receipt` y devuelve un **borrador** (no crea la transacción) |

### 🤖 Asesor de finanzas (IA)
| Método | Endpoint | Qué hace |
|--------|----------|----------|
| POST | `/assistant/chat` | Conversacional; usa tool-calling sobre los reportes para responder con números reales |
| GET | `/assistant/insights` | Proactivo; alertas de gasto (híbrido: reglas detectan, IA redacta) |

---

## 8. Funcionalidades con IA

### 📸 Escaneo de recibos
**Principio: la IA propone, el humano confirma.** El escaneo nunca crea la
transacción; solo pre-llena un borrador editable.

```
Foto → POST /transactions/scan → modelo multimodal (visión)
     → guarda receipt (imagen + raw_extraction)
     → devuelve borrador { amount, date, description,
                           suggested_category_id, suggested_expense_nature,
                           confidence, reasoning }
     → mismo formulario de siempre, pre-llenado y editable
     → usuario confirma → POST /transactions (guardado normal)
```

- **Modelo multimodal** (no OCR clásico): lee el recibo Y razona sobre su
  contenido para decidir la naturaleza general del gasto (mayoría básicos →
  `fixed`; mayoría alcohol/snacks → `discretionary`). **No** desglosa en varias
  transacciones — un solo movimiento.
- **Procesamiento síncrono** en v1 (~3-5 s).
- **Imagen guardada** en storage; su referencia en `receipts.image_url`.
- **`nature_source`** se deriva comparando el valor final con el sugerido.

### 🤖 Asesor de finanzas
**Principio: la IA razona, los números salen de la BD** (tool-calling), nunca de
volcarle transacciones crudas (evita alucinar cifras).

- **Conversacional** (`/assistant/chat`): llama funciones (los reportes) para
  responder con datos exactos. Historial en `assistant_messages`.
- **Proactivo** (`/assistant/insights`): **híbrido** — reglas deterministas
  detectan la condición (ej. `salidas > umbral`, `presupuesto > 85%`), la IA solo
  redacta el consejo. Controla costo y precisión.

**Barreras del asesor (reglas fijas del sistema):**
- ✅ Puede recomendar gastar menos, ahorrar más, o que *en general* es buena idea invertir/ahorrar.
- ❌ **No** recomienda instrumentos específicos (acción/cripto/fondo).
- ✅ **Siempre** sugiere consultar a un profesional para decisiones de inversión.

### Capa de abstracción de IA
Una interfaz `AIProvider` en `services/` aísla al proveedor. Cambiar de proveedor
o migrar a un modelo auto-hospedado = cambiar la implementación, no la app.

**Proveedor en v1: Google Gemini Flash** (hosted, modelo `gemini-3.6-flash`).
- Multimodal (visión) para el escaneo de recibos. ✅ validado en vivo.
- *Function calling* para el asesor (tool-calling sobre los reportes). ✅ validado.
- Barato y rápido → adecuado para volumen de escaneo.
- Errores del proveedor (auth/API/red) se traducen a HTTP 502 con mensaje claro
  vía `AIProviderError` (no 500 opacos).

La interfaz expone dos capacidades:
```
AIProvider
  ├── extract_receipt(image) -> ReceiptExtraction   # visión
  └── chat(messages, tools)  -> AssistantReply       # tool-calling
```
Los términos exactos de retención de datos de Gemini se confirman al implementar.

---

## 9. Registro de decisiones

| # | Decisión | Motivo |
|---|----------|--------|
| 1 | Multiusuario desde el inicio | Barato ahora, caro rediseñar después |
| 2 | Python + FastAPI | Preferencia del equipo; OpenAPI automático |
| 3 | `type` solo en `transactions` | Permite movimientos sin depender de la categoría |
| 4 | `account_id` opcional (NULL) | Registrar sin especificar cuenta |
| 5 | `category_id` obligatorio | Esencial para finanzas personales |
| 6 | `amount` como NUMERIC | Exactitud monetaria, evita errores de float |
| 7 | Categorías: `user_id` nullable | Predefinidas sin duplicar + FK limpia |
| 8 | `expense_nature` de 3 niveles en la transacción | Una categoría puede ser fija o variable |
| 9 | Ahorro calculado, no almacenado | Evita inconsistencias; índices lo hacen rápido |
| 10 | Borrado real de transacciones | Es un hecho, no un catálogo; nada la referencia |
| 11 | Paginación offset | Simple, permite "ir a página N"; suficiente a escala personal |
| 12 | Reportes en endpoints dedicados (`/reports/*`) | Deja el listado limpio; ubica cada cálculo |
| 13 | Escaneo con IA: propone borrador, humano confirma | La IA nunca escribe dinero sin revisión |
| 14 | Modelo multimodal para recibos (no OCR) | Lee y razona el contenido para decidir la naturaleza |
| 15 | Asesor con tool-calling, no datos crudos | Números exactos de la BD; evita alucinaciones |
| 16 | Insights proactivos híbridos (reglas + IA) | Precisión y control de costo |
| 17 | Asesor sin consejos de inversión específicos | Evita asesoría financiera regulada |
| 18 | Capa de abstracción `AIProvider`, v1 con Gemini Flash | No casarse con un proveedor; Flash es multimodal, con tool-calling, barato y rápido |
| 19 | `receipts` guarda imagen + `raw_extraction` | Trazabilidad y cálculo de `nature_source` |

---

## 10. Próximos pasos

- [x] **Paso 4 — Diseño de la API** (auth, transacciones, categorías, cuentas, presupuestos, reportes)
- [x] Diseño de funcionalidades con IA (escaneo de recibos + asesor)
- [x] **Paso 5 — Estructura del proyecto backend** (esqueleto FastAPI + Docker)
- [ ] **Paso 6 — Implementación del backend** (en curso)
  - [x] Esqueleto: Docker, config, BD async, todos los modelos, Alembic
  - [x] Auth (registro, login, refresh, logout) + perfil de usuario
  - [x] Categorías (sistema + propias) + seed de 16 predefinidas
  - [x] Transacciones (CRUD + filtros + paginación)
  - [x] Cuentas, Presupuestos (CRUD)
  - [x] Reportes (summary, by-category, by-nature, budgets) — verificados con cuadre
  - [x] Escaneo de recibos IA (capa `AIProvider`: Gemini + stub, storage, /scan)
  - [x] Asesor de finanzas IA (chat con tool-calling + insights proactivos híbridos)
- [ ] **Paso 7 — Frontends**
  - [ ] **App iOS (SwiftUI)** — en curso
    - [x] Scaffold: proyecto XcodeGen, red (APIClient), sesión, Keychain, modelos
    - [x] Pantallas: login/registro, dashboard (resumen), movimientos (lista+alta), perfil
    - [x] Compila (BUILD SUCCEEDED) y corre en simulador iPhone 17 Pro (iOS 26.5)
    - [x] Verificado en vivo: login → dashboard con datos reales → alta de gasto → aparece en lista
    - [x] Escaneo de recibos con IA (cámara/galería → /scan → formulario pre-llenado → confirmar)
      - Verificado en vivo: recibo de farmacia → Gemini extrajo monto 14.300, categoría Salud, naturaleza fija (98%)
    - [x] Asesor de IA: chat con historial (tool-calling) + análisis proactivo (insights)
      - Verificado en vivo: respuestas con datos reales del mes, con las barreras de inversión
    - [ ] Cuentas y presupuestos en la UI
    - [ ] Pulido: íconos/colores de categorías, gráfica en el dashboard
  - [ ] **Frontend web (React + Vite + Tailwind v4)** — en curso
    - [x] Tema claro/oscuro con paleta #FFE9CF / #134F5C, fuente Plus Jakarta Sans
    - [x] Login/registro, dashboard (balance, ahorro, gasto por categoría), movimientos (lista + alta)
    - [x] Responsivo (móvil/desktop), verificado en el navegador
    - [ ] Escaneo de recibos + asesor + presupuestos en la web
    - [ ] Deploy de la web (Render Static Site apuntando al backend en producción)

### Stack del frontend web
- **React + Vite + TypeScript + Tailwind CSS v4**, React Router, TanStack Query.
- Tema por CSS variables (claro: fondo melocotón / texto teal; oscuro: al revés).
- API en `VITE_API_URL` (dev: localhost:8000; prod: Render). Carpeta `web/`.
- [x] **Deploy del backend en Render** (Docker + Postgres + disco), HTTPS
  - URL: https://finance-backend-9rh6.onrender.com — verificado en vivo desde la app iOS (Release)
  - Migraciones + seed vía `backend/prestart.sh` (pre-deploy). Ver [DEPLOY.md](DEPLOY.md)

**✅ Backend v1 completo** (36 rutas) — IA real con Gemini validada end-to-end
(asesor con tool-calling + escaneo de recibos con visión).

### Stack de la app iOS
- **SwiftUI nativo**, MVVM, iOS 17+. Proyecto generado con **XcodeGen** (`ios/project.yml`).
- Se conecta al backend en `http://localhost:8000` (excepción ATS para localhost en dev).
- Tokens JWT guardados en **Keychain**.
