import { deleteApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { get, getDatabase, ref, set } from "firebase/database";

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

export function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const random = crypto.getRandomValues(new Uint8Array(20));
  return `MT-7${Array.from(random, (value) => alphabet[value % alphabet.length]).join("")}!`;
}

// The new account signs in only to a temporary, memory-only Auth instance.
// Profile writes use the primary database instance and the administrator's session.
export async function provisionUser(profile: UserProfileInput, temporaryPassword: string) {
  const administrator = auth.currentUser;
  if (!administrator) throw new Error("Sign in as an administrator to create users.");
  const administratorProfile = await get(ref(database, `users/${administrator.uid}`));
  if (administratorProfile.val()?.role !== "IT Admin" || administratorProfile.val()?.status !== "Active") {
    throw new Error("Only an active IT Administrator can create users.");
  }
  const normalizedProfile = {
    ...profile,
    name: profile.name.trim(), email: profile.email.trim().toLowerCase(), department: profile.department.trim(),
  };
  if (!normalizedProfile.name || !normalizedProfile.department || !normalizedProfile.email) {
    throw new Error("Enter a name, email, and department.");
  }
  if (!["Employee", "IT Technician", "IT Admin", "Management"].includes(profile.role)) {
    throw new Error("Select a valid role.");
  }
  if (temporaryPassword.length < 8) throw new Error("Use a temporary password with at least 8 characters.");
  const secondaryApp = initializeApp(firebaseConfig, `provision-${crypto.randomUUID()}`);
  try {
    const secondaryAuth = initializeAuth(secondaryApp, { persistence: inMemoryPersistence });
    const credential = await createUserWithEmailAndPassword(secondaryAuth, normalizedProfile.email, temporaryPassword);
    try {
      if (auth.currentUser?.uid !== administrator.uid) throw new Error("The administrator session changed. Sign in again and retry.");
      await set(ref(database, `users/${credential.user.uid}`), {
        ...normalizedProfile,
        status: "Active",
        createdAt: Date.now(),
        mustChangePassword: true,
      });
    } catch (error) {
      try { await deleteUser(credential.user); }
      catch {
        throw new Error(`The account for ${normalizedProfile.email} was created, but its profile could not be saved or rolled back. Use Link existing account with its Firebase UID to finish setup.`);
      }
      throw error;
    }
    return credential.user.uid;
  } finally {
    // Cleanup must not turn a successfully created account into a reported failure.
    await signOut(getAuth(secondaryApp)).catch(() => undefined);
    await deleteApp(secondaryApp).catch(() => undefined);
  }
}

export function sendUserPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email);
}
