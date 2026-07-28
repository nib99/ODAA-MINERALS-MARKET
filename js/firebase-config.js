/* ========================================================
   Firebase Configuration & Initialization (modular v9+, CDN)
   --------------------------------------------------------
   Replace the values in FIREBASE_CONFIG below with your own
   Firebase project's config (Project settings > General >
   Your apps > SDK setup and configuration).

   Enable in the Firebase console before deploying:
     - Authentication > Sign-in method > Email/Password
     - Firestore Database (start in production mode)
     - Recommended Firestore security rules are documented
       at the bottom of this file as a comment.
   ======================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// -------------------------------------------------------
// REPLACE WITH YOUR OWN FIREBASE PROJECT CONFIG
// -------------------------------------------------------
const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

// Expose a single namespaced object on window so plain <script> files
// (auth.js, main.js, upload.js, payment.js, admin.js, ai-identifier.js)
// can use Firebase without needing their own ES module imports.
window.fb = {
  app,
  auth,
  db,
  // auth
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  // firestore
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
};

// Signal that Firebase is ready so other scripts can safely start.
window.dispatchEvent(new CustomEvent("firebaseReady"));

/* ---------------------------------------------------------
   RECOMMENDED FIRESTORE SECURITY RULES (paste into Firebase
   console > Firestore Database > Rules):

   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {

       function isSignedIn() { return request.auth != null; }
       function isOwner(uid) { return isSignedIn() && request.auth.uid == uid; }
       function role() {
         return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
       }
       function isAdmin() { return isSignedIn() && role() == 'admin'; }

       match /users/{userId} {
         allow read: if isSignedIn();
         allow create: if isOwner(userId);
         allow update: if isOwner(userId) || isAdmin();
         allow delete: if isAdmin();
       }

       match /listings/{listingId} {
         allow read: if true;
         allow create: if isSignedIn() && role() == 'seller';
         allow update, delete: if isSignedIn() &&
           (resource.data.sellerId == request.auth.uid || isAdmin());
       }

       match /unlocks/{unlockId} {
         allow read: if isSignedIn() &&
           (resource.data.buyerId == request.auth.uid ||
            resource.data.sellerId == request.auth.uid || isAdmin());
         allow create: if isSignedIn();
         allow update: if isAdmin();
       }

       match /ai_requests/{reqId} {
         allow read: if isSignedIn() &&
           (resource.data.userId == request.auth.uid || isAdmin());
         allow create: if isSignedIn();
         allow update: if isAdmin();
       }
     }
   }
   --------------------------------------------------------- */
