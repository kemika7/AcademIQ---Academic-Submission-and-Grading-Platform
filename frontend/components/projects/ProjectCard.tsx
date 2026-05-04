"use client";
import Link from "next/link";
import { Calendar, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deadlineLabel } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth/session";
import type { ProjectListItem } from "@/lib/api/projects";

type StatusKey = "graded" | "not_graded" | "submissions_left" | "not_submitted";

const STATUS_VARIANT: Record<StatusKey, "default" | "secondary" | "success" | "warning"> = {
  graded: "success",
  not_graded: "default",
  submissions_left: "warning",
  not_submitted: "warning",
};

const STATUS_LABEL: Record<StatusKey, string> = {
  graded: "Graded",
  not_graded: "Not graded",
  submissions_left: "Submissions left",
  not_submitted: "Not submitted",
};

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const user = getSessionUser();
  const key: StatusKey = user?.role === "student"
    ? (project.my_status ?? "not_submitted")
    : project.display_status;

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="group h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 text-base group-hover:text-primary">{project.title}</CardTitle>
            <Badge variant={STATUS_VARIANT[key]}>{STATUS_LABEL[key]}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {project.course_label}
            {project.my_participation
              ? ` · ${project.my_participation.mode === "individual"
                  ? "Individual"
                  : project.my_participation.group_name ?? "Group"}`
              : ""}
          </p>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" /> {deadlineLabel(project.deadline)}
          </div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5" /> {project.submissions_count} submission{project.submissions_count === 1 ? "" : "s"}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
