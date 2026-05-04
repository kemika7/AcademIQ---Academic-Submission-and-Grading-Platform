"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, ArrowDownRight, ArrowUpRight, CheckCircle2, ClipboardCheck,
  Clock, Download, FolderKanban, GraduationCap, Sparkles, Users,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminAnalytics, type AnalyticsRange } from "@/lib/api/admin";
import { getSessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const RANGES: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "This month" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const COLORS = {
  active: "#3b82f6",
  pending: "#eab308",
  graded: "#22c55e",
  archived: "#94a3b8",
  primary: "#6366f1",
};

export default function AdminDashboardPage() {
  const user = getSessionUser();
  const router = useRouter();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [courseId, setCourseId] = useState<number | "">("");

  useEffect(() => {
    if (user && user.role !== "admin") router.replace("/dashboard");
  }, [user, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics", range, courseId],
    queryFn: () => getAdminAnalytics({
      range,
      ...(courseId === "" ? {} : { course: Number(courseId) }),
    }),
  });

  const trendDelta = useMemo(() => {
    const m = data?.insight.match(/(increased|decreased|held steady) by ([\d.]+)%/i);
    if (!m) return null;
    return { dir: m[1].toLowerCase(), pct: m[2] };
  }, [data?.insight]);

  function downloadCsv() {
    if (!data) return;
    const rows: string[][] = [
      ["Section", "Label", "Value"],
      ["Summary", "Active projects", String(data.summary.active_projects)],
      ["Summary", "Graded projects", String(data.summary.graded_projects)],
      ["Summary", "Pending submissions", String(data.summary.pending_submissions)],
      ["Summary", "Total users", String(data.summary.total_users)],
      ["Summary", "Students", String(data.summary.students)],
      ["Summary", "Instructors", String(data.summary.instructors)],
      ...data.project_status.map((s) => ["Project status", s.name, String(s.value)]),
      ...data.submissions_over_time.map((s) => ["Submissions over time", s.date, String(s.count)]),
      ...data.grade_distribution.map((g) => ["Grade distribution", g.range, String(g.count)]),
      ...data.top_groups.map((g) => ["Top groups", g.name, String(g.submissions)]),
      ...data.instructor_activity.map((i) => ["Instructor activity", i.name, String(i.graded)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            System-wide health, submissions, and grading activity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value === "" ? "" : Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All courses</option>
            {data?.courses.map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
            ))}
          </select>
          <div className="flex rounded-md border p-0.5">
            {RANGES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setRange(value)}
                className={cn(
                  "rounded px-3 py-1 text-xs font-medium transition-colors",
                  range === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={!data}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {data?.insight && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-full bg-primary/10 p-2">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 text-sm">{data.insight}</div>
            {trendDelta && (
              <Badge variant={trendDelta.dir === "increased" ? "success" : trendDelta.dir === "decreased" ? "warning" : "secondary"}>
                {trendDelta.dir === "increased" ? <ArrowUpRight className="h-3 w-3" /> : trendDelta.dir === "decreased" ? <ArrowDownRight className="h-3 w-3" /> : null}
                {trendDelta.pct}%
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          icon={GraduationCap}
          label="Courses"
          value={data?.summary.total_courses}
          sub={data ? `${data.summary.total_projects} project${data.summary.total_projects === 1 ? "" : "s"} total` : ""}
          loading={isLoading}
          accent={COLORS.primary}
        />
        <SummaryCard
          icon={FolderKanban}
          label="Active projects"
          value={data?.summary.active_projects}
          sub={data ? `${data.summary.awaiting_grade} awaiting grade · ${data.summary.submissions_left} submissions left` : ""}
          loading={isLoading}
          accent={COLORS.active}
        />
        <SummaryCard
          icon={Clock}
          label="Awaiting grade"
          value={data?.summary.awaiting_grade}
          sub="All students submitted; not all graded yet"
          loading={isLoading}
          accent={COLORS.pending}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Graded projects"
          value={data?.summary.graded_projects}
          sub="Every expected submitter graded"
          loading={isLoading}
          accent={COLORS.graded}
        />
        <SummaryCard
          icon={Users}
          label="Total users"
          value={data?.summary.total_users}
          sub={data ? `${data.summary.students} students · ${data.summary.instructors} instructors` : ""}
          loading={isLoading}
          accent={COLORS.primary}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Project status" subtitle="Distribution by lifecycle stage" className="lg:col-span-1">
          {isLoading || !data ? <Skeleton className="h-64" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.project_status}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {data.project_status.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  formatter={(v, name) => [`${v} projects`, name as string]}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Submissions over time" subtitle="Trend within the selected window" className="lg:col-span-2">
          {isLoading || !data ? <Skeleton className="h-64" /> : data.submissions_over_time.length === 0 ? (
            <EmptyChart message="No submissions in this window." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.submissions_over_time}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(d) => new Date(d).toLocaleDateString()}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={COLORS.primary}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: COLORS.primary }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Grade distribution" subtitle="Number of graded projects per band">
          {isLoading || !data ? <Skeleton className="h-64" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.grade_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill={COLORS.graded} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top active groups" subtitle="By submission count">
          {isLoading || !data ? <Skeleton className="h-64" /> : data.top_groups.length === 0 ? (
            <EmptyChart message="No group submissions yet." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.top_groups} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="submissions" fill={COLORS.active} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      <section>
        <ChartCard title="Instructor activity" subtitle="Number of submissions graded">
          {isLoading || !data ? <Skeleton className="h-64" /> : data.instructor_activity.length === 0 ? (
            <EmptyChart message="No grades recorded yet." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.instructor_activity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="graded" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>
    </div>
  );
}

function SummaryCard({
  icon: Icon, label, value, sub, loading, accent,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number | undefined;
  sub?: string;
  loading: boolean;
  accent: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1.5">
              {loading
                ? <Skeleton className="h-9 w-16" />
                : <div className="text-3xl font-semibold tracking-tight">{value ?? 0}</div>}
            </div>
            {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
          </div>
          <div
            className="rounded-lg p-2"
            style={{ backgroundColor: `${accent}20`, color: accent }}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title, subtitle, children, className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <Activity className="h-6 w-6 opacity-40" />
      {message}
    </div>
  );
}
