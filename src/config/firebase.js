const admin = require("firebase-admin");

let db, storage, auth;

function initFirebase() {
  if (admin.apps.length) {
    db = admin.firestore();
    storage = admin.storage();
    auth = admin.auth();
    return;
  }

  // Render stores env vars literally — \n must be converted to real newlines
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;

  if (!process.env.FIREBASE_PROJECT_ID || !privateKey) {
    throw new Error(
      "Firebase credentials missing. Set FIREBASE_PROJECT_ID and FIREBASE_PRIVATE_KEY in Render env vars."
    );
  }

  // Validate key format
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY appears malformed. Make sure it includes the full key with BEGIN/END markers."
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });

  db = admin.firestore();
  storage = admin.storage();
  auth = admin.auth();

  db.settings({ ignoreUndefinedProperties: true });

  console.log(
    `[Firebase] Initialized — project: ${process.env.FIREBASE_PROJECT_ID}`
  );
}

try {
  initFirebase();
} catch (err) {
  console.error("[Firebase] INIT FAILED:", err.message);
  // Don't crash the process — health check will report degraded status
}

module.exports = { admin, db, storage, auth };