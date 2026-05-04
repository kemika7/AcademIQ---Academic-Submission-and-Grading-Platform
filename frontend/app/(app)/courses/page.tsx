"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { CopyCode } from "@/components/shared/CopyCode";
import { EmptyState } from "@/components/shared/EmptyState";
import { createCourse, listCourses, selfEnrollCourse, type Course } from "@/lib/api/groups";
import { getSessionUser } from "@/lib/auth/session";

export default function CoursesPage() {
  const user = getSessionUser();
  const isInstructor = user?.role === "instructor" || user?.role === "admin";

  const { data, isLoading } = useQuery({ queryKey: ["courses"], queryFn: listCourses });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
          <p className="text-sm text-muted-foreground">
            {isInstructor ? "Courses you teach. Click a card to view its projects." : "All courses. Click Enroll to join, then open the course to upload projects."}
          </p>
        </div>
        <div className="flex gap-2">
          {isInstructor && <CreateCourseButton />}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No courses yet"
          body={isInstructor ? "Create your first course." : "No courses are available yet."}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((c) => <CourseCard key={c.id} course={c} isInstructor={isInstructor} />)}
        </div>
      )}
    </div>
  );
}

function CourseCard({ course, isInstructor }: { course: Course; isInstructor: boolean }) {
  const qc = useQueryClient();
  const enrollMut = useMutation({
    mutationFn: () => selfEnrollCourse(course.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["enrolled-courses"] });
    },
  });

  const card = (
    <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{course.code} — {course.title}</CardTitle>
          {!isInstructor && course.is_enrolled && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Enrolled</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{course.term}</p>
      </CardHeader>
      <CardContent>
        {course.description && <p className="mb-3 text-sm">{course.description}</p>}
        <div className="flex items-center justify-between">
          {isInstructor && course.course_code ? (
            <p className="text-xs text-muted-foreground">
              Course code <CopyCode value={course.course_code} />
            </p>
          ) : <span />}
          {!isInstructor && !course.is_enrolled && (
            <Button
              type="button"
              size="sm"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); enrollMut.mutate(); }}
              disabled={enrollMut.isPending}
            >
              {enrollMut.isPending ? "Enrolling…" : "Enroll"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return isInstructor || course.is_enrolled
    ? <Link href={`/courses/${course.id}`}>{card}</Link>
    : <div>{card}</div>;
}

function CreateCourseButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", title: "", term: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => createCourse(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      setOpen(false);
      setForm({ code: "", title: "", term: "", description: "" });
      setError(null);
    },
    onError: (e: any) => {
      const detail = e.response?.data;
      const msg = typeof detail === "string"
        ? detail
        : detail?.detail
          ?? Object.entries(detail ?? {}).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join("; ")
          ?? "Could not create course";
      setError(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> New course</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a course</DialogTitle>
          <DialogDescription>You can add students to it from the course detail page.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
          className="space-y-3"
        >
          <Field label="Code"><Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="PRG400" /></Field>
          <Field label="Title"><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Advanced Python" /></Field>
          <Field label="Term"><Input required value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} placeholder="2026 Spring" /></Field>
          <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? "Creating…" : "Create course"}
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
