from rest_framework import serializers

from .models import AIAnalysis, GitHubAnalysis


class AIAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAnalysis
        fields = (
            "id", "submission", "kind", "status",
            "summary", "weaknesses", "suggestions", "raw", "error",
            "started_at", "finished_at",
        )


class GitHubAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = GitHubAnalysis
        fields = (
            "id", "submission", "repo_url", "default_branch",
            "commit_count", "contributor_count",
            "languages", "file_count", "loc",
            "quality_score", "issues", "analyzed_at",
        )
