from rest_framework import serializers

from accounts.serializers import UserSerializer

from .models import Submission


class SubmissionSerializer(serializers.ModelSerializer):
    submitted_by = UserSerializer(read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True, default=None)
    is_individual = serializers.SerializerMethodField()
    ai_summary = serializers.SerializerMethodField()
    github_quality = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = (
            "id", "project", "version", "submitted_by",
            "group", "group_name", "is_individual",
            "report_file", "github_url", "notes",
            "submitted_at", "ai_summary", "github_quality",
        )
        read_only_fields = ("project", "version", "submitted_by")

    def get_is_individual(self, obj):
        return obj.group_id is None

    def get_ai_summary(self, obj):
        a = obj.analyses.filter(kind="report", status="done").order_by("-finished_at").first()
        return a.summary if a else None

    def get_github_quality(self, obj):
        ga = getattr(obj, "github_analysis", None)
        return float(ga.quality_score) if ga and ga.quality_score is not None else None


class InboxSubmissionSerializer(serializers.ModelSerializer):
    project_id = serializers.IntegerField(source="project.id", read_only=True)
    project_title = serializers.CharField(source="project.title", read_only=True)
    course_id = serializers.IntegerField(source="project.course.id", read_only=True)
    course_code = serializers.CharField(source="project.course.code", read_only=True)
    course_title = serializers.CharField(source="project.course.title", read_only=True)
    student_name = serializers.SerializerMethodField()
    student_email = serializers.SerializerMethodField()
    submitted_by_role = serializers.SerializerMethodField()
    group_id = serializers.IntegerField(source="group.id", read_only=True, default=None)
    group_name = serializers.CharField(source="group.name", read_only=True, default=None)
    is_individual = serializers.SerializerMethodField()
    deadline = serializers.DateTimeField(source="project.deadline", read_only=True)
    project_status = serializers.CharField(source="project.status", read_only=True)

    class Meta:
        model = Submission
        fields = (
            "id", "version", "submitted_at",
            "project_id", "project_title", "project_status", "deadline",
            "course_id", "course_code", "course_title",
            "student_name", "student_email", "submitted_by_role",
            "group_id", "group_name", "is_individual",
            "report_file", "github_url", "notes",
        )

    def get_student_name(self, obj):
        u = obj.submitted_by
        return u.full_name if u else "Unknown student"

    def get_student_email(self, obj):
        u = obj.submitted_by
        return u.email if u else None

    def get_submitted_by_role(self, obj):
        u = obj.submitted_by
        return u.role if u else None

    def get_is_individual(self, obj):
        return obj.group_id is None
