import { useState, useEffect, useMemo } from "react";
import { Modal, Button, Form, Alert, Table } from "react-bootstrap";
import { categorizeQuantity } from "../utils/productQuantity";

function QuotationModal({
  show,
  onClose,
  product,
  selectedVariant,
  catalog,
  onSubmit,
}) {
  const [form, setForm] = useState({
    company_name: "",
    contact_person: "",
    phone: "",
    email: "",
    city: "",
    pincode: "",
    gst_number: "",
    notes: "",
  });

  const [items, setItems] = useState([]);
  const [productSearch, setProductSearch] = useState("");

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show && product) {
      setItems([{ product, selectedVariant, quantity: "" }]);
    }

    if (!show) {
      setSubmitted(false);
      setSubmitting(false);
      setError(null);
      setProductSearch("");
      setItems([]);
      setForm({
        company_name: "",
        contact_person: "",
        phone: "",
        email: "",
        city: "",
        pincode: "",
        gst_number: "",
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, product, selectedVariant]);

  const searchResults = useMemo(() => {
    if (!catalog || !productSearch.trim()) return [];

    const query = productSearch.toLowerCase();

    return catalog.products
      .filter((p) => [p.name, p.brand].filter(Boolean).join(" ").toLowerCase().includes(query))
      .slice(0, 8);
  }, [catalog, productSearch]);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  function addItem(p) {
    setItems((prev) => [...prev, { product: p, selectedVariant: p.sizes?.[0] || "", quantity: "" }]);
    setProductSearch("");
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index, patch) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  const handleSubmit = async () => {
    const missingProduct = !items.length || items.some((item) => !item.quantity.trim());

    if (
      !form.company_name ||
      !form.contact_person ||
      !form.phone ||
      !form.city ||
      missingProduct
    ) {
      alert("Please fill all required fields, including quantity for every product.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        ...form,
        items: items.map((item) => ({
          product_name: item.product?.name,
          brand: item.product?.brand,
          size: item.selectedVariant,
          quantity: item.quantity,
        })),
      });

      setSubmitted(true);
    } catch {
      setError("Failed to submit quotation request. Please try again.");
    }

    setSubmitting(false);
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      size="lg"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          Request Quotation
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {submitted ? (
          <Alert variant="success">
            <h5>Quotation Request Submitted!</h5>

            Our sales team will contact you shortly.
          </Alert>
        ) : (
          <>
            <h6 className="mb-3">
              Product Details
            </h6>

            <Table size="sm" bordered className="align-middle">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Brand</th>
                  <th style={{ width: "140px" }}>Size</th>
                  <th style={{ width: "160px" }}>Quantity *</th>
                  <th style={{ width: "40px" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const unit = categorizeQuantity(item.product?.name).unit;
                  return (
                    <tr key={index}>
                      <td>{item.product?.name}</td>
                      <td>{item.product?.brand}</td>
                      <td>
                        {item.product?.sizes?.length ? (
                          <Form.Select
                            size="sm"
                            value={item.selectedVariant}
                            onChange={(e) => updateItem(index, { selectedVariant: e.target.value })}
                          >
                            {item.product.sizes.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </Form.Select>
                        ) : (
                          item.selectedVariant || "-"
                        )}
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          placeholder={`e.g. 100 ${unit.toLowerCase()}`}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, { quantity: e.target.value })}
                        />
                      </td>
                      <td>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-danger p-0"
                          disabled={items.length === 1}
                          onClick={() => removeItem(index)}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>

            {catalog && (
              <div className="mb-3 position-relative">
                <Form.Control
                  size="sm"
                  placeholder="+ Add another product..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                {searchResults.length > 0 && (
                  <div
                    className="border rounded bg-white shadow-sm position-absolute w-100"
                    style={{ zIndex: 1050, maxHeight: "200px", overflowY: "auto" }}
                  >
                    {searchResults.map((p) => (
                      <div
                        key={p.name + p.brand}
                        className="px-2 py-1 small"
                        style={{ cursor: "pointer" }}
                        onMouseDown={() => addItem(p)}
                      >
                        {p.name} {p.brand ? `(${p.brand})` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <hr />

            {error && <Alert variant="danger">{error}</Alert>}

            <Form>

              <Form.Group className="mb-3">
                <Form.Label>Company Name *</Form.Label>
                <Form.Control
                  name="company_name"
                  value={form.company_name}
                  onChange={handleChange}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Contact Person *</Form.Label>
                <Form.Control
                  name="contact_person"
                  value={form.contact_person}
                  onChange={handleChange}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Phone *</Form.Label>
                <Form.Control
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Delivery City *</Form.Label>
                <Form.Control
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Pincode</Form.Label>
                <Form.Control
                  name="pincode"
                  value={form.pincode}
                  onChange={handleChange}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>GST Number</Form.Label>
                <Form.Control
                  name="gst_number"
                  value={form.gst_number}
                  onChange={handleChange}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Additional Notes</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                />
              </Form.Group>

            </Form>
          </>
        )}
      </Modal.Body>

      {!submitted && (
        <Modal.Footer>

          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>

        </Modal.Footer>
      )}
    </Modal>
  );
}

export default QuotationModal;
