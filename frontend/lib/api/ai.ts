"use client";
import { api } from "./client";

export type AIAnalysisStatus = "pending" | "running" | "done" | "failed";

export type AIAnalysis = {
  id: number;
  submission: number;
  kind: "report" | "github";
  status: AIAnalysisStatus;
  summary: string;
  weaknesses: string[];
  suggestions: string[];
  raw: Record<string, unknown> | null;
  error: string;
  created_at: string;
  finished_at: string | null;
};

export type GitHubAnalysis = {
  id: number;
  submission: number;
  repo_url: string;
  commit_count: number;
  contributor_count: number;
  languages: Record<string, number>;
  file_count: number;
  loc: number;
  quality_score: number | null;
  issues: Array<{ severity: "info" | "warn"; message: string }>;
  created_at: string;
};

export async function listAnalyses(submissionId: number) {
  const { data } = await api.get("/ai/analyses/", { params: { submission: submissionId } });
  return (data.results ?? data) as AIAnalysis[];
}

export async function listGitHubAnalyses(submissionId: number) {
  const { data } = await api.get("/ai/github/", { params: { submission: submissionId } });
  return (data.results ?? data) as GitHubAnalysis[];
}
