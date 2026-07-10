from pathlib import Path

from app.core.logging import setup_logger

logger = setup_logger(__name__)

# Locate the knowledge_base folder
KNOWLEDGE_PATH = Path(__file__).resolve().parents[3] / "knowledge_base"


def load_company_knowledge():
    """
    Reads all markdown files from the knowledge_base folder
    and combines them into a single string.
    """

    logger.info("Loading company knowledge base")

    if not KNOWLEDGE_PATH.exists():
        logger.error(f"Knowledge base folder not found: {KNOWLEDGE_PATH}")
        raise FileNotFoundError(f"{KNOWLEDGE_PATH} does not exist.")

    knowledge = ""
    files_loaded = 0

    try:
        for file in KNOWLEDGE_PATH.glob("*.md"):
            logger.info(f"Loading knowledge file: {file.name}")

            with open(file, "r", encoding="utf-8") as f:
                knowledge += f"\n\n===== {file.stem.upper()} =====\n"
                knowledge += f.read()

            files_loaded += 1

        logger.info(
            f"Knowledge base loaded successfully ({files_loaded} files)"
        )

        return knowledge

    except Exception:
        logger.exception("Failed to load company knowledge base")
        raise