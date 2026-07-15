import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCYYPwWzi6T8wUK_e7T5PqgtriSPIgsHuw",
  authDomain: "egresados-jbc.firebaseapp.com",
  projectId: "egresados-jbc",
  storageBucket: "egresados-jbc.firebasestorage.app",
  messagingSenderId: "1069266758529",
  appId: "1:1069266758529:web:7f118c0d50ae2107ca5680",
  measurementId: "G-D92XM98GSE",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, "southamerica-east1");
