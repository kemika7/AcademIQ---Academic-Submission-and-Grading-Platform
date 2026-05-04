from django.contrib import admin

from .models import AIAnalysis, GitHubAnalysis


@admin.register(AIAnalysis)
class AIAnalysisAdmin(admin.ModelAdmin):
    list_display = ("submission", "kind", "status", "started_at", "finished_at")
    list_filter = ("kind", "status")


@admin.register(GitHubAnalysis)
class GitHubAnalysisAdmin(admin.ModelAdmin):
    list_display = ("submission", "repo_url", "quality_score", "analyzed_at")
