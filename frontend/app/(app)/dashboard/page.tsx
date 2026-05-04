"use client";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Inbox, FolderKanban, GraduationCap } from "lucide-react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { listInbox, listProjects, type InboxItem, type ProjectListItem } from "@/lib/api/projects";
import { listEnrolledCourses, type Course } from "@/lib/api/groups";
import { getSessionUser } from "@/lib/auth/session";
import { formatRelative } from "@/lib/utils";

const COLORS = { active: "#3b82f6", submitted: "#eab308", graded: "#22c55e", draft: "#94a3b8" };

export default function DashboardPage() {
  const user = getSessionUser();
  const router = useRouter();
  const isStudent = user?.role === "student";
  const isInstructor = user?.role === "instructor";

  useEffect(() => {
    if (user?.role === "admin") router.replace("/admin");
  }, [user, router]);

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });

  const { data: enrolled, isLoading: enrolledLoading } = useQuery({
    queryKey: ["enrolled-courses"],
    queryFn: listEnrolledCourses,
    enabled: isStudent,
  });

  const { data: inbox, isLoading: inboxLoading } = useQuery({
    queryKey: ["inbox"],
    queryFn: () => listInbox(),
    enabled: isInstructor,
  });

  const projectsList = projects ?? [];
  const isStudentView = isStudent;
  const isGraded = (p: ProjectListItem) => isStudentView ? p.my_status === "graded" : p.display_status === "graded";
  const active = projectsList.filter((p) => !isGraded(p));
  const graded = projectsList.filter((p) => isGraded(p));

  const enrolledCount = enrolled?.length ?? 0;

  const activeBreakdown = useMemo(() => {
    if (isStudentView) {
      return [
        { name: "Not submitted", value: projectsList.filter((p) => p.my_status === "not_submitted").length, color: COLORS.submitted },
        { name: "Not graded", value: projectsList.filter((p) => p.my_status === "not_graded").length, color: COLORS.active },
        { name: "Graded", value: projectsList.filter((p) => p.my_status === "graded").length, color: COLORS.graded },
      ];
    }
    return [
      { name: "Submissions left", value: projectsList.filter((p) => p.display_status === "submissions_left").length, color: COLORS.submitted },
      { name: "Not graded", value: projectsList.filter((p) => p.display_status === "not_graded").length, color: COLORS.active },
      { name: "Graded", value: projectsList.filter((p) => p.display_status === "graded").length, color: COLORS.graded },
    ];
  }, [projectsList, isStudentView]);

  const gradedTrend = useMemo(() => buildMonthlyTrend(graded, "updated_at"), [graded]);
  const totalTrend = useMemo(() => buildMonthlyTrend(projectsList, "created_at"), [projectsList]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {user?.full_name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here's what's happening across your projects.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat
          title="Active projects"
          value={active.length}
          loading={projectsLoading}
          chart={<MiniBars data={activeBreakdown} />}
        />
        <Stat
          title="Graded"
          value={graded.length}
          loading={projectsLoading}
          chart={<MiniArea data={gradedTrend} color={COLORS.graded} />}
        />
        <Stat
          title="Total"
          value={projects?.length ?? 0}
          loading={projectsLoading}
          chart={<MiniArea data={totalTrend} color={COLORS.active} />}
        />
      </div>

      {isStudent && (
        <EnrolledSection enrolled={enrolled} loading={enrolledLoading} />
      )}

      {isInstructor && (
        <InboxSection inbox={inbox} loading={inboxLoading} />
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projects</h2>
          {isInstructor && <CreateProjectDialog />}
        </div>

        {isStudent && enrolledCount === 0 && !enrolledLoading ? (
          <EmptyState
            icon={GraduationCap}
            title="Enroll in a course to see projects"
            body="Open the Courses page and enroll in a course to see its assignments."
            action={<Button asChild variant="outline"><Link href="/courses">Browse courses</Link></Button>}
          />
        ) : projectsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
          </div>
        ) : (projects ?? []).length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            body={isStudent
              ? "Your instructor hasn't posted any assignments yet."
              : "Create a project for one of your courses."}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects!.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function InboxSection({ inbox, loading }: { inbox: InboxItem[] | undefined; loading: boolean }) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Submissions to grade</h2>
        <Button asChild size="sm" variant="outline"><Link href="/inbox">View all</Link></Button>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : !inbox || inbox.length === 0 ? (
        <Card className="flex h-20 items-center justify-center border-dashed bg-muted/20 text-sm text-muted-foreground">
          All caught up! No pending submissions.
        </Card>
      ) : (
        <Card className="divide-y overflow-hidden">
          {inbox.slice(0, 5).map((s) => (
            <Link
              key={s.id}
              href={`/projects/${s.project_id}`}
              className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
            >
              <div>
                <div className="text-sm font-medium">{s.project_title}</div>
                <div className="text-xs text-muted-foreground">
                  {s.student_name}
                  {s.is_individual ? " · Individual" : s.group_name ? ` · ${s.group_name}` : ""}
                  {" · "}
                  {s.course_code}
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {formatRelative(s.submitted_at)}
              </div>
            </Link>
          ))}
        </Card>
      )}
    </section>
  );
}

function EnrolledSection({ enrolled, loading }: { enrolled: Course[] | undefined; loading: boolean }) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your courses</h2>
        <Button asChild size="sm" variant="outline"><Link href="/courses">Browse all courses</Link></Button>
      </div>
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : !enrolled || enrolled.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You aren't enrolled in any course yet. Open <Link href="/courses" className="underline">Courses</Link> and click Enroll.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {enrolled.map((c) => (
            <Link key={c.id} href={`/courses/${c.id}#projects`}>
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{c.code} — {c.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {c.term}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({
  title, value, loading, chart,
}: {
  title: string;
  value: number;
  loading?: boolean;
  chart?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        {loading
          ? <Skeleton className="h-8 w-12" />
          : <div className="text-3xl font-semibold">{value}</div>}
        {!loading && chart && <div className="mt-3 h-12">{chart}</div>}
      </CardContent>
    </Card>
  );
}

function buildMonthlyTrend(items: ProjectListItem[], field: "created_at" | "updated_at") {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, 0);
  }
  for (const p of items) {
    const d = new Date(p[field]);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets, ([month, count]) => ({ month, count }));
}

function MiniArea({ data, color }: { data: Array<{ month: string; count: number }>; color: string }) {
  const empty = data.every((d) => d.count === 0);
  if (empty) return <div className="flex h-full items-center text-[10px] text-muted-foreground">No data yet</div>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip
          cursor={false}
          contentStyle={{ borderRadius: 6, fontSize: 11, padding: "4px 8px" }}
          formatter={(v) => [`${v}`, "projects"]}
          labelFormatter={(l) => String(l)}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke={color}
          strokeWidth={1.75}
          fill={`url(#grad-${color.replace("#", "")})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MiniBars({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  const empty = data.every((d) => d.value === 0);
  if (empty) return <div className="flex h-full items-center text-[10px] text-muted-foreground">No active projects</div>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Tooltip
          cursor={false}
          contentStyle={{ borderRadius: 6, fontSize: 11, padding: "4px 8px" }}
          formatter={(v, _n, p) => [`${v}`, (p?.payload as { name?: string })?.name ?? ""]}
          labelFormatter={() => ""}
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
