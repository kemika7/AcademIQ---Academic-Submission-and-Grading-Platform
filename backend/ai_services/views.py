from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from core.permissions import can_access_submission
from submissions.models import Submission

from .models import AIAnalysis, GitHubAnalysis
from .serializers import AIAnalysisSerializer, GitHubAnalysisSerializer
from .tasks import analyze_github, analyze_report


def _accessible_submission_ids(user):
    """Submission ids the user is allowed to read."""
    if user.role in ("instructor", "admin"):
        return None  # sentinel: no filter
    return Submission.objects.filter(
        Q(submitted_by=user) | Q(group__memberships__user=user)
    ).values_list("id", flat=True)


class AIAnalysisViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AIAnalysisSerializer
    filterset_fields = ["submission", "kind", "status"]

    def get_queryset(self):
        ids = _accessible_submission_ids(self.request.user)
        qs = AIAnalysis.objects.all()
        if ids is None:
            return qs
        return qs.filter(submission_id__in=ids)


class GitHubAnalysisViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = GitHubAnalysisSerializer
    filterset_fields = ["submission"]

    def get_queryset(self):
        ids = _accessible_submission_ids(self.request.user)
        qs = GitHubAnalysis.objects.all()
        if ids is None:
            return qs
        return qs.filter(submission_id__in=ids)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def trigger_report(request):
    sid = request.data.get("submission_id")
    if not sid:
        return Response({"detail": "submission_id required."}, status=400)
    sub = get_object_or_404(Submission, pk=int(sid))
    if not can_access_submission(request.user, sub):
        return Response({"detail": "Forbidden."}, status=403)
    analyze_report.delay(sub.id)
    return Response({"detail": "Dispatched."}, status=202)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def trigger_github(request):
    sid = request.data.get("submission_id")
    if not sid:
        return Response({"detail": "submission_id required."}, status=400)
    sub = get_object_or_404(Submission, pk=int(sid))
    if not can_access_submission(request.user, sub):
        return Response({"detail": "Forbidden."}, status=403)
    analyze_github.delay(sub.id)
    return Response({"detail": "Dispatched."}, status=202)
