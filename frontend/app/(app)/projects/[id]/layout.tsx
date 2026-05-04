"use client";
import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { deleteProject, getProject } from "@/lib/api/projects";
import { getSessionUser } from "@/lib/auth/session";
import { cn, deadlineLabel } from "@/lib/utils";

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "submissions", label: "Submissions" },
  { slug: "github", label: "GitHub" },
  { slug: "ai-feedback", label: "AI Feedback", roles: ["instructor", "admin"] },
  { slug: "grades", label: "Grades" },
] as const;

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const path = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const id = Number(params.id);
  const user = getSessionUser();
  const isInstructor = user?.role === "instructor" || user?.role === "admin";
  const { data, isLoading } = useQuery({ queryKey: ["project", id], queryFn: () => getProject(id) });

  async function handleDelete() {
    await deleteProject(id);
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["inbox"] });
    if (data?.course?.id) {
      router.replace(`/courses/${data.course.id}`);
    } else {
      router.replace("/dashboard");
    }
  }

  return (
    <div>
      <div className="mb-6 border-b pb-4">
        {isLoading || !data ? (
          <Skeleton className="h-8 w-72" />
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>
                  <ProjectStatusBadge displayStatus={data.display_status} myStatus={data.my_status} role={user?.role} />
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {[
                    data.course?.code,
                    participationLabel(data.my_participation),
                    deadlineLabel(data.deadline),
                  ].filter(Boolean).join(" · ")}
                </div>
              </div>
              {isInstructor && (
                <DeleteDialog
                  triggerLabel="Delete project"
                  title={`Delete "${data.title}"?`}
                  description="This permanently removes the project and all of its submissions, AI analyses, and comments. This cannot be undone."
                  confirmLabel="Delete project"
                  onConfirm={handleDelete}
                />
              )}
            </div>
          </>
        )}
        <nav className="mt-4 flex gap-1">
          {TABS.filter((t) => !("roles" in t) || (user?.role && (t.roles as readonly string[]).includes(user.role))).map((t) => {
            const href = t.slug ? `/projects/${id}/${t.slug}` : `/projects/${id}`;
            const active = t.slug
              ? path.endsWith(`/${t.slug}`)
              : path === `/projects/${id}` || path === `/projects/${id}/`;
            return (
              <Link
                key={t.slug || "overview"}
                href={href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}

function participationLabel(p: any): string | null {
  if (!p) return null;
  if (p.mode === "individual") return "Individual";
  return p.group?.name ? `Group: ${p.group.name}` : "Group";
}

function ProjectStatusBadge({
  displayStatus, myStatus, role,
}: {
  displayStatus?: "graded" | "not_graded" | "submissions_left";
  myStatus?: "graded" | "not_graded" | "not_submitted" | null;
  role?: string;
}) {
  const key = role === "student" ? (myStatus ?? "not_submitted") : (displayStatus ?? "submissions_left");
  const map: Record<string, { variant: "success" | "default" | "warning"; label: string }> = {
    graded: { variant: "success", label: "Graded" },
    not_graded: { variant: "default", label: "Not graded" },
    submissions_left: { variant: "warning", label: "Submissions left" },
    not_submitted: { variant: "warning", label: "Not submitted" },
  };
  const m = map[key];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
