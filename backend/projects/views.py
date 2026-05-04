from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from core.models import emit
from core.permissions import IsGroupMemberOrInstructor, IsInstructor

from .models import (
    Comment,
    Course,
    Group,
    GroupMembership,
    Project,
    ProjectParticipation,
)
from .serializers import (
    CommentSerializer,
    CourseSerializer,
    GroupMembershipSerializer,
    GroupSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
    ProjectParticipationSerializer,
)


class CourseViewSet(viewsets.ModelViewSet):
    serializer_class = CourseSerializer
    queryset = Course.objects.all()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsInstructor()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return Course.objects.all()

    def perform_create(self, serializer):
        course = serializer.save()
        if self.request.user.role in ("instructor", "admin"):
            course.instructors.add(self.request.user)

    def perform_destroy(self, instance):
        u = self.request.user
        if u.role != "admin" and not instance.instructors.filter(pk=u.pk).exists():
            raise PermissionDenied("You can only delete courses you teach.")
        instance.delete()

    @action(detail=True, methods=["post"], url_path="add-students", permission_classes=[IsInstructor])
    def add_students(self, request, pk=None):
        course = self.get_object()
        ids = request.data.get("student_ids") or []
        emails = request.data.get("emails") or []
        if not isinstance(ids, list):
            ids = []
        if not isinstance(emails, list):
            emails = []
        if not ids and not emails:
            return Response({"detail": "Provide student_ids or emails."}, status=400)
        from accounts.models import User
        qs = User.objects.filter(role="student")
        users = list(qs.filter(pk__in=ids)) if ids else []
        if emails:
            normalized = [e.strip().lower() for e in emails if e and e.strip()]
            users += list(qs.filter(email__in=normalized))
        unique = {u.id: u for u in users}
        course.students.add(*unique.values())
        unmatched = [e for e in emails if e.strip().lower() not in {u.email.lower() for u in unique.values()}] if emails else []
        return Response({"added": len(unique), "unmatched_emails": unmatched})

    @action(detail=True, methods=["post"], url_path="remove-student", permission_classes=[IsInstructor])
    def remove_student(self, request, pk=None):
        course = self.get_object()
        student_id = request.data.get("student_id")
        if not student_id:
            return Response({"detail": "student_id is required."}, status=400)
        course.students.remove(student_id)
        return Response({"detail": "Removed."})

    @action(detail=True, methods=["get"], url_path="students", permission_classes=[IsInstructor])
    def students(self, request, pk=None):
        from accounts.serializers import UserSerializer
        course = self.get_object()
        return Response(UserSerializer(course.students.all().order_by("full_name"), many=True).data)

    @action(detail=True, methods=["post"], url_path="add-instructors", permission_classes=[IsInstructor])
    def add_instructors(self, request, pk=None):
        course = self.get_object()
        if request.user.role != "admin" and not course.instructors.filter(pk=request.user.pk).exists():
            raise PermissionDenied("Only admins or current instructors can add instructors.")
        ids = request.data.get("instructor_ids") or []
        emails = request.data.get("emails") or []
        if not isinstance(ids, list):
            ids = []
        if not isinstance(emails, list):
            emails = []
        if not ids and not emails:
            return Response({"detail": "Provide instructor_ids or emails."}, status=400)
        from accounts.models import User
        qs = User.objects.filter(role__in=["instructor", "admin"])
        users = list(qs.filter(pk__in=ids)) if ids else []
        if emails:
            normalized = [e.strip().lower() for e in emails if e and e.strip()]
            users += list(qs.filter(email__in=normalized))
        unique = {u.id: u for u in users}
        course.instructors.add(*unique.values())
        unmatched = [e for e in emails if e.strip().lower() not in {u.email.lower() for u in unique.values()}] if emails else []
        return Response({"added": len(unique), "unmatched_emails": unmatched})

    @action(detail=True, methods=["post"], url_path="remove-instructor", permission_classes=[IsInstructor])
    def remove_instructor(self, request, pk=None):
        course = self.get_object()
        if request.user.role != "admin" and not course.instructors.filter(pk=request.user.pk).exists():
            raise PermissionDenied("Only admins or current instructors can remove instructors.")
        instructor_id = request.data.get("instructor_id")
        if not instructor_id:
            return Response({"detail": "instructor_id is required."}, status=400)
        if course.instructors.count() <= 1:
            return Response({"detail": "Cannot remove the only instructor on a course."}, status=400)
        course.instructors.remove(instructor_id)
        return Response({"detail": "Removed."})

    @action(detail=False, methods=["get"], url_path="enrolled")
    def enrolled(self, request):
        u = request.user
        qs = Course.objects.filter(students=u).distinct()
        return Response(CourseSerializer(qs, many=True, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="self-enroll")
    def self_enroll(self, request, pk=None):
        course = self.get_object()
        if request.user.role != "student":
            return Response({"detail": "Only students can enroll in courses."}, status=403)
        if course.students.filter(pk=request.user.pk).exists():
            return Response({"detail": "Already enrolled."}, status=200)
        course.students.add(request.user)
        return Response(
            CourseSerializer(course, context={"request": request}).data,
            status=200,
        )


def _student_can_act_on_project(user, project) -> bool:
    return project.course.students.filter(pk=user.pk).exists()


def _has_submitted(user, project) -> bool:
    """Whether the user (individually or via their group) has submitted to this project."""
    from submissions.models import Submission
    part = ProjectParticipation.objects.filter(project=project, user=user).first()
    if not part:
        return Submission.objects.filter(project=project, submitted_by=user).exists()
    if part.mode == "group" and part.group_id:
        return Submission.objects.filter(project=project, group_id=part.group_id).exists()
    return Submission.objects.filter(project=project, submitted_by=user, group__isnull=True).exists()


class GroupViewSet(viewsets.ModelViewSet):
    serializer_class = GroupSerializer
    queryset = Group.objects.all()
    filterset_fields = ["project"]

    def perform_destroy(self, instance):
        u = self.request.user
        if u.role == "admin":
            instance.delete()
            return
        if instance.project.course.instructors.filter(pk=u.pk).exists():
            instance.delete()
            return
        if instance.memberships.filter(user=u, role="leader").exists():
            instance.delete()
            return
        raise PermissionDenied("Only the group leader, the course instructor, or an admin can delete this group.")

    def get_queryset(self):
        u = self.request.user
        project_id = self.request.query_params.get("project")
        if u.role in ("instructor", "admin"):
            qs = Group.objects.all()
            if project_id:
                qs = qs.filter(project_id=project_id)
            return qs
        # Students: if a project is specified and they're enrolled, see all groups in it.
        if project_id:
            project = Project.objects.filter(pk=project_id).first()
            if project and project.course.students.filter(pk=u.pk).exists():
                return Group.objects.filter(project_id=project_id)
        # Otherwise: only their own groups.
        return Group.objects.filter(memberships__user=u).distinct()

    def perform_create(self, serializer):
        project = serializer.validated_data.get("project")
        u = self.request.user
        if project is None:
            raise ValidationError({"project": "This field is required."})
        if u.role == "student":
            if not project.course.students.filter(pk=u.pk).exists():
                raise PermissionDenied("Enroll in the course before creating a group for one of its projects.")
            if GroupMembership.objects.filter(user=u, group__project=project).exists():
                raise ValidationError({"detail": "You're already in a group for this project."})

        group = serializer.save(created_by=u)
        GroupMembership.objects.create(
            group=group, user=u, role=GroupMembership.Role.LEADER
        )
        if u.role == "student":
            ProjectParticipation.objects.update_or_create(
                project=project,
                user=u,
                defaults={"mode": ProjectParticipation.Mode.GROUP, "group": group},
            )
        emit(project, u, "created_group", target=group, group_name=group.name)

    @action(detail=True, methods=["post"])
    def join(self, request, pk=None):
        group = self.get_object()
        u = request.user
        code = (request.data.get("group_code") or "").strip().upper()
        if code:
            if code != group.group_code:
                return Response({"detail": "Invalid group code."}, status=400)
        else:
            if not group.project.course.students.filter(pk=u.pk).exists():
                return Response(
                    {"detail": "Enroll in this course first, or join with the group code."},
                    status=403,
                )
        if group.memberships.filter(user=u).exists():
            return Response({"detail": "You are already a member of this group."}, status=400)
        if GroupMembership.objects.filter(user=u, group__project=group.project).exists():
            return Response(
                {"detail": "You're already in a group for this project. Leave it before joining another."},
                status=400,
            )
        if _has_submitted(u, group.project):
            return Response({"detail": "You have already submitted to this project."}, status=400)
        GroupMembership.objects.create(group=group, user=u)
        ProjectParticipation.objects.update_or_create(
            project=group.project,
            user=u,
            defaults={"mode": ProjectParticipation.Mode.GROUP, "group": group},
        )
        emit(group.project, u, "joined_group", target=group, group_name=group.name)
        return Response({"detail": "Joined."})

    @action(detail=False, methods=["post"], url_path="join-by-code")
    def join_by_code(self, request):
        u = request.user
        code = (request.data.get("group_code") or "").strip().upper()
        if not code:
            return Response({"detail": "group_code is required."}, status=400)
        group = Group.objects.filter(group_code=code).first()
        if not group:
            return Response({"detail": "No group matches that code."}, status=404)
        if not group.project.course.students.filter(pk=u.pk).exists():
            return Response({"detail": "You must be enrolled in the course to join this group."}, status=403)
        if group.memberships.filter(user=u).exists():
            return Response({"detail": "You are already a member of this group."}, status=400)
        if GroupMembership.objects.filter(user=u, group__project=group.project).exists():
            return Response(
                {"detail": "You're already in a group for this project. Leave it before joining another."},
                status=400,
            )
        if _has_submitted(u, group.project):
            return Response({"detail": "You have already submitted to this project."}, status=400)
        GroupMembership.objects.create(group=group, user=u)
        ProjectParticipation.objects.update_or_create(
            project=group.project,
            user=u,
            defaults={"mode": ProjectParticipation.Mode.GROUP, "group": group},
        )
        emit(group.project, u, "joined_group", target=group, group_name=group.name)
        return Response(GroupSerializer(group).data, status=200)

    @action(detail=True, methods=["get", "post"], url_path="members")
    def members(self, request, pk=None):
        group = self.get_object()
        if request.method == "GET":
            qs = group.memberships.select_related("user").all()
            return Response(GroupMembershipSerializer(qs, many=True).data)
        # POST: add member by user_id, leader-only (or instructor).
        if not group.memberships.filter(user=request.user, role="leader").exists() and request.user.role not in ("instructor", "admin"):
            return Response({"detail": "Forbidden."}, status=403)
        m, _ = GroupMembership.objects.get_or_create(
            group=group, user_id=request.data["user_id"]
        )
        return Response(GroupMembershipSerializer(m).data, status=201)


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.select_related("course").all()
    permission_classes = [permissions.IsAuthenticated, IsGroupMemberOrInstructor]
    filterset_fields = ["status", "course"]
    search_fields = ["title", "description"]
    ordering_fields = ["deadline", "created_at", "updated_at"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsInstructor()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action in ("list",):
            return ProjectListSerializer
        return ProjectDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        u = self.request.user
        if u.role == "admin":
            return qs
        if u.role == "instructor":
            return qs.filter(course__instructors=u).distinct()
        # Students see every project in courses they are enrolled in.
        return qs.filter(course__students=u).distinct()

    def perform_create(self, serializer):
        project = serializer.save(created_by=self.request.user)
        emit(project, self.request.user, "created_project")

    def perform_destroy(self, instance):
        u = self.request.user
        if u.role != "admin" and not instance.course.instructors.filter(pk=u.pk).exists():
            raise PermissionDenied("You can only delete projects in courses you teach.")
        instance.delete()

    @action(detail=True, methods=["get", "post", "delete"], url_path="participation")
    def participation(self, request, pk=None):
        """Read or set the requesting student's work mode for this project.

        GET → current participation (or null).
        POST body:
          {mode: 'individual'} → solo participation
          {mode: 'group', group_id: N} → join existing group
          {mode: 'group', create: {name: '...'}} → create new group + join it
        DELETE → clear participation (only allowed before first submission, leaves group membership).
        """
        project = self.get_object()
        u = request.user

        if request.method == "GET":
            part = ProjectParticipation.objects.filter(project=project, user=u).first()
            return Response(
                ProjectParticipationSerializer(part, context={"request": request}).data if part else None
            )

        if u.role != "student":
            return Response({"detail": "Only students choose a work mode."}, status=403)
        if not _student_can_act_on_project(u, project):
            return Response({"detail": "You must be enrolled in this course."}, status=403)

        if request.method == "DELETE":
            if _has_submitted(u, project):
                return Response({"detail": "Cannot reset mode after a submission."}, status=400)
            ProjectParticipation.objects.filter(project=project, user=u).delete()
            return Response(status=204)

        if _has_submitted(u, project):
            return Response({"detail": "Cannot change mode after a submission."}, status=400)

        mode = (request.data.get("mode") or "").lower()
        if mode == ProjectParticipation.Mode.INDIVIDUAL:
            existing_membership = GroupMembership.objects.filter(user=u, group__project=project).first()
            if existing_membership:
                return Response(
                    {"detail": "Leave your group for this project before switching to individual."},
                    status=400,
                )
            previous = ProjectParticipation.objects.filter(project=project, user=u).first()
            part, _ = ProjectParticipation.objects.update_or_create(
                project=project,
                user=u,
                defaults={"mode": ProjectParticipation.Mode.INDIVIDUAL, "group": None},
            )
            if not previous or previous.mode != ProjectParticipation.Mode.INDIVIDUAL:
                emit(project, u, "chose_individual")
            return Response(ProjectParticipationSerializer(part, context={"request": request}).data)

        if mode == ProjectParticipation.Mode.GROUP:
            create = request.data.get("create") or {}
            group_id = request.data.get("group_id")
            existing_in_project = GroupMembership.objects.filter(user=u, group__project=project).select_related("group").first()
            created_new = False
            if create:
                if existing_in_project:
                    return Response({"detail": "You're already in a group for this project."}, status=400)
                name = (create.get("name") or "").strip()
                if not name:
                    return Response({"detail": "Group name is required."}, status=400)
                group = Group.objects.create(project=project, name=name, created_by=u)
                GroupMembership.objects.create(group=group, user=u, role=GroupMembership.Role.LEADER)
                created_new = True
            elif group_id:
                group = Group.objects.filter(pk=group_id, project=project).first()
                if not group:
                    return Response({"detail": "Group not found in this project."}, status=404)
                if existing_in_project and existing_in_project.group_id != group.id:
                    return Response({"detail": "You're already in another group for this project."}, status=400)
                if not group.memberships.filter(user=u).exists():
                    return Response(
                        {"detail": "Use the group's invite code to join."},
                        status=403,
                    )
            else:
                return Response({"detail": "Provide group_id or create.name."}, status=400)

            part, _ = ProjectParticipation.objects.update_or_create(
                project=project,
                user=u,
                defaults={"mode": ProjectParticipation.Mode.GROUP, "group": group},
            )
            if created_new:
                emit(project, u, "created_group", target=group, group_name=group.name)
            return Response(ProjectParticipationSerializer(part, context={"request": request}).data)

        return Response({"detail": "mode must be 'individual' or 'group'."}, status=400)

    @action(detail=True, methods=["get"])
    def participants(self, request, pk=None):
        """All participants in this project — groups (with members) and individuals."""
        project = self.get_object()
        from submissions.models import Submission

        subs_by_group = {}
        subs_by_user = {}
        for sub in Submission.objects.filter(project=project).select_related("submitted_by", "group").order_by("-version"):
            if sub.group_id and sub.group_id not in subs_by_group:
                subs_by_group[sub.group_id] = sub
            elif sub.group_id is None and sub.submitted_by_id and sub.submitted_by_id not in subs_by_user:
                subs_by_user[sub.submitted_by_id] = sub

        def _summarize(sub):
            if not sub:
                return None
            return {
                "id": sub.id,
                "version": sub.version,
                "submitted_at": sub.submitted_at,
                "submitted_by": {"id": sub.submitted_by_id, "full_name": sub.submitted_by.full_name} if sub.submitted_by else None,
                "graded_count": sub.grades.count(),
            }

        groups_data = []
        for g in project.groups.prefetch_related("memberships__user").all():
            members = [{"id": m.user_id, "full_name": m.user.full_name} for m in g.memberships.all()]
            sub = subs_by_group.get(g.id)
            groups_data.append({
                "id": g.id,
                "name": g.name,
                "group_code": g.group_code,
                "members": members,
                "submission": _summarize(sub),
                "graded_total": sub.grades.count() if sub else 0,
                "graded_required": len(members),
            })

        individuals_data = []
        indiv_qs = ProjectParticipation.objects.filter(
            project=project, mode=ProjectParticipation.Mode.INDIVIDUAL,
        ).select_related("user")
        for part in indiv_qs:
            u = part.user
            sub = subs_by_user.get(u.id)
            individuals_data.append({
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "submission": _summarize(sub),
                "graded": bool(sub) and sub.grades.filter(student=u).exists(),
            })

        # Students enrolled but who haven't picked a mode yet.
        chosen_user_ids = set(
            ProjectParticipation.objects.filter(project=project).values_list("user_id", flat=True)
        )
        unchosen = [
            {"id": u.id, "full_name": u.full_name, "email": u.email}
            for u in project.course.students.exclude(id__in=chosen_user_ids).order_by("full_name")
        ]

        return Response({
            "groups": groups_data,
            "individuals": individuals_data,
            "unchosen": unchosen,
        })

    @action(detail=True, methods=["get"])
    def activity(self, request, pk=None):
        project = self.get_object()
        from core.models import Activity
        items = Activity.objects.filter(project=project).select_related("actor")[:100]
        data = [
            {
                "id": a.id,
                "actor": {"id": a.actor_id, "full_name": a.actor.full_name if a.actor else "system"},
                "verb": a.verb,
                "metadata": a.metadata,
                "created_at": a.created_at,
            }
            for a in items
        ]
        return Response(data)

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        project = self.get_object()
        if request.method == "GET":
            qs = project.comments.select_related("author").all()
            return Response(CommentSerializer(qs, many=True).data)
        body = request.data.get("body", "").strip()
        if not body:
            return Response({"detail": "Body required."}, status=400)
        c = Comment.objects.create(
            project=project, author=request.user, body=body,
            parent_id=request.data.get("parent"),
        )
        emit(project, request.user, "commented", target=c)
        return Response(CommentSerializer(c).data, status=status.HTTP_201_CREATED)
