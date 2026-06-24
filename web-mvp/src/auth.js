// auth.js — authentication functions for Dice Rush (Firebase)
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';

const googleProvider = new GoogleAuthProvider();

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Create or update a user profile doc in Firestore
async function ensureProfile(user, username) {
  var ref  = doc(db, 'profiles', user.uid);
  var snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      username:   username || user.displayName || user.email.split('@')[0],
      email:      user.email,
      createdAt:  serverTimestamp(),
      // prefs
      difficulty:          'easy',
      hints_enabled:       true,
      tutorial_completed:  false,
    });
  }
}

// Fetch profile doc
export async function getProfile(uid) {
  var snap = await getDoc(doc(db, 'profiles', uid));
  return snap.exists() ? snap.data() : null;
}

// Update specific fields on profile doc
export async function updateProfile_(uid, fields) {
  await setDoc(doc(db, 'profiles', uid), fields, { merge: true });
}

// ─── AUTH FUNCTIONS ───────────────────────────────────────────────────────────

// Sign up with email, password and username
export async function signUp(email, password, username) {
  var cred = await createUserWithEmailAndPassword(auth, email, password);
  // Set Firebase displayName
  await updateProfile(cred.user, { displayName: username });
  // Create Firestore profile
  await ensureProfile(cred.user, username);
  return cred.user;
}

// Sign in with email and password
export async function signIn(email, password) {
  var cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// Sign in with Google popup
export async function signInWithGoogle() {
  var cred = await signInWithPopup(auth, googleProvider);
  // First time Google users get a profile doc created
  var profile = await getProfile(cred.user.uid);
  if (!profile) {
    await ensureProfile(cred.user, cred.user.displayName);
  }
  return cred.user;
}

// Sign out
export async function signOut() {
  await firebaseSignOut(auth);
}

// Get current user (synchronous — Firebase keeps this in memory)
export function getCurrentUser() {
  return auth.currentUser;
}

// Send password reset email
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// Save a completed game score to Firestore leaderboard
export async function saveScore({ userId, username, score, turns, won, difficulty }) {
  await addDoc(collection(db, 'leaderboard'), {
    userId,
    username,
    score,
    turns,
    won,
    difficulty,
    createdAt: serverTimestamp(),
  });
}

// Listen for auth state changes — returns unsubscribe function
export function onAuthChange(callback) {
  return auth.onAuthStateChanged(callback);
}
