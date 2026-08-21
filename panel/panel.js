/**
 * Panel de administración global — JSLoader
 *
 * Seguridad:
 *  - Todo contenido dinámico se inserta con textContent / createElement (anti-XSS).
 *  - Validación de entradas igual que en editor.js antes de guardar.
 *  - IDs generados con crypto.randomUUID().
 */

'use strict';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_NAME_LENGTH = 80;
const MAX_URL_LENGTH  = 500;
const MAX_CODE_LENGTH = 200_000;

// ─── Storage ──────────────────────────────────────────────────────────────────

async function getAllScripts() {
  const data = await chrome.storage.local.get('scripts');
  return data.scripts || [];
}

async function saveAllScripts(scripts) {
  await chrome.storage.local.set({ scripts });
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function normalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return rawUrl;
  }
}

function groupByUrl(scripts) {
  const map = new Map();
  for (const s of scripts) {
    const key = normalizeUrl(s.url);
    if (!map.has(key)) map.set(key, { url: s.url, scripts: [] });
    map.get(key).scripts.push(s);
  }
  return [...map.values()];
}

function validate(name, url, code) {
  if (!name.trim()) return 'El nombre es obligatorio.';
  if (name.trim().length > MAX_NAME_LENGTH) return `Nombre máximo ${MAX_NAME_LENGTH} caracteres.`;
  if (!url.trim()) return 'La URL es obligatoria.';
  if (url.trim().length > MAX_URL_LENGTH) return `URL máximo ${MAX_URL_LENGTH} caracteres.`;
  try {
    const p = new URL(url.trim());
    if (!['http:', 'https:'].includes(p.protocol)) return 'La URL debe comenzar con http:// o https://';
  } catch { return 'La URL no tiene un formato válido.'; }
  if (!code.trim()) return 'El código no puede estar vacío.';
  if (code.length > MAX_CODE_LENGTH) return 'El código supera el tamaño máximo permitido.';
  return null;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function updateStats(scripts) {
  document.getElementById('stat-total').textContent  = scripts.length;
  document.getElementById('stat-active').textContent = scripts.filter(s => s.enabled).length;
  document.getElementById('stat-urls').textContent   = new Set(scripts.map(s => normalizeUrl(s.url))).size;
}

// ─── Datalist de URLs ─────────────────────────────────────────────────────────

function refreshUrlDatalist(scripts) {
  const dl = document.getElementById('url-suggestions');
  while (dl.firstChild) dl.removeChild(dl.firstChild);
  const unique = [...new Set(scripts.map(s => normalizeUrl(s.url)))];
  unique.forEach(url => {
    const opt = document.createElement('option');
    opt.value = url;
    dl.appendChild(opt);
  });
}

// ─── Números de línea ─────────────────────────────────────────────────────────

function updateLineNumbers(textarea, linesEl) {
  const count = textarea.value.split('\n').length;
  const current = linesEl.childElementCount;
  if (count > current) {
    const frag = document.createDocumentFragment();
    for (let i = current + 1; i <= count; i++) {
      const span = document.createElement('span');
      span.textContent = i;
      frag.appendChild(span);
    }
    linesEl.appendChild(frag);
  } else {
    while (linesEl.childElementCount > count) linesEl.removeChild(linesEl.lastChild);
  }
  linesEl.scrollTop = textarea.scrollTop;
}

// ─── Renderizado del listado ──────────────────────────────────────────────────

function createScriptRow(script, onToggle, onEdit, onDelete) {
  const row = document.createElement('div');
  row.className = `script-row ${script.enabled ? 'script-row--on' : 'script-row--off'}`;
  row.dataset.id = script.id;

  // Toggle
  const label = document.createElement('label');
  label.className = 'toggle';
  label.title = script.enabled ? 'Desactivar' : 'Activar';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = script.enabled;
  input.addEventListener('change', () => onToggle(script.id, input.checked));
  const slider = document.createElement('span');
  slider.className = 'toggle__slider';
  label.appendChild(input);
  label.appendChild(slider);

  // Info
  const info = document.createElement('div');
  info.className = 'script-row__info';
  const name = document.createElement('span');
  name.className = 'script-row__name';
  name.textContent = script.name;
  const meta = document.createElement('span');
  meta.className = 'script-row__meta';
  const parts = [];
  if (script.delay > 0) parts.push(`⏱ ${script.delay}s`);
  parts.push(script.enabled ? '● Activo' : '○ Inactivo');
  meta.textContent = parts.join('  ');
  info.appendChild(name);
  info.appendChild(meta);

  // Acciones
  const actions = document.createElement('div');
  actions.className = 'script-row__actions';
  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn--icon';
  editBtn.title = 'Editar';
  editBtn.textContent = '✏️';
  editBtn.addEventListener('click', () => onEdit(script));
  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn--icon btn--danger';
  delBtn.title = 'Eliminar';
  delBtn.textContent = '🗑️';
  delBtn.addEventListener('click', () => onDelete(script.id, script.name));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  row.appendChild(label);
  row.appendChild(info);
  row.appendChild(actions);
  return row;
}

function createUrlGroup(group, allCollapsed, onToggle, onEdit, onDelete) {
  const wrapper = document.createElement('div');
  wrapper.className = 'url-group';
  wrapper.dataset.url = group.url;

  // Cabecera del acordeón
  const header = document.createElement('button');
  header.className = 'url-group__header';
  header.setAttribute('aria-expanded', 'true');

  const urlText = document.createElement('span');
  urlText.className = 'url-group__url';
  urlText.textContent = group.url;

  const badge = document.createElement('span');
  badge.className = 'url-group__badge';
  badge.textContent = group.scripts.length;

  const chevron = document.createElement('span');
  chevron.className = 'url-group__chevron';
  chevron.textContent = '▾';
  chevron.setAttribute('aria-hidden', 'true');

  header.appendChild(chevron);
  header.appendChild(urlText);
  header.appendChild(badge);

  // Contenido colapsable
  const body = document.createElement('div');
  body.className = 'url-group__body';

  group.scripts.forEach(s => {
    body.appendChild(createScriptRow(s, onToggle, onEdit, onDelete));
  });

  // Toggle acordeón
  header.addEventListener('click', () => {
    const expanded = header.getAttribute('aria-expanded') === 'true';
    header.setAttribute('aria-expanded', String(!expanded));
    chevron.textContent = !expanded ? '▾' : '▸';
    body.style.display = !expanded ? '' : 'none';
  });

  wrapper.appendChild(header);
  wrapper.appendChild(body);
  return wrapper;
}

async function renderList(filter = '') {
  const container   = document.getElementById('groups-container');
  const emptyAll    = document.getElementById('empty-all');
  const emptySearch = document.getElementById('empty-search');

  const allScripts = await getAllScripts();
  updateStats(allScripts);
  refreshUrlDatalist(allScripts);

  // Limpiar
  while (container.firstChild) container.removeChild(container.firstChild);
  emptyAll.hidden = true;
  emptySearch.hidden = true;

  if (allScripts.length === 0) {
    emptyAll.hidden = false;
    return;
  }

  // Filtrar
  const q = filter.toLowerCase();
  const filtered = q
    ? allScripts.filter(s =>
        s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q)
      )
    : allScripts;

  if (filtered.length === 0) {
    emptySearch.hidden = false;
    return;
  }

  const groups = groupByUrl(filtered);

  groups.forEach(group => {
    container.appendChild(
      createUrlGroup(group, false, handleToggle, handleEditInline, handleDelete)
    );
  });
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleToggle(id, enabled) {
  const scripts = await getAllScripts();
  const idx = scripts.findIndex(s => s.id === id);
  if (idx === -1) return;
  scripts[idx].enabled = enabled;
  scripts[idx].updatedAt = Date.now();
  await saveAllScripts(scripts);
  updateStats(scripts);
  // Actualizar visualmente la fila sin re-renderizar todo
  const row = document.querySelector(`.script-row[data-id="${CSS.escape(id)}"]`);
  if (row) {
    row.classList.toggle('script-row--on', enabled);
    row.classList.toggle('script-row--off', !enabled);
    const meta = row.querySelector('.script-row__meta');
    if (meta) {
      const delay = scripts[idx].delay;
      const parts = [];
      if (delay > 0) parts.push(`⏱ ${delay}s`);
      parts.push(enabled ? '● Activo' : '○ Inactivo');
      meta.textContent = parts.join('  ');
    }
  }
}

let editingId = null;

function handleEditInline(script) {
  editingId = script.id;
  document.getElementById('panel-editor-title').textContent = 'Editar Script';
  document.getElementById('pe-name').value  = script.name;
  document.getElementById('pe-url').value   = script.url;
  document.getElementById('pe-delay').value = script.delay || 0;
  document.getElementById('pe-code').value  = script.code;
  updateLineNumbers(
    document.getElementById('pe-code'),
    document.getElementById('pe-line-numbers')
  );
  showView('new');
}

async function handleDelete(id, name) {
  if (!confirm(`¿Eliminar el script "${name}"?`)) return;
  const scripts = await getAllScripts();
  await saveAllScripts(scripts.filter(s => s.id !== id));
  await renderList(document.getElementById('search-input').value);
}

async function handleSave() {
  const name  = document.getElementById('pe-name').value.trim();
  const url   = document.getElementById('pe-url').value.trim();
  const delay = Math.max(0, Math.min(60, parseInt(document.getElementById('pe-delay').value, 10) || 0));
  const code  = document.getElementById('pe-code').value;
  const errEl = document.getElementById('pe-error');

  const error = validate(name, url, code);
  if (error) {
    errEl.textContent = error;
    errEl.hidden = false;
    return;
  }
  errEl.hidden = true;

  const saveBtn = document.getElementById('btn-save-panel');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando…';

  try {
    const scripts = await getAllScripts();
    if (editingId) {
      const idx = scripts.findIndex(s => s.id === editingId);
      if (idx !== -1) {
        scripts[idx] = { ...scripts[idx], name, url, delay, code, updatedAt: Date.now() };
      }
    } else {
      scripts.push({
        id: crypto.randomUUID(), name, url, delay, code,
        enabled: true, createdAt: Date.now(), updatedAt: Date.now(),
      });
    }
    await saveAllScripts(scripts);
    resetForm();
    showView('scripts');
    await renderList();
  } catch {
    errEl.textContent = 'No se pudo guardar. Inténtalo de nuevo.';
    errEl.hidden = false;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Guardar';
  }
}

function resetForm() {
  editingId = null;
  document.getElementById('panel-editor-title').textContent = 'Nuevo Script';
  ['pe-name', 'pe-url', 'pe-code'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pe-delay').value = 0;
  document.getElementById('pe-error').hidden = true;
  updateLineNumbers(
    document.getElementById('pe-code'),
    document.getElementById('pe-line-numbers')
  );
}

// ─── Navegación entre vistas ──────────────────────────────────────────────────

function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => {
    const isActive = v.id === `view-${viewId}`;
    v.classList.toggle('view--active', isActive);
    // Resetear scroll al mostrar la vista
    if (isActive) v.scrollTop = 0;
  });
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('nav-item--active', btn.dataset.view === viewId);
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await renderList();

  // Navegación sidebar
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view === 'new') {
        resetForm();
      }
      showView(btn.dataset.view);
    });
  });

  // Botones nuevo script
  document.getElementById('btn-new-from-list').addEventListener('click', () => {
    resetForm();
    showView('new');
  });
  document.getElementById('btn-new-empty-all').addEventListener('click', () => {
    resetForm();
    showView('new');
  });

  // Volver desde editor
  document.getElementById('btn-back-new').addEventListener('click', () => {
    resetForm();
    showView('scripts');
  });

  // Guardar
  document.getElementById('btn-save-panel').addEventListener('click', handleSave);

  // Búsqueda con debounce
  let searchTimer;
  document.getElementById('search-input').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderList(e.target.value), 250);
  });

  // Editor: números de línea y Tab
  const codeEl  = document.getElementById('pe-code');
  const linesEl = document.getElementById('pe-line-numbers');
  codeEl.addEventListener('input', () => updateLineNumbers(codeEl, linesEl));
  codeEl.addEventListener('scroll', () => { linesEl.scrollTop = codeEl.scrollTop; });
  codeEl.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = codeEl.selectionStart;
      codeEl.value = codeEl.value.substring(0, s) + '  ' + codeEl.value.substring(codeEl.selectionEnd);
      codeEl.selectionStart = codeEl.selectionEnd = s + 2;
      updateLineNumbers(codeEl, linesEl);
    }
  });

  // URL params: abrir editor con URL pre-rellenada o en modo edición
  const params  = new URLSearchParams(window.location.search);
  const preUrl  = params.get('newUrl');
  const editId  = params.get('editId');

  if (editId) {
    const scripts = await getAllScripts();
    const script  = scripts.find(s => s.id === editId);
    if (script) handleEditInline(script);
  } else if (preUrl) {
    resetForm();
    document.getElementById('pe-url').value = preUrl;
    showView('new');
  }
});
