/* ========================================================
   Seller Upload Module
   Mineral name/description, optional qty & price,
   multiple images + video (<=65s) via Cloudinary,
   publish to Firestore.
   ======================================================== */

const uploadModule = {
  images: [],
  video: null,
  MAX_IMAGES: 6,
  MAX_VIDEO_SECONDS: 65,

  async init() {
    const user = await utils.requireAuth("login.html");
    await authModule.init();

    if (!authModule.currentUserData || authModule.currentUserData.role !== "seller") {
      utils.toast("Only sellers can access this page.", "error");
      window.location.href = "index.html";
      return;
    }

    this.bindImageUpload();
    this.bindVideoUpload();
    this.bindFormSubmit();
    this.prefillContactFields();
  },

  prefillContactFields() {
    const data = authModule.currentUserData;
    const phoneInput = document.getElementById("seller-phone");
    const waInput = document.getElementById("seller-whatsapp");
    const tgInput = document.getElementById("seller-telegram");
    if (phoneInput && data.phone) phoneInput.value = data.phone;
    if (waInput && data.whatsapp) waInput.value = data.whatsapp;
    if (tgInput && data.telegram) tgInput.value = data.telegram;
  },

  bindImageUpload() {
    const btn = document.getElementById("upload-images-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (this.images.length >= this.MAX_IMAGES) {
        utils.toast(i18n.t("max_images_error"), "error");
        return;
      }
      cloudinary_helpers.openWidget({
        resourceType: "image",
        maxFiles: this.MAX_IMAGES - this.images.length,
        onSuccess: (urls) => {
          urls.forEach((u) => {
            if (this.images.length < this.MAX_IMAGES) this.images.push(u);
          });
          this.renderImagePreviews();
        },
        onError: () => utils.toast(i18n.t("upload_error"), "error"),
      });
    });
  },

  renderImagePreviews() {
    const container = document.getElementById("image-previews");
    if (!container) return;
    container.innerHTML = this.images.map((url, idx) => `
      <div class="relative group">
        <img src="${url}" class="w-full h-24 object-cover rounded-lg border border-[var(--border-subtle)]" />
        <button type="button" onclick="uploadModule.removeImage(${idx})"
          class="absolute -top-2 -right-2 bg-[var(--danger)] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg">
          ✕
        </button>
      </div>
    `).join("");
    const counter = document.getElementById("image-count");
    if (counter) counter.textContent = `${this.images.length}/${this.MAX_IMAGES}`;
  },

  removeImage(idx) {
    this.images.splice(idx, 1);
    this.renderImagePreviews();
  },

  bindVideoUpload() {
    const btn = document.getElementById("upload-video-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      cloudinary_helpers.openWidget({
        resourceType: "video",
        maxFiles: 1,
        onSuccess: (urls) => {
          if (!urls[0]) return;
          this.validateVideoDuration(urls[0]);
        },
        onError: () => utils.toast(i18n.t("upload_error"), "error"),
      });
    });
  },

  validateVideoDuration(url) {
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = url;
    probe.onloadedmetadata = () => {
      window.URL.revokeObjectURL(probe.src);
      if (probe.duration > this.MAX_VIDEO_SECONDS) {
        utils.toast(i18n.t("video_too_long"), "error");
        this.video = null;
        this.renderVideoPreview();
        return;
      }
      this.video = url;
      this.renderVideoPreview();
    };
    probe.onerror = () => {
      // If duration can't be probed (CORS on <video> metadata), still accept —
      // Cloudinary widget already enforces file type; length is best-effort client check.
      this.video = url;
      this.renderVideoPreview();
    };
  },

  renderVideoPreview() {
    const container = document.getElementById("video-preview");
    if (!container) return;
    if (!this.video) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = `
      <div class="relative inline-block">
        <video src="${this.video}" class="w-48 rounded-lg border border-[var(--border-subtle)]" controls></video>
        <button type="button" onclick="uploadModule.removeVideo()"
          class="absolute -top-2 -right-2 bg-[var(--danger)] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg">
          ✕
        </button>
      </div>
    `;
  },

  removeVideo() {
    this.video = null;
    this.renderVideoPreview();
  },

  validateForm(fields) {
    let valid = true;
    const { nameInput, descInput } = fields;

    if (!nameInput.value.trim()) {
      utils.showFieldError(nameInput, i18n.t("required_field"));
      valid = false;
    } else {
      utils.clearFieldError(nameInput);
    }

    if (!descInput.value.trim()) {
      utils.showFieldError(descInput, i18n.t("required_field"));
      valid = false;
    } else {
      utils.clearFieldError(descInput);
    }

    if (this.images.length === 0) {
      utils.toast(i18n.t("select_at_least_one_image"), "error");
      valid = false;
    }

    return valid;
  },

  bindFormSubmit() {
    const form = document.getElementById("upload-form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById("mineral-name");
      const descInput = document.getElementById("mineral-description");
      const qtyInput = document.getElementById("mineral-quantity");
      const priceInput = document.getElementById("mineral-price");
      const phoneInput = document.getElementById("seller-phone");
      const waInput = document.getElementById("seller-whatsapp");
      const tgInput = document.getElementById("seller-telegram");
      const submitBtn = document.getElementById("publish-btn");

      if (!this.validateForm({ nameInput, descInput })) return;

      utils.setLoading(submitBtn, true, i18n.t("publishing"));

      try {
        const listing = {
          sellerId: authModule.currentUser.uid,
          sellerName: authModule.currentUserData.name,
          sellerPhone: phoneInput.value.trim(),
          sellerWhatsapp: waInput.value.trim(),
          sellerTelegram: tgInput.value.trim(),
          mineralName: nameInput.value.trim(),
          description: descInput.value.trim(),
          quantity: qtyInput.value.trim() || null,
          price: priceInput.value.trim() || null,
          images: this.images,
          video: this.video,
          status: "active",
          createdAt: fb.serverTimestamp(),
        };

        await fb.addDoc(fb.collection(fb.db, "listings"), listing);

        // Persist contact info back to seller profile for next time
        await fb.updateDoc(fb.doc(fb.db, "users", authModule.currentUser.uid), {
          phone: phoneInput.value.trim(),
          whatsapp: waInput.value.trim(),
          telegram: tgInput.value.trim(),
        });

        utils.toast(i18n.t("success_listing_published"), "success");
        setTimeout(() => { window.location.href = "index.html"; }, 1200);
      } catch (err) {
        console.error("publish listing error", err);
        utils.toast(i18n.t("generic_error"), "error");
      } finally {
        utils.setLoading(submitBtn, false);
      }
    });
  },
};

window.uploadModule = uploadModule;
window.addEventListener("firebaseReady", () => uploadModule.init());
