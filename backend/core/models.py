from django.conf import settings
from django.db import models


class Activity(models.Model):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="activities"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    verb = models.CharField(max_length=40)
    target_type = models.CharField(max_length=40, blank=True)
    target_id = models.PositiveIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["project", "-created_at"])]

    def __str__(self) -> str:
        actor = self.actor.full_name if self.actor else "system"
        return f"{actor} {self.verb} on {self.project_id}"


def emit(project, actor, verb, target=None, **metadata) -> Activity:
    payload = {
        "project": project,
        "actor": actor,
        "verb": verb,
        "metadata": metadata,
    }
    if target is not None:
        payload["target_type"] = target.__class__.__name__
        payload["target_id"] = target.pk
    return Activity.objects.create(**payload)
