import { getAuth } from "firebase/auth";
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
export const auth = getAuth(app); 

// Upgraded Forensic Database for Mathematical Matching
// Upgraded 8-Person Forensic Database
const dummySuspects = [
  { id: 1, name: "David 'Shadow' Miller", image: "https://randomuser.me/api/portraits/men/32.jpg", traits: { age: 36, faceShape: 'Diamond', eyeShape: 'Almond', tags: ['Beard', 'Scar'] } },
  { id: 2, name: "Maria 'Viper' Rostova", image: "https://randomuser.me/api/portraits/women/44.jpg", traits: { age: 28, faceShape: 'Oval', eyeShape: 'Round', tags: ['Glasses'] } },
  { id: 3, name: "Marcus 'Heavy' Vance", image: "https://randomuser.me/api/portraits/men/68.jpg", traits: { age: 45, faceShape: 'Square', eyeShape: 'Hooded', tags: ['Mustache'] } },
  { id: 4, name: "Sarah 'Ghost' Jenkins", image: "https://randomuser.me/api/portraits/women/12.jpg", traits: { age: 31, faceShape: 'Diamond', eyeShape: 'Upturned', tags: ['Piercing', 'Tattoo'] } },
  { id: 5, name: "Tommy 'Two-Tone' Clark", image: "https://randomuser.me/api/portraits/men/90.jpg", traits: { age: 25, faceShape: 'Square', eyeShape: 'Almond', tags: ['Earrings', 'Hoodie'] } },
  { id: 6, name: "Elena 'Phantom' Cruz", image: "https://randomuser.me/api/portraits/women/68.jpg", traits: { age: 42, faceShape: 'Heart', eyeShape: 'Deep-set', tags: ['Hat', 'Wrinkles'] } },
  { id: 7, name: "Arthur 'Professor' Pendelton", image: "https://randomuser.me/api/portraits/men/11.jpg", traits: { age: 55, faceShape: 'Oval', eyeShape: 'Round', tags: ['Glasses', 'Beard', 'Wrinkles'] } },
  { id: 8, name: "Chloe 'Glitch' Sato", image: "https://randomuser.me/api/portraits/women/33.jpg", traits: { age: 22, faceShape: 'Round', eyeShape: 'Monolid', tags: ['Piercing', 'Hoodie', 'Tattoo'] } }
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