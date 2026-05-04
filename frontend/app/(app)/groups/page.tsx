"use client";
import { useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, FolderKanban, Plus, User, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { CopyCode } from "@/components/shared/CopyCode";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  joinGroupByCode, listCourses, listEnrolledCourses, listGroups, listGroupsForProject,
  type Course, type Group,
} from "@/lib/api/groups";
import {
  chooseGroupCreate, listProjects, type ProjectListItem,
} from "@/lib/api/projects";
import { getSessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export default function GroupsPage() {
  const user = getSessionUser();
  const isInstructor = user?.role === "instructor" || user?.role === "admin";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
          <p className="text-sm text-muted-foreground">
            {isInstructor
              ? "Browse projects in each course you teach. Each project has its own groups."
              : "Pick a course, open a project, and create or join a group inside it."}
          </p>
        </div>
        <div className="flex gap-2">
          {!isInstructor && <JoinByCodeButton />}
        </div>
      </div>

      {isInstructor ? <InstructorView userId={user?.id} /> : <StudentView />}
    </div>
  );
}

function StudentView() {
  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ["enrolled-courses"],
    queryFn: listEnrolledCourses,
  });
  const { data: myGroups } = useQuery({
    queryKey: ["groups"],
    queryFn: listGroups,
  });

  if (coursesLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }
  if (!courses || courses.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Not enrolled in any courses"
        body="Enroll in a course first, then come back to create or join a group inside one of its projects."
      />
    );
  }

  return (
    <div className="space-y-3">
      {courses.map((c) => (
        <CourseAccordion
          key={c.id}
          course={c}
          myGroupsByProject={
            (myGroups ?? []).reduce((acc, g) => {
              acc.set(g.project, g);
              return acc;
            }, new Map<number, Group>())
          }
          studentMode
        />
      ))}
    </div>
  );
}

function InstructorView({ userId }: { userId?: number }) {
  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: listCourses,
  });

  const taught = (courses ?? []).filter((c) =>
    userId ? c.instructors?.some((i) => i.id === userId) : true
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }
  if (taught.length === 0) {
    return <EmptyState icon={Users} title="No courses" body="You aren't teaching any courses yet." />;
  }
  return (
    <div className="space-y-3">
      {taught.map((c) => <CourseAccordion key={c.id} course={c} />)}
    </div>
  );
}

function CourseAccordion({
  course, studentMode, myGroupsByProject,
}: {
  course: Course;
  studentMode?: boolean;
  myGroupsByProject?: Map<number, Group>;
}) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
      >
        <div className="flex items-center gap-2">
          <Chevron className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-sm font-semibold">{course.code} — {course.title}</div>
            <div className="text-xs text-muted-foreground">
              {course.term} · {course.student_count} student{course.student_count === 1 ? "" : "s"}
              {" · "}{course.project_count} project{course.project_count === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <Link
          href={`/courses/${course.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Open course →
        </Link>
      </button>
      {open && (
        <CardContent className="border-t pt-4">
          <CourseProjects courseId={course.id} studentMode={studentMode} myGroupsByProject={myGroupsByProject} />
        </CardContent>
      )}
    </Card>
  );
}

function CourseProjects({
  courseId, studentMode, myGroupsByProject,
}: {
  courseId: number;
  studentMode?: boolean;
  myGroupsByProject?: Map<number, Group>;
}) {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects", { course: courseId }],
    queryFn: () => listProjects({ course: courseId }),
  });

  if (isLoading) return <Skeleton className="h-16" />;
  if (!projects || projects.length === 0) {
    return <p className="text-sm text-muted-foreground">No projects in this course.</p>;
  }

  return (
    <div className="space-y-3">
      {projects.map((p) => (
        <ProjectGroupRow
          key={p.id}
          project={p}
          studentMode={studentMode}
          myGroup={myGroupsByProject?.get(p.id)}
        />
      ))}
    </div>
  );
}

function ProjectGroupRow({
  project, studentMode, myGroup,
}: {
  project: ProjectListItem;
  studentMode?: boolean;
  myGroup?: Group;
}) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;

  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups", { project: project.id }],
    queryFn: () => listGroupsForProject(project.id),
    enabled: open,
  });

  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Chevron className="h-3.5 w-3.5 text-muted-foreground" />
          <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{project.title}</div>
            {studentMode && (
              <div className="text-xs text-muted-foreground">
                {project.my_participation
                  ? project.my_participation.mode === "individual"
                    ? "You're working individually"
                    : `In group: ${project.my_participation.group_name ?? "—"}`
                  : "No mode chosen yet"}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${project.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Open →
          </Link>
        </div>
      </button>
      {open && (
        <div className="space-y-3 border-t p-3">
          {studentMode && !project.my_participation && (
            <CreateGroupForRow projectId={project.id} />
          )}
          {studentMode && project.my_participation?.mode === "group" && myGroup && (
            <p className="text-xs text-muted-foreground">
              You are already in <span className="font-medium">{myGroup.name}</span>.{" "}
              <Link href={`/groups/${myGroup.id}`} className="text-primary hover:underline">View group →</Link>
            </p>
          )}
          <div>
            <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Groups in this project
            </h5>
            {isLoading ? (
              <Skeleton className="h-10" />
            ) : !groups || groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No groups yet.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {groups.map((g) => (
                  <Link key={g.id} href={`/groups/${g.id}`}>
                    <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
                      <CardHeader className="pb-1">
                        <CardTitle className="text-sm">{g.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground">
                        {g.member_count} member{g.member_count === 1 ? "" : "s"}
                        {" · code "}<CopyCode value={g.group_code} />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateGroupForRow({ projectId }: { projectId: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => chooseGroupCreate(projectId, name.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["participation", projectId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      setName("");
      setError(null);
    },
    onError: (e: any) => setError(e.response?.data?.detail || "Could not create group."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /> New group for this project</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create group</DialogTitle>
          <DialogDescription>
            You'll be set as leader. Picking "create group" automatically chooses group mode for this project.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) mut.mutate(); }}
          className="space-y-3"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cool Beans"
            required
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={mut.isPending || !name.trim()}>
              {mut.isPending ? "Creating…" : "Create group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function JoinByCodeButton() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => joinGroupByCode(code.trim().toUpperCase()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["participation"] });
      setOpen(false);
      setCode("");
      setError(null);
    },
    onError: (e: any) => setError(e.response?.data?.detail || e.message || "Could not join group"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Join with code</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a group</DialogTitle>
          <DialogDescription>Enter the invite code shared by the group leader.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); if (code) mut.mutate(); }}
          className="space-y-3"
        >
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD1234" required />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={mut.isPending || !code}>
              {mut.isPending ? "Joining…" : "Join group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
