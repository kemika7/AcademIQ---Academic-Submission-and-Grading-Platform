from django.conf import settings
from django.db import models


class Rubric(models.Model):
    course = models.ForeignKey(
        "projects.Course", on_delete=models.CASCADE, related_name="rubrics"
    )
    name = models.CharField(max_length=160)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.name} ({self.course.code})"


class RubricCriterion(models.Model):
    rubric = models.ForeignKey(Rubric, on_delete=models.CASCADE, related_name="criteria")
    label = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    weight = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    max_score = models.PositiveIntegerField(default=10)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order"]


class Grade(models.Model):
    submission = models.ForeignKey(
        "submissions.Submission", on_delete=models.CASCADE, related_name="grades"
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="grades_received",
        null=True, blank=True,
    )
    rubric = models.ForeignKey(Rubric, on_delete=models.PROTECT)
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="grades_given",
    )
    total_score = models.DecimalField(max_digits=6, decimal_places=2)
    feedback = models.TextField(blank=True)
    graded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["submission", "student"], name="unique_grade_per_student"),
        ]


class CriterionScore(models.Model):
    grade = models.ForeignKey(Grade, on_delete=models.CASCADE, related_name="scores")
    criterion = models.ForeignKey(RubricCriterion, on_delete=models.PROTECT)
    score = models.DecimalField(max_digits=5, decimal_places=2)
    comment = models.TextField(blank=True)


class PeerReview(models.Model):
    submission = models.ForeignKey(
        "submissions.Submission", on_delete=models.CASCADE, related_name="peer_reviews"
    )
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("submission", "reviewer")
