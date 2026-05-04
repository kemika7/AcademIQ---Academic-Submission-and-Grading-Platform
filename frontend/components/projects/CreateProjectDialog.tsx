"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { createProject, listCourses } from "@/lib/api/groups";

export function CreateProjectDialog({ defaultCourseId }: { defaultCourseId?: number } = {}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    course: (defaultCourseId ?? "") as number | "",
    title: "",
    description: "",
    deadline: "",
  });
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: courses } = useQuery({ queryKey: ["courses"], queryFn: listCourses, enabled: open });

  const mut = useMutation({
    mutationFn: () => createProject({
      course: Number(form.course),
      title: form.title,
      description: form.description,
      deadline: new Date(form.deadline).toISOString(),
      status: "active",
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["course", Number(form.course)] });
      setOpen(false);
      setForm({ course: defaultCourseId ?? "", title: "", description: "", deadline: "" });
      setError(null);
    },
    onError: (e: any) => {
      const detail = e.response?.data;
      const msg = typeof detail === "string"
        ? detail
        : detail?.detail
          ?? Object.entries(detail ?? {}).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join("; ")
          ?? "Could not create project";
      setError(msg);
    },
  });

  const ready = !!form.course && !!form.title && !!form.deadline;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> New project</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a project</DialogTitle>
          <DialogDescription>
            Define an assignment for one of your courses. Students will then submit individually or as a group.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (ready) mut.mutate(); }} className="space-y-3">
          <Field label="Course">
            <select
              required
              value={form.course === "" ? "" : String(form.course)}
              onChange={(e) => setForm({ ...form, course: e.target.value ? Number(e.target.value) : "" })}
              disabled={!!defaultCourseId}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select a course…</option>
              {(courses ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Final project" />
          </Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What students need to do for this assignment." />
          </Field>
          <Field label="Deadline">
            <Input
              type="datetime-local"
              required
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={mut.isPending || !ready}>
              {mut.isPending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
