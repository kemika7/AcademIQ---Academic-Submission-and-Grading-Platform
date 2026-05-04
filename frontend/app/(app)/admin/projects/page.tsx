"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { deleteProject, listProjects, type ProjectListItem } from "@/lib/api/projects";
import { listCourses } from "@/lib/api/groups";
import { getSessionUser } from "@/lib/auth/session";
import { deadlineLabel } from "@/lib/utils";

export default function AdminProjectsPage() {
  const me = getSessionUser();
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me && me.role !== "admin") router.replace("/dashboard");
  }, [me, router]);

  const { data: courses } = useQuery({ queryKey: ["courses"], queryFn: listCourses });

  const { data: projects, isLoading } = useQuery({
    queryKey: ["admin-projects", courseFilter],
    queryFn: () =>
      listProjects(courseFilter === "" ? undefined : { course: Number(courseFilter) }),
  });

  const courseLabelById = useMemo(() => {
    const m = new Map<number, string>();
    (courses ?? []).forEach((c) => m.set(c.id, `${c.code} — ${c.title}`));
    return m;
  }, [courses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (projects ?? []).filter((p) =>
      !q || p.title.toLowerCase().includes(q) || (p.course_label ?? "").toLowerCase().includes(q),
    );
  }, [projects, search]);

  const delMut = useMutation({
    mutationFn: (id: number) => deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
      setError(null);
    },
    onError: (e: any) => setError(e.response?.data?.detail || "Could not delete project."),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">All projects</h1>
        <p className="text-sm text-muted-foreground">
          Every project across every course. Filter, search, and delete from here.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or course…"
            className="pl-9"
          />
        </div>
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value === "" ? "" : Number(e.target.value))}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All courses</option>
          {(courses ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects"
          body={search || courseFilter ? "No projects match the current filters." : "No projects exist yet."}
        />
      ) : (
        <Card className="divide-y overflow-hidden">
          {filtered.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              courseLabel={courseLabelById.get(p.course) ?? p.course_label ?? "—"}
              onDelete={() => {
                if (confirm(`Delete "${p.title}"? All submissions, groups, and grades go with it.`)) {
                  delMut.mutate(p.id);
                }
              }}
              deleting={delMut.isPending}
            />
          ))}
        </Card>
      )}
    </div>
  );
}

function ProjectRow({
  project, courseLabel, onDelete, deleting,
}: {
  project: ProjectListItem;
  courseLabel: string;
  onDelete: () => void;
  deleting: boolean;
}) {
  const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" }> = {
    graded: { label: "Graded", variant: "success" },
    not_graded: { label: "Not graded", variant: "default" },
    submissions_left: { label: "Submissions left", variant: "warning" },
  };
  const s = STATUS[project.display_status];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link href={`/projects/${project.id}`} className="truncate text-sm font-medium hover:underline">
            {project.title}
          </Link>
          <Badge variant={s.variant}>{s.label}</Badge>
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {courseLabel} · {deadlineLabel(project.deadline)} · {project.submissions_count} submission{project.submissions_count === 1 ? "" : "s"}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/projects/${project.id}`}>Open</Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} disabled={deleting} title="Delete project">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
