"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Edit2, ExternalLink, GitBranch, Github, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { getProject, updateSubmission } from "@/lib/api/projects";

export default function GitHubTab() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id),
  });

  const sub = project?.latest_submission;
  const subId = sub?.id;
  const { data, isLoading } = useQuery({
    queryKey: ["github-analysis", subId],
    enabled: !!subId,
    queryFn: async () => {
      const r = await api.get("/ai/github/", { params: { submission: subId } });
      return r.data.results?.[0] ?? null;
    },
  });

  if (projectLoading) return <Skeleton className="h-32" />;
  if (!sub) return <EmptyState icon={GitBranch} title="No submission yet" />;

  return (
    <div className="space-y-4">
      <RepoCard projectId={id} submissionId={sub.id} githubUrl={sub.github_url} />

      {!sub.github_url ? (
        <EmptyState icon={GitBranch} title="No GitHub link on this submission" body="Add one above to enable analysis." />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : !data ? (
        <EmptyState icon={GitBranch} title="Analysis not ready" body="Check back in a moment." />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="Quality score" value={`${data.quality_score}/100`} />
          <Stat label="Commits" value={data.commit_count} />
          <Stat label="Contributors" value={data.contributor_count} />
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Languages</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(data.languages || {}).map(([lang, pct]) => (
                <div key={lang}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{lang}</span><span className="text-muted-foreground">{String(pct)}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Issues</CardTitle></CardHeader>
            <CardContent>
              {(data.issues || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No issues flagged.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.issues.map((i: any, idx: number) => (
                    <li key={idx} className="flex gap-2">
                      <span className={i.severity === "warn" ? "text-amber-500" : "text-muted-foreground"}>●</span>
                      <span>{i.msg}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function RepoCard({
  projectId, submissionId, githubUrl,
}: {
  projectId: number;
  submissionId: number;
  githubUrl: string;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(githubUrl);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setDraft(githubUrl); }, [githubUrl]);

  const mut = useMutation({
    mutationFn: (next: string) => updateSubmission(projectId, submissionId, { github_url: next }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["submissions", projectId] });
      qc.invalidateQueries({ queryKey: ["github-analysis"] });
      setEditing(false);
      setError(null);
    },
    onError: (e: any) => setError(e.response?.data?.detail || "Could not update link"),
  });

  async function copy() {
    if (!githubUrl) return;
    try {
      await navigator.clipboard.writeText(githubUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Github className="h-4 w-4" /> Repository link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {editing ? (
          <form
            onSubmit={(e) => { e.preventDefault(); mut.mutate(draft.trim()); }}
            className="space-y-2"
          >
            <Input
              type="url"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="https://github.com/org/repo"
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setEditing(false); setDraft(githubUrl); setError(null); }}
                disabled={mut.isPending}
              >
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" size="sm" disabled={mut.isPending || draft.trim() === githubUrl}>
                <Check className="h-4 w-4" /> {mut.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        ) : githubUrl ? (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-w-0 flex-1 items-center gap-2 truncate rounded-md border bg-muted/30 px-3 py-2 text-sm font-mono text-foreground transition-colors hover:bg-muted/60"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{githubUrl}</span>
            </a>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit2 className="h-4 w-4" /> Edit
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm italic text-muted-foreground">No GitHub link on this submission.</p>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit2 className="h-4 w-4" /> Add link
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><div className="text-3xl font-semibold">{value}</div></CardContent>
    </Card>
  );
}
