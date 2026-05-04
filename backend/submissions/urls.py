from django.urls import path

from .views import FeedViewSet, InboxViewSet, SubmissionViewSet

submission_list = SubmissionViewSet.as_view({"get": "list", "post": "create"})
submission_detail = SubmissionViewSet.as_view({"get": "retrieve", "patch": "partial_update"})
submission_reanalyze = SubmissionViewSet.as_view({"post": "reanalyze"})
inbox = InboxViewSet.as_view({"get": "list"})
feed = FeedViewSet.as_view({"get": "list"})

urlpatterns = [
    path("projects/<int:project_pk>/submissions/", submission_list, name="submission-list"),
    path("projects/<int:project_pk>/submissions/<int:pk>/", submission_detail, name="submission-detail"),
    path("projects/<int:project_pk>/submissions/<int:pk>/reanalyze/", submission_reanalyze, name="submission-reanalyze"),
    path("inbox/", inbox, name="inbox"),
    path("feed/", feed, name="feed"),
]
