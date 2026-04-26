const admin = require("firebase-admin");

let db, storage, auth;

function initFirebase() {
  if (admin.apps.length) {
    db = admin.firestore();
    storage = admin.storage();
    auth = admin.auth();
    return;
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;

  if (!process.env.FIREBASE_PROJECT_ID || !privateKey) {
    throw new Error("Firebase credentials missing. Check FIREBASE_PROJECT_ID and FIREBASE_PRIVATE_KEY.");
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

  // Firestore settings — use timestamps as Dates
  db.settings({ ignoreUndefinedProperties: true });
}

initFirebase();

module.exports = { admin, db, storage, auth };
