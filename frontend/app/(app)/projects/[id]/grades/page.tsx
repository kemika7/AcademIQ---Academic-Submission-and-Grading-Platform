"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, GraduationCap, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { getProject } from "@/lib/api/projects";
import { getGroup } from "@/lib/api/groups";
import {
  createGrade, createRubric, getGrades, listRubrics, type Grade, type Rubric,
} from "@/lib/api/reviews";
import { getSessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const DEFAULT_CRITERIA = [
  { label: "Code quality", description: "", weight: 1, max_score: 10, order: 0 },
  { label: "Functionality", description: "", weight: 1, max_score: 10, order: 1 },
  { label: "Documentation", description: "", weight: 1, max_score: 10, order: 2 },
];

type Student = { id: number; full_name: string };

export default function GradesTab() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const user = getSessionUser();
  const isInstructor = user?.role === "instructor" || user?.role === "admin";

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
  });
  const subId: number | undefined = project?.latest_submission?.id;
  const courseId: number | undefined = project?.course?.id;

  const grades = useQuery({
    queryKey: ["grades", subId],
    enabled: !!subId,
    queryFn: () => getGrades(subId!),
    retry: false,
  });

  const submissionGroupId: number | undefined = project?.latest_submission?.group ?? undefined;
  const submissionGroup = useQuery({
    queryKey: ["group", submissionGroupId],
    queryFn: () => getGroup(submissionGroupId!),
    enabled: !!submissionGroupId,
  });

  if (projectLoading) return <Skeleton className="h-40" />;
  if (!subId) return <EmptyState icon={GraduationCap} title="No submission yet" body="Grade becomes available after a submission." />;

  const sub = project.latest_submission;
  const students: Student[] = sub.is_individual
    ? sub.submitted_by ? [sub.submitted_by] : []
    : (submissionGroup.data?.memberships ?? []).map((m: any) => ({ id: m.user.id, full_name: m.user.full_name }));

  const gradesByStudent = new Map<number, Grade>();
  (grades.data ?? []).forEach((g) => { if (g.student) gradesByStudent.set(g.student, g); });

  if (grades.isLoading) return <Skeleton className="h-40" />;

  if (!isInstructor) {
    if (grades.data && grades.data.length > 0) {
      return <StudentGradeView grades={grades.data} />;
    }
    return <EmptyState icon={GraduationCap} title="Not graded yet" body="An instructor will grade this submission soon." />;
  }

  return (
    <InstructorGradeView
      submissionId={subId}
      courseId={courseId}
      students={students}
      gradesByStudent={gradesByStudent}
      isGroup={!sub.is_individual}
    />
  );
}

function InstructorGradeView({
  submissionId, courseId, students, gradesByStudent, isGroup,
}: {
  submissionId: number;
  courseId?: number;
  students: Student[];
  gradesByStudent: Map<number, Grade>;
  isGroup: boolean;
}) {
  if (students.length === 0) {
    return <EmptyState icon={User} title="No students to grade" body="The submission has no associated student." />;
  }
  return (
    <GradingFlow
      submissionId={submissionId}
      courseId={courseId}
      students={students}
      gradesByStudent={gradesByStudent}
      isGroup={isGroup}
    />
  );
}

function GradingFlow({
  submissionId, courseId, students, gradesByStudent, isGroup,
}: {
  submissionId: number;
  courseId?: number;
  students: Student[];
  gradesByStudent: Map<number, Grade>;
  isGroup: boolean;
}) {
  const qc = useQueryClient();
  const { data: rubrics, isLoading } = useQuery({
    queryKey: ["rubrics", courseId],
    queryFn: () => listRubrics(courseId ? { course: courseId, is_active: true } : { is_active: true }),
  });

  // Silently create a default rubric if the course doesn't have one.
  const autoCreatedRef = useRef(false);
  useEffect(() => {
    if (!courseId || isLoading || !rubrics || rubrics.length > 0 || autoCreatedRef.current) return;
    autoCreatedRef.current = true;
    createRubric({ course: courseId, name: "Default rubric", criteria: DEFAULT_CRITERIA })
      .then(() => qc.invalidateQueries({ queryKey: ["rubrics", courseId] }))
      .catch(() => { autoCreatedRef.current = false; });
  }, [courseId, rubrics, isLoading, qc]);

  const [step, setStep] = useState<1 | 2>(1);
  const [rubricId, setRubricId] = useState<number | null>(null);
  // Step 1 — work scores per criterion: { [criterionId]: { score, comment } }
  const [workScores, setWorkScores] = useState<Record<number, { score: string; comment: string }>>({});

  const rubric: Rubric | undefined = useMemo(
    () => (rubrics ?? []).find((r) => r.id === rubricId),
    [rubrics, rubricId],
  );

  useEffect(() => {
    if (!rubricId && rubrics && rubrics.length > 0) setRubricId(rubrics[0].id);
  }, [rubrics, rubricId]);

  useEffect(() => {
    if (!rubric) return;
    setWorkScores((prev) => {
      const next: Record<number, { score: string; comment: string }> = {};
      rubric.criteria.forEach((c) => { next[c.id] = prev[c.id] ?? { score: "", comment: "" }; });
      return next;
    });
  }, [rubric]);

  const projectedTotal = useMemo(() => projectTotal(rubric, workScores), [rubric, workScores]);

  const allCriteriaScored = useMemo(() => {
    if (!rubric) return false;
    return rubric.criteria.every((c) => workScores[c.id]?.score !== "" && workScores[c.id]?.score !== undefined);
  }, [rubric, workScores]);

  if (isLoading) return <Skeleton className="h-60" />;
  // Rubric is being auto-created if missing — show skeleton during that brief gap.
  if (!rubrics || rubrics.length === 0) return <Skeleton className="h-60" />;

  return (
    <div className="space-y-4">
      <StepHeader step={step} setStep={setStep} canAdvance={allCriteriaScored} />

      {step === 1 ? (
        <WorkStep
          rubrics={rubrics}
          rubric={rubric}
          rubricId={rubricId}
          setRubricId={setRubricId}
          scores={workScores}
          setScores={setWorkScores}
          projectedTotal={projectedTotal}
          onNext={() => setStep(2)}
          isGroup={isGroup}
        />
      ) : (
        <StudentsStep
          submissionId={submissionId}
          rubric={rubric!}
          workScores={workScores}
          projectedTotal={projectedTotal}
          students={students}
          gradesByStudent={gradesByStudent}
          isGroup={isGroup}
          onBack={() => setStep(1)}
        />
      )}
    </div>
  );
}

function StepHeader({
  step, setStep, canAdvance,
}: { step: 1 | 2; setStep: (s: 1 | 2) => void; canAdvance: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <StepPill n={1} label="Grade the work" active={step === 1} done={step === 2} onClick={() => setStep(1)} />
      <div className="h-px flex-1 bg-border" />
      <StepPill n={2} label="Grade the students" active={step === 2} done={false} disabled={!canAdvance} onClick={() => canAdvance && setStep(2)} />
    </div>
  );
}

function StepPill({
  n, label, active, done, disabled, onClick,
}: {
  n: number; label: string; active: boolean; done: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors",
        active && "bg-primary text-primary-foreground",
        !active && done && "bg-emerald-500/10 text-emerald-600",
        !active && !done && !disabled && "hover:bg-muted",
        disabled && "opacity-50",
      )}
    >
      <span className={cn(
        "flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold",
        active ? "bg-primary-foreground/20" : done ? "bg-emerald-500/20" : "bg-muted",
      )}>{done ? <Check className="h-3 w-3" /> : n}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

function WorkStep({
  rubrics, rubric, rubricId, setRubricId, scores, setScores, projectedTotal, onNext, isGroup,
}: {
  rubrics: Rubric[];
  rubric: Rubric | undefined;
  rubricId: number | null;
  setRubricId: (n: number) => void;
  scores: Record<number, { score: string; comment: string }>;
  setScores: (s: Record<number, { score: string; comment: string }>) => void;
  projectedTotal: number;
  onNext: () => void;
  isGroup: boolean;
}) {
  const allScored = rubric ? rubric.criteria.every((c) => scores[c.id]?.score !== "" && scores[c.id]?.score !== undefined) : false;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grade the project work</CardTitle>
          <p className="text-xs text-muted-foreground">
            Score each criterion. {isGroup ? "These scores apply to the group's submission as a whole." : "These scores apply to the submission."}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {rubrics.length > 1 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Rubric</label>
              <select
                value={rubricId ?? ""}
                onChange={(e) => setRubricId(Number(e.target.value))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {rubrics.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}

          {rubric?.criteria.map((c) => (
            <CriterionRow
              key={c.id}
              criterion={c}
              value={scores[c.id]?.score ?? ""}
              comment={scores[c.id]?.comment ?? ""}
              onScore={(v) => setScores({ ...scores, [c.id]: { ...scores[c.id], score: v, comment: scores[c.id]?.comment ?? "" } })}
              onComment={(v) => setScores({ ...scores, [c.id]: { ...scores[c.id], score: scores[c.id]?.score ?? "", comment: v } })}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="self-start">
        <CardHeader>
          <CardTitle className="text-base">Work summary</CardTitle>
          <p className="text-xs text-muted-foreground">Live total. Move on to grade {isGroup ? "each member" : "the student"} when this looks right.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Projected work total</div>
            <div className="mt-1 text-4xl font-semibold tracking-tight">
              {projectedTotal}<span className="text-base text-muted-foreground">/100</span>
            </div>
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={!allScored}
            onClick={onNext}
          >
            Next: grade {isGroup ? "members" : "student"} →
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StudentsStep({
  submissionId, rubric, workScores, projectedTotal, students, gradesByStudent, isGroup, onBack,
}: {
  submissionId: number;
  rubric: Rubric;
  workScores: Record<number, { score: string; comment: string }>;
  projectedTotal: number;
  students: Student[];
  gradesByStudent: Map<number, Grade>;
  isGroup: boolean;
  onBack: () => void;
}) {
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    const ungraded = students.find((s) => !gradesByStudent.has(s.id));
    setActiveId(ungraded?.id ?? students[0]?.id ?? null);
  }, [students, gradesByStudent]);

  const active = students.find((s) => s.id === activeId) ?? null;
  const activeGrade = active ? gradesByStudent.get(active.id) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="self-start">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">{isGroup ? "Group members" : "Student"}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {gradesByStudent.size}/{students.length} graded
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            ← Work
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 p-2">
          {students.map((s) => {
            const g = gradesByStudent.get(s.id);
            const isActive = s.id === activeId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveId(s.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <span className="truncate">{s.full_name}</span>
                {g ? (
                  <Badge variant={isActive ? "secondary" : "success"} className={cn(isActive && "bg-primary-foreground/20 text-primary-foreground border-transparent")}>
                    <Check className="h-3 w-3" /> {Number(g.total_score).toFixed(1)}
                  </Badge>
                ) : (
                  <span className={cn("text-xs", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    pending
                  </span>
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div>
        {active ? (
          activeGrade ? (
            <StudentGradeView grades={[activeGrade]} />
          ) : (
            <PerStudentForm
              submissionId={submissionId}
              rubric={rubric}
              baseScores={workScores}
              baseTotal={projectedTotal}
              student={active}
              isGroup={isGroup}
            />
          )
        ) : null}
      </div>
    </div>
  );
}

function PerStudentForm({
  submissionId, rubric, baseScores, baseTotal, student, isGroup,
}: {
  submissionId: number;
  rubric: Rubric;
  baseScores: Record<number, { score: string; comment: string }>;
  baseTotal: number;
  student: Student;
  isGroup: boolean;
}) {
  const qc = useQueryClient();
  const [scores, setScores] = useState<Record<number, { score: string; comment: string }>>({});
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset to base scores on student change.
  useEffect(() => {
    const next: Record<number, { score: string; comment: string }> = {};
    rubric.criteria.forEach((c) => { next[c.id] = { ...baseScores[c.id] }; });
    setScores(next);
    setFeedback("");
    setError(null);
  }, [student.id, rubric, baseScores]);

  const projectedTotal = useMemo(() => projectTotal(rubric, scores), [rubric, scores]);

  const mut = useMutation({
    mutationFn: () => createGrade(submissionId, {
      rubric: rubric.id,
      student: student.id,
      feedback,
      scores: rubric.criteria.map((c) => ({
        criterion: c.id,
        score: Number(scores[c.id]?.score || 0),
        comment: scores[c.id]?.comment || "",
      })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grades", submissionId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
      setError(null);
    },
    onError: (e: any) => {
      const detail = e.response?.data;
      setError(typeof detail === "string"
        ? detail
        : detail?.detail
          ?? Object.entries(detail ?? {}).map(([k, v]) => `${k}: ${(v as any).toString()}`).join("; ")
          ?? "Could not save grade");
    },
  });

  const adjusted = !isGroup && projectedTotal !== baseTotal;

  if (isGroup) {
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{student.full_name}</CardTitle>
            <p className="text-xs text-muted-foreground">
              The group's work score applies to every member. Add personal feedback for {student.full_name.split(" ")[0]} below.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Group work total</div>
              <div className="mt-1 text-4xl font-semibold tracking-tight">
                {baseTotal}<span className="text-base text-muted-foreground">/100</span>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Personal feedback</label>
              <Textarea
                rows={6}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={`A note for ${student.full_name.split(" ")[0]} only.`}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={mut.isPending}>
              {mut.isPending ? "Saving…" : `Save grade for ${student.full_name.split(" ")[0]}`}
            </Button>
          </CardContent>
        </Card>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
      className="grid gap-4 lg:grid-cols-2"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{student.full_name}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Pre-filled from the work scores. Adjust if this student deserves a different score on any criterion.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {rubric.criteria.map((c) => (
            <CriterionRow
              key={c.id}
              criterion={c}
              value={scores[c.id]?.score ?? ""}
              comment={scores[c.id]?.comment ?? ""}
              onScore={(v) => setScores({ ...scores, [c.id]: { ...scores[c.id], score: v, comment: scores[c.id]?.comment ?? "" } })}
              onComment={(v) => setScores({ ...scores, [c.id]: { ...scores[c.id], score: scores[c.id]?.score ?? "", comment: v } })}
              hint={baseScores[c.id]?.score ? `work: ${baseScores[c.id]?.score}` : undefined}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="self-start">
        <CardHeader>
          <CardTitle className="text-base">Personal feedback</CardTitle>
          <p className="text-xs text-muted-foreground">A note for {student.full_name.split(" ")[0]} only.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {adjusted ? "Adjusted total" : "Total"}
            </div>
            <div className="mt-1 text-4xl font-semibold tracking-tight">
              {projectedTotal}<span className="text-base text-muted-foreground">/100</span>
            </div>
            {adjusted && (
              <div className="mt-1 text-xs text-muted-foreground">
                work total was {baseTotal}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Feedback</label>
            <Textarea
              rows={6}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Strengths, weaknesses, action items…"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={mut.isPending}>
            {mut.isPending ? "Saving…" : `Save grade for ${student.full_name.split(" ")[0]}`}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

function CriterionRow({
  criterion: c, value, comment, onScore, onComment, hint,
}: {
  criterion: Rubric["criteria"][number];
  value: string;
  comment: string;
  onScore: (v: string) => void;
  onComment: (v: string) => void;
  hint?: string;
}) {
  const max = Number(c.max_score);
  const useButtons = max <= 10;
  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{c.label}</div>
          {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
        </div>
        <div className="whitespace-nowrap text-xs text-muted-foreground">
          weight {Number(c.weight)} · max {max}
        </div>
      </div>
      {useButtons ? (
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: max + 1 }, (_, i) => i).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onScore(String(n))}
              className={cn(
                "h-9 min-w-9 rounded-md border px-2 text-sm font-medium transition-colors",
                Number(value) === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
              aria-label={`Score ${n} of ${max}`}
            >
              {n}
            </button>
          ))}
        </div>
      ) : (
        <Input
          type="number"
          step="0.5"
          min={0}
          max={max}
          placeholder={`/${max}`}
          value={value}
          onChange={(e) => onScore(e.target.value)}
          required
        />
      )}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      <Input
        className="mt-2"
        placeholder="Optional comment"
        value={comment}
        onChange={(e) => onComment(e.target.value)}
      />
    </div>
  );
}

function projectTotal(
  rubric: Rubric | undefined,
  scores: Record<number, { score: string; comment: string }>,
): number {
  if (!rubric) return 0;
  const totalWeight = rubric.criteria.reduce((s, c) => s + Number(c.weight), 0) || 1;
  let acc = 0;
  rubric.criteria.forEach((c) => {
    const raw = Number(scores[c.id]?.score);
    if (Number.isFinite(raw)) acc += (raw / Number(c.max_score)) * Number(c.weight);
  });
  return Math.round((acc / totalWeight) * 100 * 100) / 100;
}

function StudentGradeView({ grades }: { grades: Grade[] }) {
  const grade = grades[0];
  const { data: rubric } = useQuery({
    queryKey: ["rubric", grade.rubric],
    queryFn: async () => (await listRubrics()).find((r) => r.id === grade.rubric),
  });
  const labelById = useMemo(() => {
    const m = new Map<number, string>();
    rubric?.criteria.forEach((c) => m.set(c.id, c.label));
    return m;
  }, [rubric]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{grade.student_name ? `${grade.student_name}'s score` : "Total score"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-5xl font-semibold">
            {Number(grade.total_score).toFixed(1)}
            <span className="text-base text-muted-foreground">/100</span>
          </div>
          {grade.feedback && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Feedback</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{grade.feedback}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Per-criterion breakdown</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {grade.scores?.map((s) => (
            <div key={s.id ?? s.criterion}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{labelById.get(s.criterion) ?? `Criterion ${s.criterion}`}</span>
                <span className="text-muted-foreground">{s.score}</span>
              </div>
              {s.comment && <p className="text-xs text-muted-foreground">{s.comment}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

