/* ========================================================
   Shared Utilities: toasts, validation, formatting, helpers
   ======================================================== */

const PAYMENT_METHODS = [
  { id: "telebirr", label: "Telebirr", icon: "💚" },
  { id: "ebirr", label: "Ebirr", icon: "💙" },
  { id: "bank", label: "Bank Transfer", icon: "🏦" },
  { id: "mpesa", label: "M-Pesa", icon: "💰" },
  { id: "kaaf", label: "Kaafi", icon: "💳" },
];
window.PAYMENT_METHODS = PAYMENT_METHODS;

const utils = {
  toast(message, type = "info", duration = 4000) {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.3s ease";
      setTimeout(() => el.remove(), 300);
    }, duration);
  },

  setLoading(btn, isLoading, loadingText) {
    if (!btn) return;
    if (isLoading) {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span><span>${loadingText || ""}</span>`;
    } else {
      btn.disabled = false;
      if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
    }
  },

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  showFieldError(inputEl, message) {
    this.clearFieldError(inputEl);
    inputEl.classList.add("invalid");
    const err = document.createElement("p");
    err.className = "field-error";
    err.setAttribute("data-error-for", inputEl.id);
    err.textContent = message;
    inputEl.insertAdjacentElement("afterend", err);
  },

  clearFieldError(inputEl) {
    inputEl.classList.remove("invalid");
    const existing = inputEl.parentElement.querySelector(`[data-error-for="${inputEl.id}"]`);
    if (existing) existing.remove();
  },

  formatDate(timestamp) {
    if (!timestamp) return "-";
    const dateObj = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return dateObj.toLocaleDateString(i18n.current, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  },

  formatPrice(value) {
    if (value === undefined || value === null || value === "") return null;
    const num = Number(value);
    if (isNaN(num)) return value;
    return `${num.toLocaleString()} ETB`;
  },

  escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  },

  truncate(str, n) {
    if (!str) return "";
    return str.length > n ? str.slice(0, n).trim() + "…" : str;
  },

  getInitials(name) {
    if (!name) return "?";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join("");
  },

  qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  requireAuth(redirectTo = "login.html") {
    return new Promise((resolve) => {
      window.addEventListener("firebaseReady", () => {
        fb.onAuthStateChanged(fb.auth, (user) => {
          if (!user) {
            window.location.href = redirectTo;
          } else {
            resolve(user);
          }
        });
      }, { once: true });
    });
  },

  skeletonCard() {
    return `
      <div class="card overflow-hidden">
        <div class="skeleton w-full" style="aspect-ratio:4/3;"></div>
        <div class="p-4 space-y-3">
          <div class="skeleton h-4 w-3/4"></div>
          <div class="skeleton h-3 w-full"></div>
          <div class="skeleton h-3 w-5/6"></div>
          <div class="skeleton h-9 w-full mt-2"></div>
        </div>
      </div>
    `;
  },
};

window.utils = utils;
