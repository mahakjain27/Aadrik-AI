import { Accordion, Form, Modal, Spinner } from "react-bootstrap";
import { useMemo, useState } from "react";
import { groupProducts, hasSubcategory, gradeLabel } from "../utils/groupProducts";

function ProductExplorer({ show, onClose, onSelectVariant, catalog, loading, error }) {
  const [search, setSearch] = useState("");

  function handleVariantClick(product, variant) {
    onSelectVariant(product, variant);
    onClose();
  }
const filteredProducts = useMemo(() => {
  if (!catalog) return [];

  if (!search.trim()) return catalog.products;

  const query = search.toLowerCase();

  return catalog.products.filter((product) => {
    const searchableText = [
      product.category,
      product.subcategory,
      product.brand,
      product.name,
      product.grade,
      ...(product.sizes || []),
      ...(product.packing || [])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(query);
  });

}, [catalog, search]);

const grouped = groupProducts(filteredProducts);

  return (
    <Modal show={show} onHide={onClose} size="lg" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>Product Catalogue</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form.Control
          type="search"
          placeholder="Search products, brands, sizes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />

        {loading && (
          <div className="d-flex justify-content-center py-4">
            <Spinner animation="border" />
          </div>
        )}

        {error && (
          <p className="text-danger">Failed to load products: {error}</p>
        )}

        {catalog && (
          <Accordion alwaysOpen>
            {Object.entries(grouped).map(([category, bySubcategory], index) => (
              <Accordion.Item eventKey={String(index)} key={category}>
                <Accordion.Header>{category}</Accordion.Header>

                <Accordion.Body>
                  {Object.entries(bySubcategory).map(([subcategory, byBrand]) => (
                    <div key={subcategory} className="mb-4">
                      {hasSubcategory(subcategory) && (
                        <div className="text-uppercase small fw-bold text-secondary mb-2">
                          {subcategory}
                        </div>
                      )}

                      {Object.entries(byBrand).map(([brand, products]) => (
                        <div key={brand} className="mb-3">
                          <div className="fw-semibold small mb-1">{brand}</div>

                          {products.length === 1 ? (
                            <VariantRow
                              product={products[0]}
                              onSelect={handleVariantClick}
                            />
                          ) : (
                            <div className="ps-3">
                              {products.map((product) => (
                                <div key={product.id} className="mb-2">
                                  {gradeLabel(product) && (
                                    <div className="text-muted small mb-1">
                                      {gradeLabel(product)}
                                    </div>
                                  )}
                                  <VariantRow
                                    product={product}
                                    onSelect={handleVariantClick}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </Accordion.Body>
              </Accordion.Item>
            ))}
          </Accordion>
        )}
      </Modal.Body>
    </Modal>
  );
}

function VariantRow({ product, onSelect }) {
  const variants = product.sizes.length ? product.sizes : product.packing;

  return (
    <div className="d-flex flex-wrap gap-2">
      {variants.length ? (
        variants.map((variant) => (
          <button
            key={variant}
            className="btn btn-sm btn-outline-secondary"
            onClick={() => onSelect(product, variant)}
          >
            {variant}
          </button>
        ))
      ) : (
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => onSelect(product, "")}
        >
          Ask about this product
        </button>
      )}
    </div>
  );
}

export default ProductExplorer;
