from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import AdminUserSerializer, LoginSerializer, RegisterSerializer, UserSerializer

User = get_user_model()


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role == "admin")


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]


class RefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class AdminUserViewSet(viewsets.ModelViewSet):
    """Admin-only CRUD over user accounts."""
    queryset = User.objects.all().order_by("-created_at")
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["role", "is_active"]
    search_fields = ["email", "full_name"]

    def perform_destroy(self, instance):
        if instance == self.request.user:
            raise PermissionDenied("You cannot delete your own admin account.")
        instance.delete()


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_stats(request):
    from projects.models import Course, Group, Project
    from submissions.models import Submission
    from reviews.models import Grade

    by_role = {r: User.objects.filter(role=r).count() for r in ("student", "instructor", "admin")}
    project_status = {
        s: Project.objects.filter(status=s).count()
        for s in ("draft", "active", "submitted", "graded", "archived")
    }

    return Response({
        "users": {
            "total": User.objects.count(),
            "by_role": by_role,
            "active": User.objects.filter(is_active=True).count(),
        },
        "courses": {"total": Course.objects.count()},
        "groups": {"total": Group.objects.count()},
        "projects": {"total": Project.objects.count(), "by_status": project_status},
        "submissions": {"total": Submission.objects.count(), "graded": Grade.objects.count()},
    })


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_analytics(request):
    """Aggregated data for the admin analytics dashboard.

    Query params:
      range: "7d" | "30d" | "90d" | "all" (default 30d)
      course: course id (optional filter)
    """
    from datetime import timedelta
    from django.db.models import Count
    from django.db.models.functions import TruncDate
    from django.utils import timezone
    from projects.models import Course, Project
    from submissions.models import Submission
    from reviews.models import Grade

    range_param = request.query_params.get("range", "30d")
    range_days = {"7d": 7, "30d": 30, "90d": 90}.get(range_param)
    since = timezone.now() - timedelta(days=range_days) if range_days else None

    course_id = request.query_params.get("course")
    project_qs = Project.objects.all()
    submission_qs = Submission.objects.all()
    grade_qs = Grade.objects.all()
    if course_id:
        project_qs = project_qs.filter(course_id=course_id)
        submission_qs = submission_qs.filter(project__course_id=course_id)
        grade_qs = grade_qs.filter(submission__project__course_id=course_id)

    scoped_subs = submission_qs.filter(submitted_at__gte=since) if since else submission_qs
    scoped_grades = grade_qs.filter(graded_at__gte=since) if since else grade_qs

    # Derive display status per project: graded / not_graded / submissions_left.
    from projects.serializers import _compute_display_status
    counts_by_display = {"graded": 0, "not_graded": 0, "submissions_left": 0}
    for p in project_qs.prefetch_related(
        "submissions__grades",
        "course__students",
        "groups__memberships",
        "participations__group",
    ):
        counts_by_display[_compute_display_status(p)] += 1

    graded = counts_by_display["graded"]
    not_graded = counts_by_display["not_graded"]
    submissions_left = counts_by_display["submissions_left"]
    active = not_graded + submissions_left

    pending = submission_qs.filter(grades__isnull=True).distinct().count()

    project_status = [
        {"name": "Submissions left", "value": submissions_left, "color": "#eab308"},
        {"name": "Not graded", "value": not_graded, "color": "#3b82f6"},
        {"name": "Graded", "value": graded, "color": "#22c55e"},
    ]

    daily = (
        scoped_subs
        .annotate(day=TruncDate("submitted_at"))
        .values("day")
        .annotate(count=Count("id"))
        .order_by("day")
    )
    submissions_over_time = [{"date": row["day"].isoformat(), "count": row["count"]} for row in daily]

    buckets = [
        ("F (0-59)", 0, 59),
        ("D (60-69)", 60, 69),
        ("C (70-79)", 70, 79),
        ("B (80-89)", 80, 89),
        ("A (90-100)", 90, 100),
    ]
    grade_distribution = []
    for label, lo, hi in buckets:
        count = grade_qs.filter(total_score__gte=lo, total_score__lte=hi).count()
        grade_distribution.append({"range": label, "count": count})

    top_groups_raw = (
        submission_qs
        .filter(group__isnull=False)
        .values("group__id", "group__name")
        .annotate(count=Count("id"))
        .order_by("-count")[:8]
    )
    top_groups = [
        {"name": g["group__name"], "submissions": g["count"]}
        for g in top_groups_raw
    ]

    instructor_activity_raw = (
        grade_qs
        .filter(graded_by__isnull=False)
        .values("graded_by__id", "graded_by__full_name")
        .annotate(count=Count("id"))
        .order_by("-count")[:8]
    )
    instructor_activity = [
        {"name": i["graded_by__full_name"], "graded": i["count"]}
        for i in instructor_activity_raw
    ]

    if since:
        prev_since = since - timedelta(days=range_days)
        prev_subs = submission_qs.filter(submitted_at__gte=prev_since, submitted_at__lt=since).count()
        curr_subs = scoped_subs.count()
        if prev_subs == 0:
            change_pct = 100.0 if curr_subs > 0 else 0.0
        else:
            change_pct = round((curr_subs - prev_subs) / prev_subs * 100, 1)
        if change_pct > 0:
            insight = f"Submissions increased by {change_pct}% vs the previous {range_days} days."
        elif change_pct < 0:
            insight = f"Submissions decreased by {abs(change_pct)}% vs the previous {range_days} days."
        else:
            insight = f"Submissions held steady vs the previous {range_days} days."
    else:
        insight = f"{submission_qs.count()} total submissions across all time."

    courses = [{"id": c.id, "code": c.code, "title": c.title} for c in Course.objects.all().order_by("code")]

    return Response({
        "summary": {
            "active_projects": active,
            "awaiting_grade": not_graded,
            "submissions_left": submissions_left,
            "graded_projects": graded,
            "pending_submissions": pending,
            "total_courses": Course.objects.count(),
            "total_projects": project_qs.count(),
            "total_users": User.objects.count(),
            "students": User.objects.filter(role="student").count(),
            "instructors": User.objects.filter(role="instructor").count(),
        },
        "project_status": project_status,
        "submissions_over_time": submissions_over_time,
        "grade_distribution": grade_distribution,
        "top_groups": top_groups,
        "instructor_activity": instructor_activity,
        "insight": insight,
        "courses": courses,
        "range": range_param,
    })
