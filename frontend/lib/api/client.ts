"use client";
import axios from "axios";

import { getAccessToken, setAccessToken, clearTokens, getRefreshToken, setRefreshToken } from "../auth/session";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
});

const AUTH_ENDPOINTS = ["/auth/login/", "/auth/register/", "/auth/refresh/"];

api.interceptors.request.use((config) => {
  const url = config.url ?? "";
  if (AUTH_ENDPOINTS.some((p) => url.includes(p))) return config;
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = getRefreshToken();
      if (!refresh) {
        clearTokens();
        if (typeof window !== "undefined") window.location.href = "/login";
        return Promise.reject(error);
      }
      refreshing ??= axios
        .post(`${api.defaults.baseURL}/auth/refresh/`, { refresh })
        .then((res) => {
          setAccessToken(res.data.access);
          if (res.data.refresh) setRefreshToken(res.data.refresh);
          return res.data.access as string;
        })
        .catch(() => {
          clearTokens();
          if (typeof window !== "undefined") window.location.href = "/login";
          return null;
        })
        .finally(() => { refreshing = null; });

      const newToken = await refreshing;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);
