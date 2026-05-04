from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AdminUserViewSet, LoginView, MeView, RefreshView, RegisterView, admin_analytics, admin_stats

router = DefaultRouter()
router.register("admin/users", AdminUserViewSet, basename="admin-users")

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("admin/stats/", admin_stats, name="admin-stats"),
    path("admin/analytics/", admin_analytics, name="admin-analytics"),
    *router.urls,
]
