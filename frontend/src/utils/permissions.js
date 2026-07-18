export const permissions = {
  admin: [
    "chat",
    "products",
    "product_admin",
    "knowledge_admin",
    "dashboard",
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
    "chat",
    "products",
    "dashboard",
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
    "chat",
    "products",
  ],
};

export function canAccess(role, page) {
  if (!role) return false;

  return permissions[role]?.includes(page);
}
