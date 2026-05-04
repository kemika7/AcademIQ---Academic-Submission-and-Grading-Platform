from django.contrib import admin

from .models import CriterionScore, Grade, PeerReview, Rubric, RubricCriterion


class CriterionInline(admin.TabularInline):
    model = RubricCriterion
    extra = 1


@admin.register(Rubric)
class RubricAdmin(admin.ModelAdmin):
    inlines = [CriterionInline]
    list_display = ("name", "course", "is_active")


@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ("submission", "total_score", "graded_by", "graded_at")


admin.site.register(PeerReview)
admin.site.register(CriterionScore)
