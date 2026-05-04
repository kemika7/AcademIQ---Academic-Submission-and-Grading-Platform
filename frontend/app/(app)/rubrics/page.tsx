"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, ChevronDown, ChevronRight, Clock, GraduationCap, ListChecks, Plus, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { createRubric, listRubrics, type Rubric } from "@/lib/api/reviews";
import { listInbox, type InboxItem } from "@/lib/api/projects";
import { listCourses } from "@/lib/api/groups";
import { formatRelative } from "@/lib/utils";

export default function GradingPage() {
  const [pending, graded] = useQueries({
    queries: [
      { queryKey: ["inbox", { status: "submitted" }], queryFn: () => listInbox({ status: "submitted" }) },
      { queryKey: ["inbox", { status: "graded" }], queryFn: () => listInbox({ status: "graded" }) },
    ],
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Grading</h1>
        <p className="text-sm text-muted-foreground">Submissions across your courses, ready to grade.</p>
      </div>

      <SubmissionsSection
        icon={Clock}
        title="Awaiting grade"
        loading={pending.isLoading}
        items={pending.data ?? []}
        emptyTitle="Nothing to grade right now"
        emptyBody="When students submit, their work will show up here."
        ctaLabel="Grade"
      />

      <SubmissionsSection
        icon={CheckCircle2}
        title="Recently graded"
        loading={graded.isLoading}
        items={graded.data ?? []}
        emptyTitle="No graded submissions yet"
        emptyBody="Graded work appears here for quick re-review."
        ctaLabel="Review"
        muted
      />

      <RubricTemplatesSection />
    </div>
  );
}

function SubmissionsSection({
  icon: Icon, title, loading, items, emptyTitle, emptyBody, ctaLabel, muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; loading: boolean; items: InboxItem[];
  emptyTitle: string; emptyBody: string; ctaLabel: string; muted?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4" />
        {title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
          {loading ? "…" : items.length}
        </span>
      </h2>
      {loading ? (
        <Skeleton className="h-32" />
      ) : items.length === 0 ? (
        <EmptyState icon={Icon} title={emptyTitle} body={emptyBody} />
      ) : (
        <Card className="divide-y overflow-hidden">
          {items.map((s) => <SubmissionRow key={s.id} item={s} ctaLabel={ctaLabel} muted={muted} />)}
        </Card>
      )}
    </section>
  );
}

function SubmissionRow({ item, ctaLabel, muted }: { item: InboxItem; ctaLabel: string; muted?: boolean }) {
  return (
    <Link
      href={`/projects/${item.project_id}/grades`}
      className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/50"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{item.project_title}</span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            v{item.version}
          </span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{item.course_code}</span>
          {" · "}
          <span className="text-foreground">{item.student_name}</span>
          {item.is_individual ? " · Individual" : item.group_name ? ` · ${item.group_name}` : ""}
          {" · "}
          {formatRelative(item.submitted_at)}
        </div>
      </div>
      <Button size="sm" variant={muted ? "ghost" : "default"} className="shrink-0">
        <GraduationCap className="h-4 w-4" /> {ctaLabel}
      </Button>
    </Link>
  );
}

function RubricTemplatesSection() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["rubrics"], queryFn: () => listRubrics() });
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <section>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold hover:text-primary"
        >
          <Chevron className="h-4 w-4 text-muted-foreground" />
          <ListChecks className="h-4 w-4" />
          Rubric templates
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
            {isLoading ? "…" : (data?.length ?? 0)}
          </span>
        </button>
        <CreateRubricButton />
      </div>
      {open && (
        <div className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rubrics yet. Create one to grade by criteria with weights.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.map((r) => <RubricCard key={r.id} rubric={r} />)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function RubricCard({ rubric }: { rubric: Rubric }) {
  const totalWeight = rubric.criteria.reduce((s, c) => s + Number(c.weight), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{rubric.name}</span>
          {rubric.is_active && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">active</span>}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{rubric.criteria.length} criteria · total weight {totalWeight}</p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {rubric.criteria.map((c) => (
            <li key={c.id} className="flex items-center justify-between text-sm">
              <span>{c.label}</span>
              <span className="text-xs text-muted-foreground">w {Number(c.weight)} · /{c.max_score}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

type DraftCriterion = { label: string; description: string; weight: string; max_score: string };
const newCriterion = (): DraftCriterion => ({ label: "", description: "", weight: "1", max_score: "10" });

function CreateRubricButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [course, setCourse] = useState<number | "">("");
  const [criteria, setCriteria] = useState<DraftCriterion[]>([newCriterion()]);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: courses } = useQuery({ queryKey: ["courses"], queryFn: listCourses, enabled: open });

  const mut = useMutation({
    mutationFn: () => createRubric({
      course: Number(course),
      name,
      criteria: criteria.map((c, idx) => ({
        label: c.label,
        description: c.description,
        weight: Number(c.weight) || 0,
        max_score: Number(c.max_score) || 10,
        order: idx,
      })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rubrics"] });
      setOpen(false);
      setName("");
      setCourse("");
      setCriteria([newCriterion()]);
      setError(null);
    },
    onError: (e: any) => {
      const detail = e.response?.data;
      setError(typeof detail === "string" ? detail : (detail?.detail || JSON.stringify(detail) || "Could not create rubric"));
    },
  });

  const ready = name && course && criteria.every((c) => c.label && c.weight && c.max_score);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Plus className="h-4 w-4" /> New rubric</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create a rubric</DialogTitle>
          <DialogDescription>Add criteria with weights. Final scores are weighted-averaged out of 100.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (ready) mut.mutate(); }} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Course</label>
              <select
                required
                value={course}
                onChange={(e) => setCourse(e.target.value ? Number(e.target.value) : "")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select…</option>
                {(courses ?? []).map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Name</label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Final project rubric" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Criteria</span>
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => setCriteria([...criteria, newCriterion()])}
              >
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>

            {criteria.map((c, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-start gap-2">
                  <Input
                    placeholder="Label (e.g. Code quality)"
                    value={c.label}
                    onChange={(e) => updateCriterion(setCriteria, criteria, i, { label: e.target.value })}
                    required
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    disabled={criteria.length === 1}
                    onClick={() => setCriteria(criteria.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  rows={2} placeholder="Description (optional)"
                  value={c.description}
                  onChange={(e) => updateCriterion(setCriteria, criteria, i, { description: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Weight</label>
                    <Input
                      type="number" min={0} step="0.1" required
                      value={c.weight}
                      onChange={(e) => updateCriterion(setCriteria, criteria, i, { weight: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Max score</label>
                    <Input
                      type="number" min={1} required
                      value={c.max_score}
                      onChange={(e) => updateCriterion(setCriteria, criteria, i, { max_score: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={mut.isPending || !ready}>
              {mut.isPending ? "Creating…" : "Create rubric"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function updateCriterion(
  setCriteria: React.Dispatch<React.SetStateAction<DraftCriterion[]>>,
  criteria: DraftCriterion[],
  i: number,
  patch: Partial<DraftCriterion>,
) {
  setCriteria(criteria.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
}
