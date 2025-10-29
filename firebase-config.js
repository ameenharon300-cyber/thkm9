const admin = require('firebase-admin');

// تهيئة Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD9aLabUWNfgjqoIuZSYNm1X8kAtM-Eac8",
  authDomain: "andex-html.firebaseapp.com",
  databaseURL: "https://andex-html-default-rtdb.firebaseio.com",
  projectId: "andex-html",
  storageBucket: "andex-html.firebasestorage.app",
  messagingSenderId: "94749059385",
  appId: "1:94749059385:web:332359f7c770aea05520e8",
  measurementId: "G-LN0D106XNC"
};

// Initialize Firebase
let db = null;
let rtdb = null;

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      databaseURL: firebaseConfig.databaseURL,
    });
    console.log('✅ Firebase initialized successfully');
  }

  db = admin.firestore();
  rtdb = admin.database();
  console.log('✅ Firestore & Database initialized');

} catch (error) {
  console.log('❌ Firebase initialization error:', error.message);
}

// دالة لحفظ الجلسات
async function saveReverseSession(sessionData) {
  try {
    if (db) {
      const sessionRef = db.collection('reverse_sessions').doc(sessionData.device_id);
      await sessionRef.set({
        ...sessionData,
        socket: null,
        last_updated: admin.firestore.FieldValue.serverTimestamp(),
        connected: true
      });
      return true;
    }
    return false;
  } catch (error) {
    console.log('❌ Error saving session:', error.message);
    return false;
  }
}

// دالة لاسترجاع الجلسات
async function getActiveSessions() {
  try {
    if (db) {
      const snapshot = await db.collection('reverse_sessions')
        .where('connected', '==', true)
        .get();
      
      const sessions = [];
      snapshot.forEach(doc => {
        sessions.push(doc.data());
      });
      
      return sessions;
    }
    return [];
  } catch (error) {
    console.log('❌ Error getting sessions:', error.message);
    return [];
  }
}

// دالة لتحديث حالة الجلسة
async function updateSessionStatus(deviceId, connected) {
  try {
    if (db) {
      const sessionRef = db.collection('reverse_sessions').doc(deviceId);
      await sessionRef.update({
        connected: connected,
        last_updated: admin.firestore.FieldValue.serverTimestamp()
      });
      return true;
    }
    return false;
  } catch (error) {
    console.log('❌ Error updating session:', error.message);
    return false;
  }
}

module.exports = {
  admin,
  db,
  rtdb,
  firebaseConfig,
  saveReverseSession,
  getActiveSessions,
  updateSessionStatus
};