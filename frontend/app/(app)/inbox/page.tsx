"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Activity, CheckCircle2, FilePlus, GraduationCap, Inbox, MessageSquare, ShieldCheck, UserCog,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { listFeed, type FeedItem } from "@/lib/api/projects";
import { getSessionUser } from "@/lib/auth/session";
import { formatRelative, cn } from "@/lib/utils";

type ActorTab = "student" | "instructor" | "admin";

const TABS: Record<ActorTab, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  student: { label: "Students", icon: GraduationCap },
  instructor: { label: "Instructors", icon: UserCog },
  admin: { label: "Admins", icon: ShieldCheck },
};

export default function InboxPage() {
  const user = getSessionUser();
  const role = user?.role;

  if (role === "student") return <StudentInbox />;
  if (role === "instructor") return <RoleScopedInbox tabs={["student", "instructor"]} />;
  if (role === "admin") return <RoleScopedInbox tabs={["student", "instructor", "admin"]} />;
  return null;
}

function StudentInbox() {
  const { data, isLoading } = useQuery({
    queryKey: ["feed", "student"],
    queryFn: () => listFeed(),
  });

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Inbox</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Grades, feedback, and comments on your submissions.
      </p>
      <FeedList items={data} isLoading={isLoading} role="student" />
    </div>
  );
}

function RoleScopedInbox({ tabs }: { tabs: ActorTab[] }) {
  const [tab, setTab] = useState<ActorTab>(tabs[0]);
  const { data, isLoading } = useQuery({
    queryKey: ["feed", tab],
    queryFn: () => listFeed({ actor_role: tab }),
  });

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Inbox</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Activity across your courses, grouped by who acted.
      </p>

      <div className={cn("mb-4 grid gap-1 rounded-md border p-1", tabs.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {tabs.map((t) => {
          const { label, icon: Icon } = TABS[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      <FeedList items={data} isLoading={isLoading} role={tab} />
    </div>
  );
}

function FeedList({ items, isLoading, role }: { items: FeedItem[] | undefined; isLoading: boolean; role: string }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }
  if (!items || items.length === 0) {
    return <EmptyState icon={Inbox} title={`No ${role} activity`} body="Nothing to show yet — check back later." />;
  }
  return (
    <Card className="divide-y">
      {items.map((item) => <FeedRow key={item.id} item={item} />)}
    </Card>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  const { icon: Icon, color, message } = describe(item);
  return (
    <Link
      href={`/projects/${item.project.id}`}
      className="flex items-start gap-3 p-4 transition-colors hover:bg-muted/40"
    >
      <div
        className="mt-0.5 rounded-full p-2"
        style={{ backgroundColor: `${color}20`, color }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="font-medium">{item.actor.full_name}</span>
          {item.actor.role && (
            <Badge
              variant={item.actor.role === "admin" ? "success" : item.actor.role === "instructor" ? "default" : "secondary"}
              className="capitalize"
            >
              {item.actor.role}
            </Badge>
          )}
          <span className="text-muted-foreground">{message}</span>
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {item.project.course_code} — {item.project.title}
        </div>
      </div>
      <div className="whitespace-nowrap text-xs text-muted-foreground">
        {formatRelative(item.created_at)}
      </div>
    </Link>
  );
}

function describe(item: FeedItem): { icon: React.ComponentType<{ className?: string }>; color: string; message: string } {
  const meta = item.metadata ?? {};
  switch (item.verb) {
    case "submitted":
      return {
        icon: FilePlus,
        color: "#3b82f6",
        message: typeof meta.version === "number" ? `submitted v${meta.version}` : "submitted a version",
      };
    case "graded":
      return {
        icon: CheckCircle2,
        color: "#22c55e",
        message: typeof meta.total === "number" ? `graded · ${meta.total}/100` : "graded a submission",
      };
    case "commented":
      return { icon: MessageSquare, color: "#a855f7", message: "left a comment" };
    case "created_project":
      return { icon: FilePlus, color: "#eab308", message: "created the project" };
    default:
      return { icon: Activity, color: "#94a3b8", message: item.verb.replace("_", " ") };
  }
}
