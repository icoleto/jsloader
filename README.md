# JSLoader

Extensión de Chrome (Manifest V3) para guardar, activar/desactivar y ejecutar scripts JavaScript por URL exacta.

## Qué hace

- Ejecuta scripts por URL cuando la página termina de cargar.
- Almacenamiento local en `chrome.storage.local`.
- Activación/desactivación por script.
- Delay configurable por script (útil para SPAs como Power BI).
- Helper global `waitForElement(selector, timeoutMs)` disponible en scripts.
- Panel global para administrar todos los scripts por URL.

## Estructura del proyecto

```text
jsloader/
├── manifest.json
├── background/
│   └── service-worker.js
├── content/
│   └── content-bridge.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── panel/
│   ├── panel.html
│   ├── panel.css
│   └── panel.js
├── editor/
│   ├── editor.html
│   ├── editor.css
│   └── editor.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Instalación manual en Chrome

1. Abre `chrome://extensions`.
2. Activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida**.
4. Selecciona la carpeta raíz del proyecto (`jsloader`).
5. (Opcional) Fija la extensión con el icono de puzzle para tenerla visible.

Cada vez que cambies código:

1. Vuelve a `chrome://extensions`.
2. Pulsa **Actualizar** en la tarjeta de JSLoader.

## Uso rápido

1. Abre una web objetivo.
2. Haz clic en el icono de JSLoader.
3. Pulsa **+ Nuevo** y crea tu script para esa URL.
4. Activa/desactiva desde el popup o desde **Ver todos** (panel global).

Ejemplo con espera de elemento:

```js
const filtro = await waitForElement('[data-testid="slicer-container"]', 20000);
filtro.click();
```

## Requisitos

- Google Chrome (actual).
- Permiso para cargar extensiones descomprimidas en modo desarrollador.

## Seguridad y notas

- El código de usuario se ejecuta mediante `chrome.scripting.executeScript` en `world: "MAIN"`.
- Los scripts se asocian a URL exacta (normalizada sin hash y sin trailing slash).
- No se incluyen secretos en el repositorio.
