"use client";
import { api } from "./client";

export type GroupMember = {
  id: number;
  user: { id: number; email: string; full_name: string; role: string };
  role: "leader" | "member";
  joined_at: string;
};

export type Group = {
  id: number;
  project: number;
  project_title: string;
  course_id: number;
  course_label: string;
  name: string;
  group_code: string;
  memberships: GroupMember[];
  member_count: number;
  created_at: string;
};

export type Course = {
  id: number;
  code: string;
  title: string;
  term: string;
  description: string;
  course_code: string | null;
  is_enrolled: boolean;
  student_count: number;
  project_count: number;
  instructors: Array<{ id: number; full_name: string; email: string }>;
  created_at: string;
};

export async function listGroups() {
  const { data } = await api.get("/groups/");
  return (data.results ?? data) as Group[];
}

export async function createGroup(payload: { project: number; name: string }) {
  const { data } = await api.post("/groups/", payload);
  return data as Group;
}

export async function joinGroup(groupId: number, group_code: string) {
  const { data } = await api.post(`/groups/${groupId}/join/`, { group_code });
  return data as { detail: string };
}

export async function joinGroupOpen(groupId: number) {
  const { data } = await api.post(`/groups/${groupId}/join/`, {});
  return data as { detail: string };
}

export async function joinGroupByCode(group_code: string) {
  const { data } = await api.post("/groups/join-by-code/", { group_code });
  return data as Group;
}

export async function listEnrolledCourses() {
  const { data } = await api.get("/courses/enrolled/");
  return (data.results ?? data) as Course[];
}

export async function listCourses() {
  const { data } = await api.get("/courses/");
  return (data.results ?? data) as Course[];
}

export async function getCourse(id: number) {
  const { data } = await api.get(`/courses/${id}/`);
  return data as Course;
}

export async function listGroupsForProject(projectId: number) {
  const { data } = await api.get("/groups/", { params: { project: projectId } });
  return (data.results ?? data) as Group[];
}

export async function getGroup(id: number) {
  const { data } = await api.get(`/groups/${id}/`);
  return data as Group;
}

export async function addStudentsByEmail(courseId: number, emails: string[]) {
  const { data } = await api.post(`/courses/${courseId}/add-students/`, { emails });
  return data as { added: number; unmatched_emails: string[] };
}

export async function selfEnrollCourse(courseId: number) {
  const { data } = await api.post(`/courses/${courseId}/self-enroll/`);
  return data as Course;
}

export async function createCourse(payload: {
  code: string;
  title: string;
  term: string;
  description?: string;
}) {
  const { data } = await api.post("/courses/", payload);
  return data as Course;
}

export async function addStudentsToCourse(courseId: number, student_ids: number[]) {
  const { data } = await api.post(`/courses/${courseId}/add-students/`, { student_ids });
  return data as { detail: string };
}

export async function removeStudentFromCourse(courseId: number, student_id: number) {
  const { data } = await api.post(`/courses/${courseId}/remove-student/`, { student_id });
  return data as { detail: string };
}

export async function listCourseStudents(courseId: number) {
  const { data } = await api.get(`/courses/${courseId}/students/`);
  return (data.results ?? data) as Array<{ id: number; email: string; full_name: string; role: string }>;
}

export async function addInstructorsByEmail(courseId: number, emails: string[]) {
  const { data } = await api.post(`/courses/${courseId}/add-instructors/`, { emails });
  return data as { added: number; unmatched_emails: string[] };
}

export async function removeInstructorFromCourse(courseId: number, instructor_id: number) {
  const { data } = await api.post(`/courses/${courseId}/remove-instructor/`, { instructor_id });
  return data as { detail: string };
}

export async function deleteCourse(id: number) {
  await api.delete(`/courses/${id}/`);
}

export async function deleteGroup(id: number) {
  await api.delete(`/groups/${id}/`);
}

export async function createProject(payload: {
  course: number;
  title: string;
  description?: string;
  deadline: string;
  status?: string;
}) {
  const { course, ...rest } = payload;
  const body: Record<string, unknown> = { ...rest, course_id: course };
  const { data } = await api.post("/projects/", body);
  return data;
}
