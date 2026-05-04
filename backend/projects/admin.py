from django.contrib import admin

from .models import (
    Comment,
    Course,
    Group,
    GroupMembership,
    Project,
    ProjectParticipation,
)


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "term", "course_code")
    search_fields = ("code", "title")


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "group_code", "created_at")
    list_filter = ("project",)


@admin.register(GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
    list_display = ("group", "user", "role", "joined_at")


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("title", "course", "status", "deadline")
    list_filter = ("status", "course")
    search_fields = ("title", "description")


@admin.register(ProjectParticipation)
class ProjectParticipationAdmin(admin.ModelAdmin):
    list_display = ("project", "user", "mode", "group", "created_at")
    list_filter = ("mode",)


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("project", "author", "created_at")
