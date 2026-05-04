from rest_framework.routers import DefaultRouter

from .views import CourseViewSet, GroupViewSet, ProjectViewSet

router = DefaultRouter()
router.register("courses", CourseViewSet, basename="course")
router.register("groups", GroupViewSet, basename="group")
router.register("projects", ProjectViewSet, basename="project")

urlpatterns = router.urls
