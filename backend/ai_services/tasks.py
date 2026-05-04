from __future__ import annotations

import logging
from datetime import datetime, timezone

from celery import shared_task

from .models import AIAnalysis, GitHubAnalysis

log = logging.getLogger(__name__)


def _now():
    return datetime.now(tz=timezone.utc)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def analyze_report(self, submission_id: int) -> int:
    from submissions.models import Submission
    from .services.report_analyzer import analyze

    sub = Submission.objects.get(pk=submission_id)
    record = AIAnalysis.objects.create(
        submission=sub, kind=AIAnalysis.Kind.REPORT,
        status=AIAnalysis.Status.RUNNING, started_at=_now(),
    )
    try:
        if not sub.report_file:
            raise ValueError("No report file attached.")
        insights = analyze(sub.report_file.path)
        record.summary = insights.summary
        record.weaknesses = insights.weaknesses
        record.suggestions = insights.suggestions
        record.raw = insights.raw
        record.status = AIAnalysis.Status.DONE
    except Exception as e:
        log.exception("analyze_report failed for submission=%s", submission_id)
        record.status = AIAnalysis.Status.FAILED
        record.error = str(e)
    finally:
        record.finished_at = _now()
        record.save()
    return record.id


def _summarize_github(insights) -> tuple[str, list[str], list[str]]:
    """Build a qualitative paragraph + actionable weaknesses/suggestions from raw metrics."""
    primary_lang = next(iter(insights.languages), None)
    lang_phrase = f"primarily {primary_lang}" if primary_lang else "no recognized source files"
    if len(insights.languages) > 1:
        rest = list(insights.languages)[1:3]
        lang_phrase += f" with {', '.join(rest)}"

    score = insights.quality_score
    if score >= 80:
        verdict = "in strong shape"
    elif score >= 60:
        verdict = "in reasonable shape, with a few gaps"
    elif score >= 40:
        verdict = "rough — several engineering hygiene items are missing"
    else:
        verdict = "early-stage; significant structural work needed"

    summary = (
        f"This repository is {lang_phrase} ({insights.loc:,} LOC across {insights.file_count} files). "
        f"History shows {insights.commit_count} commit{'s' if insights.commit_count != 1 else ''} "
        f"from {insights.contributor_count} contributor{'s' if insights.contributor_count != 1 else ''}. "
        f"Overall, the project is {verdict} (quality score {score:g}/100)."
    )

    weaknesses: list[str] = []
    suggestions: list[str] = []
    for issue in insights.issues:
        target = weaknesses if issue["severity"] == "warn" else suggestions
        target.append(issue["msg"])

    if insights.loc and insights.loc < 200:
        weaknesses.append(f"Codebase is small ({insights.loc} LOC) — consider whether the project demonstrates enough depth.")
    if insights.commit_count >= 5 and insights.commit_count < 15:
        suggestions.append("Commit cadence is light; small, frequent commits make code review easier and progress visible.")
    if insights.commit_count >= 15:
        suggestions.append(f"Healthy commit history ({insights.commit_count} commits) — keep using descriptive messages tied to features.")
    if not any("README" in i["msg"] for i in insights.issues):
        suggestions.append("README is present; make sure it covers setup, usage, and architecture overview.")
    if primary_lang in {"Python", "JavaScript", "TypeScript"}:
        suggestions.append(f"For {primary_lang} projects, add a linter/formatter config (ruff/eslint+prettier) if not already in place.")

    return summary, weaknesses, suggestions


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def analyze_github(self, submission_id: int) -> int:
    from submissions.models import Submission
    from .services.github_analyzer import analyze

    sub = Submission.objects.get(pk=submission_id)
    record = AIAnalysis.objects.create(
        submission=sub, kind=AIAnalysis.Kind.GITHUB,
        status=AIAnalysis.Status.RUNNING, started_at=_now(),
    )
    try:
        if not sub.github_url:
            raise ValueError("No GitHub URL provided.")

        record.summary = "Cloning repository..."
        record.save(update_fields=["summary"])

        insights = analyze(sub.github_url)

        ga, _ = GitHubAnalysis.objects.update_or_create(
            submission=sub,
            defaults=dict(
                repo_url=sub.github_url,
                default_branch=insights.default_branch,
                commit_count=insights.commit_count,
                contributor_count=insights.contributor_count,
                languages=insights.languages,
                file_count=insights.file_count,
                loc=insights.loc,
                quality_score=insights.quality_score,
                issues=insights.issues,
            ),
        )

        summary, weaknesses, suggestions = _summarize_github(insights)
        record.summary = summary
        record.weaknesses = weaknesses
        record.suggestions = suggestions
        record.raw = {
            "languages": insights.languages,
            "metrics": {
                "commit_count": insights.commit_count,
                "contributor_count": insights.contributor_count,
                "file_count": insights.file_count,
                "loc": insights.loc,
                "quality_score": insights.quality_score,
            },
            "github_analysis_id": ga.id,
        }
        record.status = AIAnalysis.Status.DONE
    except Exception as e:
        log.exception("analyze_github failed for submission=%s", submission_id)
        record.status = AIAnalysis.Status.FAILED
        record.error = str(e)
    finally:
        record.finished_at = _now()
        record.save()
    return record.id
