from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AIAnalysisViewSet, GitHubAnalysisViewSet, trigger_github, trigger_report

router = DefaultRouter()
router.register("analyses", AIAnalysisViewSet, basename="analysis")
router.register("github", GitHubAnalysisViewSet, basename="github-analysis")

urlpatterns = [
    path("report/analyze/", trigger_report, name="trigger-report"),
    path("github/analyze/", trigger_github, name="trigger-github"),
    *router.urls,
]
