"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, RotateCw } from "lucide-react";
import { api } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { getProject } from "@/lib/api/projects";
import { getSessionUser } from "@/lib/auth/session";

const STATUS_VARIANT: Record<string, "secondary" | "warning" | "success" | "danger"> = {
  pending: "secondary", running: "warning", done: "success", failed: "danger",
};

type Analysis = {
  id: number; kind: "report" | "github"; status: "pending" | "running" | "done" | "failed";
  summary: string; weaknesses: string[]; suggestions: string[]; error: string;
  started_at: string | null; finished_at: string | null;
};

export default function AIFeedbackTab() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const user = getSessionUser();
  const isInstructor = user?.role === "instructor" || user?.role === "admin";

  useEffect(() => {
    if (user && user.role === "student") {
      router.replace(`/projects/${id}`);
    }
  }, [user, id, router]);

  const { data: project } = useQuery({ queryKey: ["project", id], queryFn: () => getProject(id), enabled: isInstructor });
  const subId = project?.latest_submission?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["analyses", subId],
    enabled: !!subId,
    refetchInterval: (q) => {
      const items = (q.state.data as any)?.results ?? [];
      return items.some((a: Analysis) => a.status === "pending" || a.status === "running") ? 3000 : false;
    },
    queryFn: async () => {
      const r = await api.get("/ai/analyses/", { params: { submission: subId } });
      return r.data;
    },
  });

  if (!subId) return <EmptyState icon={Bot} title="No submission yet" />;
  if (isLoading) return <Skeleton className="h-64" />;

  // Keep only the latest analysis per kind so old failed retries don't surface.
  const all: Analysis[] = data?.results ?? [];
  const latestByKind = new Map<string, Analysis>();
  for (const a of all) if (!latestByKind.has(a.kind)) latestByKind.set(a.kind, a);
  const items = Array.from(latestByKind.values());

  if (items.length === 0) return <EmptyState icon={Bot} title="No AI analyses yet" />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((a) => (
        <AnalysisCard key={a.id} analysis={a} submissionId={subId} canRetry={isInstructor} />
      ))}
    </div>
  );
}

function AnalysisCard({
  analysis: a, submissionId, canRetry,
}: { analysis: Analysis; submissionId: number; canRetry: boolean }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const retry = useMutation({
    mutationFn: async () => {
      const url = a.kind === "github" ? "/ai/github/analyze/" : "/ai/report/analyze/";
      await api.post(url, { submission_id: submissionId });
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["analyses", submissionId] });
      qc.invalidateQueries({ queryKey: ["github-analysis", submissionId] });
    },
    onError: (e: any) => setError(e?.response?.data?.detail || "Could not re-run analysis"),
  });

  const inProgress = a.status === "pending" || a.status === "running";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="capitalize">{a.kind} analysis</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[a.status] ?? "secondary"} className="capitalize">{a.status}</Badge>
            {canRetry && !inProgress && (
              <Button
                variant="ghost" size="sm"
                onClick={() => retry.mutate()}
                disabled={retry.isPending}
                title="Re-run analysis"
              >
                <RotateCw className={`h-4 w-4 ${retry.isPending ? "animate-spin" : ""}`} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {inProgress && <p className="text-muted-foreground">Working on it…</p>}
        {a.status === "failed" && (
          <>
            <p className="text-destructive">{a.error || "Analysis failed."}</p>
            {canRetry && (
              <Button variant="outline" size="sm" onClick={() => retry.mutate()} disabled={retry.isPending}>
                <RotateCw className={`h-4 w-4 ${retry.isPending ? "animate-spin" : ""}`} />
                {retry.isPending ? "Re-running…" : "Re-run analysis"}
              </Button>
            )}
          </>
        )}
        {a.status === "done" && (
          <>
            <p className="text-muted-foreground">{a.summary}</p>
            {a.weaknesses?.length > 0 && (
              <Section title="Weaknesses" items={a.weaknesses} dot="bg-destructive" />
            )}
            {a.suggestions?.length > 0 && (
              <Section title="Suggestions" items={a.suggestions} dot="bg-emerald-500" />
            )}
          </>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function Section({ title, items, dot }: { title: string; items: string[]; dot: string }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
