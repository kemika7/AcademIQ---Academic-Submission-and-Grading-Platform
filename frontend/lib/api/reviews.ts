"use client";
import { api } from "./client";

export type RubricCriterion = {
  id: number;
  label: string;
  description: string;
  weight: number;
  max_score: number;
  order: number;
};

export type Rubric = {
  id: number;
  course: number;
  name: string;
  is_active: boolean;
  criteria: RubricCriterion[];
  created_at: string;
};

export type CriterionScore = {
  id?: number;
  criterion: number;
  score: number;
  comment?: string;
};

export type Grade = {
  id: number;
  submission: number;
  student: number | null;
  student_name: string | null;
  rubric: number;
  graded_by: number | null;
  total_score: number;
  feedback: string;
  scores: CriterionScore[];
  graded_at: string;
};

export type PeerReview = {
  id: number;
  submission: number;
  reviewer: number;
  rating: number;
  comment: string;
  created_at: string;
};

export async function listRubrics(params?: { course?: number; is_active?: boolean }) {
  const { data } = await api.get("/rubrics/", { params });
  return (data.results ?? data) as Rubric[];
}

export async function createRubric(payload: {
  course: number;
  name: string;
  criteria: Array<Omit<RubricCriterion, "id">>;
}) {
  const { data } = await api.post("/rubrics/", payload);
  return data as Rubric;
}

export async function getGrades(submissionId: number) {
  const { data } = await api.get(`/submissions/${submissionId}/grade/`);
  return data as Grade[];
}

export async function createGrade(
  submissionId: number,
  payload: { rubric: number; student: number; feedback?: string; scores: CriterionScore[] },
) {
  const { data } = await api.post(`/submissions/${submissionId}/grade/`, payload);
  return data as Grade;
}

export async function listPeerReviews(submissionId: number) {
  const { data } = await api.get(`/submissions/${submissionId}/peer-reviews/`);
  return data as PeerReview[];
}

export async function createPeerReview(
  submissionId: number,
  payload: { rating: number; comment: string },
) {
  const { data } = await api.post(`/submissions/${submissionId}/peer-reviews/`, payload);
  return data as PeerReview;
}
