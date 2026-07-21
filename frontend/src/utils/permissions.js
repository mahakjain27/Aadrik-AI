export const permissions = {
  admin: [
    "dashboard",
    "products",
    "product_admin",
    "knowledge_admin",
    "analytics",
    "customers",
    "policies",
    "company",
    "settings",
    "users",
    "activity",
    "inbox",
  ],

  sales: [
    "dashboard",
    "products",
    "customers",
    "inbox",
  ],

  manager: [
    "dashboard",
    "analytics",
    "customers",
    "products",
    "product_admin",
    "knowledge_admin",
    "inbox",
  ],

  viewer: [
    "policies",
    "products",
  ],
};

export function canAccess(role, page) {
  if (!role) return false;

  return permissions[role]?.includes(page);
}
