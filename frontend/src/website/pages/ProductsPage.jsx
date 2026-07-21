import { useMemo, useState } from "react";
import { FaArrowLeft, FaSearch } from "react-icons/fa";

import Reveal from "../components/Reveal";
import CategoryCard from "../components/CategoryCard";
import ProductCard from "../components/ProductCard";
import ProductDetailModal from "../components/ProductDetailModal";
import { useProductCatalog } from "../hooks/useProductCatalog";
import { productSearchText } from "../utils/productDisplay";

export default function ProductsPage() {
  const { catalog, loading, error } = useProductCatalog();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activeProduct, setActiveProduct] = useState(null);

  const isSearching = search.trim().length > 0;

  const countsByCategory = useMemo(() => {
    const counts = {};
    for (const product of catalog?.products || []) {
      counts[product.category] = (counts[product.category] || 0) + 1;
    }
    return counts;
  }, [catalog]);

  const visibleProducts = useMemo(() => {
    if (!catalog) return [];

    const query = search.trim().toLowerCase();

    return catalog.products.filter((product) => {
      const matchesCategory = isSearching
        ? true
        : product.category === selectedCategory;
      const matchesSearch = query ? productSearchText(product).includes(query) : true;

      return matchesCategory && matchesSearch;
    });
  }, [catalog, search, selectedCategory, isSearching]);

  function openCategory(category) {
    setSelectedCategory(category);
    setSearch("");
  }

  function backToCategories() {
    setSelectedCategory(null);
    setSearch("");
  }

  const showCategoryGrid = !isSearching && !selectedCategory;

  return (
    <section className="tw-mx-auto tw-max-w-7xl tw-px-6 tw-py-20 lg:tw-px-10">
      <Reveal className="tw-text-center">
        <p className="tw-text-sm tw-font-semibold tw-uppercase tw-tracking-widest tw-text-aadrik-wine">
          Catalog
        </p>
        <h1 className="tw-mt-4 tw-text-4xl tw-font-extrabold tw-text-aadrik-charcoal">
          Product Catalog
        </h1>
        <p className="tw-mx-auto tw-mt-4 tw-max-w-2xl tw-text-lg tw-text-aadrik-charcoal/60">
          Electrodes, wires, machines, cutting equipment and safety gear — browse
          what we supply, then ask our AI assistant or request a quote.
        </p>
      </Reveal>

      <Reveal delay={100}>
        <div className="tw-mx-auto tw-mt-10 tw-max-w-3xl">
          <div className="tw-relative">
            <FaSearch className="tw-pointer-events-none tw-absolute tw-left-4 tw-top-1/2 tw--translate-y-1/2 tw-text-aadrik-charcoal/30" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                selectedCategory
                  ? `Search in ${selectedCategory}...`
                  : "Search all products or brands..."
              }
              className="tw-w-full tw-rounded-full tw-border tw-border-aadrik-charcoal/10 tw-bg-white tw-py-3 tw-pl-11 tw-pr-4 tw-text-sm tw-text-aadrik-charcoal tw-outline-none tw-transition-shadow tw-duration-200 focus:tw-shadow-aadrik-card"
            />
          </div>
        </div>
      </Reveal>

      {loading && (
        <p className="tw-mt-16 tw-text-center tw-text-aadrik-charcoal/50">
          Loading products...
        </p>
      )}

      {error && (
        <p className="tw-mt-16 tw-text-center tw-text-aadrik-wine">{error}</p>
      )}

      {!loading && !error && catalog && (
        <>
          {showCategoryGrid ? (
            <div className="tw-mt-14 tw-grid tw-grid-cols-1 tw-gap-6 sm:tw-grid-cols-2 lg:tw-grid-cols-4">
              {catalog.categories.map((category, i) => (
                <Reveal key={category} delay={i * 80}>
                  <CategoryCard
                    category={category}
                    count={countsByCategory[category] || 0}
                    onSelect={openCategory}
                  />
                </Reveal>
              ))}
            </div>
          ) : (
            <>
              {!isSearching && selectedCategory && (
                <button
                  type="button"
                  onClick={backToCategories}
                  className="tw-mt-10 tw-inline-flex tw-appearance-none tw-items-center tw-gap-2 tw-p-0 tw-text-sm tw-font-semibold tw-text-aadrik-wine"
                >
                  <FaArrowLeft size={12} />
                  All Categories
                </button>
              )}

              {isSearching && selectedCategory && (
                <p className="tw-mt-10 tw-text-center tw-text-sm tw-text-aadrik-charcoal/50">
                  Searching in <span className="tw-font-semibold tw-text-aadrik-wine">{selectedCategory}</span>
                  {" — "}
                  <button
                    type="button"
                    onClick={backToCategories}
                    className="tw-appearance-none tw-p-0 tw-underline"
                  >
                    clear
                  </button>
                </p>
              )}

              <div className="tw-mt-8 tw-grid tw-grid-cols-1 tw-gap-6 sm:tw-grid-cols-2 lg:tw-grid-cols-3">
                {visibleProducts.map((product, i) => (
                  <Reveal key={product.id} delay={(i % 3) * 60}>
                    <ProductCard product={product} onViewDetails={setActiveProduct} />
                  </Reveal>
                ))}
              </div>

              {visibleProducts.length === 0 && (
                <p className="tw-mt-16 tw-text-center tw-text-aadrik-charcoal/50">
                  No products match your search.
                </p>
              )}
            </>
          )}
        </>
      )}

      <ProductDetailModal product={activeProduct} onClose={() => setActiveProduct(null)} />
    </section>
  );
}
