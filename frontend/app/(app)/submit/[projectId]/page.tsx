"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileUp, GitBranch, Sparkles, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createSubmission, getMyParticipation, getProject } from "@/lib/api/projects";
import { getSessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "report", label: "Upload report", icon: FileUp },
  { key: "github", label: "GitHub repo", icon: GitBranch },
  { key: "review", label: "Review & submit", icon: Sparkles },
] as const;

export default function SubmitPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params.projectId);
  const router = useRouter();
  const qc = useQueryClient();
  const user = getSessionUser();

  useEffect(() => {
    if (user && user.role !== "student") {
      router.replace(`/projects/${projectId}`);
    }
  }, [user, projectId, router]);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
  });

  const { data: participation, isLoading: participationLoading } = useQuery({
    queryKey: ["participation", projectId],
    queryFn: () => getMyParticipation(projectId),
  });

  useEffect(() => {
    if (!participationLoading && participation === null) {
      router.replace(`/projects/${projectId}`);
    }
  }, [participation, participationLoading, projectId, router]);

  const previous = project?.latest_submission;
  const isUpdate = Boolean(previous);

  const [step, setStep] = useState(0);
  const [report, setReport] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (!previous || prefilled) return;
    setGithubUrl(previous.github_url ?? "");
    setNotes(previous.notes ?? "");
    setPrefilled(true);
  }, [previous, prefilled]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      if (report) fd.append("report_file", report);
      fd.append("github_url", githubUrl);
      fd.append("notes", notes);
      await createSubmission(projectId, fd);
      qc.invalidateQueries({ queryKey: ["submissions", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
      router.push(`/projects/${projectId}/submissions`);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (projectLoading || participationLoading || !participation) return <Skeleton className="h-64" />;

  const modeLabel = participation.mode === "individual"
    ? "Individual"
    : `Group: ${participation.group?.name ?? "—"}`;
  const ModeIcon = participation.mode === "individual" ? User : Users;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">{isUpdate ? "Update submission" : "New submission"}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {isUpdate
          ? "Saving will replace your current submission with the new content. We'll re-run analysis."
          : "Three quick steps. We'll auto-analyze your report and repo."}
      </p>

      <div className="mb-6 inline-flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm">
        <ModeIcon className="h-4 w-4 text-muted-foreground" />
        <span>Submitting as <span className="font-medium">{modeLabel}</span></span>
      </div>

      <ol className="mb-8 flex items-center justify-between">
        {STEPS.map((s, i) => {
          const Icon = i < step ? Check : s.icon;
          return (
            <li key={s.key} className="flex flex-1 items-center">
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                i <= step ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <span className={cn("ml-2 hidden text-sm sm:inline", i === step ? "font-medium" : "text-muted-foreground")}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <div className="mx-3 h-px flex-1 bg-border" />}
            </li>
          );
        })}
      </ol>

      <Card>
        <CardHeader><CardTitle>{STEPS[step].label}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <div className="space-y-2">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed py-12 text-sm text-muted-foreground hover:border-primary/40 hover:bg-muted/30">
                <FileUp className="h-6 w-6" />
                <span>{report ? report.name : "Click to upload PDF, DOCX, TXT, or MD"}</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md"
                  className="hidden"
                  onChange={(e) => setReport(e.target.files?.[0] ?? null)}
                />
              </label>
              {isUpdate && previous?.report_file && !report && (
                <p className="text-xs text-muted-foreground">
                  Currently uploaded: <a href={previous.report_file} target="_blank" rel="noreferrer" className="text-primary hover:underline">{previous.report_file.split("/").pop()}</a>. Pick a new file to replace it, or skip to keep the existing one.
                </p>
              )}
            </div>
          )}
          {step === 1 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">GitHub repository URL</label>
              <Input
                placeholder="https://github.com/user/repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
              />
              <p className="mt-2 text-xs text-muted-foreground">Public repo. We'll clone it and run analysis.</p>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3 text-sm">
              <Row label="Submit as" value={modeLabel} />
              <Row label="Report" value={report?.name ?? (isUpdate && previous?.report_file ? "(keeping existing)" : "—")} />
              <Row label="GitHub" value={githubUrl || "—"} />
              <div>
                <label className="mb-1.5 block text-sm font-medium">Notes (optional)</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to flag for the instructor?" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={
              (step === 0 && !report && !(isUpdate && previous?.report_file)) ||
              (step === 1 && !githubUrl)
            }
          >
            Continue
          </Button>
        ) : (
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : isUpdate ? "Update submission" : "Submit"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
