const NO_SUBCATEGORY = "General";

export function groupProducts(products) {
  const groups = {};

  for (const product of products) {
    const subcategoryKey = product.subcategory || NO_SUBCATEGORY;
    const brandKey = product.brand || "Other";

    if (!groups[product.category]) groups[product.category] = {};
    if (!groups[product.category][subcategoryKey]) groups[product.category][subcategoryKey] = {};
    if (!groups[product.category][subcategoryKey][brandKey]) {
      groups[product.category][subcategoryKey][brandKey] = [];
    }

    groups[product.category][subcategoryKey][brandKey].push(product);
  }

  return groups;
}

export function hasSubcategory(subcategoryKey) {
  return subcategoryKey !== NO_SUBCATEGORY;
}

export function gradeLabel(product) {
  if (!product.grade) return null;

  return Array.isArray(product.grade) ? product.grade.join(" / ") : product.grade;
}
