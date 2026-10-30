let categories = [];
let items = [];

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-panel")
      .forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ---------- Auth ----------
const AUTH_STORAGE_KEY = "hideout-admin-auth";

// Which menu sections this dashboard shows: the logged-in account's sections
// (empty = all), narrowed to the club when opened at /club/admin.
const ALL_SECTIONS = ["food", "drinks", "ciga", "club"];
const CLUB_ONLY_URL = location.pathname.startsWith("/club/admin");
let visibleSections = ALL_SECTIONS;

function applyScope(accountSections) {
  visibleSections = accountSections && accountSections.length ? accountSections : ALL_SECTIONS;
  if (CLUB_ONLY_URL) visibleSections = visibleSections.filter((s) => s === "club");
  const clubOnly = visibleSections.length === 1 && visibleSections[0] === "club";
  document.title = clubOnly ? "Hideout — Club Admin" : "Hideout — Admin Dashboard";
  document.querySelector(".site-header .logo").src = clubOnly ? "assets/club-logo.webp" : "assets/logo.webp";
  document.querySelector(".tagline").textContent = clubOnly
    ? "Club admin — manage club drinks, food and categories"
    : "Admin — manage categories and menu items";
  [...categorySectionField.options].forEach((o) => {
    o.hidden = o.disabled = !visibleSections.includes(o.value);
  });
  categorySectionField.hidden = visibleSections.length === 1;
}

const inScope = (section) => visibleSections.includes(section ?? "food");

function getAuthHeader() {
  return sessionStorage.getItem(AUTH_STORAGE_KEY);
}

function setAuthHeader(value) {
  sessionStorage.setItem(AUTH_STORAGE_KEY, value);
}

function clearAuthHeader() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

function buildBasicAuthHeader(username, password) {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

// ---------- Login ----------
const loginRoot = document.getElementById("login-root");
const adminRoot = document.getElementById("admin-root");
const loginForm = document.getElementById("login-form");
const loginUsernameField = document.getElementById("login-username");
const loginPasswordField = document.getElementById("login-password");
const logoutBtn = document.getElementById("logout-btn");
const loginSubmitBtn = document.getElementById("login-submit");

function showLogin(message = "") {
  document.getElementById("loading-text").hidden = true;
  loginRoot.hidden = false;
  adminRoot.hidden = true;
  logoutBtn.hidden = true;
  showMsg("login-msg", message, Boolean(message));
  loginPasswordField.value = "";
}

function showAdminDashboard() {
  document.getElementById("loading-text").hidden = true;
  loginRoot.hidden = true;
  adminRoot.hidden = false;
  logoutBtn.hidden = false;
}

// Returns the account ({ username, sections }) or null.
async function checkCredentials(authHeader) {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/check`, {
      headers: { Authorization: authHeader },
    });
    return res.ok ? await res.json() : null;
  } catch (err) {
    return null;
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = loginUsernameField.value.trim();
  const password = loginPasswordField.value;
  const authHeader = buildBasicAuthHeader(username, password);

  showMsg("login-msg", "");
  loginSubmitBtn.disabled = true;
  loginSubmitBtn.textContent = "Logging in…";

  try {
    const account = await checkCredentials(authHeader);
    if (account) {
      setAuthHeader(authHeader);
      applyScope(account.sections);
      showAdminDashboard();
      await initDashboard();
    } else {
      showMsg("login-msg", "Invalid username or password.");
    }
  } finally {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = "Log in";
  }
});

logoutBtn.addEventListener("click", () => {
  clearAuthHeader();
  loginForm.reset();
  showLogin();
});

// ---------- Helpers ----------
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  const authHeader = getAuthHeader();
  if (authHeader) headers.Authorization = authHeader;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    ...options,
  });

  if (res.status === 401) {
    clearAuthHeader();
    showLogin("Session expired. Please log in again.");
    throw new Error("Not authenticated");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;
    throw new Error(message || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function showMsg(id, text, isError = true) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.style.color = isError ? "var(--danger)" : "var(--accent)";
}

let toastTimeoutId = null;

function showToast(text, isError = false) {
  const toast = document.getElementById("toast");
  clearTimeout(toastTimeoutId);
  toast.textContent = text;
  toast.classList.toggle("toast-error", isError);
  toast.classList.add("visible");
  toast.hidden = false;
  toastTimeoutId = setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => {
      toast.hidden = true;
    }, 250);
  }, 2500);
}

// ---------- Modal helper ----------
function setupModalBackdropClose(dialog) {
  dialog.addEventListener("click", (e) => {
    const rect = dialog.getBoundingClientRect();
    const clickedInside =
      rect.top <= e.clientY &&
      e.clientY <= rect.bottom &&
      rect.left <= e.clientX &&
      e.clientX <= rect.right;
    if (!clickedInside) dialog.close();
  });
}

function isInsideRect(dialog, e) {
  const rect = dialog.getBoundingClientRect();
  return (
    rect.top <= e.clientY &&
    e.clientY <= rect.bottom &&
    rect.left <= e.clientX &&
    e.clientX <= rect.right
  );
}

// ---------- Confirm dialog ----------
const confirmDialog = document.getElementById("confirm-dialog");
const confirmMessage = document.getElementById("confirm-message");
const confirmOkBtn = document.getElementById("confirm-ok");
const confirmCancelBtn = document.getElementById("confirm-cancel");

function confirmAction(message) {
  return new Promise((resolve) => {
    confirmMessage.textContent = message;

    function finish(result) {
      confirmOkBtn.removeEventListener("click", onOk);
      confirmCancelBtn.removeEventListener("click", onCancel);
      confirmDialog.removeEventListener("cancel", onCancelDialog);
      confirmDialog.removeEventListener("click", onBackdropClick);
      confirmDialog.close();
      resolve(result);
    }
    function onOk() {
      finish(true);
    }
    function onCancel() {
      finish(false);
    }
    function onCancelDialog() {
      finish(false);
    }
    function onBackdropClick(e) {
      if (!isInsideRect(confirmDialog, e)) finish(false);
    }

    confirmOkBtn.addEventListener("click", onOk);
    confirmCancelBtn.addEventListener("click", onCancel);
    confirmDialog.addEventListener("cancel", onCancelDialog);
    confirmDialog.addEventListener("click", onBackdropClick);
    confirmDialog.showModal();
  });
}

// ---------- Categories ----------
const categoryForm = document.getElementById("category-form");
const categoryIdField = document.getElementById("category-id");
const categoryNameField = document.getElementById("category-name");
const categorySectionField = document.getElementById("category-section");
const categorySortField = document.getElementById("category-sort");
const categorySubmitBtn = document.getElementById("category-submit");
const categoryCancelBtn = document.getElementById("category-cancel");
const categoryDialog = document.getElementById("category-dialog");
const categoryDialogTitle = document.getElementById("category-dialog-title");
const categoryAddBtn = document.getElementById("category-add-btn");
setupModalBackdropClose(categoryDialog);

categoryAddBtn.addEventListener("click", () => {
  resetCategoryForm();
  categoryDialogTitle.textContent = "Add Category";
  categoryDialog.showModal();
  categoryDialog.focus();
});

function formatPrice(price) {
  return `₦${Number(price).toLocaleString("en-NG")}`;
}

let categorySearchQuery = "";

async function loadCategories() {
  categories = (await api("/categories")).filter((cat) => inScope(cat.section));
  renderCategories();
  renderItemCategoryOptions();
}

function renderCategories() {
  const tbody = document.getElementById("category-list");
  tbody.innerHTML = "";
  if (categories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3">No categories yet.</td></tr>';
    return;
  }
  const query = categorySearchQuery.trim().toLowerCase();
  const filtered = query
    ? categories.filter((cat) => {
        return (
          cat.name.toLowerCase().includes(query) ||
          (cat.section ?? "food").includes(query)
        );
      })
    : categories;
  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="3">No categories match your search.</td></tr>';
    return;
  }
  filtered.forEach((cat) => {
    const tr = document.createElement("tr");
    const sectionLabel = cat.section
      ? cat.section.charAt(0).toUpperCase() + cat.section.slice(1)
      : "Food";
    tr.innerHTML = `
      <td class="cell-primary">${escapeHtml(cat.name)}</td>
      <td class="cell-meta">${sectionLabel} · Sort ${cat.sortOrder ?? 0}</td>
      <td class="cell-actions">
        <button class="link-btn" data-action="edit-category" data-id="${cat._id}">Edit</button>
        <button class="link-btn danger" data-action="delete-category" data-id="${cat._id}">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

categoryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = categoryIdField.value;
  const payload = {
    name: categoryNameField.value.trim(),
    section: categorySectionField.value,
    sortOrder: Number(categorySortField.value) || 0,
  };
  try {
    if (id) {
      await api(`/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      showToast("Category updated.");
    } else {
      await api("/categories", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      showToast("Category added.");
    }
    categoryDialog.close();
    resetCategoryForm();
    await loadCategories();
  } catch (err) {
    showMsg("category-msg", err.message);
  }
});

categoryCancelBtn.addEventListener("click", () => {
  categoryDialog.close();
  resetCategoryForm();
});

document.getElementById("category-search").addEventListener("input", (e) => {
  categorySearchQuery = e.target.value;
  renderCategories();
});

function resetCategoryForm() {
  categoryIdField.value = "";
  categoryForm.reset();
  categorySectionField.value = visibleSections[0];
  categorySortField.value = 0;
  categorySubmitBtn.textContent = "Add Category";
  showMsg("category-msg", "");
}

document
  .getElementById("category-list")
  .addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === "edit-category") {
      const cat = categories.find((c) => c._id === id);
      categoryIdField.value = cat._id;
      categoryNameField.value = cat.name;
      categorySectionField.value = cat.section ?? "food";
      categorySortField.value = cat.sortOrder ?? 0;
      categorySubmitBtn.textContent = "Save Category";
      categoryDialogTitle.textContent = "Edit Category";
      categoryDialog.showModal();
      categoryDialog.focus();
    } else if (btn.dataset.action === "delete-category") {
      const ok = await confirmAction(
        "Delete this category? Menu items in it will remain but lose their category.",
      );
      if (!ok) return;
      try {
        await api(`/categories/${id}`, { method: "DELETE" });
        showToast("Category deleted.");
        await loadCategories();
        await loadItems();
      } catch (err) {
        showToast(err.message, true);
      }
    }
  });

// ---------- Menu Items ----------
const itemForm = document.getElementById("item-form");
const itemIdField = document.getElementById("item-id");
const itemNameField = document.getElementById("item-name");
const itemDescField = document.getElementById("item-description");
const itemPriceField = document.getElementById("item-price");
const itemCategoryField = document.getElementById("item-category");
const itemAvailableField = document.getElementById("item-available");
const itemSubmitBtn = document.getElementById("item-submit");
const itemCancelBtn = document.getElementById("item-cancel");
const itemDialog = document.getElementById("item-dialog");
const itemDialogTitle = document.getElementById("item-dialog-title");
const itemAddBtn = document.getElementById("item-add-btn");
const itemFeaturedField = document.getElementById("item-featured");
const itemImageUrlField = document.getElementById("item-image-url");
const itemPhotoInput = document.getElementById("item-photo");
const itemPhotoPreview = document.getElementById("item-photo-preview");
const itemPhotoRemove = document.getElementById("item-photo-remove");
const itemPhotoStatus = document.getElementById("item-photo-status");
const PHOTO_HINT = "PNG with a transparent background looks best.";
setupModalBackdropClose(itemDialog);
function setItemPhoto(url) {
  itemImageUrlField.value = url || "";
  itemPhotoPreview.innerHTML = url
    ? `<img src="${escapeHtml(url)}" alt="" />`
    : "No photo";
  itemPhotoRemove.hidden = !url;
}

itemPhotoInput.addEventListener("change", async () => {
  const file = itemPhotoInput.files[0];
  if (!file) return;
  const body = new FormData();
  body.append("file", file);
  itemPhotoStatus.textContent = "Uploading…";
  itemSubmitBtn.disabled = true;
  try {
    const res = await fetch(`${API_BASE_URL}/uploads/image`, {
      method: "POST",
      headers: { Authorization: getAuthHeader() },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Upload failed (${res.status})`);
    setItemPhoto(data.url);
    itemPhotoStatus.textContent = "Photo uploaded. Save the item to keep it.";
  } catch (err) {
    itemPhotoStatus.textContent = err.message;
  } finally {
    itemSubmitBtn.disabled = false;
    itemPhotoInput.value = "";
  }
});

itemPhotoRemove.addEventListener("click", () => {
  setItemPhoto("");
  itemPhotoStatus.textContent = "Photo removed. Save the item to keep this change.";
});

itemAddBtn.addEventListener("click", () => {
  resetItemForm();
  itemDialogTitle.textContent = "Add Item";
  itemDialog.showModal();
  itemDialog.focus();
});

function renderItemCategoryOptions() {
  const groups = [
    { section: "food", label: "Food" },
    { section: "drinks", label: "Drinks" },
    { section: "ciga", label: "Ciga" },
    { section: "club", label: "Club" },
  ].filter(({ section }) => inScope(section));
  itemCategoryField.innerHTML = groups
    .map(({ section, label }) => {
      const options = categories
        .filter((cat) => cat.section === section)
        .map(
          (cat) =>
            `<option value="${cat._id}">${escapeHtml(cat.name)}</option>`,
        )
        .join("");
      return options ? `<optgroup label="${label}">${options}</optgroup>` : "";
    })
    .join("");
}

let itemSearchQuery = "";

async function loadItems() {
  // Items whose category was deleted only show to admins who see every section.
  items = (await api("/menu-items")).filter((item) =>
    item.category ? inScope(item.category.section) : visibleSections === ALL_SECTIONS,
  );
  renderItems();
}

function renderItems() {
  const tbody = document.getElementById("item-list");
  tbody.innerHTML = "";
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3">No menu items yet.</td></tr>';
    return;
  }
  const query = itemSearchQuery.trim().toLowerCase();
  const filtered = query
    ? items.filter((item) => {
        const categoryName = item.category
          ? item.category.name.toLowerCase()
          : "";
        const description = (item.description || "").toLowerCase();
        return (
          item.name.toLowerCase().includes(query) ||
          categoryName.includes(query) ||
          description.includes(query)
        );
      })
    : items;
  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="3">No items match your search.</td></tr>';
    return;
  }
  filtered.forEach((item) => {
    const tr = document.createElement("tr");
    if (!item.available) tr.classList.add("unavailable-row");
    const categoryName = item.category ? escapeHtml(item.category.name) : "—";
    const availability = item.available ? "Available" : "Unavailable";
    const thumb = item.imageUrl
      ? `<img class="item-thumb" src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy" />`
      : "";
    const featured = item.featured ? ' · <span class="badge">Featured</span>' : "";
    tr.innerHTML = `
      <td class="cell-primary">${thumb}${escapeHtml(item.name)}</td>
      <td class="cell-meta">${categoryName} · ${formatPrice(item.price)} · ${availability}${featured}</td>
      <td class="cell-actions">
        <button class="link-btn" data-action="edit-item" data-id="${item._id}">Edit</button>
        <button class="link-btn danger" data-action="delete-item" data-id="${item._id}">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

itemForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = itemIdField.value;
  const payload = {
    name: itemNameField.value.trim(),
    description: itemDescField.value.trim(),
    price: Number(itemPriceField.value),
    category: itemCategoryField.value,
    available: itemAvailableField.checked,
    featured: itemFeaturedField.checked,
    imageUrl: itemImageUrlField.value,
  };
  try {
    if (id) {
      await api(`/menu-items/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      showToast("Item updated.");
    } else {
      await api("/menu-items", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      showToast("Item added.");
    }
    itemDialog.close();
    resetItemForm();
    await loadItems();
  } catch (err) {
    showMsg("item-msg", err.message);
  }
});

itemCancelBtn.addEventListener("click", () => {
  itemDialog.close();
  resetItemForm();
});

document.getElementById("item-search").addEventListener("input", (e) => {
  itemSearchQuery = e.target.value;
  renderItems();
});

function resetItemForm() {
  itemIdField.value = "";
  itemForm.reset();
  itemAvailableField.checked = true;
  itemFeaturedField.checked = false;
  setItemPhoto("");
  itemPhotoStatus.textContent = PHOTO_HINT;
  itemSubmitBtn.textContent = "Add Item";
  showMsg("item-msg", "");
}

document.getElementById("item-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === "edit-item") {
    const item = items.find((i) => i._id === id);
    itemIdField.value = item._id;
    itemNameField.value = item.name;
    itemDescField.value = item.description || "";
    itemPriceField.value = item.price;
    itemCategoryField.value = item.category ? item.category._id : "";
    itemAvailableField.checked = item.available;
    itemFeaturedField.checked = !!item.featured;
    setItemPhoto(item.imageUrl);
    itemPhotoStatus.textContent = PHOTO_HINT;
    itemSubmitBtn.textContent = "Save Item";
    itemDialogTitle.textContent = "Edit Item";
    itemDialog.showModal();
    itemDialog.focus();
  } else if (btn.dataset.action === "delete-item") {
    const ok = await confirmAction("Delete this menu item?");
    if (!ok) return;
    try {
      await api(`/menu-items/${id}`, { method: "DELETE" });
      showToast("Item deleted.");
      await loadItems();
    } catch (err) {
      showToast(err.message, true);
    }
  }
});

// ---------- QR Code ----------
// Temporarily disabled along with the tab button, panel, and qrcodejs script
// tag in index.html. Uncomment all four to re-enable.
/*
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
    loadImage('assets/logo.webp'),
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
*/

// ---------- Utils ----------
function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

// ---------- Init ----------
async function initDashboard() {
  try {
    await loadCategories();
    await loadItems();
  } catch (err) {
    showMsg("category-msg", `Could not reach backend: ${err.message}`);
  }
}

(async function bootstrap() {
  const stored = getAuthHeader();
  const account = stored ? await checkCredentials(stored) : null;
  if (account) {
    applyScope(account.sections);
    showAdminDashboard();
    await initDashboard();
    return;
  }
  clearAuthHeader();
  showLogin();
})();
