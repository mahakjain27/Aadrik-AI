# Mirrors frontend/src/website/data/categoryMeta.js's CATEGORY_META image
# paths - keep the two in sync. Products don't have per-SKU photos yet, so
# the Meta/WhatsApp catalog feed (see app/services/catalog_feed_service.py)
# reuses each product's category photo instead.
CATEGORY_IMAGE_PATHS: dict[str, str] = {
    "Welding Electrodes": "/category-images/welding-electrodes.jpg",
    "MIG / MAG Welding Wire": "/category-images/mig-wire.jpg",
    "TIG Filler Rods": "/category-images/tig-wire.jpg",
    "Primers": "/category-images/primer.webp",
    "Cutting & Grinding": "/category-images/grind-cut.jpg",
    "Tungsten Electrodes": "/category-images/tungsten.jpg",
    "SAW Wire & Flux": "/category-images/saw-wire-flux.jpg",
    "Flux Cored Wires": "/category-images/flux-core-wire.jpg",
    "Hard Facing": "/category-images/hard-facing.png",
}

DEFAULT_CATEGORY_IMAGE_PATH = "/updlogo.jpeg"
