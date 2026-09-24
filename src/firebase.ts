import { deleteApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { getDatabase, ref, set } from "firebase/database";

export const firebaseConfig = {
  apiKey: "AIzaSyCYw7zgHU2kxjf027_3sbR-76ba66yH9RY",
  authDomain: "ticketing-a8461.firebaseapp.com",
  databaseURL: "https://ticketing-a8461-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ticketing-a8461",
  storageBucket: "ticketing-a8461.firebasestorage.app",
  messagingSenderId: "679746711317",
  appId: "1:679746711317:web:ed14ff83d74f6c240d831c",
  measurementId: "G-275EKPEELL",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const database = getDatabase(firebaseApp);
export const auth = getAuth(firebaseApp);

export type UserProfileInput = {
  name: string;
  email: string;
  role: "Employee" | "IT Technician" | "IT Admin" | "Management";
  department: string;
};

// A secondary Auth instance creates the account without replacing the signed-in admin.
export async function provisionUser(profile: UserProfileInput, temporaryPassword: string) {
  const secondaryApp = initializeApp(firebaseConfig, `provision-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, profile.email, temporaryPassword);
    await set(ref(database, `users/${credential.user.uid}`), {
      ...profile,
      status: "Active",
      createdAt: Date.now(),
      lastActive: "Not signed in yet",
      mustChangePassword: true,
    });
    await signOut(secondaryAuth);
    return credential.user.uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

export function sendUserPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email);
}
