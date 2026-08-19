# Instalar la app en tu iPhone (gratis, sin App Store)

Con tu **Apple ID normal** puedes instalar la app en tu propio iPhone.
No necesitas el Apple Developer Program ($99). El único límite: la firma
**caduca a los 7 días** — para renovar, vuelves a correr desde Xcode.

La app instalada así usa **producción (Render)**, así que registras tu cuenta
real y tus datos viven en la nube.

## Pasos

### 1. Conecta el iPhone
- Conéctalo a la Mac con cable, desbloquéalo y toca **"Confiar"** ("Trust This
  Computer") si aparece.

### 2. Abre el proyecto en Xcode
```bash
cd ios && xcodegen generate && open FinanceCalc.xcodeproj
```

### 3. Configura la firma
- En Xcode, selecciona el proyecto **FinanceCalc** (barra lateral) → target
  **FinanceCalc** → pestaña **Signing & Capabilities**.
- Marca **"Automatically manage signing"**.
- En **Team**, elige tu Apple ID. Si no aparece: **Add an Account…** e inicia
  sesión con tu Apple ID (crea un "Personal Team" gratis).

> **Si sale error de "bundle identifier"** (ya está en uso): cambia
> `PRODUCT_BUNDLE_IDENTIFIER` en `ios/project.yml` por algo único, ej.
> `com.ejcervantes.financecalc`, guarda, corre `xcodegen generate` y reabre.

### 4. Elige tu iPhone como destino
- En la barra superior de Xcode (junto al nombre del esquema), selecciona tu
  **iPhone** en vez del simulador.

### 5. Corre (⌘R)
- Xcode compila, firma e instala la app en el teléfono.

### 6. Confía en el certificado (solo la primera vez)
- Al abrir la app el iPhone dirá "Developer no confiable".
- En el iPhone: **Ajustes → General → VPN y gestión de dispositivos** → toca tu
  Apple ID → **Confiar**.

### 7. Abre la app
- Regístrate con tu cuenta real. La app habla con tu backend en Render. ✅

## Renovar (cada 7 días)
- Vuelve a conectar el iPhone y **Run (⌘R)** desde Xcode. Listo.

## ¿Quieres que dure un año + compartir con otros?
- Necesitas el **Apple Developer Program** ($99/año). Eso habilita **TestFlight**
  (invitas gente por link/email) y firmas que duran un año.
