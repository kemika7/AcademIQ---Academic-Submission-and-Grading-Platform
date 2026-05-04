from django.conf import settings
from django.db import models


class Submission(models.Model):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="submissions"
    )
    version = models.PositiveIntegerField()
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    group = models.ForeignKey(
        "projects.Group",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submissions",
    )
    report_file = models.FileField(upload_to="reports/", blank=True, null=True)
    github_url = models.URLField(blank=True)
    notes = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("project", "version")
        ordering = ["-version"]

    def __str__(self) -> str:
        return f"{self.project.title} v{self.version}"
