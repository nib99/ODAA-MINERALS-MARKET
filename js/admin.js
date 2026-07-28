/* ========================================================
   Admin Dashboard Module
   Pending payments review, user management, listing
   management, AI identification request review.
   ======================================================== */

const adminModule = {
  activeTab: "payments",

  async init() {
    await utils.requireAuth("login.html");
    await authModule.init();

    if (!authModule.currentUserData || authModule.currentUserData.role !== "admin") {
      utils.toast("Admin access only.", "error");
      window.location.href = "index.html";
      return;
    }

    this.bindTabs();
    await this.loadStats();
    await this.loadPendingPayments();
  },

  bindTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
    const panel = document.getElementById(`panel-${tab}`);
    if (panel) panel.classList.remove("hidden");

    if (tab === "payments") this.loadPendingPayments();
    if (tab === "listings") this.loadAllListings();
    if (tab === "users") this.loadAllUsers();
    if (tab === "ai") this.loadAIRequests();
  },

  async loadStats() {
    try {
      const [listingsSnap, usersSnap, unlocksSnap] = await Promise.all([
        fb.getDocs(fb.collection(fb.db, "listings")),
        fb.getDocs(fb.collection(fb.db, "users")),
        fb.getDocs(fb.query(fb.collection(fb.db, "unlocks"), fb.where("status", "==", "pending"))),
      ]);
      this.setStat("stat-listings", listingsSnap.size);
      this.setStat("stat-users", usersSnap.size);
      this.setStat("stat-pending", unlocksSnap.size);
    } catch (err) {
      console.error("loadStats error", err);
    }
  },

  setStat(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  },

  async loadPendingPayments() {
    const container = document.getElementById("payments-list");
    if (!container) return;
    container.innerHTML = `<div class="flex justify-center py-10"><div class="spinner"></div></div>`;

    try {
      const q = fb.query(fb.collection(fb.db, "unlocks"), fb.where("status", "==", "pending"));
      const snap = await fb.getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      if (items.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="text-4xl mb-2">📭</div><p>${i18n.t("no_pending_payments")}</p></div>`;
        return;
      }

      container.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-[var(--text-secondary)] border-b divider">
                <th class="py-3 pr-4">${i18n.t("buyer")}</th>
                <th class="py-3 pr-4">Mineral</th>
                <th class="py-3 pr-4">${i18n.t("method")}</th>
                <th class="py-3 pr-4">${i18n.t("transaction_id")}</th>
                <th class="py-3 pr-4">${i18n.t("receipt_image")}</th>
                <th class="py-3 pr-4">${i18n.t("date")}</th>
                <th class="py-3 pr-4">${i18n.t("action")}</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item) => `
                <tr class="border-b divider">
                  <td class="py-3 pr-4">${utils.escapeHtml(item.buyerName || item.buyerEmail || "-")}</td>
                  <td class="py-3 pr-4">${utils.escapeHtml(item.mineralName || "-")}</td>
                  <td class="py-3 pr-4">${utils.escapeHtml(item.paymentMethod || "-")}</td>
                  <td class="py-3 pr-4">${utils.escapeHtml(item.transactionId || "-")}</td>
                  <td class="py-3 pr-4">
                    <a href="${item.receiptUrl}" target="_blank" rel="noopener" class="text-[var(--gold-light)] underline">${i18n.t("view_receipt")}</a>
                  </td>
                  <td class="py-3 pr-4 text-[var(--text-muted)]">${utils.formatDate(item.createdAt)}</td>
                  <td class="py-3 pr-4 flex gap-2">
                    <button class="btn btn-emerald !py-1.5 !px-3 text-xs" onclick="adminModule.reviewUnlock('${item.id}', 'approved')">${i18n.t("approve")}</button>
                    <button class="btn btn-danger !py-1.5 !px-3 text-xs" onclick="adminModule.reviewUnlock('${item.id}', 'rejected')">${i18n.t("reject")}</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      console.error("loadPendingPayments error", err);
      container.innerHTML = `<div class="empty-state">${i18n.t("generic_error")}</div>`;
    }
  },

  async reviewUnlock(id, decision) {
    try {
      await fb.updateDoc(fb.doc(fb.db, "unlocks", id), {
        status: decision,
        reviewedAt: fb.serverTimestamp(),
        reviewedBy: authModule.currentUser.uid,
      });
      utils.toast(decision === "approved" ? i18n.t("success_approved") : i18n.t("success_rejected"), "success");
      this.loadPendingPayments();
      this.loadStats();
    } catch (err) {
      console.error("reviewUnlock error", err);
      utils.toast(i18n.t("generic_error"), "error");
    }
  },

  async loadAllListings() {
    const container = document.getElementById("listings-admin-list");
    if (!container) return;
    container.innerHTML = `<div class="flex justify-center py-10"><div class="spinner"></div></div>`;
    try {
      const q = fb.query(fb.collection(fb.db, "listings"), fb.orderBy("createdAt", "desc"));
      const snap = await fb.getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (items.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="text-4xl mb-2">📭</div><p>${i18n.t("no_listings")}</p></div>`;
        return;
      }

      container.innerHTML = items.map((l) => `
        <div class="card p-4 flex items-center gap-4">
          <img src="${(l.images && l.images[0]) || 'https://placehold.co/100x100/1b1f28/6b7280?text=Mineral'}" class="w-16 h-16 object-cover rounded-lg" />
          <div class="flex-1 min-w-0">
            <h4 class="font-semibold truncate">${utils.escapeHtml(l.mineralName || "-")}</h4>
            <p class="text-xs text-[var(--text-secondary)] truncate">${utils.escapeHtml(l.sellerName || "-")} · ${utils.formatDate(l.createdAt)}</p>
          </div>
          <span class="badge ${l.status === 'active' ? 'badge-unlocked' : 'badge-locked'}">${utils.escapeHtml(l.status || "active")}</span>
          <button class="btn btn-outline !py-1.5 !px-3 text-xs" onclick="adminModule.deleteListing('${l.id}')">${i18n.t("delete")}</button>
        </div>
      `).join("");
    } catch (err) {
      console.error("loadAllListings error", err);
      container.innerHTML = `<div class="empty-state">${i18n.t("generic_error")}</div>`;
    }
  },

  async deleteListing(id) {
    if (!confirm("Delete this listing permanently?")) return;
    try {
      await fb.updateDoc(fb.doc(fb.db, "listings", id), { status: "removed" });
      utils.toast(i18n.t("success_approved"), "success");
      this.loadAllListings();
      this.loadStats();
    } catch (err) {
      console.error("deleteListing error", err);
      utils.toast(i18n.t("generic_error"), "error");
    }
  },

  async loadAllUsers() {
    const container = document.getElementById("users-admin-list");
    if (!container) return;
    container.innerHTML = `<div class="flex justify-center py-10"><div class="spinner"></div></div>`;
    try {
      const snap = await fb.getDocs(fb.collection(fb.db, "users"));
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      container.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-[var(--text-secondary)] border-b divider">
                <th class="py-3 pr-4">${i18n.t("full_name")}</th>
                <th class="py-3 pr-4">${i18n.t("email")}</th>
                <th class="py-3 pr-4">${i18n.t("role")}</th>
                <th class="py-3 pr-4">Status</th>
                <th class="py-3 pr-4">${i18n.t("action")}</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((u) => `
                <tr class="border-b divider">
                  <td class="py-3 pr-4">${utils.escapeHtml(u.name || "-")}</td>
                  <td class="py-3 pr-4">${utils.escapeHtml(u.email || "-")}</td>
                  <td class="py-3 pr-4"><span class="badge badge-gold">${utils.escapeHtml(u.role || "buyer")}</span></td>
                  <td class="py-3 pr-4"><span class="badge ${u.status === 'suspended' ? 'badge-locked' : 'badge-unlocked'}">${utils.escapeHtml(u.status || "active")}</span></td>
                  <td class="py-3 pr-4">
                    ${u.role !== 'admin' ? `<button class="btn ${u.status === 'suspended' ? 'btn-emerald' : 'btn-danger'} !py-1.5 !px-3 text-xs"
                      onclick="adminModule.toggleUserStatus('${u.id}', '${u.status === 'suspended' ? 'active' : 'suspended'}')">
                      ${u.status === 'suspended' ? i18n.t("activate") : i18n.t("suspend")}
                    </button>` : ""}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      console.error("loadAllUsers error", err);
      container.innerHTML = `<div class="empty-state">${i18n.t("generic_error")}</div>`;
    }
  },

  async toggleUserStatus(uid, newStatus) {
    try {
      await fb.updateDoc(fb.doc(fb.db, "users", uid), { status: newStatus });
      utils.toast(i18n.t("success_approved"), "success");
      this.loadAllUsers();
    } catch (err) {
      console.error("toggleUserStatus error", err);
      utils.toast(i18n.t("generic_error"), "error");
    }
  },

  async loadAIRequests() {
    const container = document.getElementById("ai-admin-list");
    if (!container) return;
    container.innerHTML = `<div class="flex justify-center py-10"><div class="spinner"></div></div>`;
    try {
      const q = fb.query(fb.collection(fb.db, "ai_requests"), fb.where("status", "==", "pending_payment_review"));
      const snap = await fb.getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (items.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="text-4xl mb-2">🤖</div><p>${i18n.t("no_pending_ai")}</p></div>`;
        return;
      }

      container.innerHTML = items.map((r) => `
        <div class="card p-4 flex items-center gap-4 flex-wrap">
          <div class="flex-1 min-w-[150px]">
            <h4 class="font-semibold">${utils.escapeHtml(r.userName || r.userEmail || "-")}</h4>
            <p class="text-xs text-[var(--text-secondary)]">${utils.escapeHtml(r.paymentMethod || "-")} · ${utils.escapeHtml(r.transactionId || "-")}</p>
          </div>
          <a href="${r.receiptUrl}" target="_blank" rel="noopener" class="text-[var(--gold-light)] underline text-sm">${i18n.t("view_receipt")}</a>
          <div class="flex gap-2">
            <button class="btn btn-emerald !py-1.5 !px-3 text-xs" onclick="adminModule.reviewAIRequest('${r.id}', 'approved')">${i18n.t("approve")}</button>
            <button class="btn btn-danger !py-1.5 !px-3 text-xs" onclick="adminModule.reviewAIRequest('${r.id}', 'rejected')">${i18n.t("reject")}</button>
          </div>
        </div>
      `).join("");
    } catch (err) {
      console.error("loadAIRequests error", err);
      container.innerHTML = `<div class="empty-state">${i18n.t("generic_error")}</div>`;
    }
  },

  async reviewAIRequest(id, decision) {
    try {
      await fb.updateDoc(fb.doc(fb.db, "ai_requests", id), {
        status: decision === "approved" ? "awaiting_upload" : "rejected",
        reviewedAt: fb.serverTimestamp(),
        reviewedBy: authModule.currentUser.uid,
      });
      utils.toast(decision === "approved" ? i18n.t("success_approved") : i18n.t("success_rejected"), "success");
      this.loadAIRequests();
    } catch (err) {
      console.error("reviewAIRequest error", err);
      utils.toast(i18n.t("generic_error"), "error");
    }
  },
};

window.adminModule = adminModule;
window.addEventListener("firebaseReady", () => adminModule.init());
