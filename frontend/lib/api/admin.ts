"use client";
import { api } from "./client";

export type AdminUser = {
  id: number;
  email: string;
  full_name: string;
  role: "student" | "instructor" | "admin";
  is_active: boolean;
  github_username: string;
  created_at: string;
};

export type AdminStats = {
  users: { total: number; by_role: Record<string, number>; active: number };
  courses: { total: number };
  groups: { total: number };
  projects: { total: number; by_status: Record<string, number> };
  submissions: { total: number; graded: number };
};

export async function getAdminStats() {
  const { data } = await api.get("/auth/admin/stats/");
  return data as AdminStats;
}

export type AnalyticsRange = "7d" | "30d" | "90d" | "all";

export type AdminAnalytics = {
  summary: {
    active_projects: number;
    awaiting_grade: number;
    submissions_left: number;
    graded_projects: number;
    pending_submissions: number;
    total_courses: number;
    total_projects: number;
    total_users: number;
    students: number;
    instructors: number;
  };
  project_status: Array<{ name: string; value: number; color: string }>;
  submissions_over_time: Array<{ date: string; count: number }>;
  grade_distribution: Array<{ range: string; count: number }>;
  top_groups: Array<{ name: string; submissions: number }>;
  instructor_activity: Array<{ name: string; graded: number }>;
  insight: string;
  courses: Array<{ id: number; code: string; title: string }>;
  range: AnalyticsRange;
};

export async function getAdminAnalytics(params?: { range?: AnalyticsRange; course?: number }) {
  const { data } = await api.get("/auth/admin/analytics/", { params });
  return data as AdminAnalytics;
}

export async function listAdminUsers(params?: { role?: string; search?: string }) {
  const { data } = await api.get("/auth/admin/users/", { params });
  return (data.results ?? data) as AdminUser[];
}

export async function createAdminUser(payload: {
  email: string; full_name: string; password: string;
  role: "student" | "instructor" | "admin"; is_active?: boolean;
}) {
  const { data } = await api.post("/auth/admin/users/", payload);
  return data as AdminUser;
}

export async function updateAdminUser(
  id: number,
  patch: Partial<{ role: string; is_active: boolean; full_name: string; password: string }>,
) {
  const { data } = await api.patch(`/auth/admin/users/${id}/`, patch);
  return data as AdminUser;
}

export async function deleteAdminUser(id: number) {
  await api.delete(`/auth/admin/users/${id}/`);
}
