from django.db import transaction

from core.models import emit
from projects.models import Project

from .models import Submission


@transaction.atomic
def create_submission(*, project: Project, user, group=None, report_file=None, github_url="", notes="") -> Submission:
    """Create or update the student's single submission for this project.

    One submission per (project, user-or-group). Resubmitting replaces the
    previous content in place rather than creating a new version.
    """
    if group is not None:
        existing = project.submissions.filter(group=group).first()
    else:
        existing = project.submissions.filter(
            submitted_by=user, group__isnull=True,
        ).first()

    if existing is not None:
        if report_file is not None:
            existing.report_file = report_file
        existing.github_url = github_url
        existing.notes = notes
        existing.submitted_by = user
        existing.save()
        sub = existing
    else:
        sub = Submission.objects.create(
            project=project,
            version=1,
            submitted_by=user,
            group=group,
            report_file=report_file,
            github_url=github_url,
            notes=notes,
        )

    project.status = Project.Status.SUBMITTED
    project.save(update_fields=["status", "updated_at"])
    emit(project, user, "submitted", target=sub, version=sub.version)

    from ai_services.tasks import analyze_github, analyze_report

    if sub.report_file:
        analyze_report.delay(sub.id)
    if sub.github_url:
        analyze_github.delay(sub.id)
    return sub
