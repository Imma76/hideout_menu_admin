let categories = [];
let items = [];

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ---------- Helpers ----------
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function showMsg(id, text, isError = true) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.style.color = isError ? 'var(--danger)' : 'var(--accent)';
}

// ---------- Categories ----------
const categoryForm = document.getElementById('category-form');
const categoryIdField = document.getElementById('category-id');
const categoryNameField = document.getElementById('category-name');
const categorySectionField = document.getElementById('category-section');
const categorySortField = document.getElementById('category-sort');
const categorySubmitBtn = document.getElementById('category-submit');
const categoryCancelBtn = document.getElementById('category-cancel');

function formatPrice(price) {
  return `₦${Number(price).toLocaleString('en-NG')}`;
}

async function loadCategories() {
  categories = await api('/categories');
  renderCategories();
  renderItemCategoryOptions();
}

function renderCategories() {
  const tbody = document.getElementById('category-list');
  tbody.innerHTML = '';
  if (categories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">No categories yet.</td></tr>';
    return;
  }
  categories.forEach((cat) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(cat.name)}</td>
      <td>${cat.section === 'drinks' ? 'Drinks' : 'Food'}</td>
      <td>${cat.sortOrder ?? 0}</td>
      <td>
        <button class="link-btn" data-action="edit-category" data-id="${cat._id}">Edit</button>
        <button class="link-btn danger" data-action="delete-category" data-id="${cat._id}">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

categoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = categoryIdField.value;
  const payload = {
    name: categoryNameField.value.trim(),
    section: categorySectionField.value,
    sortOrder: Number(categorySortField.value) || 0,
  };
  try {
    if (id) {
      await api(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      showMsg('category-msg', 'Category updated.', false);
    } else {
      await api('/categories', { method: 'POST', body: JSON.stringify(payload) });
      showMsg('category-msg', 'Category added.', false);
    }
    resetCategoryForm();
    await loadCategories();
  } catch (err) {
    showMsg('category-msg', err.message);
  }
});

categoryCancelBtn.addEventListener('click', resetCategoryForm);

function resetCategoryForm() {
  categoryIdField.value = '';
  categoryForm.reset();
  categorySectionField.value = 'food';
  categorySortField.value = 0;
  categorySubmitBtn.textContent = 'Add Category';
  categoryCancelBtn.hidden = true;
}

document.getElementById('category-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === 'edit-category') {
    const cat = categories.find((c) => c._id === id);
    categoryIdField.value = cat._id;
    categoryNameField.value = cat.name;
    categorySectionField.value = cat.section ?? 'food';
    categorySortField.value = cat.sortOrder ?? 0;
    categorySubmitBtn.textContent = 'Save Category';
    categoryCancelBtn.hidden = false;
  } else if (btn.dataset.action === 'delete-category') {
    if (!confirm('Delete this category? Menu items in it will remain but lose their category.')) return;
    try {
      await api(`/categories/${id}`, { method: 'DELETE' });
      await loadCategories();
      await loadItems();
    } catch (err) {
      showMsg('category-msg', err.message);
    }
  }
});

// ---------- Menu Items ----------
const itemForm = document.getElementById('item-form');
const itemIdField = document.getElementById('item-id');
const itemNameField = document.getElementById('item-name');
const itemDescField = document.getElementById('item-description');
const itemPriceField = document.getElementById('item-price');
const itemCategoryField = document.getElementById('item-category');
const itemAvailableField = document.getElementById('item-available');
const itemSubmitBtn = document.getElementById('item-submit');
const itemCancelBtn = document.getElementById('item-cancel');

function renderItemCategoryOptions() {
  const groups = [
    { section: 'food', label: 'Food' },
    { section: 'drinks', label: 'Drinks' },
  ];
  itemCategoryField.innerHTML = groups
    .map(({ section, label }) => {
      const options = categories
        .filter((cat) => cat.section === section)
        .map((cat) => `<option value="${cat._id}">${escapeHtml(cat.name)}</option>`)
        .join('');
      return options ? `<optgroup label="${label}">${options}</optgroup>` : '';
    })
    .join('');
}

async function loadItems() {
  items = await api('/menu-items');
  renderItems();
}

function renderItems() {
  const tbody = document.getElementById('item-list');
  tbody.innerHTML = '';
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">No menu items yet.</td></tr>';
    return;
  }
  items.forEach((item) => {
    const tr = document.createElement('tr');
    if (!item.available) tr.classList.add('unavailable-row');
    const categoryName = item.category ? escapeHtml(item.category.name) : '—';
    tr.innerHTML = `
      <td>${escapeHtml(item.name)}</td>
      <td>${categoryName}</td>
      <td>${formatPrice(item.price)}</td>
      <td>${item.available ? 'Yes' : 'No'}</td>
      <td>
        <button class="link-btn" data-action="edit-item" data-id="${item._id}">Edit</button>
        <button class="link-btn danger" data-action="delete-item" data-id="${item._id}">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

itemForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = itemIdField.value;
  const payload = {
    name: itemNameField.value.trim(),
    description: itemDescField.value.trim(),
    price: Number(itemPriceField.value),
    category: itemCategoryField.value,
    available: itemAvailableField.checked,
  };
  try {
    if (id) {
      await api(`/menu-items/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      showMsg('item-msg', 'Item updated.', false);
    } else {
      await api('/menu-items', { method: 'POST', body: JSON.stringify(payload) });
      showMsg('item-msg', 'Item added.', false);
    }
    resetItemForm();
    await loadItems();
  } catch (err) {
    showMsg('item-msg', err.message);
  }
});

itemCancelBtn.addEventListener('click', resetItemForm);

function resetItemForm() {
  itemIdField.value = '';
  itemForm.reset();
  itemAvailableField.checked = true;
  itemSubmitBtn.textContent = 'Add Item';
  itemCancelBtn.hidden = true;
}

document.getElementById('item-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === 'edit-item') {
    const item = items.find((i) => i._id === id);
    itemIdField.value = item._id;
    itemNameField.value = item.name;
    itemDescField.value = item.description || '';
    itemPriceField.value = item.price;
    itemCategoryField.value = item.category ? item.category._id : '';
    itemAvailableField.checked = item.available;
    itemSubmitBtn.textContent = 'Save Item';
    itemCancelBtn.hidden = false;
  } else if (btn.dataset.action === 'delete-item') {
    if (!confirm('Delete this menu item?')) return;
    try {
      await api(`/menu-items/${id}`, { method: 'DELETE' });
      await loadItems();
    } catch (err) {
      showMsg('item-msg', err.message);
    }
  }
});

// ---------- QR Code ----------
const qrForm = document.getElementById('qr-form');
const qrUrlField = document.getElementById('qr-url');
const qrOutput = document.getElementById('qr-output');

qrUrlField.value = FRONTEND_URL;

function generateRawQrCanvas(url, size) {
  return new Promise((resolve) => {
    const hiddenHost = document.createElement('div');
    hiddenHost.style.position = 'fixed';
    hiddenHost.style.left = '-9999px';
    document.body.appendChild(hiddenHost);

    new QRCode(hiddenHost, {
      text: url,
      width: size,
      height: size,
      correctLevel: QRCode.CorrectLevel.M,
    });

    // qrcodejs renders synchronously via <canvas> in modern browsers, but
    // give it a tick in case it falls back to the <img> table renderer.
    setTimeout(() => {
      const canvas = hiddenHost.querySelector('canvas');
      if (canvas) {
        resolve(canvas);
        document.body.removeChild(hiddenHost);
        return;
      }
      const img = hiddenHost.querySelector('img');
      const fallback = document.createElement('canvas');
      fallback.width = size;
      fallback.height = size;
      fallback.getContext('2d').drawImage(img, 0, 0, size, size);
      resolve(fallback);
      document.body.removeChild(hiddenHost);
    }, 50);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

async function buildShareableQrCard(url) {
  const CARD_W = 1200;
  const CARD_H = 1360;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#16130f';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Outer gold border
  ctx.strokeStyle = '#d8a24a';
  ctx.lineWidth = 6;
  roundedRect(ctx, 20, 20, CARD_W - 40, CARD_H - 40, 24);
  ctx.stroke();

  // Logo
  const [logo, qrCanvas] = await Promise.all([
    loadImage('assets/logo.png'),
    generateRawQrCanvas(url, 900),
  ]);

  const logoMaxWidth = CARD_W - 200;
  const logoScale = Math.min(1, logoMaxWidth / logo.width);
  const logoW = logo.width * logoScale;
  const logoH = logo.height * logoScale;
  const logoX = (CARD_W - logoW) / 2;
  const logoY = 100;
  ctx.drawImage(logo, logoX, logoY, logoW, logoH);

  // Caption
  ctx.fillStyle = '#d8a24a';
  ctx.textAlign = 'center';
  ctx.font = 'bold 42px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillText('SCAN TO VIEW OUR MENU', CARD_W / 2, logoY + logoH + 80);

  // White panel behind QR for scan contrast
  const qrSize = 760;
  const qrX = (CARD_W - qrSize) / 2;
  const qrY = logoY + logoH + 190;
  const panelPadding = 40;
  ctx.fillStyle = '#ffffff';
  roundedRect(
    ctx,
    qrX - panelPadding,
    qrY - panelPadding,
    qrSize + panelPadding * 2,
    qrSize + panelPadding * 2,
    20,
  );
  ctx.fill();

  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  return canvas;
}

async function renderQr(url) {
  qrOutput.innerHTML = '<p class="hint">Generating…</p>';

  try {
    const card = await buildShareableQrCard(url);
    qrOutput.innerHTML = '';

    const preview = document.createElement('img');
    preview.className = 'qr-card-preview';
    preview.src = card.toDataURL('image/png');
    qrOutput.appendChild(preview);

    const link = document.createElement('a');
    link.textContent = 'Download PNG';
    link.download = 'hideout-menu-qr-card.png';
    link.href = preview.src;
    qrOutput.appendChild(link);

    const urlText = document.createElement('div');
    urlText.className = 'hint';
    urlText.textContent = `Links to: ${url}`;
    qrOutput.appendChild(urlText);
  } catch (err) {
    console.error(err);
    qrOutput.innerHTML = '<p class="hint">Could not generate QR code.</p>';
  }
}

qrForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const url = qrUrlField.value.trim();
  if (url) renderQr(url);
});

renderQr(qrUrlField.value);

// ---------- Utils ----------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------- Init ----------
(async function init() {
  try {
    await loadCategories();
    await loadItems();
  } catch (err) {
    showMsg('category-msg', `Could not reach backend: ${err.message}`);
  }
})();
