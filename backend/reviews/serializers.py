from rest_framework import serializers

from .models import CriterionScore, Grade, PeerReview, Rubric, RubricCriterion


class RubricCriterionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RubricCriterion
        fields = ("id", "label", "description", "weight", "max_score", "order")


class RubricSerializer(serializers.ModelSerializer):
    criteria = RubricCriterionSerializer(many=True)

    class Meta:
        model = Rubric
        fields = ("id", "course", "name", "is_active", "criteria", "created_at")

    def create(self, validated):
        criteria = validated.pop("criteria", [])
        rubric = Rubric.objects.create(**validated)
        for c in criteria:
            RubricCriterion.objects.create(rubric=rubric, **c)
        return rubric


class CriterionScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = CriterionScore
        fields = ("id", "criterion", "score", "comment")


class GradeSerializer(serializers.ModelSerializer):
    scores = CriterionScoreSerializer(many=True)
    student_name = serializers.CharField(source="student.full_name", read_only=True, default=None)

    class Meta:
        model = Grade
        fields = (
            "id", "submission", "student", "student_name",
            "rubric", "graded_by", "total_score", "feedback", "scores", "graded_at",
        )
        read_only_fields = ("graded_by", "total_score", "graded_at")

    def create(self, validated):
        scores_data = validated.pop("scores", [])
        rubric = validated["rubric"]
        # weighted total: sum(score / max_score * weight)
        total = 0
        weight_total = sum(c.weight for c in rubric.criteria.all()) or 1
        criteria_by_id = {c.id: c for c in rubric.criteria.all()}
        for s in scores_data:
            crit = criteria_by_id.get(s["criterion"].id if hasattr(s["criterion"], "id") else s["criterion"])
            if not crit:
                continue
            total += float(s["score"]) / float(crit.max_score) * float(crit.weight)
        validated["total_score"] = round(total / float(weight_total) * 100, 2)
        grade = Grade.objects.create(**validated)
        for s in scores_data:
            CriterionScore.objects.create(grade=grade, **s)
        return grade


class PeerReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = PeerReview
        fields = ("id", "submission", "reviewer", "rating", "comment", "created_at")
        read_only_fields = ("reviewer",)
