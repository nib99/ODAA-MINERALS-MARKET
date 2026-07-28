/* ========================================================
   Authentication: Register / Login / Logout / Session state
   Roles: buyer, seller, admin
   ======================================================== */

const authModule = {
  currentUser: null,
  currentUserData: null,

  async waitForFirebase() {
    if (window.fb) return;
    await new Promise((resolve) => window.addEventListener("firebaseReady", resolve, { once: true }));
  },

  async init() {
    await this.waitForFirebase();
    return new Promise((resolve) => {
      fb.onAuthStateChanged(fb.auth, async (user) => {
        this.currentUser = user;
        if (user) {
          try {
            const snap = await fb.getDoc(fb.doc(fb.db, "users", user.uid));
            this.currentUserData = snap.exists() ? snap.data() : null;
          } catch (e) {
            console.error("Failed to load user profile", e);
          }
        } else {
          this.currentUserData = null;
        }
        this.updateNavUI();
        document.dispatchEvent(new CustomEvent("authReady", { detail: { user, data: this.currentUserData } }));
        resolve({ user, data: this.currentUserData });
      });
    });
  },

  updateNavUI() {
    const guestNav = document.getElementById("nav-guest");
    const userNav = document.getElementById("nav-user");
    const adminLink = document.getElementById("nav-admin-link");
    const sellLink = document.getElementById("nav-sell-link");
    const userNameEl = document.getElementById("nav-user-name");
    const userAvatarEl = document.getElementById("nav-user-avatar");

    if (this.currentUser && this.currentUserData) {
      if (guestNav) guestNav.classList.add("hidden");
      if (userNav) userNav.classList.remove("hidden");
      if (userNameEl) userNameEl.textContent = this.currentUserData.name || this.currentUser.email;
      if (userAvatarEl) userAvatarEl.textContent = utils.getInitials(this.currentUserData.name);
      if (adminLink) adminLink.classList.toggle("hidden", this.currentUserData.role !== "admin");
      if (sellLink) sellLink.classList.toggle("hidden", this.currentUserData.role !== "seller");
    } else {
      if (guestNav) guestNav.classList.remove("hidden");
      if (userNav) userNav.classList.add("hidden");
      if (adminLink) adminLink.classList.add("hidden");
      if (sellLink) sellLink.classList.add("hidden");
    }
  },

  async register({ name, email, password, phone, role }) {
    await this.waitForFirebase();
    const cred = await fb.createUserWithEmailAndPassword(fb.auth, email, password);
    await fb.updateProfile(cred.user, { displayName: name });
    const userDoc = {
      uid: cred.user.uid,
      name,
      email,
      phone: phone || "",
      role: role || "buyer",
      whatsapp: "",
      telegram: "",
      status: "active",
      createdAt: fb.serverTimestamp(),
    };
    await fb.setDoc(fb.doc(fb.db, "users", cred.user.uid), userDoc);
    this.currentUserData = userDoc;
    return cred.user;
  },

  async login({ email, password }) {
    await this.waitForFirebase();
    const cred = await fb.signInWithEmailAndPassword(fb.auth, email, password);
    const snap = await fb.getDoc(fb.doc(fb.db, "users", cred.user.uid));
    if (snap.exists() && snap.data().status === "suspended") {
      await fb.signOut(fb.auth);
      throw { code: "auth/user-suspended" };
    }
    return cred.user;
  },

  async logout() {
    await this.waitForFirebase();
    await fb.signOut(fb.auth);
    window.location.href = "index.html";
  },

  friendlyError(error) {
    const code = error && error.code ? error.code : "";
    const map = {
      "auth/email-already-in-use": i18n.t("invalid_email") + " — already in use.",
      "auth/invalid-email": i18n.t("invalid_email"),
      "auth/weak-password": i18n.t("password_too_short"),
      "auth/user-not-found": i18n.t("generic_error"),
      "auth/wrong-password": i18n.t("generic_error"),
      "auth/invalid-credential": i18n.t("generic_error"),
      "auth/user-suspended": "Your account has been suspended. Contact support.",
      "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    };
    return map[code] || (error && error.message) || i18n.t("generic_error");
  },
};

window.authModule = authModule;
window.addEventListener("firebaseReady", () => authModule.init());
