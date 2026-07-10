import json
from functools import lru_cache
from pathlib import Path

from app.core.logging import setup_logger

logger = setup_logger(__name__)

BASE_DIR = Path(__file__).resolve().parents[3]
PRODUCTS_PATH = BASE_DIR / "data" / "products.json"


@lru_cache(maxsize=1)
def get_catalog() -> dict:
    logger.info("Loading product catalog")

    try:
        with open(PRODUCTS_PATH, encoding="utf-8") as f:
            catalog = json.load(f)

        logger.info(f"Product catalog loaded successfully ({len(catalog)} categories)")

        return catalog

    except FileNotFoundError:
        logger.exception(f"Product catalog not found: {PRODUCTS_PATH}")
        raise

    except json.JSONDecodeError:
        logger.exception("Invalid JSON format in products.json")
        raise

    except Exception:
        logger.exception("Unexpected error while loading product catalog")
        raise
