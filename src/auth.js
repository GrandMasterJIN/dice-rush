// auth.js — authentication functions for Dice Rush
import { supabase } from './supabase.js';

// Sign up with email, password and username
export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw error;
  return data;
}

// Sign in with email and password
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Get current session (used on app load to restore state)
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data; // { session } — session is null if not logged in
}

// Send password reset email
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

// Save a completed game score to the leaderboard
export async function saveScore({ userId, username, score, turns, won, difficulty }) {
  const { error } = await supabase.from('leaderboard').insert({
    user_id:    userId,
    username:   username,
    score:      score,
    turns:      turns,
    won:        won,
    difficulty: difficulty,
  });
  if (error) throw error;
}
