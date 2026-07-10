import re
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/knowledge", tags=["Knowledge"])

BASE_DIR = Path(__file__).resolve().parents[3]
KNOWLEDGE_BASE = BASE_DIR / "knowledge_base"

HEADER_RE = re.compile(r"^#{1,2}\s+(.+?)\s*$")
HR_RE = re.compile(r"^-{3,}$")
AI_ONLY_TITLES = {"ai assistant guidance", "ai assistant knowledge"}


def parse_sections(text: str):
    sections = []
    title = None
    body_lines = []

    def flush():
        if title is None:
            return
        lines = [ln for ln in body_lines if not HR_RE.match(ln.strip())]
        body = "\n".join(lines).strip()
        if not body or title.lower() in AI_ONLY_TITLES:
            return
        sections.append({"title": title, "body": body})

    for line in text.splitlines():
        match = HEADER_RE.match(line)
        if match:
            flush()
            title = match.group(1)
            body_lines = []
        else:
            body_lines.append(line)

    flush()
    return sections


def load_sections(filename: str):
    path = KNOWLEDGE_BASE / filename
    if not path.exists():
        raise HTTPException(404, f"{filename} not found")
    return parse_sections(path.read_text(encoding="utf-8"))


@router.get("/policies")
def get_policies():
    return load_sections("policies.md")


@router.get("/company")
def get_company():
    return load_sections("company.md")
