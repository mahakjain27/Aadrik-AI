import { useEffect, useState } from "react";

import { getPublicProducts } from "../../services/api";

// Same catalog the dashboard uses (see /public/products in
// backend/app/api/products.py — an unauthenticated mirror of /products,
// added specifically so the public site isn't stuck on placeholder data).
export function useProductCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getPublicProducts()
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the product catalog right now.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, loading, error };
}
