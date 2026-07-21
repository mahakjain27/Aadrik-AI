export function productTitle(product) {
  return product.grade ? `${product.name} — ${product.grade}` : product.name;
}

export function productBlurb(product) {
  if (product.applications?.length) {
    return `Used for: ${product.applications.join(", ")}`;
  }
  if (product.sizes?.length) {
    return `Available sizes: ${product.sizes.join(", ")}`;
  }
  return product.subcategory || product.category;
}

export function productSearchText(product) {
  return [
    product.category,
    product.subcategory,
    product.brand,
    product.name,
    product.grade,
    ...(product.sizes || []),
    ...(product.applications || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
