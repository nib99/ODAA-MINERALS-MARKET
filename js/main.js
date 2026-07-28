/* ========================================================
   Main Dashboard Logic
   Loads listings, renders cards, handles search & unlock CTA
   ======================================================== */

const dashboard = {
  allListings: [],
  unlockedListingIds: new Set(),

  async init() {
    await authModule.waitForFirebase();
    this.bindSearch();
    await this.loadListings();
    document.addEventListener("authReady", async (e) => {
      if (e.detail.user) {
        await this.loadUnlockedListings(e.detail.user.uid);
        this.renderListings(this.filterListings(document.getElementById("search-input")?.value || ""));
      }
    });
  },

  bindSearch() {
    const input = document.getElementById("search-input");
    if (!input) return;
    let debounceTimer;
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.renderListings(this.filterListings(input.value));
      }, 200);
    });
  },

  filterListings(term) {
    const t = (term || "").trim().toLowerCase();
    if (!t) return this.allListings;
    return this.allListings.filter((l) =>
      (l.mineralName || "").toLowerCase().includes(t) ||
      (l.description || "").toLowerCase().includes(t)
    );
  },

  async loadListings() {
    const grid = document.getElementById("listings-grid");
    if (!grid) return;
    grid.innerHTML = Array(6).fill(utils.skeletonCard()).join("");

    try {
      const q = fb.query(
        fb.collection(fb.db, "listings"),
        fb.where("status", "!=", "removed"),
        fb.orderBy("status"),
        fb.orderBy("createdAt", "desc"),
        fb.limit(48)
      );
      const snap = await fb.getDocs(q);
      this.allListings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error("loadListings error, falling back to simple query", err);
      try {
        const q2 = fb.query(fb.collection(fb.db, "listings"), fb.orderBy("createdAt", "desc"), fb.limit(48));
        const snap2 = await fb.getDocs(q2);
        this.allListings = snap2.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((l) => l.status !== "removed");
      } catch (err2) {
        console.error("loadListings fallback failed", err2);
        this.allListings = [];
      }
    }
    this.renderListings(this.allListings);
  },

  async loadUnlockedListings(uid) {
    try {
      const q = fb.query(
        fb.collection(fb.db, "unlocks"),
        fb.where("buyerId", "==", uid),
        fb.where("status", "==", "approved")
      );
      const snap = await fb.getDocs(q);
      this.unlockedListingIds = new Set(snap.docs.map((d) => d.data().listingId));
    } catch (err) {
      console.error("loadUnlockedListings error", err);
    }
  },

  renderListings(list) {
    const grid = document.getElementById("listings-grid");
    const emptyState = document.getElementById("listings-empty");
    if (!grid) return;

    if (!list || list.length === 0) {
      grid.innerHTML = "";
      if (emptyState) emptyState.classList.remove("hidden");
      return;
    }
    if (emptyState) emptyState.classList.add("hidden");

    grid.innerHTML = list.map((l) => this.cardTemplate(l)).join("");
  },

  cardTemplate(l) {
    const isUnlocked = this.unlockedListingIds.has(l.id);
    const img = (l.images && l.images[0]) || "https://placehold.co/600x450/1b1f28/6b7280?text=Mineral";
    const priceStr = utils.formatPrice(l.price);
    const qtyStr = l.quantity ? utils.escapeHtml(String(l.quantity)) : null;

    return `
      <div class="card card-hover overflow-hidden flex flex-col">
        <div class="relative">
          <img src="${img}" alt="${utils.escapeHtml(l.mineralName || "Mineral")}" class="mineral-img w-full" loading="lazy" />
          <span class="badge ${isUnlocked ? "badge-unlocked" : "badge-locked"} absolute top-3 ${document.documentElement.dir === "rtl" ? "left-3" : "right-3"}">
            ${isUnlocked ? "🔓" : "🔒"} <span>${isUnlocked ? i18n.t("seller_unlocked") : i18n.t("seller_locked")}</span>
          </span>
        </div>
        <div class="p-4 flex flex-col flex-1">
          <h3 class="font-heading font-semibold text-lg mb-1 truncate">${utils.escapeHtml(l.mineralName || "Unnamed Mineral")}</h3>
          <p class="text-sm text-[var(--text-secondary)] mb-3 flex-1">${utils.escapeHtml(utils.truncate(l.description || "", 100))}</p>
          <div class="flex items-center gap-3 text-xs text-[var(--text-muted)] mb-3 flex-wrap">
            ${qtyStr ? `<span>📦 ${i18n.t("quantity")}: ${qtyStr}</span>` : ""}
            <span>💰 ${priceStr ? priceStr : i18n.t("negotiable")}</span>
          </div>
          <button
            class="btn ${isUnlocked ? "btn-emerald" : "btn-primary"} w-full"
            onclick="dashboard.handleUnlockClick('${l.id}')"
          >
            ${isUnlocked ? "📞 " + i18n.t("contact_seller") : "🔒 " + i18n.t("unlock_seller_contact")}
          </button>
        </div>
      </div>
    `;
  },

  async handleUnlockClick(listingId) {
    if (!authModule.currentUser) {
      utils.toast(i18n.t("required_field"), "error");
      window.location.href = `login.html?redirect=index.html`;
      return;
    }
    const listing = this.allListings.find((l) => l.id === listingId);
    if (!listing) return;

    if (this.unlockedListingIds.has(listingId)) {
      this.showContactModal(listing);
      return;
    }
    window.location.href = `unlock.html?listing=${listingId}`;
  },

  showContactModal(listing) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="card w-full max-w-md p-6">
        <h3 class="font-heading text-xl font-bold mb-1">${utils.escapeHtml(listing.mineralName)}</h3>
        <p class="text-sm text-[var(--text-secondary)] mb-4">${i18n.t("seller_contact_info")}</p>
        <div class="space-y-3">
          <div class="flex items-center justify-between bg-[var(--bg-secondary)] rounded-lg px-4 py-3">
            <span class="text-sm text-[var(--text-secondary)]">📱 ${i18n.t("phone_number")}</span>
            <a href="tel:${listing.sellerPhone || ""}" class="font-semibold text-[var(--gold-light)]">${utils.escapeHtml(listing.sellerPhone || "-")}</a>
          </div>
          <div class="flex items-center justify-between bg-[var(--bg-secondary)] rounded-lg px-4 py-3">
            <span class="text-sm text-[var(--text-secondary)]">💬 WhatsApp</span>
            <a href="https://wa.me/${(listing.sellerWhatsapp || "").replace(/[^0-9]/g, "")}" target="_blank" rel="noopener" class="font-semibold text-[var(--emerald-light)]">${utils.escapeHtml(listing.sellerWhatsapp || "-")}</a>
          </div>
          <div class="flex items-center justify-between bg-[var(--bg-secondary)] rounded-lg px-4 py-3">
            <span class="text-sm text-[var(--text-secondary)]">✈️ Telegram</span>
            <a href="https://t.me/${(listing.sellerTelegram || "").replace("@", "")}" target="_blank" rel="noopener" class="font-semibold text-[var(--gold-light)]">${utils.escapeHtml(listing.sellerTelegram || "-")}</a>
          </div>
        </div>
        <button class="btn btn-outline w-full mt-5" id="close-contact-modal">${i18n.t("close")}</button>
      </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.querySelector("#close-contact-modal").addEventListener("click", () => backdrop.remove());
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  },
};

window.dashboard = dashboard;
window.addEventListener("firebaseReady", () => dashboard.init());
