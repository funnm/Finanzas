// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDfTBPUPu8z_lWj6ORxvEiPlzfoYPhlqDw",
  authDomain: "elzuco-vault-73760.firebaseapp.com",
  databaseURL: "https://elzuco-vault-73760-default-rtdb.firebaseio.com",
  projectId: "elzuco-vault-73760",
  storageBucket: "elzuco-vault-73760.firebasestorage.app",
  messagingSenderId: "68119814899",
  appId: "1:68119814899:web:e99d0951f02cb804f6cd86",
  measurementId: "G-0Q10RP6YJ0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
