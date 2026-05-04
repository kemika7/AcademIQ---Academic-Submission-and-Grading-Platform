"use client";

const ACCESS_KEY = "academiq_access";
const REFRESH_KEY = "academiq_refresh";
const USER_KEY = "academiq_user";

export type Role = "student" | "instructor" | "admin";
export type SessionUser = {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  avatar?: string | null;
  github_username?: string;
};

const isBrowser = () => typeof window !== "undefined";

export function getAccessToken() {
  return isBrowser() ? localStorage.getItem(ACCESS_KEY) : null;
}
export function getRefreshToken() {
  return isBrowser() ? localStorage.getItem(REFRESH_KEY) : null;
}
export function setAccessToken(token: string) {
  if (isBrowser()) localStorage.setItem(ACCESS_KEY, token);
}
export function setRefreshToken(token: string) {
  if (isBrowser()) localStorage.setItem(REFRESH_KEY, token);
}
export function setSession(access: string, refresh: string, user: SessionUser) {
  setAccessToken(access);
  setRefreshToken(refresh);
  if (isBrowser()) localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function getSessionUser(): SessionUser | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}
export function clearTokens() {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}
