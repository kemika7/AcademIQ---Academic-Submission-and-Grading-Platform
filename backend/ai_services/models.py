from django.db import models


class AIAnalysis(models.Model):
    class Kind(models.TextChoices):
        REPORT = "report", "Report"
        GITHUB = "github", "GitHub"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        DONE = "done", "Done"
        FAILED = "failed", "Failed"

    submission = models.ForeignKey(
        "submissions.Submission", on_delete=models.CASCADE, related_name="analyses"
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    summary = models.TextField(blank=True)
    weaknesses = models.JSONField(default=list, blank=True)
    suggestions = models.JSONField(default=list, blank=True)
    raw = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-id"]


class GitHubAnalysis(models.Model):
    submission = models.OneToOneField(
        "submissions.Submission", on_delete=models.CASCADE, related_name="github_analysis"
    )
    repo_url = models.URLField()
    default_branch = models.CharField(max_length=80, blank=True)
    commit_count = models.PositiveIntegerField(default=0)
    contributor_count = models.PositiveIntegerField(default=0)
    languages = models.JSONField(default=dict, blank=True)
    file_count = models.PositiveIntegerField(default=0)
    loc = models.PositiveIntegerField(default=0)
    quality_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    issues = models.JSONField(default=list, blank=True)
    analyzed_at = models.DateTimeField(auto_now=True)
