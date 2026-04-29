import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBtO7Pqnz7TUUHr4mDW_ibC-hbl86Iie1M",
  authDomain: "crimescenesketch.firebaseapp.com",
  projectId: "crimescenesketch",
  storageBucket: "crimescenesketch.firebasestorage.app",
  messagingSenderId: "303970558962",
  appId: "1:303970558962:web:4d2a7344ec1df11e19816b",
  measurementId: "G-L5GDKRJ4TX"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Dummy Suspect Database for Matching Logic
const dummySuspects = [
  { id: 1, name: "John 'The Ghost' Doe", traits: ["beard", "scar", "glasses"], image: "https://i.pravatar.cc/150?u=1" },
  { id: 2, name: "Jane 'Red' Smith", traits: ["sharp jaw", "piercing eyes"], image: "https://i.pravatar.cc/150?u=2" },
  { id: 3, name: "Mike 'Heavy' Miller", traits: ["round face", "bald"], image: "https://i.pravatar.cc/150?u=3" }
];

export const dbService = {
  saveLog: async (action) => {
    try {
      await addDoc(collection(db, "auditLogs"), {
        action,
        timestamp: new Date().toISOString(),
        caseId: "CASE-2026-X"
      });
    } catch (e) { console.error("Error logging:", e); }
  },
  getLogs: async () => {
    const q = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  },
  getSuspects: () => dummySuspects
};