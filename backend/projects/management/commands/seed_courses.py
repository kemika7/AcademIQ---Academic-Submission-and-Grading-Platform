from django.core.management.base import BaseCommand

from projects.models import Course


SEED_COURSES = [
    {
        "code": "PRG400",
        "title": "Advanced Python",
        "term": "2026 Spring",
        "description": "Asynchronous programming, packaging, and advanced testing in Python.",
        "course_code": "PRG400AP",
    },
    {
        "code": "WEB300",
        "title": "Modern Web Development",
        "term": "2026 Spring",
        "description": "Full-stack development with Next.js and Django REST Framework.",
        "course_code": "WEB300MW",
    },
    {
        "code": "DAT250",
        "title": "Applied Data Science",
        "term": "2026 Spring",
        "description": "Data wrangling, visualization, and intro to ML pipelines.",
        "course_code": "DAT250AD",
    },
    {
        "code": "SEC310",
        "title": "Application Security",
        "term": "2026 Fall",
        "description": "OWASP top 10, threat modeling, and secure coding practices.",
        "course_code": "SEC310AS",
    },
]


class Command(BaseCommand):
    help = "Prepopulate the database with a default set of courses."

    def handle(self, *args, **options):
        from accounts.models import User
        instructors = list(User.objects.filter(role__in=["instructor", "admin"]))
        if not instructors:
            self.stdout.write(self.style.WARNING("No instructor found. Courses will be created without instructors."))

        created = 0
        for spec in SEED_COURSES:
            course, was_created = Course.objects.get_or_create(
                code=spec["code"],
                defaults={
                    "title": spec["title"],
                    "term": spec["term"],
                    "description": spec["description"],
                    "course_code": spec["course_code"],
                },
            )
            if instructors:
                course.instructors.add(*instructors)
            
            if was_created:
                created += 1
                self.stdout.write(self.style.SUCCESS(
                    f"Created {course.code} — {course.title} (join code: {course.course_code})"
                ))
            else:
                self.stdout.write(f"Skipped {course.code} (already exists, join code: {course.course_code})")
        self.stdout.write(self.style.SUCCESS(f"Done. {created} new course(s) created."))
