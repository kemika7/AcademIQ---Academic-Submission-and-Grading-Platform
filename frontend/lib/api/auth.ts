"use client";
import { api } from "./client";
import { setSession, type SessionUser } from "../auth/session";

export async function login(email: string, password: string) {
  const { data } = await api.post("/auth/login/", { email, password });
  setSession(data.access, data.refresh, data.user as SessionUser);
  return data.user as SessionUser;
}

export async function register(payload: {
  email: string; password: string; full_name: string; role: "student" | "instructor" | "admin";
}) {
  await api.post("/auth/register/", payload);
  return login(payload.email, payload.password);
}

export async function fetchMe() {
  const { data } = await api.get("/auth/me/");
  return data as SessionUser;
}
