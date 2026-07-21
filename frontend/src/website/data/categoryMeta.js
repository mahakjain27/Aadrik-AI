import {
  FaBolt,
  FaCircleNotch,
  FaFire,
  FaGripLines,
  FaGripLinesVertical,
  FaLayerGroup,
  FaPaintRoller,
  FaRulerHorizontal,
} from "react-icons/fa";

import weldingElectrodesPhoto from "../assets/WELDING_ELECTRODES.jpg";
import migWirePhoto from "../assets/MIG_WIRE.jpg";
import tigWirePhoto from "../assets/TIG_WIRE.jpg";
import primerPhoto from "../assets/primer.webp";
import grindCutPhoto from "../assets/grind&cut.jpg";
import tungstenPhoto from "../assets/tungsten.jpg";
import sawWireFluxPhoto from "../assets/S.A.W_WIRE_AND_FLUX.jpg";
import fluxCoreWirePhoto from "../assets/FLUX_CORE_WIRE.jpg";

// Category-level display info (icon fallback + blurb + real photo).
// Keys must match the `category` strings that come back from
// /public/products exactly, or a category silently falls back to the
// generic tile below. `image: null` means no photo yet - the card falls
// back to a gradient + icon tile until one is supplied.
//
// Icons are deliberately from react-icons/fa (already used elsewhere in
// this app) rather than react-icons/gi - the gi set's single entry file is
// ~7MB and crashes Vite's dependency pre-bundler (WebAssembly.Memory.grow()
// RangeError during `vite dev`'s optimizer scan) in this environment.
export const CATEGORY_META = {
  "Welding Electrodes": {
    icon: FaBolt,
    blurb: "Stick electrodes for mild steel, stainless and cast iron work.",
    image: weldingElectrodesPhoto,
  },
  "MIG / MAG Welding Wire": {
    icon: FaGripLines,
    blurb: "Solid and cored wire spools for MIG/MAG welding.",
    image: migWirePhoto,
  },
  "TIG Filler Rods": {
    icon: FaRulerHorizontal,
    blurb: "Precision filler rods for clean, controlled TIG welds.",
    image: tigWirePhoto,
  },
  Primers: {
    icon: FaPaintRoller,
    blurb: "Surface primers for corrosion resistance and finish prep.",
    image: primerPhoto,
  },
  "Cutting & Grinding": {
    icon: FaFire,
    blurb: "Cutting and grinding tools and accessories.",
    image: grindCutPhoto,
  },
  "Tungsten Electrodes": {
    icon: FaGripLinesVertical,
    blurb: "Non-consumable tungsten electrodes for precision TIG welding.",
    image: tungstenPhoto,
  },
  "SAW Wire & Flux": {
    icon: FaLayerGroup,
    blurb: "Submerged arc welding wire and flux for heavy-duty fabrication.",
    image: sawWireFluxPhoto,
  },
  "Flux Cored Wires": {
    icon: FaCircleNotch,
    blurb: "Carbon steel, stainless, metal-cored and hard-facing FCAW wires.",
    image: fluxCoreWirePhoto,
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
