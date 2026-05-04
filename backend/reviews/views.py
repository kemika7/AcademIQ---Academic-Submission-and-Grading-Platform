from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import emit
from core.permissions import IsInstructor, can_access_submission
from projects.models import Project
from submissions.models import Submission

from .models import Grade, PeerReview, Rubric
from .serializers import GradeSerializer, PeerReviewSerializer, RubricSerializer


class RubricViewSet(viewsets.ModelViewSet):
    queryset = Rubric.objects.prefetch_related("criteria").all()
    serializer_class = RubricSerializer
    filterset_fields = ["course", "is_active"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsInstructor()]
        return [permissions.IsAuthenticated()]


class GradeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, submission_id):
        sub = get_object_or_404(Submission, pk=submission_id)
        if not can_access_submission(request.user, sub):
            return Response({"detail": "Forbidden."}, status=403)
        grades_qs = sub.grades.select_related("student").all()
        # Students only see their own grade.
        if request.user.role == "student":
            grades_qs = grades_qs.filter(student=request.user)
        grades = list(grades_qs)
        if not grades:
            return Response({"detail": "Not graded."}, status=404)
        return Response(GradeSerializer(grades, many=True).data)

    def post(self, request, submission_id):
        if request.user.role not in ("instructor", "admin"):
            return Response({"detail": "Forbidden."}, status=403)
        sub = get_object_or_404(Submission, pk=submission_id)
        student_id = request.data.get("student")
        if not student_id:
            return Response({"detail": "student is required."}, status=400)
        if sub.grades.filter(student_id=student_id).exists():
            return Response({"detail": "This student has already been graded for this submission."}, status=400)
        data = {**request.data, "submission": sub.id, "student": student_id}
        ser = GradeSerializer(data=data)
        ser.is_valid(raise_exception=True)
        grade = ser.save(graded_by=request.user)
        # Mark project graded once everyone in scope has been graded.
        if sub.group_id:
            members = sub.group.memberships.values_list("user_id", flat=True)
            graded = sub.grades.values_list("student_id", flat=True)
            if set(members).issubset(set(graded)):
                sub.project.status = Project.Status.GRADED
                sub.project.save(update_fields=["status", "updated_at"])
        else:
            sub.project.status = Project.Status.GRADED
            sub.project.save(update_fields=["status", "updated_at"])
        emit(sub.project, request.user, "graded", target=grade, total=float(grade.total_score), student_id=int(student_id))
        return Response(GradeSerializer(grade).data, status=status.HTTP_201_CREATED)


class PeerReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, submission_id):
        sub = get_object_or_404(Submission, pk=submission_id)
        if not can_access_submission(request.user, sub):
            return Response({"detail": "Forbidden."}, status=403)
        qs = PeerReview.objects.filter(submission_id=submission_id)
        return Response(PeerReviewSerializer(qs, many=True).data)

    def post(self, request, submission_id):
        sub = get_object_or_404(Submission, pk=submission_id)
        if not can_access_submission(request.user, sub):
            return Response({"detail": "Forbidden."}, status=403)
        ser = PeerReviewSerializer(data={**request.data, "submission": sub.id})
        ser.is_valid(raise_exception=True)
        ser.save(reviewer=request.user)
        return Response(ser.data, status=201)
