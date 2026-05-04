"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FolderKanban, Inbox, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import {
  addInstructorsByEmail, addStudentsByEmail, deleteCourse, getCourse,
  listCourseStudents, removeInstructorFromCourse, removeStudentFromCourse,
} from "@/lib/api/groups";
import { listInbox, listProjects } from "@/lib/api/projects";
import { getSessionUser } from "@/lib/auth/session";
import { formatRelative } from "@/lib/utils";

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const courseId = Number(params.id);
  const user = getSessionUser();
  const isInstructor = user?.role === "instructor" || user?.role === "admin";

  async function handleDeleteCourse() {
    await deleteCourse(courseId);
    qc.invalidateQueries({ queryKey: ["courses"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["inbox"] });
    router.replace("/courses");
  }

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => getCourse(courseId),
    enabled: !Number.isNaN(courseId),
  });

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects", { course: courseId }],
    queryFn: () => listProjects({ course: courseId }),
    enabled: !Number.isNaN(courseId),
  });

  const { data: inbox, isLoading: inboxLoading } = useQuery({
    queryKey: ["inbox", { course: courseId }],
    queryFn: () => listInbox({ course: String(courseId) }),
    enabled: isInstructor && !Number.isNaN(courseId),
  });

  if (courseLoading || !course) {
    return <Skeleton className="h-32" />;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/courses" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All courses
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{course.code} — {course.title}</h1>
            <p className="text-sm text-muted-foreground">{course.term}</p>
            {course.description && <p className="mt-2 max-w-2xl text-sm">{course.description}</p>}
          </div>
          {isInstructor && (
            <div className="flex flex-wrap gap-2">
              <CreateProjectDialog defaultCourseId={courseId} />
              <AddStudentsButton courseId={courseId} />
              <ManageInstructorsButton courseId={courseId} instructors={course.instructors} />
              <ManageStudentsButton courseId={courseId} />
              <DeleteDialog
                triggerLabel="Delete course"
                title={`Delete ${course.code} — ${course.title}?`}
                description="This permanently removes the course, its groups, all of its projects, and every submission within them. This cannot be undone."
                confirmLabel="Delete course"
                onConfirm={handleDeleteCourse}
              />
            </div>
          )}
        </div>
        {isInstructor && course.instructors?.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Instructors: {course.instructors.map((i) => i.full_name).join(", ")}
          </p>
        )}
      </div>

      <section id="projects">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <FolderKanban className="h-4 w-4" /> Projects
        </h2>
        {projectsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (projects ?? []).length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects in this course"
            body={isInstructor ? "Create a project to share an assignment with students." : "Your instructor hasn't posted any assignments yet."}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects!.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </section>

      {isInstructor && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Inbox className="h-4 w-4" /> Submissions
          </h2>
          {inboxLoading ? (
            <Skeleton className="h-24" />
          ) : (inbox ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No submissions for this course yet.</p>
          ) : (
            <Card className="divide-y overflow-hidden">
              {inbox!.map((s) => (
                <Link
                  key={s.id}
                  href={`/projects/${s.project_id}/submissions`}
                  className="block p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        {s.project_title}
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                          v{s.version}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{s.student_name}</span>
                        {s.is_individual ? " · Individual" : s.group_name ? ` · Group: ${s.group_name}` : ""}
                        {" · "}
                        {formatRelative(s.submitted_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="sm" className="h-8 text-xs">View details</Button>
                    </div>
                  </div>
                </Link>
              ))}
            </Card>
          )}
        </section>
      )}
    </div>
  );
}

function AddStudentsButton({ courseId }: { courseId: number }) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: number; unmatched_emails: string[] } | null>(null);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => {
      const list = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
      return addStudentsByEmail(courseId, list);
    },
    onSuccess: (res) => {
      setResult(res);
      setError(null);
      qc.invalidateQueries({ queryKey: ["course", courseId] });
      qc.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (e: any) => setError(e.response?.data?.detail || e.message || "Could not add students"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEmails(""); setResult(null); setError(null); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><UserPlus className="h-4 w-4" /> Add students</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add students to this course</DialogTitle>
          <DialogDescription>
            Paste student emails separated by spaces, commas, or new lines. Only registered student accounts will be enrolled.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); if (emails.trim()) mut.mutate(); }}
          className="space-y-3"
        >
          <Textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="alice@school.edu, bob@school.edu"
            rows={5}
            required
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result && (
            <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
              <p>Added <strong>{result.added}</strong> student{result.added === 1 ? "" : "s"}.</p>
              {result.unmatched_emails.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Not matched (no student account): {result.unmatched_emails.join(", ")}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={mut.isPending || !emails.trim()}>
              {mut.isPending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageInstructorsButton({
  courseId, instructors,
}: {
  courseId: number;
  instructors: Array<{ id: number; full_name: string; email: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: number; unmatched_emails: string[] } | null>(null);
  const qc = useQueryClient();

  const addMut = useMutation({
    mutationFn: () => {
      const list = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
      return addInstructorsByEmail(courseId, list);
    },
    onSuccess: (res) => {
      setResult(res);
      setError(null);
      setEmails("");
      qc.invalidateQueries({ queryKey: ["course", courseId] });
      qc.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (e: any) => setError(e.response?.data?.detail || e.message || "Could not add instructors."),
  });

  const removeMut = useMutation({
    mutationFn: (id: number) => removeInstructorFromCourse(courseId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course", courseId] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      setError(null);
    },
    onError: (e: any) => setError(e.response?.data?.detail || "Could not remove instructor."),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEmails(""); setResult(null); setError(null); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><ShieldCheck className="h-4 w-4" /> Instructors</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage instructors</DialogTitle>
          <DialogDescription>
            Add by email (must be an instructor or admin account) or remove existing instructors.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current</h4>
            {instructors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No instructors assigned.</p>
            ) : (
              <Card className="divide-y overflow-hidden">
                {instructors.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div>
                      <div className="font-medium">{i.full_name}</div>
                      <div className="text-xs text-muted-foreground">{i.email}</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMut.mutate(i.id)}
                      disabled={removeMut.isPending || instructors.length <= 1}
                      title={instructors.length <= 1 ? "Cannot remove the only instructor" : ""}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                ))}
              </Card>
            )}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); if (emails.trim()) addMut.mutate(); }}
            className="space-y-2"
          >
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add by email</h4>
            <Textarea
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="newprof@school.edu"
              rows={3}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {result && (
              <p className="text-xs text-muted-foreground">
                Added {result.added}. {result.unmatched_emails.length > 0 && `Unmatched: ${result.unmatched_emails.join(", ")}`}
              </p>
            )}
            <Button type="submit" size="sm" disabled={addMut.isPending || !emails.trim()}>
              {addMut.isPending ? "Adding…" : "Add"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ManageStudentsButton({ courseId }: { courseId: number }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: students, isLoading } = useQuery({
    queryKey: ["course-students", courseId],
    queryFn: () => listCourseStudents(courseId),
    enabled: open,
  });
  const [error, setError] = useState<string | null>(null);

  const removeMut = useMutation({
    mutationFn: (id: number) => removeStudentFromCourse(courseId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-students", courseId] });
      qc.invalidateQueries({ queryKey: ["course", courseId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setError(null);
    },
    onError: (e: any) => setError(e.response?.data?.detail || "Could not remove student."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Users className="h-4 w-4" /> Students</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enrolled students</DialogTitle>
          <DialogDescription>
            Drop a student to remove them from the course (their submissions stay attached).
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        ) : !students || students.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students enrolled yet.</p>
        ) : (
          <Card className="max-h-96 divide-y overflow-y-auto">
            {students.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <div className="font-medium">{s.full_name}</div>
                  <div className="text-xs text-muted-foreground">{s.email}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMut.mutate(s.id)}
                  disabled={removeMut.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Drop
                </Button>
              </div>
            ))}
          </Card>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
