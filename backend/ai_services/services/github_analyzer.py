"""Clone a GitHub repo and produce structural metrics + a quality score."""
from __future__ import annotations

import os
import re
import shutil
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings


LANGUAGE_BY_EXT = {
    ".py": "Python", ".js": "JavaScript", ".jsx": "JavaScript",
    ".ts": "TypeScript", ".tsx": "TypeScript",
    ".java": "Java", ".kt": "Kotlin", ".go": "Go",
    ".rb": "Ruby", ".php": "PHP", ".cs": "C#",
    ".c": "C", ".cpp": "C++", ".h": "C", ".hpp": "C++",
    ".rs": "Rust", ".swift": "Swift",
    ".html": "HTML", ".css": "CSS", ".scss": "SCSS",
    ".md": "Markdown", ".sql": "SQL", ".sh": "Shell",
    ".yaml": "YAML", ".yml": "YAML", ".json": "JSON",
}

IGNORE_DIRS = {".git", "node_modules", "__pycache__", "venv", ".venv", "dist", "build", ".next"}


@dataclass
class GithubInsights:
    default_branch: str
    commit_count: int
    contributor_count: int
    languages: dict
    file_count: int
    loc: int
    quality_score: float
    issues: list[dict]


def _safe_clone_dir(repo_url: str) -> Path:
    base = Path(settings.REPO_CLONE_DIR)
    base.mkdir(parents=True, exist_ok=True)
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "_", repo_url)[-60:]
    return Path(tempfile.mkdtemp(prefix=f"{slug}_", dir=base))


def _walk(target: Path):
    for root, dirs, files in os.walk(target):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in files:
            yield Path(root) / f


def analyze(repo_url: str) -> GithubInsights:
    import git  # GitPython

    target = _safe_clone_dir(repo_url)
    try:
        repo = git.Repo.clone_from(repo_url, target, depth=50)

        try:
            default_branch = repo.active_branch.name
        except TypeError:
            default_branch = "HEAD"

        commits = list(repo.iter_commits(max_count=500))
        contributors = {c.author.email for c in commits}

        file_count = 0
        loc = 0
        lang_loc: Counter[str] = Counter()
        issues: list[dict] = []

        for path in _walk(target):
            try:
                if path.stat().st_size > 1_500_000:
                    continue
            except OSError:
                continue
            suffix = path.suffix.lower()
            lang = LANGUAGE_BY_EXT.get(suffix)
            if not lang:
                continue
            file_count += 1
            try:
                text = path.read_text(errors="ignore")
            except Exception:
                continue
            lines = text.count("\n") + 1
            loc += lines
            lang_loc[lang] += lines

        languages = {lang: round(n / loc * 100, 1) for lang, n in lang_loc.most_common()} if loc else {}

        if not (target / "README.md").exists() and not (target / "README").exists():
            issues.append({"severity": "warn", "msg": "No README found at repo root."})
        if not any(target.glob("LICENSE*")):
            issues.append({"severity": "info", "msg": "No LICENSE file detected."})
        has_tests = any(p.name.startswith("test_") or "tests" in p.parts for p in _walk(target))
        if not has_tests:
            issues.append({"severity": "warn", "msg": "No tests directory or test_ files detected."})
        if len(commits) < 5:
            issues.append({"severity": "warn", "msg": f"Only {len(commits)} commits in history."})
        if len(contributors) < 2:
            issues.append({"severity": "info", "msg": "Single contributor — encourage pair work."})

        quality = 100.0
        quality -= 10 * sum(1 for i in issues if i["severity"] == "warn")
        quality -= 3 * sum(1 for i in issues if i["severity"] == "info")
        quality += min(20, len(commits) * 0.5)
        quality = max(0.0, min(100.0, quality))

        return GithubInsights(
            default_branch=default_branch,
            commit_count=len(commits),
            contributor_count=len(contributors),
            languages=languages,
            file_count=file_count,
            loc=loc,
            quality_score=round(quality, 2),
            issues=issues,
        )
    finally:
        shutil.rmtree(target, ignore_errors=True)
