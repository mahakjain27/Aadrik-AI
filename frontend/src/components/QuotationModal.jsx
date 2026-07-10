import { useState, useEffect } from "react";
import { Modal, Button, Form, Alert } from "react-bootstrap";
import { categorizeQuantity } from "../utils/productQuantity";

function QuotationModal({
  show,
  onClose,
  product,
  selectedVariant,
  onSubmit,
}) {
  const [form, setForm] = useState({
    company_name: "",
    contact_person: "",
    phone: "",
    email: "",
    quantity: "",
    city: "",
    pincode: "",
    gst_number: "",
    notes: "",
  });

  const quantityUnit = categorizeQuantity(product?.name).unit;

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!show) {
      setSubmitted(false);
      setSubmitting(false);
      setError(null);
      setForm({
        company_name: "",
        contact_person: "",
        phone: "",
        email: "",
        quantity: "",
        city: "",
        pincode: "",
        gst_number: "",
        notes: "",
      });
    }
  }, [show]);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    if (
      !form.company_name ||
      !form.contact_person ||
      !form.phone ||
      !form.quantity ||
      !form.city
    ) {
      alert("Please fill all required fields.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        ...form,
        product_name: product?.name,
        brand: product?.brand,
        size: selectedVariant,
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

            <table className="table table-sm">
              <tbody>
                <tr>
                  <td><strong>Product</strong></td>
                  <td>{product?.name}</td>
                </tr>

                <tr>
                  <td><strong>Brand</strong></td>
                  <td>{product?.brand}</td>
                </tr>

                <tr>
                  <td><strong>Size</strong></td>
                  <td>{selectedVariant}</td>
                </tr>
              </tbody>
            </table>

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
                <Form.Label>
                  Quantity * <span className="text-muted">(in {quantityUnit})</span>
                </Form.Label>
                <Form.Control
                  name="quantity"
                  placeholder={`e.g. 100 ${quantityUnit.toLowerCase()}`}
                  value={form.quantity}
                  onChange={handleChange}
                />
                <Form.Text className="text-muted">
                  This product is sold in {quantityUnit.toLowerCase()} — please enter quantity accordingly.
                </Form.Text>
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