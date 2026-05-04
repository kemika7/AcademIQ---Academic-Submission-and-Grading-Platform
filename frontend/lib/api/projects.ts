"use client";
import { api } from "./client";

export type ProjectMode = "individual" | "group";

export type MyParticipationSummary = {
  mode: ProjectMode;
  group_id: number | null;
  group_name: string | null;
};

export type ProjectListItem = {
  id: number;
  title: string;
  status: "draft" | "active" | "submitted" | "graded" | "archived";
  display_status: "graded" | "not_graded" | "submissions_left";
  my_status: "graded" | "not_graded" | "not_submitted" | null;
  my_participation: MyParticipationSummary | null;
  deadline: string;
  course: number;
  course_label: string;
  student_name: string | null;
  submissions_count: number;
  created_at: string;
  updated_at: string;
};

export type ProjectParticipation = {
  id: number;
  project: number;
  user: { id: number; full_name: string; email: string; role: string };
  mode: ProjectMode;
  group: {
    id: number;
    project: number;
    project_title: string;
    course_id: number;
    course_label: string;
    name: string;
    group_code: string;
    member_count: number;
    memberships: Array<{
      id: number;
      user: { id: number; full_name: string; email: string; role: string };
      role: "leader" | "member";
      joined_at: string;
    }>;
    created_at: string;
  } | null;
  created_at: string;
  updated_at: string;
};

export async function listProjects(params?: Record<string, string | number>) {
  const { data } = await api.get("/projects/", { params });
  return data.results as ProjectListItem[];
}

export async function getProject(id: number) {
  const { data } = await api.get(`/projects/${id}/`);
  return data;
}

export async function getActivity(id: number) {
  const { data } = await api.get(`/projects/${id}/activity/`);
  return data as Array<{
    id: number; verb: string; metadata: Record<string, unknown>;
    actor: { id: number | null; full_name: string }; created_at: string;
  }>;
}

export async function getMyParticipation(projectId: number) {
  const { data } = await api.get(`/projects/${projectId}/participation/`);
  return (data ?? null) as ProjectParticipation | null;
}

export async function chooseIndividual(projectId: number) {
  const { data } = await api.post(`/projects/${projectId}/participation/`, {
    mode: "individual",
  });
  return data as ProjectParticipation;
}

export async function chooseGroupExisting(projectId: number, groupId: number) {
  const { data } = await api.post(`/projects/${projectId}/participation/`, {
    mode: "group",
    group_id: groupId,
  });
  return data as ProjectParticipation;
}

export async function chooseGroupCreate(projectId: number, name: string) {
  const { data } = await api.post(`/projects/${projectId}/participation/`, {
    mode: "group",
    create: { name },
  });
  return data as ProjectParticipation;
}

export async function clearParticipation(projectId: number) {
  await api.delete(`/projects/${projectId}/participation/`);
}

export type ProjectParticipants = {
  groups: Array<{
    id: number;
    name: string;
    group_code: string;
    members: Array<{ id: number; full_name: string }>;
    submission: {
      id: number; version: number; submitted_at: string;
      submitted_by: { id: number; full_name: string } | null;
      graded_count: number;
    } | null;
    graded_total: number;
    graded_required: number;
  }>;
  individuals: Array<{
    id: number;
    full_name: string;
    email: string;
    submission: {
      id: number; version: number; submitted_at: string;
      submitted_by: { id: number; full_name: string } | null;
      graded_count: number;
    } | null;
    graded: boolean;
  }>;
  unchosen: Array<{ id: number; full_name: string; email: string }>;
};

export async function getProjectParticipants(id: number) {
  const { data } = await api.get(`/projects/${id}/participants/`);
  return data as ProjectParticipants;
}

export async function listSubmissions(projectId: number) {
  const { data } = await api.get(`/projects/${projectId}/submissions/`);
  return data.results ?? data;
}

export async function createSubmission(projectId: number, form: FormData) {
  const { data } = await api.post(`/projects/${projectId}/submissions/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function updateSubmission(
  projectId: number,
  submissionId: number,
  patch: { github_url?: string; notes?: string },
) {
  const { data } = await api.patch(`/projects/${projectId}/submissions/${submissionId}/`, patch);
  return data;
}

export async function deleteProject(id: number) {
  await api.delete(`/projects/${id}/`);
}

export type InboxItem = {
  id: number;
  version: number;
  submitted_at: string;
  project_id: number;
  project_title: string;
  project_status: "draft" | "active" | "submitted" | "graded" | "archived";
  deadline: string;
  course_id: number;
  course_code: string;
  course_title: string;
  student_name: string;
  student_email: string | null;
  submitted_by_role: "student" | "instructor" | "admin" | null;
  group_name: string | null;
  is_individual: boolean;
  report_file: string | null;
  github_url: string;
  notes: string;
};

export async function listInbox(params?: Record<string, string>) {
  const { data } = await api.get("/inbox/", { params });
  return data as InboxItem[];
}

export type FeedItem = {
  id: number;
  verb: string;
  metadata: Record<string, any>;
  created_at: string;
  project: { id: number; title: string; course_code: string; course_title: string };
  actor: { id: number | null; full_name: string; role: "student" | "instructor" | "admin" | null };
};

export async function listFeed(params?: { actor_role?: "student" | "instructor" | "admin" }) {
  const { data } = await api.get("/feed/", { params });
  return data as FeedItem[];
}
