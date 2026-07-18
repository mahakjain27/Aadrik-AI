import { useEffect, useState } from "react";
import { Table, Modal, Button, Form, Alert, Badge } from "react-bootstrap";
import {
  getManagedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../services/api";

function errorMessage(err, fallback) {
  return err.response?.data?.message || fallback;
}

const STOCK_BADGE = {
  "In Stock": "success",
  "Low Stock": "warning",
  "Out of Stock": "danger",
};

const EMPTY_FORM = {
  name: "",
  brand: "",
  category: "",
  subcategory: "",
  grade: "",
  sizes: "",
  packaging: "",
  applications: "",
  mrp: "",
  selling_price: "",
  gst_percent: "18",
  stock_status: "In Stock",
  description: "",
  is_active: true,
};

function toCsv(list) {
  return (list || []).join(", ");
}

function fromCsv(text) {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function ProductFormModal({ show, product, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!show) return;

    if (product) {
      setForm({
        name: product.name || "",
        brand: product.brand || "",
        category: product.category || "",
        subcategory: product.subcategory || "",
        grade: product.grade || "",
        sizes: toCsv(product.sizes),
        packaging: toCsv(product.packaging),
        applications: toCsv(product.applications),
        mrp: product.mrp != null ? String(product.mrp) : "",
        selling_price: product.selling_price != null ? String(product.selling_price) : "",
        gst_percent: String(product.gst_percent ?? 18),
        stock_status: product.stock_status || "In Stock",
        description: product.description || "",
        is_active: product.is_active !== false,
      });
    } else {
      setForm(EMPTY_FORM);
    }

    setError(null);
  }, [show, product]);

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      category: form.category.trim() || null,
      subcategory: form.subcategory.trim() || null,
      grade: form.grade.trim() || null,
      sizes: fromCsv(form.sizes),
      packaging: fromCsv(form.packaging),
      applications: fromCsv(form.applications),
      mrp: form.mrp ? Number(form.mrp) : null,
      selling_price: form.selling_price ? Number(form.selling_price) : null,
      gst_percent: Number(form.gst_percent) || 0,
      stock_status: form.stock_status,
      description: form.description.trim() || null,
      is_active: form.is_active,
    };

    try {
      if (product) {
        await updateProduct(product.id, payload);
      } else {
        await createProduct(payload);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not save product."));
    }

    setSaving(false);
  }

  return (
    <Modal show={show} onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{product ? "Edit Product" : "Add Product"}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <Alert variant="danger" className="py-2">
            {error}
          </Alert>
        )}

        <Form className="row g-3">
          <Form.Group className="col-sm-6">
            <Form.Label className="small mb-1">Product Name *</Form.Label>
            <Form.Control
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="col-sm-6">
            <Form.Label className="small mb-1">Brand</Form.Label>
            <Form.Control
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="col-sm-6">
            <Form.Label className="small mb-1">Category</Form.Label>
            <Form.Control
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="col-sm-6">
            <Form.Label className="small mb-1">Subcategory</Form.Label>
            <Form.Control
              value={form.subcategory}
              onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="col-sm-6">
            <Form.Label className="small mb-1">Grade</Form.Label>
            <Form.Control
              value={form.grade}
              onChange={(e) => setForm({ ...form, grade: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="col-sm-6">
            <Form.Label className="small mb-1">Stock Status</Form.Label>
            <Form.Select
              value={form.stock_status}
              onChange={(e) => setForm({ ...form, stock_status: e.target.value })}
            >
              <option>In Stock</option>
              <option>Low Stock</option>
              <option>Out of Stock</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="col-sm-6">
            <Form.Label className="small mb-1">Sizes (comma separated)</Form.Label>
            <Form.Control
              placeholder="2.00 mm, 2.50 mm, 3.15 mm"
              value={form.sizes}
              onChange={(e) => setForm({ ...form, sizes: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="col-sm-6">
            <Form.Label className="small mb-1">Packaging (comma separated)</Form.Label>
            <Form.Control
              placeholder="5 kg box, 20 kg carton"
              value={form.packaging}
              onChange={(e) => setForm({ ...form, packaging: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="col-12">
            <Form.Label className="small mb-1">Applications (comma separated)</Form.Label>
            <Form.Control
              value={form.applications}
              onChange={(e) => setForm({ ...form, applications: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="col-sm-4">
            <Form.Label className="small mb-1">MRP (Rs.)</Form.Label>
            <Form.Control
              type="number"
              min="0"
              step="0.01"
              value={form.mrp}
              onChange={(e) => setForm({ ...form, mrp: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="col-sm-4">
            <Form.Label className="small mb-1">Selling Price (Rs.)</Form.Label>
            <Form.Control
              type="number"
              min="0"
              step="0.01"
              value={form.selling_price}
              onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="col-sm-4">
            <Form.Label className="small mb-1">GST %</Form.Label>
            <Form.Control
              type="number"
              min="0"
              step="0.01"
              value={form.gst_percent}
              onChange={(e) => setForm({ ...form, gst_percent: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="col-12">
            <Form.Label className="small mb-1">Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Shown to the AI assistant when answering product questions."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Form.Group>

          {product && (
            <Form.Group className="col-12">
              <Form.Check
                type="checkbox"
                label="Active (visible to customers, the AI, and WhatsApp menu)"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
            </Form.Group>
          )}
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={saving} onClick={handleSave}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [formTarget, setFormTarget] = useState(undefined);
  const [notice, setNotice] = useState(null);

  async function load(query) {
    setLoading(true);
    try {
      const data = await getManagedProducts(query);
      setProducts(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => load(search), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleDelete(product) {
    if (!window.confirm(`Remove "${product.name}"? It will be hidden from customers, the AI, and quotations, but its history is kept.`)) {
      return;
    }

    try {
      await deleteProduct(product.id);
      setNotice({ variant: "success", text: `${product.name} removed.` });
      load(search);
    } catch (err) {
      setNotice({ variant: "danger", text: errorMessage(err, "Could not remove product.") });
    }
  }

  return (
    <div className="container mt-4" style={{ paddingBottom: "32px" }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 style={{ fontWeight: 700, color: "#0b0b0b" }}>Manage Products</h2>
        <Button variant="primary" onClick={() => setFormTarget(null)}>
          + Add Product
        </Button>
      </div>

      {notice && (
        <Alert variant={notice.variant} dismissible onClose={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      <Form.Control
        className="mb-3"
        style={{ maxWidth: 360 }}
        placeholder="🔍 Search name, brand, category..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div
        style={{
          background: "#ffffff",
          border: "1px solid rgba(11,11,11,0.08)",
          borderRadius: "16px",
          boxShadow: "var(--shadow-card)",
          overflow: "hidden",
        }}
      >
        <Table hover responsive className="mb-0">
          <thead>
            <tr>
              <th>Product</th>
              <th>Brand</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {products.map((p) => (
              <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                <td style={{ minWidth: 200 }}>
                  <strong>{p.name}</strong>
                  {p.grade && <div className="text-muted small">Grade: {p.grade}</div>}
                </td>
                <td>{p.brand || "-"}</td>
                <td>
                  {p.category || "-"}
                  {p.subcategory && (
                    <div className="text-muted small">{p.subcategory}</div>
                  )}
                </td>
                <td>
                  {p.selling_price != null ? (
                    <>
                      Rs. {p.selling_price.toFixed(2)}
                      <div className="text-muted small">GST {p.gst_percent}%</div>
                    </>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  <Badge bg={STOCK_BADGE[p.stock_status] || "secondary"} pill>
                    {p.stock_status}
                  </Badge>
                </td>
                <td>{p.is_active ? "Active" : "Removed"}</td>
                <td className="d-flex gap-2">
                  <Button
                    size="sm"
                    variant="light"
                    className="border"
                    onClick={() => setFormTarget(p)}
                  >
                    Edit
                  </Button>
                  {p.is_active && (
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => handleDelete(p)}
                    >
                      Delete
                    </Button>
                  )}
                </td>
              </tr>
            ))}

            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted py-4">
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      <ProductFormModal
        show={formTarget !== undefined}
        product={formTarget}
        onClose={() => setFormTarget(undefined)}
        onSaved={() => load(search)}
      />
    </div>
  );
}
