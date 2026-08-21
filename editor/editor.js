/**
 * Editor — Script Manager Extension
 *
 * Gestiona la creación y edición de scripts.
 * Recibe el ID del script por query param (?id=xxx) o la URL para script nuevo (?newUrl=...).
 *
 * Seguridad:
 *  - Validación de entradas con esquema explícito antes de guardar.
 *  - Los valores se insertan siempre con .value / .textContent, nunca innerHTML.
 *  - La URL se valida con el constructor URL() nativo para evitar valores malformados.
 *  - Los mensajes de error no revelan datos del sistema.
 */

'use strict';

// ─── Constantes de validación ─────────────────────────────────────────────────

const MAX_NAME_LENGTH = 80;
const MAX_URL_LENGTH  = 500;
const MAX_CODE_LENGTH = 200_000; // 200 KB de código máximo

// ─── Storage helpers ──────────────────────────────────────────────────────────

async function getAllScripts() {
  const data = await chrome.storage.local.get('scripts');
  return data.scripts || [];
}

async function saveAllScripts(scripts) {
  await chrome.storage.local.set({ scripts });
}

// ─── Validación ───────────────────────────────────────────────────────────────

/**
 * Valida los campos del formulario y retorna un mensaje de error o null.
 * @param {string} name
 * @param {string} url
 * @param {string} code
 * @returns {string|null}
 */
function validate(name, url, code) {
  if (!name.trim()) return 'El nombre es obligatorio.';
  if (name.trim().length > MAX_NAME_LENGTH)
    return `El nombre no puede superar ${MAX_NAME_LENGTH} caracteres.`;

  if (!url.trim()) return 'La URL es obligatoria.';
  if (url.trim().length > MAX_URL_LENGTH)
    return `La URL no puede superar ${MAX_URL_LENGTH} caracteres.`;

  try {
    const parsed = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol))
      return 'La URL debe comenzar con http:// o https://';
  } catch {
    return 'La URL no tiene un formato válido.';
  }

  if (!code.trim()) return 'El código no puede estar vacío.';
  if (code.length > MAX_CODE_LENGTH)
    return `El código supera el tamaño máximo permitido (${MAX_CODE_LENGTH / 1000} KB).`;

  return null;
}

// ─── Números de línea ─────────────────────────────────────────────────────────

function updateLineNumbers(textarea, lineNumbersEl) {
  const lines = textarea.value.split('\n').length;
  const current = lineNumbersEl.childElementCount;

  if (lines > current) {
    const fragment = document.createDocumentFragment();
    for (let i = current + 1; i <= lines; i++) {
      const span = document.createElement('span');
      span.textContent = i;
      fragment.appendChild(span);
    }
    lineNumbersEl.appendChild(fragment);
  } else if (lines < current) {
    while (lineNumbersEl.childElementCount > lines) {
      lineNumbersEl.removeChild(lineNumbersEl.lastChild);
    }
  }

  // Sincronizar scroll
  lineNumbersEl.scrollTop = textarea.scrollTop;
}

// ─── Mostrar / ocultar error ──────────────────────────────────────────────────

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg; // textContent: seguro contra XSS
  el.hidden = false;
}

function clearError() {
  const el = document.getElementById('error-msg');
  el.textContent = '';
  el.hidden = true;
}

// ─── Inicialización ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const params    = new URLSearchParams(window.location.search);
  const editId    = params.get('id');
  const newUrl    = params.get('newUrl');

  const nameInput  = document.getElementById('input-name');
  const urlInput   = document.getElementById('input-url');
  const delayInput = document.getElementById('input-delay');
  const codeInput  = document.getElementById('input-code');
  const lineNums  = document.getElementById('line-numbers');
  const pageTitle = document.getElementById('page-title');
  const btnSave   = document.getElementById('btn-save');
  const btnBack   = document.getElementById('btn-back');

  let editingScript = null;

  // Cargar script existente si estamos en modo edición
  if (editId) {
    const scripts = await getAllScripts();
    editingScript = scripts.find((s) => s.id === editId) || null;

    if (editingScript) {
      pageTitle.textContent = 'Editar Script';
      nameInput.value  = editingScript.name;
      urlInput.value   = editingScript.url;
      delayInput.value = editingScript.delay || 0;
      codeInput.value  = editingScript.code;
      updateLineNumbers(codeInput, lineNums);
    }
  } else if (newUrl) {
    // Pre-rellenar URL cuando venimos del popup
    urlInput.value = newUrl;
  }

  // Inicializar líneas
  updateLineNumbers(codeInput, lineNums);

  // Actualizar números de línea y scroll en tiempo real
  codeInput.addEventListener('input', () => {
    updateLineNumbers(codeInput, lineNums);
    clearError();
  });

  codeInput.addEventListener('scroll', () => {
    lineNums.scrollTop = codeInput.scrollTop;
  });

  // Tab → insertar 2 espacios en el textarea
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = codeInput.selectionStart;
      const end   = codeInput.selectionEnd;
      codeInput.value =
        codeInput.value.substring(0, start) + '  ' + codeInput.value.substring(end);
      codeInput.selectionStart = codeInput.selectionEnd = start + 2;
      updateLineNumbers(codeInput, lineNums);
    }
  });

  // ── Guardar ────────────────────────────────────────────────────────────────

  btnSave.addEventListener('click', async () => {
    const name  = nameInput.value.trim();
    const url   = urlInput.value.trim();
    const delay = Math.max(0, Math.min(60, parseInt(delayInput.value, 10) || 0));
    const code  = codeInput.value;

    const error = validate(name, url, code);
    if (error) {
      showError(error);
      return;
    }

    clearError();
    btnSave.disabled = true;
    btnSave.textContent = 'Guardando…';

    try {
      const scripts = await getAllScripts();

      if (editingScript) {
        // Actualizar script existente
        const idx = scripts.findIndex((s) => s.id === editingScript.id);
        if (idx !== -1) {
          scripts[idx] = {
            ...scripts[idx],
            name,
            url,
            delay,
            code,
            updatedAt: Date.now(),
          };
        }
      } else {
        // Crear nuevo script
        scripts.push({
          id:        crypto.randomUUID(),
          name,
          url,
          delay,
          code,
          enabled:   true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      await saveAllScripts(scripts);
      window.close();
    } catch {
      // No revelamos detalles del error al usuario
      showError('No se pudo guardar el script. Inténtalo de nuevo.');
      btnSave.disabled = false;
      btnSave.textContent = '💾 Guardar';
    }
  });

  // ── Volver ─────────────────────────────────────────────────────────────────

  btnBack.addEventListener('click', () => window.close());
});
