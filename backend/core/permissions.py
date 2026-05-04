from rest_framework import permissions


class IsInstructor(permissions.BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role in ("instructor", "admin"))


class IsStudent(permissions.BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role == "student")


class IsGroupMemberOrInstructor(permissions.BasePermission):
    """For project objects: allow enrolled students (read+write) and instructors (any).

    Mode-specific access (individual vs group) is enforced by views / participation,
    not at the project-object level — every enrolled student can open the project
    page, but submission requires a participation record.
    """

    def has_object_permission(self, request, view, obj):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if u.role in ("instructor", "admin"):
            return True
        project = obj if obj.__class__.__name__ == "Project" else getattr(obj, "project", None)
        if project is None:
            return False
        return project.course.students.filter(pk=u.pk).exists()


def can_access_submission(user, submission) -> bool:
    """Whether `user` may view this submission's content / analysis / grade.

    Instructors and admins always pass. For students:
      - group submission: must be a member of the group.
      - individual submission: must be the submitter.
    """
    if not (user and user.is_authenticated):
        return False
    if user.role in ("instructor", "admin"):
        return True
    if submission.group_id:
        return submission.group.memberships.filter(user=user).exists()
    return submission.submitted_by_id == user.id
