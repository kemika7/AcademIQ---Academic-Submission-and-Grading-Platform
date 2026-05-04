from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import IsGroupMemberOrInstructor, IsInstructor, IsStudent
from projects.models import Project

from .models import Submission
from .serializers import InboxSubmissionSerializer, SubmissionSerializer
from .services import create_submission


class SubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = SubmissionSerializer
    permission_classes = [permissions.IsAuthenticated, IsGroupMemberOrInstructor]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated(), IsStudent()]
        return super().get_permissions()

    def partial_update(self, request, *args, **kwargs):
        sub = self.get_object()
        allowed = {"github_url", "notes"}
        payload = {k: v for k, v in request.data.items() if k in allowed}
        if not payload:
            return Response({"detail": "Only github_url and notes are editable."}, status=400)
        for k, v in payload.items():
            setattr(sub, k, v)
        sub.save(update_fields=list(payload.keys()))
        if "github_url" in payload and sub.github_url:
            from ai_services.tasks import analyze_github
            analyze_github.delay(sub.id)
        return Response(SubmissionSerializer(sub).data)

    def get_queryset(self):
        from django.db.models import Q
        project_id = self.kwargs.get("project_pk")
        qs = Submission.objects.select_related("submitted_by", "group").filter(project_id=project_id)
        u = self.request.user
        if u.role in ("instructor", "admin"):
            return qs
        return qs.filter(
            Q(submitted_by=u) | Q(group__memberships__user=u)
        ).distinct()

    def create(self, request, project_pk=None):
        from projects.models import ProjectParticipation
        project = get_object_or_404(Project, pk=project_pk)
        if not project.course.students.filter(pk=request.user.pk).exists():
            return Response(
                {"detail": "You must be enrolled in this course to submit."},
                status=status.HTTP_403_FORBIDDEN,
            )
        part = ProjectParticipation.objects.filter(project=project, user=request.user).select_related("group").first()
        if not part:
            return Response(
                {"detail": "Choose individual or group on this project before submitting."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        group = part.group if part.mode == ProjectParticipation.Mode.GROUP else None
        if part.mode == ProjectParticipation.Mode.GROUP:
            if not group or not group.memberships.filter(user=request.user).exists():
                return Response(
                    {"detail": "Your group membership for this project is missing."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        sub = create_submission(
            project=project,
            user=request.user,
            group=group,
            report_file=request.FILES.get("report_file"),
            github_url=request.data.get("github_url", ""),
            notes=request.data.get("notes", ""),
        )
        return Response(SubmissionSerializer(sub).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[IsInstructor])
    def reanalyze(self, request, project_pk=None, pk=None):
        sub = self.get_object()
        from ai_services.tasks import analyze_github, analyze_report
        if sub.report_file:
            analyze_report.delay(sub.id)
        if sub.github_url:
            analyze_github.delay(sub.id)
        return Response({"detail": "Re-analysis dispatched."})


class InboxViewSet(viewsets.ViewSet):
    """Instructor inbox — submissions awaiting grading."""

    permission_classes = [IsInstructor]

    def list(self, request):
        qs = Submission.objects.select_related(
            "project", "project__course",
            "project__created_by", "submitted_by",
            "group",
        )
        u = request.user
        if u.role != "admin":
            qs = qs.filter(project__course__instructors=u)
        course = request.query_params.get("course")
        if course:
            qs = qs.filter(project__course_id=course)
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(project__status=status_filter)
        else:
            qs = qs.filter(project__status__in=["submitted", "active"])
        qs = qs.order_by("project__deadline", "-submitted_at").distinct()[:200]
        return Response(InboxSubmissionSerializer(qs, many=True).data)


class FeedViewSet(viewsets.ViewSet):
    """Role-aware activity feed."""

    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        from django.db.models import Q
        from core.models import Activity
        from projects.models import Project

        u = request.user
        actor_role = request.query_params.get("actor_role")

        qs = (
            Activity.objects
            .select_related("actor", "project", "project__course")
            .order_by("-created_at")
        )

        if u.role == "student":
            # Activities for projects in courses the student is enrolled in.
            accessible_projects = Project.objects.filter(course__students=u).values_list("id", flat=True)
            qs = qs.filter(project_id__in=list(accessible_projects))
            qs = qs.filter(
                # grades aimed at the student
                (Q(verb="graded") & Q(metadata__student_id=u.id))
                # comments by others on a project they're in
                | (Q(verb="commented") & ~Q(actor=u))
            )
        elif u.role == "instructor":
            qs = qs.filter(project__course__instructors=u)
            if actor_role == "instructor":
                qs = qs.filter(actor__role__in=["instructor", "admin"])
            elif actor_role == "student":
                qs = qs.filter(actor__role="student")
        elif u.role == "admin":
            if actor_role in ("student", "instructor", "admin"):
                if actor_role == "instructor":
                    qs = qs.filter(actor__role__in=["instructor", "admin"])
                else:
                    qs = qs.filter(actor__role=actor_role)

        items = qs.distinct()[:200]
        data = []
        for a in items:
            actor = a.actor
            data.append({
                "id": a.id,
                "verb": a.verb,
                "metadata": a.metadata,
                "created_at": a.created_at,
                "project": {
                    "id": a.project_id,
                    "title": a.project.title,
                    "course_code": a.project.course.code,
                    "course_title": a.project.course.title,
                },
                "actor": {
                    "id": actor.id if actor else None,
                    "full_name": actor.full_name if actor else "system",
                    "role": actor.role if actor else None,
                },
            })
        return Response(data)
