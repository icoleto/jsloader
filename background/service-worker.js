/**
 * Service Worker — JSLoader Extension
 *
 * Responsabilidades:
 *  1. Al navegar a una pestaña, buscar scripts activos para esa URL exacta.
 *  2. Ejecutar cada script en el contexto MAIN de la página via chrome.scripting.executeScript,
 *     lo que bypasea la CSP de la web (es un privilegio de extensión, no inline script).
 *
 * Seguridad:
 *  - world: 'MAIN' ejecuta en el contexto window de la página, sin acceso a APIs de extensión.
 *  - El código de usuario se pasa como función serializada, nunca como string eval-uado
 *    dentro del contexto privilegiado de la extensión.
 *  - No se expone ninguna API interna de la extensión a los scripts de usuario.
 */

/**
 * Normaliza una URL eliminando hash y trailing slash para comparación consistente.
 * @param {string} rawUrl
 * @returns {string}
 */
function normalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return rawUrl;
  }
}

/**
 * Recupera los scripts activos para una URL concreta desde chrome.storage.local.
 * @param {string} pageUrl
 * @returns {Promise<Array>}
 */
async function getActiveScriptsForUrl(pageUrl) {
  const normalized = normalizeUrl(pageUrl);
  const data = await chrome.storage.local.get('scripts');
  const scripts = data.scripts || [];
  return scripts.filter(
    (s) => s.enabled && normalizeUrl(s.url) === normalized
  );
}

/**
 * Ejecuta los scripts en el contexto MAIN de la página usando chrome.scripting.executeScript.
 * Este método bypasea la CSP de la web porque Chrome lo trata como inyección de extensión.
 *
 * Flujo por script:
 *  1. Esperar el delay configurado (por defecto 0ms).
 *  2. Inyectar el helper waitForElement en la página.
 *  3. Ejecutar el código de usuario.
 * @param {number} tabId
 * @param {Array} scripts
 */
async function injectScripts(tabId, scripts) {
  if (!scripts.length) return;

  for (const script of scripts) {
    const delayMs = (script.delay || 0) * 1000;

    try {
      // ── Paso 1: esperar el delay configurado ──────────────────────────────
      if (delayMs > 0) {
        await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
          args: [delayMs],
        });
      }

      // ── Paso 2: inyectar helper waitForElement ────────────────────────────
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
          // Disponible globalmente en los scripts de usuario como waitForElement(selector, timeout)
          if (window.__jsloaderReady) return;
          window.__jsloaderReady = true;

          window.waitForElement = function (selector, timeoutMs = 15000) {
            return new Promise((resolve, reject) => {
              const el = document.querySelector(selector);
              if (el) return resolve(el);

              const observer = new MutationObserver(() => {
                const found = document.querySelector(selector);
                if (found) {
                  observer.disconnect();
                  clearTimeout(timer);
                  resolve(found);
                }
              });

              observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
              });

              const timer = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`[JSLoader] waitForElement: "${selector}" no apareció en ${timeoutMs}ms`));
              }, timeoutMs);
            });
          };
        },
        args: [],
      });

      // ── Paso 3: ejecutar el código de usuario ─────────────────────────────
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (code, name) => {
          try {
            // eslint-disable-next-line no-new-func
            const fn = new Function(code);
            fn();
          } catch (err) {
            console.error(`[JSLoader] Error en script "${name}":`, err.message);
          }
        },
        args: [script.code, script.name],
      });

    } catch (err) {
      console.debug('[JSLoader] No se pudo inyectar script en tab', tabId, err?.message);
    }
  }
}

// ─── Listener principal ────────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Solo actuamos cuando la página ha terminado de cargar y tiene URL http/https
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || !/^https?:\/\//.test(tab.url)) return;

  const activeScripts = await getActiveScriptsForUrl(tab.url);
  await injectScripts(tabId, activeScripts);
});
