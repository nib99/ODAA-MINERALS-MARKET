/* ========================================================
   i18n Engine
   Applies translations to any element with data-i18n,
   data-i18n-placeholder, or data-i18n-title attributes.
   Persists chosen language in localStorage.
   ======================================================== */

const I18N_STORAGE_KEY = "mindeb_lang";

const i18n = {
  current: "en",

  init() {
    const saved = localStorage.getItem(I18N_STORAGE_KEY);
    const browserLang = (navigator.language || "en").slice(0, 2);
    const supported = window.LANGUAGES.map((l) => l.code);
    this.current = saved && supported.includes(saved)
      ? saved
      : (supported.includes(browserLang) ? browserLang : "en");
    this.apply();
    this.renderSwitcher();
  },

  t(key) {
    const dict = window.TRANSLATIONS[this.current] || window.TRANSLATIONS.en;
    return dict[key] || window.TRANSLATIONS.en[key] || key;
  },

  setLanguage(code) {
    if (!window.TRANSLATIONS[code]) return;
    this.current = code;
    localStorage.setItem(I18N_STORAGE_KEY, code);
    this.apply();
    this.renderSwitcher();
    document.dispatchEvent(new CustomEvent("languageChanged", { detail: { lang: code } }));
  },

  apply() {
    const meta = window.LANGUAGES.find((l) => l.code === this.current) || window.LANGUAGES[0];
    document.documentElement.lang = this.current;
    document.documentElement.dir = meta.dir;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = this.t(key);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      el.setAttribute("placeholder", this.t(key));
    });

    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      el.setAttribute("title", this.t(key));
    });
  },

  renderSwitcher() {
    const container = document.getElementById("lang-switcher-menu");
    const currentLabel = document.getElementById("lang-switcher-current");
    if (currentLabel) {
      const meta = window.LANGUAGES.find((l) => l.code === this.current);
      currentLabel.textContent = meta ? meta.code.toUpperCase() : "EN";
    }
    if (!container) return;
    container.innerHTML = window.LANGUAGES.map((l) => `
      <button
        class="w-full text-left px-4 py-2 text-sm rounded-md hover:bg-[var(--bg-elevated)] transition-colors flex items-center justify-between ${l.code === this.current ? "text-[var(--gold-light)] font-semibold" : "text-[var(--text-secondary)]"}"
        onclick="i18n.setLanguage('${l.code}'); document.getElementById('lang-switcher-menu').classList.add('hidden');"
        type="button"
      >
        <span>${l.label}</span>
        ${l.code === this.current ? '<span>&#10003;</span>' : ""}
      </button>
    `).join("");
  },
};

window.i18n = i18n;
document.addEventListener("DOMContentLoaded", () => i18n.init());
