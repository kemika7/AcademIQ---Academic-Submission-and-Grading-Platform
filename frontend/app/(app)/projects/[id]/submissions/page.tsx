"use client";
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Github, MessageSquare, Sparkles, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { listSubmissions } from "@/lib/api/projects";
import { createPeerReview, listPeerReviews } from "@/lib/api/reviews";
import { formatRelative } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth/session";

export default function SubmissionsTab() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const search = useSearchParams();
  const submitterParam = search.get("submitter"); // "group:<id>" | "user:<id>"

  const { data, isLoading } = useQuery({
    queryKey: ["submissions", id],
    queryFn: () => listSubmissions(id),
  });

  const filtered = useMemo(() => {
    if (!data || !submitterParam) return data ?? [];
    const [kind, rawId] = submitterParam.split(":");
    const fid = Number(rawId);
    if (!fid) return data;
    return (data as any[]).filter((s) =>
      kind === "group" ? s.group === fid : s.submitted_by?.id === fid,
    );
  }, [data, submitterParam]);

  const filterLabel = useMemo(() => {
    if (!submitterParam || !filtered?.length) return null;
    const s: any = filtered[0];
    return s.is_individual
      ? s.submitted_by?.full_name ?? "this student"
      : s.group_name ?? "this group";
  }, [filtered, submitterParam]);

  if (isLoading) return <Skeleton className="h-40" />;

  if (!filtered || filtered.length === 0) {
    return submitterParam ? (
      <EmptyState
        icon={FileText}
        title="No submissions for this filter"
        body="Try removing the filter to see all submissions."
        action={<Button asChild variant="outline"><Link href={`/projects/${id}/submissions`}>Clear filter</Link></Button>}
      />
    ) : (
      <EmptyState icon={FileText} title="No submissions yet" body="Submit a report and GitHub link to start." />
    );
  }

  const latest = filtered[0];

  return (
    <div className="space-y-4">
      {filterLabel && (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span>
            Showing submissions from <span className="font-semibold">{filterLabel}</span>
          </span>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/projects/${id}/submissions`}>
              <X className="h-3.5 w-3.5" /> Clear
            </Link>
          </Button>
        </div>
      )}

      {filtered.map((s: any, idx: number) => (
        <SubmissionVersion key={s.id} sub={s} isLatest={idx === 0} />
      ))}

      <PeerReviewSection submissionId={latest.id} />
    </div>
  );
}

function SubmissionVersion({ sub }: { sub: any; isLatest: boolean }) {
  const fileName = sub.report_file
    ? decodeURIComponent(String(sub.report_file).split("/").pop() ?? "report")
    : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Submission</CardTitle>
            {sub.is_individual
              ? <Badge variant="secondary">Individual</Badge>
              : sub.group_name
                ? <Badge variant="secondary">{sub.group_name}</Badge>
                : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            by {sub.submitted_by?.full_name ?? "—"} · {formatRelative(sub.submitted_at)}
          </p>
        </div>
        {typeof sub.github_quality === "number" && (
          <Badge variant="success">GitHub quality {sub.github_quality.toFixed(1)}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {sub.notes ? (
          <div className="flex gap-2 rounded-md bg-muted/40 p-3">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="whitespace-pre-wrap text-sm text-foreground/90">{sub.notes}</p>
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">No message left with this submission.</p>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {sub.report_file ? (
            <a
              href={sub.report_file}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-md border p-3 text-sm transition-colors hover:bg-muted/40"
            >
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{fileName}</div>
                <div className="text-xs text-muted-foreground">Report file · click to open</div>
              </div>
              <Download className="h-4 w-4 text-muted-foreground" />
            </a>
          ) : (
            <div className="flex items-center gap-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <FileText className="h-5 w-5 shrink-0 opacity-40" /> No report file
            </div>
          )}

          {sub.github_url ? (
            <a
              href={sub.github_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-md border p-3 text-sm transition-colors hover:bg-muted/40"
            >
              <Github className="h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{sub.github_url}</div>
                <div className="text-xs text-muted-foreground">GitHub repository</div>
              </div>
            </a>
          ) : (
            <div className="flex items-center gap-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <Github className="h-5 w-5 shrink-0 opacity-40" /> No GitHub link
            </div>
          )}
        </div>

        {sub.ai_summary && (
          <div className="flex gap-2 rounded-md border border-primary/20 bg-primary/5 p-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-primary">AI summary</div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{sub.ai_summary}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PeerReviewSection({ submissionId }: { submissionId: number }) {
  const user = getSessionUser();
  const isStudent = user?.role === "student";
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["peer-reviews", submissionId],
    queryFn: () => listPeerReviews(submissionId),
  });

  const [rating, setRating] = useState(4);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => createPeerReview(submissionId, { rating, comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["peer-reviews", submissionId] });
      setComment("");
      setRating(4);
      setError(null);
    },
    onError: (e: any) => {
      const detail = e.response?.data;
      setError(typeof detail === "string"
        ? detail
        : detail?.detail ?? Object.values(detail ?? {}).flat().join(" ") ?? "Could not save review");
    },
  });

  const myReview = data?.find((r) => r.reviewer === user?.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" /> Peer reviews
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-16" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No peer reviews yet.</p>
        ) : (
          <ul className="divide-y">
            {data.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <div className="flex items-center gap-1 text-sm">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${i < r.rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-sm">{r.comment}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-muted-foreground">{formatRelative(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}

        {isStudent && !myReview && (
          <form
            onSubmit={(e) => { e.preventDefault(); if (comment.trim()) mut.mutate(); }}
            className="space-y-2 rounded-md border p-3"
          >
            <p className="text-sm font-medium">Leave a peer review</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="rounded p-0.5 hover:bg-muted"
                  aria-label={`${n} stars`}
                >
                  <Star className={`h-5 w-5 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            <Textarea
              required rows={3} value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What worked well? What could improve?"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={mut.isPending || !comment.trim()}>
                {mut.isPending ? "Posting…" : "Post review"}
              </Button>
            </div>
          </form>
        )}
        {isStudent && myReview && (
          <p className="text-xs text-muted-foreground">You already reviewed this submission.</p>
        )}
      </CardContent>
    </Card>
  );
}
