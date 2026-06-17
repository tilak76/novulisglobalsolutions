import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyC9YXOsBfClNVPp_jZnAq1UxwYC3A6Lf1g",
  authDomain: "moviedatabase-e226c.firebaseapp.com",
  projectId: "moviedatabase-e226c",
  storageBucket: "moviedatabase-e226c.firebasestorage.app",
  messagingSenderId: "127156386325",
  appId: "1:127156386325:web:43c347976132a783d3ec1c",
  measurementId: "G-BPDWPNT2F9"
};

const app = initializeApp(firebaseConfig);
export const secondaryApp = initializeApp(firebaseConfig, "Secondary");

export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
