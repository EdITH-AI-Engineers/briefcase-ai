import type { StudentDashboardDto } from "../types/dashboard";

export type RunSummary = {
  id: string;
  status: string;
  frameworkVersion?: string;
  completedAnalyses?: number;
  requestedProfiles?: number;
};

export type StudentSummary = {
  id: string;
  name: string;
  program: string;
  yearLevel: number | null;
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Request failed with ${res.status}: ${path}`);
  return (await res.json()) as T;
}

export async function fetchDashboard(): Promise<StudentDashboardDto | null> {
  const body = await getJson<{ dashboard: StudentDashboardDto | null }>("/api/dashboard/latest");
  return body.dashboard;
}

export async function fetchRuns(): Promise<RunSummary[]> {
  return getJson<RunSummary[]>("/api/runs");
}

export async function fetchStudents(runId: string): Promise<StudentSummary[]> {
  return getJson<StudentSummary[]>(`/api/runs/${runId}/students`);
}

export async function fetchStudentDashboard(runId: string, studentId: string): Promise<StudentDashboardDto> {
  return getJson<StudentDashboardDto>(`/api/runs/${runId}/students/${studentId}/dashboard`);
}
