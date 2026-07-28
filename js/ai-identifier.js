/* ========================================================
   AI Mineral Identifier Module
   Flow: examples -> pay fee -> admin approves payment ->
   upload images/video -> generate report.

   NOTE: This MVP ships a deterministic, rule-based visual
   heuristic (color/texture keyword matching entered by the
   user description) to produce a preliminary report client-
   side, since no external AI vision API key is configured.
   Swap `runAnalysis()` for a real model/API call when ready.
   ======================================================== */

const AI_FEE_ETB = 150;
// PAYMENT_METHODS is defined in utils.js and shared across payment.js / ai-identifier.js

const MINERAL_PROFILES = [
  { name: "Gold (Native)", keywords: ["yellow", "metallic", "shiny", "heavy", "gold"], notes: "Dense, malleable, resistant to tarnish. Often found with quartz veining." },
  { name: "Opal", keywords: ["colorful", "play of color", "translucent", "milky", "opal"], notes: "Amorphous silica mineraloid; value driven by color play and clarity." },
  { name: "Tantalite / Columbite (Coltan)", keywords: ["black", "dark", "dense", "metallic", "coltan", "tantalum"], notes: "Dark, dense ore mineral; commonly associated with pegmatite deposits." },
  { name: "Emerald / Beryl", keywords: ["green", "crystal", "transparent", "hexagonal", "emerald"], notes: "Beryl family; green color from chromium/vanadium traces." },
  { name: "Quartz / Rock Crystal", keywords: ["clear", "white", "crystal", "glassy", "quartz"], notes: "Very common silicate mineral; hexagonal crystal habit." },
  { name: "Sapphire / Corundum", keywords: ["blue", "hard", "crystal", "sapphire"], notes: "Corundum family; extreme hardness (9 on Mohs scale)." },
  { name: "Tourmaline", keywords: ["multicolor", "green", "pink", "crystal", "tourmaline"], notes: "Complex borosilicate; wide color range, often zoned." },
  { name: "Unidentified Rock/Mineral Sample", keywords: [], notes: "Insufficient distinguishing features detected from description for a confident preliminary match." },
];

const aiModule = {
  currentRequest: null,
  images: [],
  video: null,

  async init() {
    await utils.requireAuth(`login.html?redirect=${encodeURIComponent(window.location.href)}`);
    await authModule.init();
    await this.checkExistingRequest();
    this.bindPayForm();
    this.bindUploadForm();
  },

  async checkExistingRequest() {
    try {
      const q = fb.query(
        fb.collection(fb.db, "ai_requests"),
        fb.where("userId", "==", authModule.currentUser.uid)
      );
      const snap = await fb.getDocs(q);
      if (snap.empty) {
        this.showStage("intro");
        return;
      }
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      this.currentRequest = docs[0];

      switch (this.currentRequest.status) {
        case "pending_payment_review":
          this.showStage("pending");
          break;
        case "awaiting_upload":
          this.showStage("upload");
          break;
        case "completed":
          this.showStage("report");
          this.renderReport(this.currentRequest.aiReport);
          break;
        case "rejected":
          this.showStage("intro");
          break;
        default:
          this.showStage("intro");
      }
    } catch (err) {
      console.error("checkExistingRequest error", err);
      this.showStage("intro");
    }
  },

  showStage(stage) {
    ["intro", "pending", "upload", "report"].forEach((s) => {
      const el = document.getElementById(`ai-stage-${s}`);
      if (el) el.classList.toggle("hidden", s !== stage);
    });
  },

  bindPayForm() {
    const form = document.getElementById("ai-pay-form");
    if (!form) return;

    const methodsContainer = document.getElementById("ai-payment-methods");
    if (methodsContainer) {
      methodsContainer.innerHTML = PAYMENT_METHODS.map((m) => `
        <button type="button" data-method="${m.id}"
          class="ai-payment-method-btn card p-4 flex flex-col items-center gap-2 border-2 border-[var(--border-subtle)]"
          onclick="aiModule.selectMethod('${m.id}')">
          <span class="text-2xl">${m.icon}</span>
          <span class="text-sm font-semibold">${m.label}</span>
        </button>
      `).join("");
    }

    const receiptBtn = document.getElementById("ai-upload-receipt-btn");
    if (receiptBtn) {
      receiptBtn.addEventListener("click", () => {
        cloudinary_helpers.openWidget({
          resourceType: "image",
          maxFiles: 1,
          onSuccess: (urls) => {
            this.receiptUrl = urls[0];
            const preview = document.getElementById("ai-receipt-preview");
            if (preview) preview.innerHTML = `<img src="${urls[0]}" class="w-32 h-32 object-cover rounded-lg border border-[var(--border-subtle)]" />`;
          },
          onError: () => utils.toast(i18n.t("upload_error"), "error"),
        });
      });
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const txnInput = document.getElementById("ai-transaction-id");
      const submitBtn = document.getElementById("ai-submit-payment-btn");

      let valid = true;
      if (!this.selectedMethod) {
        utils.toast(i18n.t("choose_payment_method"), "error");
        valid = false;
      }
      if (!txnInput.value.trim()) {
        utils.showFieldError(txnInput, i18n.t("required_field"));
        valid = false;
      } else {
        utils.clearFieldError(txnInput);
      }
      if (!this.receiptUrl) {
        utils.toast(i18n.t("upload_receipt"), "error");
        valid = false;
      }
      if (!valid) return;

      utils.setLoading(submitBtn, true, i18n.t("submitting"));
      try {
        const ref = await fb.addDoc(fb.collection(fb.db, "ai_requests"), {
          userId: authModule.currentUser.uid,
          userName: authModule.currentUserData.name,
          userEmail: authModule.currentUserData.email,
          paymentMethod: this.selectedMethod,
          transactionId: txnInput.value.trim(),
          receiptUrl: this.receiptUrl,
          fee: AI_FEE_ETB,
          status: "pending_payment_review",
          createdAt: fb.serverTimestamp(),
        });
        this.currentRequest = { id: ref.id, status: "pending_payment_review" };
        utils.toast(i18n.t("success_payment_submitted"), "success");
        this.showStage("pending");
      } catch (err) {
        console.error("ai payment submit error", err);
        utils.toast(i18n.t("generic_error"), "error");
      } finally {
        utils.setLoading(submitBtn, false);
      }
    });
  },

  selectMethod(id) {
    this.selectedMethod = id;
    document.querySelectorAll(".ai-payment-method-btn").forEach((btn) => {
      if (btn.dataset.method === id) {
        btn.style.borderColor = "var(--gold)";
        btn.style.background = "rgba(212,175,55,0.08)";
      } else {
        btn.style.borderColor = "var(--border-subtle)";
        btn.style.background = "";
      }
    });
  },

  bindUploadForm() {
    const imgBtn = document.getElementById("ai-upload-images-btn");
    if (imgBtn) {
      imgBtn.addEventListener("click", () => {
        if (this.images.length >= 6) {
          utils.toast(i18n.t("max_images_error"), "error");
          return;
        }
        cloudinary_helpers.openWidget({
          resourceType: "image",
          maxFiles: 6 - this.images.length,
          onSuccess: (urls) => {
            urls.forEach((u) => { if (this.images.length < 6) this.images.push(u); });
            this.renderImagePreviews();
          },
          onError: () => utils.toast(i18n.t("upload_error"), "error"),
        });
      });
    }

    const vidBtn = document.getElementById("ai-upload-video-btn");
    if (vidBtn) {
      vidBtn.addEventListener("click", () => {
        cloudinary_helpers.openWidget({
          resourceType: "video",
          maxFiles: 1,
          onSuccess: (urls) => {
            this.video = urls[0];
            const preview = document.getElementById("ai-video-preview");
            if (preview) preview.innerHTML = `<video src="${urls[0]}" class="w-48 rounded-lg border border-[var(--border-subtle)]" controls></video>`;
          },
          onError: () => utils.toast(i18n.t("upload_error"), "error"),
        });
      });
    }

    const form = document.getElementById("ai-upload-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const notesInput = document.getElementById("ai-observation-notes");
        const submitBtn = document.getElementById("ai-submit-analysis-btn");

        if (this.images.length === 0) {
          utils.toast(i18n.t("select_at_least_one_image"), "error");
          return;
        }

        utils.setLoading(submitBtn, true, i18n.t("identifying"));
        try {
          const report = this.runAnalysis(notesInput.value.trim());
          await fb.updateDoc(fb.doc(fb.db, "ai_requests", this.currentRequest.id), {
            images: this.images,
            video: this.video,
            observationNotes: notesInput.value.trim(),
            aiReport: report,
            status: "completed",
            completedAt: fb.serverTimestamp(),
          });
          // small delay to simulate processing
          await new Promise((r) => setTimeout(r, 900));
          this.showStage("report");
          this.renderReport(report);
          utils.toast("Analysis complete!", "success");
        } catch (err) {
          console.error("ai analysis error", err);
          utils.toast(i18n.t("generic_error"), "error");
        } finally {
          utils.setLoading(submitBtn, false);
        }
      });
    }
  },

  renderImagePreviews() {
    const container = document.getElementById("ai-image-previews");
    if (!container) return;
    container.innerHTML = this.images.map((url, idx) => `
      <div class="relative">
        <img src="${url}" class="w-full h-24 object-cover rounded-lg border border-[var(--border-subtle)]" />
        <button type="button" onclick="aiModule.removeImage(${idx})"
          class="absolute -top-2 -right-2 bg-[var(--danger)] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">✕</button>
      </div>
    `).join("");
  },

  removeImage(idx) {
    this.images.splice(idx, 1);
    this.renderImagePreviews();
  },

  runAnalysis(notesText) {
    const text = notesText.toLowerCase();
    let best = MINERAL_PROFILES[MINERAL_PROFILES.length - 1];
    let bestScore = 0;

    MINERAL_PROFILES.forEach((profile) => {
      const score = profile.keywords.filter((k) => text.includes(k)).length;
      if (score > bestScore) {
        bestScore = score;
        best = profile;
      }
    });

    const confidence = bestScore === 0 ? 32 : Math.min(90, 45 + bestScore * 15);

    return {
      possibleMineral: best.name,
      confidence,
      notes: best.notes,
      generatedAt: new Date().toISOString(),
    };
  },

  renderReport(report) {
    if (!report) return;
    const container = document.getElementById("ai-report-content");
    if (!container) return;
    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between bg-[var(--bg-secondary)] rounded-lg px-4 py-3">
          <span class="text-sm text-[var(--text-secondary)]">${i18n.t("possible_mineral")}</span>
          <span class="font-heading font-bold text-[var(--gold-light)]">${utils.escapeHtml(report.possibleMineral)}</span>
        </div>
        <div class="bg-[var(--bg-secondary)] rounded-lg px-4 py-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-[var(--text-secondary)]">${i18n.t("confidence")}</span>
            <span class="font-bold text-[var(--emerald-light)]">${report.confidence}%</span>
          </div>
          <div class="w-full h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-[var(--emerald-dark)] to-[var(--emerald-light)]" style="width:${report.confidence}%"></div>
          </div>
        </div>
        <div class="bg-[var(--bg-secondary)] rounded-lg px-4 py-3">
          <span class="text-sm text-[var(--text-secondary)] block mb-1">${i18n.t("notes")}</span>
          <p class="text-sm">${utils.escapeHtml(report.notes)}</p>
        </div>
        <div class="bg-[rgba(245,158,11,0.08)] border border-[var(--warning)] rounded-lg px-4 py-3">
          <span class="text-xs font-bold text-[var(--warning)] block mb-1">⚠️ ${i18n.t("disclaimer")}</span>
          <p class="text-xs text-[var(--text-secondary)]">${i18n.t("ai_disclaimer_text")}</p>
        </div>
      </div>
    `;
  },
};

window.aiModule = aiModule;
window.addEventListener("firebaseReady", () => aiModule.init());
