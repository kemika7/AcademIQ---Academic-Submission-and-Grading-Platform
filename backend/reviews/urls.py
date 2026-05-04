from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import GradeView, PeerReviewView, RubricViewSet

router = DefaultRouter()
router.register("rubrics", RubricViewSet, basename="rubric")

urlpatterns = [
    path("submissions/<int:submission_id>/grade/", GradeView.as_view(), name="grade"),
    path("submissions/<int:submission_id>/peer-reviews/", PeerReviewView.as_view(), name="peer-reviews"),
    *router.urls,
]
