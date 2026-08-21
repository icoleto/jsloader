/**
 * Popup — Script Manager Extension
 *
 * Muestra los scripts asociados a la URL activa y permite activar/desactivar,
 * editar o eliminar cada uno.
 *
 * Seguridad:
 *  - Todo contenido dinámico se inserta con textContent / createElement,
 *    NUNCA con innerHTML de strings no controlados (prevención XSS).
 *  - Las acciones destructivas (eliminar) requieren confirmación.
 */

'use strict';

// ─── Utilidades de storage ────────────────────────────────────────────────────

async function getAllScripts() {
  const data = await chrome.storage.local.get('scripts');
  return data.scripts || [];
}

async function saveAllScripts(scripts) {
  await chrome.storage.local.set({ scripts });
}

// ─── Normalización de URL ─────────────────────────────────────────────────────

function normalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return rawUrl;
  }
}

// ─── Renderizado ──────────────────────────────────────────────────────────────

/**
 * Crea el elemento DOM de un script de forma segura (sin innerHTML).
 * @param {object} script
 * @param {Function} onToggle
 * @param {Function} onEdit
 * @param {Function} onDelete
 * @returns {HTMLElement}
 */
function createScriptItem(script, onToggle, onEdit, onDelete) {
  const item = document.createElement('article');
  item.className = `script-item ${script.enabled ? 'script-item--on' : 'script-item--off'}`;
  item.dataset.id = script.id;

  // Toggle switch
  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'toggle';
  toggleLabel.title = script.enabled ? 'Desactivar script' : 'Activar script';

  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.checked = script.enabled;
  toggleInput.addEventListener('change', () => onToggle(script.id, toggleInput.checked));

  const toggleSlider = document.createElement('span');
  toggleSlider.className = 'toggle__slider';

  toggleLabel.appendChild(toggleInput);
  toggleLabel.appendChild(toggleSlider);

  // Info
  const info = document.createElement('div');
  info.className = 'script-item__info';

  const name = document.createElement('strong');
  name.className = 'script-item__name';
  name.textContent = script.name; // textContent: seguro contra XSS

  const meta = document.createElement('span');
  meta.className = 'script-item__meta';
  meta.textContent = script.enabled ? 'Activo' : 'Inactivo';

  info.appendChild(name);
  info.appendChild(meta);

  // Acciones
  const actions = document.createElement('div');
  actions.className = 'script-item__actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn--icon';
  editBtn.title = 'Editar script';
  editBtn.textContent = '✏️';
  editBtn.addEventListener('click', () => onEdit(script.id));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn--icon btn--danger';
  deleteBtn.title = 'Eliminar script';
  deleteBtn.textContent = '🗑️';
  deleteBtn.addEventListener('click', () => onDelete(script.id, script.name));

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  item.appendChild(toggleLabel);
  item.appendChild(info);
  item.appendChild(actions);

  return item;
}

async function renderScripts(currentUrl) {
  const list = document.getElementById('scripts-list');
  const emptyState = document.getElementById('empty-state');

  const allScripts = await getAllScripts();
  const pageScripts = allScripts.filter(
    (s) => normalizeUrl(s.url) === normalizeUrl(currentUrl)
  );

  // Limpiar lista de forma segura
  while (list.firstChild) list.removeChild(list.firstChild);

  if (pageScripts.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  pageScripts.forEach((script) => {
    const item = createScriptItem(
      script,
      handleToggle,
      handleEdit,
      handleDelete
    );
    list.appendChild(item);
  });
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleToggle(id, enabled) {
  const scripts = await getAllScripts();
  const idx = scripts.findIndex((s) => s.id === id);
  if (idx === -1) return;
  scripts[idx].enabled = enabled;
  scripts[idx].updatedAt = Date.now();
  await saveAllScripts(scripts);
  // Actualizar clase visual sin re-renderizar todo
  const item = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (item) {
    item.classList.toggle('script-item--on', enabled);
    item.classList.toggle('script-item--off', !enabled);
    const meta = item.querySelector('.script-item__meta');
    if (meta) meta.textContent = enabled ? 'Activo' : 'Inactivo';
  }
}

function handleEdit(id) {
  chrome.tabs.create({
    url: chrome.runtime.getURL(`panel/panel.html?editId=${encodeURIComponent(id)}`),
  });
  window.close();
}

async function handleDelete(id, name) {
  // Confirmación antes de destruir — usamos texto seguro
  if (!confirm(`¿Eliminar el script "${name}"?`)) return;
  const scripts = await getAllScripts();
  const filtered = scripts.filter((s) => s.id !== id);
  await saveAllScripts(filtered);
  // Obtener URL activa y re-renderizar
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await renderScripts(tab.url);
}

function handleNewScript(currentUrl) {
  const url = chrome.runtime.getURL(
    `panel/panel.html?newUrl=${encodeURIComponent(normalizeUrl(currentUrl))}`
  );
  chrome.tabs.create({ url });
  window.close();
}

function handleOpenPanel() {
  chrome.tabs.create({ url: chrome.runtime.getURL('panel/panel.html') });
  window.close();
}

// ─── Inicialización ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Mostrar URL actual de forma segura
  const urlEl = document.getElementById('current-url');
  urlEl.textContent = tab.url || 'URL no disponible';
  urlEl.title = tab.url || '';

  // Botones de nuevo script
  const btnNew = document.getElementById('btn-new');
  const btnNewEmpty = document.getElementById('btn-new-empty');

  btnNew.addEventListener('click', () => handleNewScript(tab.url));
  btnNewEmpty.addEventListener('click', () => handleNewScript(tab.url));

  document.getElementById('btn-panel').addEventListener('click', handleOpenPanel);

  await renderScripts(tab.url);
});
