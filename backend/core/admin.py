from django.contrib import admin

from .models import Activity


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ("project", "actor", "verb", "created_at")
    list_filter = ("verb",)
    search_fields = ("verb", "project__title", "actor__email")
