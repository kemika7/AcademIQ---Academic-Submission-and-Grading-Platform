from django.contrib import admin

from .models import Submission


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ("project", "version", "submitted_by", "submitted_at")
    list_filter = ("project__course",)
