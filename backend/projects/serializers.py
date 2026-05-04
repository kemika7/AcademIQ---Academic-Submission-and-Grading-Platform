from rest_framework import serializers

from accounts.serializers import UserSerializer

from .models import Comment, Course, Group, GroupMembership, Project, ProjectParticipation


def _participation_for(obj, user):
    if not user or not getattr(user, "is_authenticated", False):
        return None
    return obj.participations.filter(user=user).select_related("group").first()


def _compute_display_status(obj) -> str:
    """Aggregate status across expected submitters for a project.

    'graded' — every participant (individuals + groups with members) has been graded.
    'not_graded' — at least one submission exists but not everyone is graded.
    'submissions_left' — at least one expected participant has not submitted.
    """
    submissions = obj.submissions.all()
    parts = list(obj.participations.select_related("group").all())
    if not parts:
        # No one has chosen yet — nothing has been submitted.
        return "submissions_left"

    indiv_users = [p.user_id for p in parts if p.mode == "individual"]
    group_ids = {p.group_id for p in parts if p.mode == "group" and p.group_id}

    submitted_users = set(submissions.filter(group__isnull=True).values_list("submitted_by_id", flat=True))
    submitted_groups = set(submissions.filter(group__isnull=False).values_list("group_id", flat=True))

    missing_users = [uid for uid in indiv_users if uid not in submitted_users]
    missing_groups = [gid for gid in group_ids if gid not in submitted_groups]
    if missing_users or missing_groups:
        return "submissions_left"

    # All expected submissions are in. Now check grading.
    graded_users: set[int] = set()
    for s in submissions.prefetch_related("grades"):
        for g in s.grades.all():
            if g.student_id is not None:
                graded_users.add(g.student_id)
    expected_user_ids = set(indiv_users)
    for gid in group_ids:
        expected_user_ids.update(
            GroupMembership.objects.filter(group_id=gid).values_list("user_id", flat=True)
        )
    return "graded" if expected_user_ids.issubset(graded_users) else "not_graded"


def _compute_my_status(obj, user) -> str | None:
    """Per-student status: 'graded', 'not_graded', 'not_submitted', or None."""
    if not user or not getattr(user, "is_authenticated", False) or user.role != "student":
        return None
    part = _participation_for(obj, user)
    if not part:
        return None
    if part.mode == "group" and part.group_id:
        latest = obj.submissions.filter(group_id=part.group_id).order_by("-version").first()
    else:
        latest = obj.submissions.filter(submitted_by=user, group__isnull=True).order_by("-version").first()
    if not latest:
        return "not_submitted"
    return "graded" if latest.grades.filter(student=user).exists() else "not_graded"


class CourseSerializer(serializers.ModelSerializer):
    instructors = UserSerializer(many=True, read_only=True)
    student_count = serializers.IntegerField(source="students.count", read_only=True)
    project_count = serializers.IntegerField(source="projects.count", read_only=True)
    is_enrolled = serializers.SerializerMethodField()
    course_code = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = (
            "id", "code", "title", "term", "description",
            "instructors", "course_code", "is_enrolled",
            "student_count", "project_count", "created_at",
        )

    def get_is_enrolled(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.students.filter(pk=request.user.pk).exists()

    def get_course_code(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and user.is_authenticated and user.role in ("instructor", "admin"):
            return obj.course_code
        return None


class GroupMembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = GroupMembership
        fields = ("id", "user", "role", "joined_at")


class GroupSerializer(serializers.ModelSerializer):
    memberships = GroupMembershipSerializer(many=True, read_only=True)
    project_title = serializers.CharField(source="project.title", read_only=True)
    course_id = serializers.IntegerField(source="project.course_id", read_only=True)
    course_label = serializers.CharField(source="project.course.code", read_only=True)
    member_count = serializers.IntegerField(source="memberships.count", read_only=True)

    class Meta:
        model = Group
        fields = (
            "id", "project", "project_title", "course_id", "course_label",
            "name", "group_code", "memberships", "member_count", "created_at",
        )
        read_only_fields = ("group_code",)


class ProjectParticipationSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    group = GroupSerializer(read_only=True)

    class Meta:
        model = ProjectParticipation
        fields = ("id", "project", "user", "mode", "group", "created_at", "updated_at")
        read_only_fields = ("project", "user", "created_at", "updated_at")


class ProjectListSerializer(serializers.ModelSerializer):
    course_label = serializers.CharField(source="course.code", read_only=True)
    submissions_count = serializers.SerializerMethodField()
    student_name = serializers.CharField(source="created_by.full_name", read_only=True, default=None)
    display_status = serializers.SerializerMethodField()
    my_status = serializers.SerializerMethodField()
    my_participation = serializers.SerializerMethodField()

    def get_submissions_count(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        qs = obj.submissions.all()
        if user and user.is_authenticated and user.role == "student":
            part = _participation_for(obj, user)
            if not part:
                return 0
            if part.mode == "group" and part.group_id:
                qs = qs.filter(group_id=part.group_id)
            else:
                qs = qs.filter(submitted_by=user, group__isnull=True)
        return qs.count()

    def get_display_status(self, obj):
        return _compute_display_status(obj)

    def get_my_status(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return _compute_my_status(obj, user)

    def get_my_participation(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        part = _participation_for(obj, user)
        if not part:
            return None
        return {
            "mode": part.mode,
            "group_id": part.group_id,
            "group_name": part.group.name if part.group else None,
        }

    class Meta:
        model = Project
        fields = (
            "id", "title", "status", "deadline",
            "course", "course_label",
            "student_name",
            "display_status", "my_status", "my_participation",
            "submissions_count", "created_at", "updated_at",
        )


class ProjectDetailSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    course_id = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.all(), source="course", write_only=True,
    )
    latest_submission = serializers.SerializerMethodField()
    display_status = serializers.SerializerMethodField()
    my_status = serializers.SerializerMethodField()
    my_participation = serializers.SerializerMethodField()
    group_count = serializers.IntegerField(source="groups.count", read_only=True)

    class Meta:
        model = Project
        fields = (
            "id", "title", "description", "status", "deadline",
            "course", "course_id",
            "latest_submission", "display_status", "my_status", "my_participation",
            "group_count", "created_at", "updated_at",
        )

    def get_display_status(self, obj):
        return _compute_display_status(obj)

    def get_my_status(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return _compute_my_status(obj, user)

    def get_my_participation(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        part = _participation_for(obj, user)
        if not part:
            return None
        return ProjectParticipationSerializer(part, context=self.context).data

    def get_latest_submission(self, obj):
        from submissions.serializers import SubmissionSerializer
        request = self.context.get("request")
        user = getattr(request, "user", None)
        qs = obj.submissions.order_by("-version")
        if user and user.is_authenticated and user.role == "student":
            part = _participation_for(obj, user)
            if not part:
                return None
            if part.mode == "group" and part.group_id:
                qs = qs.filter(group_id=part.group_id)
            else:
                qs = qs.filter(submitted_by=user, group__isnull=True)
        sub = qs.first()
        return SubmissionSerializer(sub, context=self.context).data if sub else None

    def validate(self, attrs):
        course = attrs.get("course")
        request = self.context.get("request")
        if request and self.instance is None:
            user = request.user
            if user.role in ("instructor", "admin"):
                if course and not course.instructors.filter(pk=user.pk).exists():
                    raise serializers.ValidationError({"course_id": "You must teach this course to create a project for it."})
        return attrs


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ("id", "project", "author", "body", "parent", "created_at")
        read_only_fields = ("project", "author")
