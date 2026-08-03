import {
  FaBolt,
  FaCircleNotch,
  FaFire,
  FaGripLines,
  FaGripLinesVertical,
  FaLayerGroup,
  FaPaintRoller,
  FaRulerHorizontal,
  FaShieldAlt,
} from "react-icons/fa";

// Category-level display info (icon fallback + blurb + real photo).
// Keys must match the `category` strings that come back from
// /public/products exactly, or a category silently falls back to the
// generic tile below. `image: null` means no photo yet - the card falls
// back to a gradient + icon tile until one is supplied.
//
// Images live in /public/category-images (not imported from src/assets)
// so they get a stable, unhashed URL - Vite content-hashes anything
// imported from src on every build, which would break the Meta catalog
// feed's image_link after each deploy (see backend/app/services/catalog_feed_service.py,
// which mirrors this same category -> filename mapping).
//
// Icons are deliberately from react-icons/fa (already used elsewhere in
// this app) rather than react-icons/gi - the gi set's single entry file is
// ~7MB and crashes Vite's dependency pre-bundler (WebAssembly.Memory.grow()
// RangeError during `vite dev`'s optimizer scan) in this environment.
export const CATEGORY_META = {
  "Welding Electrodes": {
    icon: FaBolt,
    blurb: "Stick electrodes for mild steel, stainless and cast iron work.",
    image: "/category-images/welding-electrodes.jpg",
  },
  "MIG / MAG Welding Wire": {
    icon: FaGripLines,
    blurb: "Solid and cored wire spools for MIG/MAG welding.",
    image: "/category-images/mig-wire.jpg",
  },
  "TIG Filler Rods": {
    icon: FaRulerHorizontal,
    blurb: "Precision filler rods for clean, controlled TIG welds.",
    image: "/category-images/tig-wire.jpg",
  },
  Primers: {
    icon: FaPaintRoller,
    blurb: "Surface primers for corrosion resistance and finish prep.",
    image: "/category-images/primer.webp",
  },
  "Cutting & Grinding": {
    icon: FaFire,
    blurb: "Cutting and grinding tools and accessories.",
    image: "/category-images/grind-cut.jpg",
  },
  "Tungsten Electrodes": {
    icon: FaGripLinesVertical,
    blurb: "Non-consumable tungsten electrodes for precision TIG welding.",
    image: "/category-images/tungsten.jpg",
  },
  "SAW Wire & Flux": {
    icon: FaLayerGroup,
    blurb: "Submerged arc welding wire and flux for heavy-duty fabrication.",
    image: "/category-images/saw-wire-flux.jpg",
  },
  "Flux Cored Wires": {
    icon: FaCircleNotch,
    blurb: "Carbon steel, stainless, metal-cored and hard-facing FCAW wires.",
    image: "/category-images/flux-core-wire.jpg",
  },
  "Hard Facing": {
    icon: FaShieldAlt,
    blurb: "Wear-resistant hard-facing consumables for surfacing and rebuilding.",
    image: "/category-images/hard-facing.png",
  },
};

export const DEFAULT_CATEGORY_META = {
  icon: FaRulerHorizontal,
  blurb: "Browse this category's products.",
  image: null,
};

export function getCategoryMeta(category) {
  return CATEGORY_META[category] || DEFAULT_CATEGORY_META;
}
