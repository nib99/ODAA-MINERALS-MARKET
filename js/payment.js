/* ========================================================
   Buyer Access / Payment Flow
   Choose payment method, upload receipt + transaction ID,
   save to Firestore for admin review, poll for approval.
   ======================================================== */

const paymentModule = {
  listing: null,
  selectedMethod: null,
  receiptUrl: null,
  existingUnlock: null,

  async init() {
    const user = await utils.requireAuth(`login.html?redirect=${encodeURIComponent(window.location.href)}`);
    await authModule.init();

    const listingId = utils.qs("listing");
    if (!listingId) {
      window.location.href = "index.html";
      return;
    }

    await this.loadListing(listingId);
    await this.checkExistingUnlock(listingId, user.uid);
    this.renderPaymentMethods();
    this.bindReceiptUpload();
    this.bindSubmit();
  },

  async loadListing(listingId) {
    try {
      const snap = await fb.getDoc(fb.doc(fb.db, "listings", listingId));
      if (!snap.exists()) {
        utils.toast(i18n.t("generic_error"), "error");
        window.location.href = "index.html";
        return;
      }
      this.listing = { id: snap.id, ...snap.data() };
      this.renderListingSummary();
    } catch (err) {
      console.error("loadListing error", err);
      utils.toast(i18n.t("generic_error"), "error");
    }
  },

  renderListingSummary() {
    const container = document.getElementById("listing-summary");
    if (!container || !this.listing) return;
    const img = (this.listing.images && this.listing.images[0]) || "https://placehold.co/200x150/1b1f28/6b7280?text=Mineral";
    container.innerHTML = `
      <img src="${img}" class="w-20 h-20 object-cover rounded-lg" />
      <div>
        <h4 class="font-heading font-semibold">${utils.escapeHtml(this.listing.mineralName)}</h4>
        <p class="text-sm text-[var(--text-secondary)]">${utils.escapeHtml(utils.truncate(this.listing.description, 80))}</p>
      </div>
    `;
  },

  async checkExistingUnlock(listingId, uid) {
    try {
      const q = fb.query(
        fb.collection(fb.db, "unlocks"),
        fb.where("listingId", "==", listingId),
        fb.where("buyerId", "==", uid)
      );
      const snap = await fb.getDocs(q);
      if (!snap.empty) {
        // most recent
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        this.existingUnlock = docs[0];
        this.renderExistingStatus();
      }
    } catch (err) {
      console.error("checkExistingUnlock error", err);
    }
  },

  renderExistingStatus() {
    const statusBox = document.getElementById("existing-status");
    const form = document.getElementById("payment-form");
    if (!statusBox || !this.existingUnlock) return;

    if (this.existingUnlock.status === "approved") {
      statusBox.classList.remove("hidden");
      statusBox.innerHTML = `
        <div class="card p-6 text-center">
          <div class="text-4xl mb-3">✅</div>
          <h3 class="font-heading text-xl font-bold text-[var(--emerald-light)] mb-2">${i18n.t("payment_approved")}</h3>
          <button class="btn btn-emerald mt-2" onclick="window.location.href='index.html'">
            ${i18n.t("view_details")}
          </button>
        </div>`;
      if (form) form.classList.add("hidden");
    } else if (this.existingUnlock.status === "pending") {
      statusBox.classList.remove("hidden");
      statusBox.innerHTML = `
        <div class="card p-6 text-center">
          <div class="text-4xl mb-3">⏳</div>
          <h3 class="font-heading text-xl font-bold text-[var(--warning)] mb-2">${i18n.t("payment_pending")}</h3>
          <p class="text-sm text-[var(--text-secondary)]">${i18n.t("payment_pending_sub")}</p>
        </div>`;
      if (form) form.classList.add("hidden");
    } else if (this.existingUnlock.status === "rejected") {
      statusBox.classList.remove("hidden");
      statusBox.innerHTML = `
        <div class="card p-6 text-center mb-4">
          <div class="text-4xl mb-3">❌</div>
          <h3 class="font-heading text-xl font-bold text-[var(--danger-light)] mb-2">${i18n.t("payment_rejected")}</h3>
          <p class="text-sm text-[var(--text-secondary)]">You may submit a new payment below.</p>
        </div>`;
    }
  },

  renderPaymentMethods() {
    const container = document.getElementById("payment-methods");
    if (!container) return;
    container.innerHTML = PAYMENT_METHODS.map((m) => `
      <button type="button" data-method="${m.id}"
        class="payment-method-btn card p-4 flex flex-col items-center gap-2 border-2 border-[var(--border-subtle)] transition-all"
        onclick="paymentModule.selectMethod('${m.id}')">
        <span class="text-2xl">${m.icon}</span>
        <span class="text-sm font-semibold">${m.label}</span>
      </button>
    `).join("");
  },

  selectMethod(id) {
    this.selectedMethod = id;
    document.querySelectorAll(".payment-method-btn").forEach((btn) => {
      if (btn.dataset.method === id) {
        btn.style.borderColor = "var(--gold)";
        btn.style.background = "rgba(212,175,55,0.08)";
      } else {
        btn.style.borderColor = "var(--border-subtle)";
        btn.style.background = "";
      }
    });
  },

  bindReceiptUpload() {
    const btn = document.getElementById("upload-receipt-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      cloudinary_helpers.openWidget({
        resourceType: "image",
        maxFiles: 1,
        onSuccess: (urls) => {
          this.receiptUrl = urls[0];
          const preview = document.getElementById("receipt-preview");
          if (preview) {
            preview.innerHTML = `<img src="${urls[0]}" class="w-32 h-32 object-cover rounded-lg border border-[var(--border-subtle)]" />`;
          }
        },
        onError: () => utils.toast(i18n.t("upload_error"), "error"),
      });
    });
  },

  bindSubmit() {
    const form = document.getElementById("payment-form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const txnInput = document.getElementById("transaction-id");
      const submitBtn = document.getElementById("submit-payment-btn");

      let valid = true;
      if (!this.selectedMethod) {
        utils.toast(i18n.t("required_field") + ": " + i18n.t("choose_payment_method"), "error");
        valid = false;
      }
      if (!txnInput.value.trim()) {
        utils.showFieldError(txnInput, i18n.t("required_field"));
        valid = false;
      } else {
        utils.clearFieldError(txnInput);
      }
      if (!this.receiptUrl) {
        utils.toast(i18n.t("required_field") + ": " + i18n.t("upload_receipt"), "error");
        valid = false;
      }
      if (!valid) return;

      utils.setLoading(submitBtn, true, i18n.t("submitting"));
      try {
        await fb.addDoc(fb.collection(fb.db, "unlocks"), {
          listingId: this.listing.id,
          sellerId: this.listing.sellerId,
          buyerId: authModule.currentUser.uid,
          buyerName: authModule.currentUserData.name,
          buyerEmail: authModule.currentUserData.email,
          mineralName: this.listing.mineralName,
          paymentMethod: this.selectedMethod,
          transactionId: txnInput.value.trim(),
          receiptUrl: this.receiptUrl,
          status: "pending",
          createdAt: fb.serverTimestamp(),
        });
        utils.toast(i18n.t("success_payment_submitted"), "success");
        this.existingUnlock = { status: "pending" };
        this.renderExistingStatus();
        form.reset();
        form.classList.add("hidden");
      } catch (err) {
        console.error("submit payment error", err);
        utils.toast(i18n.t("generic_error"), "error");
      } finally {
        utils.setLoading(submitBtn, false);
      }
    });
  },
};

window.paymentModule = paymentModule;
window.addEventListener("firebaseReady", () => paymentModule.init());
