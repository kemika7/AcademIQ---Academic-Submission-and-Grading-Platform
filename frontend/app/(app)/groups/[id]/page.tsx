"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FolderKanban, Inbox, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyCode } from "@/components/shared/CopyCode";
import { getGroup } from "@/lib/api/groups";
import { getProject, listInbox } from "@/lib/api/projects";
import { getSessionUser } from "@/lib/auth/session";
import { formatRelative } from "@/lib/utils";

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = Number(params.id);
  const user = getSessionUser();
  const isInstructor = user?.role === "instructor" || user?.role === "admin";

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getGroup(groupId),
    enabled: !Number.isNaN(groupId),
  });

  const projectId = group?.project;

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
  });

  const { data: inbox, isLoading: inboxLoading } = useQuery({
    queryKey: ["inbox", { group: groupId }],
    queryFn: () => listInbox(),
    enabled: isInstructor && !!projectId,
    select: (items) => items.filter((s) => s.project_id === projectId && s.group_name === group?.name),
  });

  if (groupLoading || !group) return <Skeleton className="h-32" />;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/groups"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to groups
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
        <p className="text-sm text-muted-foreground">
          {group.course_label} · {group.memberships?.length ?? group.member_count ?? 0} member
          {((group.memberships?.length ?? group.member_count ?? 0) === 1) ? "" : "s"}
          {" · code "}<CopyCode value={group.group_code} />
        </p>
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <FolderKanban className="h-4 w-4" /> Project
        </h2>
        {!project ? (
          <Skeleton className="h-24" />
        ) : (
          <Link href={`/projects/${project.id}`}>
            <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader>
                <CardTitle>{project.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{project.course?.code} — {project.course?.title}</p>
              </CardHeader>
              {project.description && (
                <CardContent className="text-sm text-muted-foreground">
                  {project.description}
                </CardContent>
              )}
            </Card>
          </Link>
        )}
      </section>

      {isInstructor && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Inbox className="h-4 w-4" /> Submissions from this group
          </h2>
          {inboxLoading ? (
            <Skeleton className="h-24" />
          ) : (inbox ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No submissions from this group yet.</p>
          ) : (
            <Card className="divide-y">
              {inbox!.map((s) => (
                <Link
                  key={s.id}
                  href={`/projects/${s.project_id}/submissions`}
                  className="block p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{s.project_title} <span className="text-xs text-muted-foreground">v{s.version}</span></div>
                      <div className="mt-1 text-xs text-muted-foreground">{s.student_name}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{formatRelative(s.submitted_at)}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </Card>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Users className="h-4 w-4" /> Members
        </h2>
        {(group.memberships ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <Card className="divide-y">
            {group.memberships!.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 text-sm">
                <span>{m.user.full_name}</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{m.role}</span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
