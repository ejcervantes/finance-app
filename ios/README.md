# Finance Calc — App iOS (SwiftUI)

App nativa de iPhone para la plataforma de finanzas personales.
Consume el backend en `http://localhost:8000` (ver [`../backend`](../backend)).

## Requisitos

- **Xcode** (completo, no solo Command Line Tools)
- **XcodeGen** (`brew install xcodegen`) — genera el `.xcodeproj` desde `project.yml`
- El **backend corriendo** (`docker compose up` en la raíz del proyecto)

## Generar y correr

```bash
# 1. Generar el proyecto Xcode (tras clonar o cambiar project.yml)
cd ios
xcodegen generate

# 2. Abrir en Xcode
open FinanceCalc.xcodeproj
```

En Xcode: elige un simulador de iPhone y pulsa **Run** (⌘R).

> El proyecto ya permite HTTP a `localhost` (excepción de ATS en `project.yml`)
> para conectar con el backend en desarrollo.

## Estructura

```
FinanceCalc/
├── App/            punto de entrada + navegación raíz (tabs)
├── Core/           red (APIClient), sesión, Keychain, formatos
├── Models/         structs Codable que mapean la API
└── Features/
    ├── Auth/         login + registro
    ├── Dashboard/    resumen del mes (balance, ahorro, por categoría)
    ├── Transactions/ lista + alta de movimientos
    └── Profile/      datos del usuario + cerrar sesión
```

## Arquitectura

- **SwiftUI** + patrón MVVM (`ViewModel` como `ObservableObject`).
- **APIClient**: un solo punto para peticiones; inyecta el token, decodifica
  respuestas y errores (`{ "detail": ... }`), convierte snake_case ↔ camelCase.
- **Session**: estado global de autenticación; guarda los tokens en **Keychain**.
- El proyecto (`.xcodeproj`) se **genera**; no se versiona. Se versiona `project.yml`.
