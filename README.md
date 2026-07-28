# MinDeb Marketplace — Ethiopia's Mineral Trading Platform

A production-ready, multilingual (EN/SO/OM/AM/AR/FR) mineral marketplace built with plain HTML, Tailwind CSS (CDN), vanilla JavaScript, Firebase (Auth + Firestore), and Cloudinary (media uploads).

## 1. Project structure

```
mineral-platform/
├── index.html            Dashboard (listings, search, nav)
├── login.html             Login
├── register.html          Register (buyer / seller)
├── sell.html               Seller: create a listing
├── unlock.html             Buyer: pay to unlock seller contact
├── admin.html               Admin dashboard
├── ai-identifier.html       AI mineral identifier flow
├── css/
│   └── styles.css          Design tokens + shared components
└── js/
    ├── translations.js     6-language string dictionary
    ├── i18n.js               i18n engine (DOM binding + switcher)
    ├── firebase-config.js  Firebase init (ES module)
    ├── cloudinary-config.js Cloudinary widget helper
    ├── utils.js               Toasts, validation, formatting
    ├── auth.js                Register / login / logout / nav state
    ├── main.js                Dashboard listings + unlock trigger
    ├── upload.js              Seller listing creation
    ├── payment.js             Buyer payment / unlock submission
    ├── admin.js                Admin review & management
    └── ai-identifier.js       AI identification flow
```

## 2. Before you deploy — required configuration

### Firebase
1. Create a project at https://console.firebase.google.com
2. Enable **Authentication → Sign-in method → Email/Password**
3. Enable **Firestore Database** (start in production mode)
4. Go to Project settings → General → Your apps → add a Web app, copy the config object
5. Paste it into `js/firebase-config.js` → `FIREBASE_CONFIG`
6. Paste the Firestore security rules found in the comment block at the bottom of `js/firebase-config.js` into Firestore → Rules

### Cloudinary
1. Create a free account at https://cloudinary.com
2. Go to Settings → Upload → Upload presets → Add an **unsigned** preset
3. Copy your Cloud Name and the preset name into `js/cloudinary-config.js`

### Firestore composite index (recommended, optional)
`main.js` queries active listings ordered by status + date. If you see an index-required error in the console the first time listings load, click the link Firebase prints in the browser console to auto-create the index (the app already has a client-side fallback so it will keep working either way).

## 3. Firestore collections created automatically at runtime

- `users` — {uid, name, email, phone, role: buyer|seller|admin, whatsapp, telegram, status, createdAt}
- `listings` — {sellerId, sellerName, sellerPhone, sellerWhatsapp, sellerTelegram, mineralName, description, quantity, price, images[], video, status, createdAt}
- `unlocks` — {listingId, sellerId, buyerId, buyerName, paymentMethod, transactionId, receiptUrl, status: pending|approved|rejected, createdAt}
- `ai_requests` — {userId, paymentMethod, transactionId, receiptUrl, images[], video, observationNotes, aiReport{}, status, createdAt}

## 4. Creating your first admin account

There is no self-serve admin signup (by design). To create an admin:
1. Register normally as a buyer or seller.
2. In the Firebase console, open Firestore → `users` → your document → change the `role` field to `admin`.
3. Log out and back in — the Admin link will appear in the navbar.

## 5. AI Mineral Identifier — how the report is generated

This MVP ships a deterministic, rule-based analysis (`runAnalysis()` in `js/ai-identifier.js`) that matches keywords from the buyer's written observations against a small mineral-profile table to produce a preliminary possible-mineral, confidence score, and notes. It's wired end-to-end (payment → admin approval → upload → report) so you can later swap `runAnalysis()` for a call to a real computer-vision/AI API without changing anything else in the flow. The disclaimer shown to users makes clear this is a preliminary estimate, not certified lab analysis.

## 6. Deploying

Any static host works (Firebase Hosting, Netlify, Vercel, GitHub Pages, etc.) since this is plain HTML/CSS/JS with no build step. For Firebase Hosting:

```
npm install -g firebase-tools
firebase login
firebase init hosting   # select this folder as the public directory
firebase deploy
```

## 7. Design system

Dark charcoal background (`#0f1115`), gold accent (`#d4af37`), emerald accent (`#10b981`). All tokens live in `css/styles.css` under `:root` — change them there to re-theme the whole platform.
