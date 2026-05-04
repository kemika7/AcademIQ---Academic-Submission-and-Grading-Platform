"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity as ActivityIcon, ArrowLeft, Clock, FileText, GitBranch, Pencil, Plus, Trash2, Upload, User, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyCode } from "@/components/shared/CopyCode";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  chooseGroupCreate, chooseIndividual, getActivity, getMyParticipation,
  getProject, getProjectParticipants, listSubmissions,
  type ProjectParticipants,
} from "@/lib/api/projects";
import { deleteGroup, joinGroupByCode, listGroupsForProject, type Group } from "@/lib/api/groups";
import { getSessionUser } from "@/lib/auth/session";
import { cn, formatRelative } from "@/lib/utils";

type Submission = {
  id: number;
  version: number;
  submitted_at: string;
  submitted_by: { id: number; full_name: string } | null;
  group: number | null;
  group_name: string | null;
  is_individual: boolean;
  report_file: string | null;
  github_url: string;
  notes: string;
};

export default function ProjectOverview() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const user = getSessionUser();
  const isInstructor = user?.role === "instructor" || user?.role === "admin";
  const isStudent = user?.role === "student";

  const { data: project } = useQuery({ queryKey: ["project", id], queryFn: () => getProject(id) });
  const { data: participation, isLoading: participationLoading } = useQuery({
    queryKey: ["participation", id],
    queryFn: () => getMyParticipation(id),
    enabled: isStudent,
  });

  const showChooser = isStudent && !participationLoading && !participation;

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["project-activity", id],
    queryFn: () => getActivity(id),
    enabled: !showChooser,
  });
  const { data: submissions } = useQuery<Submission[]>({
    queryKey: ["submissions", id],
    queryFn: () => listSubmissions(id),
    enabled: !showChooser,
  });

  const { data: participants, isLoading: participantsLoading } = useQuery({
    queryKey: ["project-participants", id],
    queryFn: () => getProjectParticipants(id),
    enabled: isInstructor,
  });

  if (showChooser && project) {
    return <ModeChooser projectId={id} project={project} />;
  }

  const latestPerSubmitter = groupLatestBySubmitter(submissions ?? []);
  const myLatest = isStudent ? latestPerSubmitter[0] : undefined;
  const hasOwnSubmission = Boolean(myLatest);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader><CardTitle>Description</CardTitle></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {project?.description || "No description provided."}
            </p>
          </CardContent>
        </Card>

        {isStudent && participation && (
          <ParticipationCard participation={participation} projectId={id} canSwitch={!hasOwnSubmission} />
        )}

        {isInstructor && (
          <ProjectParticipantsCard
            loading={participantsLoading}
            participants={participants}
            projectId={id}
          />
        )}

        {isStudent && hasOwnSubmission && <SubmissionCard submission={myLatest!} />}

        <div className="flex flex-wrap gap-2">
          {isStudent && participation && (
            <Button asChild>
              <Link href={`/submit/${id}`}>
                {hasOwnSubmission ? <><Pencil className="h-4 w-4" /> Update submission</> : <><Upload className="h-4 w-4" /> New submission</>}
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/projects/${id}/submissions`}>
              {isInstructor ? "View all versions" : "View my versions"}
            </Link>
          </Button>
        </div>
      </div>

      <ActivityCard isLoading={activityLoading} activity={activity} />
    </div>
  );
}

function groupLatestBySubmitter(submissions: Submission[]): Submission[] {
  const latest = new Map<string, Submission>();
  for (const s of submissions) {
    const key = s.group ? `g:${s.group}` : `u:${s.submitted_by?.id ?? "anon"}`;
    const prev = latest.get(key);
    if (!prev || new Date(s.submitted_at) > new Date(prev.submitted_at)) {
      latest.set(key, s);
    }
  }
  return Array.from(latest.values()).sort(
    (a, b) => +new Date(b.submitted_at) - +new Date(a.submitted_at),
  );
}

function ModeChooser({ projectId, project }: { projectId: number; project: any }) {
  const [step, setStep] = useState<"mode" | "group">("mode");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pick how you'll work on this project</CardTitle>
          <p className="text-sm text-muted-foreground">
            {project.title} — {project.course?.code ?? ""}. You can change this later until your first submission.
          </p>
        </CardHeader>
        <CardContent>
          {step === "mode" ? (
            <ModeStep onIndividual={() => null} projectId={projectId} onPickGroup={() => setStep("group")} />
          ) : (
            <GroupStep projectId={projectId} onBack={() => setStep("mode")} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModeStep({ projectId, onPickGroup }: { projectId: number; onIndividual: () => void; onPickGroup: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const indiv = useMutation({
    mutationFn: () => chooseIndividual(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["participation", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: any) => setError(e.response?.data?.detail || "Could not pick individual mode."),
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceCard
          icon={User}
          title="Work individually"
          body="Submit on your own. You can switch to a group later until your first submission."
          onClick={() => indiv.mutate()}
          disabled={indiv.isPending}
        />
        <ChoiceCard
          icon={Users}
          title="Work in a group"
          body="Create a new group for this project, or join an existing one."
          onClick={onPickGroup}
          accent
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function GroupStep({ projectId, onBack }: { projectId: number; onBack: () => void }) {
  const [tab, setTab] = useState<"create" | "join">("create");
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <div className="flex gap-1 rounded-md bg-muted p-1">
          <TabButton active={tab === "create"} onClick={() => setTab("create")}>Create new</TabButton>
          <TabButton active={tab === "join"} onClick={() => setTab("join")}>Join existing</TabButton>
        </div>
      </div>
      {tab === "create" ? <CreateGroupForm projectId={projectId} /> : <JoinGroupSection projectId={projectId} />}
    </div>
  );
}

function CreateGroupForm({ projectId }: { projectId: number }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => chooseGroupCreate(projectId, name.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["participation", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: any) => setError(e.response?.data?.detail || "Could not create group."),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (name.trim()) mut.mutate(); }}
      className="space-y-3"
    >
      <div>
        <label className="mb-1.5 block text-sm font-medium">Group name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. The Async Avengers"
          required
          autoFocus
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={mut.isPending || !name.trim()}>
        <Plus className="h-4 w-4" /> {mut.isPending ? "Creating…" : "Create group"}
      </Button>
    </form>
  );
}

function JoinGroupSection({ projectId }: { projectId: number }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups", { project: projectId }],
    queryFn: () => listGroupsForProject(projectId),
  });

  const joinByCode = useMutation({
    mutationFn: () => joinGroupByCode(code.trim().toUpperCase()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["participation", projectId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setCode("");
      setError(null);
    },
    onError: (e: any) => setError(e.response?.data?.detail || "Could not join with that code."),
  });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); if (code.trim()) joinByCode.mutate(); }}
        className="flex flex-wrap gap-2"
      >
        <Input
          className="max-w-sm"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Group invite code"
        />
        <Button type="submit" disabled={joinByCode.isPending || !code.trim()}>
          {joinByCode.isPending ? "Joining…" : "Join with code"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Ask a member of the group for the invite code.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Groups in this project
        </h4>
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        ) : !groups || groups.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No groups yet. Create one above.
          </p>
        ) : (
          <Card className="divide-y overflow-hidden">
            {groups.map((g) => (
              <GroupListItem key={g.id} group={g} />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function GroupListItem({ group: g }: { group: Group }) {
  const memberCount = g.memberships?.length ?? g.member_count ?? 0;
  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{g.name}</div>
        <div className="text-xs text-muted-foreground">
          {memberCount} member{memberCount === 1 ? "" : "s"}
        </div>
      </div>
      <span className="text-xs text-muted-foreground">Code required to join</span>
    </div>
  );
}

function ChoiceCard({
  icon: Icon, title, body, onClick, accent, disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  onClick: () => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60",
        accent ? "border-primary/40 bg-primary/5 hover:border-primary" : "hover:border-foreground/30",
      )}
    >
      <div className={cn(
        "rounded-md p-2",
        accent ? "bg-primary/10 text-primary" : "bg-muted text-foreground",
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{body}</div>
    </button>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-sm px-3 py-1 text-xs font-medium transition-colors",
        active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ParticipationCard({
  participation, projectId, canSwitch,
}: {
  participation: { mode: "individual" | "group"; group: { id: number; name: string; group_code: string; memberships?: any[] } | null };
  projectId: number;
  canSwitch: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {participation.mode === "individual" ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
          {participation.mode === "individual"
            ? "You're working individually"
            : `Group: ${participation.group?.name ?? "—"}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {participation.mode === "group" && participation.group && (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Invite code <CopyCode value={participation.group.group_code} />
            </div>
            <div className="flex flex-wrap gap-1">
              {participation.group.memberships?.map((m: any) => (
                <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                  {m.user.full_name}
                  {m.role === "leader" && <span className="text-[10px] uppercase text-primary">★</span>}
                </span>
              ))}
            </div>
          </>
        )}
        {canSwitch && (
          <p className="text-xs text-muted-foreground">
            You can <Link href={`/projects/${projectId}`} className="text-primary hover:underline">change this</Link> until you submit.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectParticipantsCard({
  loading, participants, projectId,
}: {
  loading: boolean;
  participants: ProjectParticipants | undefined;
  projectId: number;
}) {
  if (loading || !participants) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }
  const { groups, individuals } = participants;
  const total = groups.length + individuals.length;
  if (total === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No participants yet"
        body="Once students open this project and pick a mode, they'll appear here."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" /> Project participants
        </h2>
        <p className="text-xs text-muted-foreground">
          {groups.length} group{groups.length === 1 ? "" : "s"} · {individuals.length} individual{individuals.length === 1 ? "" : "s"}
        </p>
      </div>

      {groups.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Groups</h3>
          <Card className="divide-y overflow-hidden">
            {groups.map((g) => (
              <ParticipantRow
                key={`g-${g.id}`}
                projectId={projectId}
                kind="group"
                refId={g.id}
                title={g.name}
                subtitle={`${g.members.length} member${g.members.length === 1 ? "" : "s"}${g.members.length ? " · " + g.members.map((m) => m.full_name.split(" ")[0]).join(", ") : ""}`}
                submission={g.submission}
                gradedLabel={g.submission ? `${g.graded_total}/${g.graded_required} graded` : undefined}
                groupId={g.id}
              />
            ))}
          </Card>
        </section>
      )}

      {individuals.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Individuals</h3>
          <Card className="divide-y overflow-hidden">
            {individuals.map((u) => (
              <ParticipantRow
                key={`u-${u.id}`}
                projectId={projectId}
                kind="user"
                refId={u.id}
                title={u.full_name}
                subtitle={u.email}
                submission={u.submission}
                gradedLabel={u.submission ? (u.graded ? "graded" : "not graded") : undefined}
              />
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function ParticipantRow({
  projectId, kind, refId, title, subtitle, submission, gradedLabel, groupId,
}: {
  projectId: number;
  kind: "group" | "user";
  refId: number;
  title: string;
  subtitle: string;
  submission: { version: number; submitted_at: string } | null;
  gradedLabel: string | undefined;
  groupId?: number;
}) {
  const Icon = kind === "group" ? Users : User;
  const openHref = `/projects/${projectId}/submissions?submitter=${kind}:${refId}`;
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const delMut = useMutation({
    mutationFn: () => deleteGroup(groupId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-participants", projectId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      setError(null);
    },
    onError: (e: any) => setError(e.response?.data?.detail || "Could not delete group."),
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-md bg-muted p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
          {error && <div className="text-xs text-destructive">{error}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {submission ? (
          <>
            <Badge variant="default">v{submission.version}</Badge>
            <span className="text-xs text-muted-foreground">{formatRelative(submission.submitted_at)}</span>
            {gradedLabel && (
              <Badge variant={gradedLabel === "graded" ? "success" : "secondary"}>
                {gradedLabel}
              </Badge>
            )}
            <Button asChild size="sm" variant="outline">
              <Link href={openHref}>Open their submission</Link>
            </Button>
          </>
        ) : (
          <>
            <Badge variant="warning">
              <Clock className="h-3 w-3" /> Not submitted yet
            </Badge>
          </>
        )}
        {kind === "group" && groupId && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm("Delete this group? Members will lose their participation.")) {
                delMut.mutate();
              }
            }}
            disabled={delMut.isPending}
            title="Delete group"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function SubmissionCard({ submission }: { submission: Submission }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your submission</CardTitle>
        <p className="text-xs text-muted-foreground">Last saved {formatRelative(submission.submitted_at)}</p>
      </CardHeader>
      <CardContent>
        <SubmissionDetails submission={submission} />
      </CardContent>
    </Card>
  );
}

function SubmissionDetails({ submission }: { submission: Submission }) {
  return (
    <div className="space-y-2 text-sm">
      {submission.report_file ? (
        <a
          href={submission.report_file}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-primary hover:underline"
        >
          <FileText className="h-4 w-4" /> Download report
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">No report file uploaded.</p>
      )}
      {submission.github_url ? (
        <a
          href={submission.github_url}
          target="_blank"
          rel="noreferrer"
          className="block break-all text-primary hover:underline"
        >
          <span className="inline-flex items-center gap-2"><GitBranch className="h-4 w-4" /> {submission.github_url}</span>
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">No GitHub URL provided.</p>
      )}
      {submission.notes && (
        <div className="mt-2 rounded-md bg-muted/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{submission.notes}</p>
        </div>
      )}
    </div>
  );
}

function describeActivity(a: { verb: string; metadata?: Record<string, unknown> }) {
  const meta = a.metadata ?? {};
  const groupName = typeof meta.group_name === "string" ? meta.group_name : null;
  switch (a.verb) {
    case "submitted":
      return "submitted their work";
    case "graded":
      return typeof meta.total === "number" ? `graded · ${meta.total}` : "graded";
    case "commented":
      return "commented";
    case "created_project":
      return "created the project";
    case "created_group":
      return groupName ? `created group "${groupName}"` : "created a group";
    case "joined_group":
      return groupName ? `joined group "${groupName}"` : "joined a group";
    case "chose_individual":
      return "chose to work individually";
    default:
      return a.verb.replace(/_/g, " ");
  }
}

function ActivityCard({ isLoading, activity }: { isLoading: boolean; activity: any }) {
  return (
    <Card className="lg:col-span-1">
        <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (activity ?? []).length === 0 ? (
            <EmptyState icon={ActivityIcon} title="No activity yet" />
          ) : (
            <ol className="relative space-y-4 border-l border-border/60 pl-4">
              {activity!.map((a: any) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                  <div className="text-sm">
                    <span className="font-medium">{a.actor.full_name}</span>{" "}
                    <span className="text-muted-foreground">{describeActivity(a)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatRelative(a.created_at)}</div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
  );
}
