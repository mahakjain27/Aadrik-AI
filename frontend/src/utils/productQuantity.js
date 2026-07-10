// Quantity units differ by product line and aren't comparable to each other
// (kg vs. boxes vs. coils vs. packets). This is the single source of truth
// for which unit a product is sold in, used both to hint customers on the
// quotation form and to normalize quantity in AI lead scoring.
const QUANTITY_CATEGORIES = [
  { key: "coils", test: /\bmig\b|\bmag\b/i, label: "coil order", unit: "Coils" },
  { key: "kg", test: /\btig\b/i, label: "order size", unit: "Kg" },
  { key: "boxes", test: /6013/i, label: "box order", unit: "Boxes" },
];
const PACKETS_CATEGORY = { key: "packets", label: "packet order", unit: "Packets" };

export function categorizeQuantity(productName) {
  const name = productName || "";
  return QUANTITY_CATEGORIES.find((c) => c.test.test(name)) || PACKETS_CATEGORY;
}
