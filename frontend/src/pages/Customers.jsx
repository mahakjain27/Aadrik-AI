import { useEffect, useState } from "react";
import { Table, Modal, Button, Form, Alert, Badge } from "react-bootstrap";
import {
  getCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getAssignees,
} from "../services/api";
import { useAuth } from "../context/AuthContext";

function errorMessage(err, fallback) {
  return err.response?.data?.message || fallback;
}

function quoteNumber(q) {
  const year = new Date(q.created_at).getFullYear();
  return `AD-${year}-${String(q.id).padStart(4, "0")}`;
}

function TagList({ tags }) {
  const list = (tags || "").split(",").map((t) => t.trim()).filter(Boolean);

  if (list.length === 0) return <span className="text-muted">-</span>;

  return (
    <div className="d-flex gap-1 flex-wrap">
      {list.map((tag) => (
        <Badge key={tag} bg="light" text="dark" className="border fw-normal">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

function CustomerDetailsModal({ customerId, assignees, onClose, onSaved }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customerId) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    getCustomer(customerId)
      .then((data) => {
        setCustomer(data);
        setForm({
          company_name: data.company_name || "",
          contact_person: data.contact_person || "",
          email: data.email || "",
          gst_number: data.gst_number || "",
          city: data.city || "",
          assigned_to: data.assigned_to ? String(data.assigned_to) : "",
          notes: data.notes || "",
          tags: data.tags || "",
        });
      })
      .catch((err) => setError(errorMessage(err, "Could not load customer.")))
      .finally(() => setLoading(false));
  }, [customerId]);

  if (!customerId) return null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await updateCustomer(customerId, {
        ...form,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      });
      setSuccess(true);
      onSaved?.();
    } catch (err) {
      setError(errorMessage(err, "Could not save customer."));
    }

    setSaving(false);
  }

  return (
    <Modal show={!!customerId} onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{customer?.company_name || "Customer"}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {loading || !form ? (
          <div className="text-center py-4 text-muted">Loading...</div>
        ) : (
          <>
            {error && (
              <Alert variant="danger" className="py-2">
                {error}
              </Alert>
            )}
            {success && (
              <Alert variant="success" className="py-2">
                Customer updated.
              </Alert>
            )}

            <Form className="row g-3">
              <Form.Group className="col-sm-6">
                <Form.Label className="small mb-1">Phone</Form.Label>
                <Form.Control value={customer.phone} disabled />
              </Form.Group>

              <Form.Group className="col-sm-6">
                <Form.Label className="small mb-1">Company Name</Form.Label>
                <Form.Control
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                />
              </Form.Group>

              <Form.Group className="col-sm-6">
                <Form.Label className="small mb-1">Contact Person</Form.Label>
                <Form.Control
                  value={form.contact_person}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                />
              </Form.Group>

              <Form.Group className="col-sm-6">
                <Form.Label className="small mb-1">Email</Form.Label>
                <Form.Control
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Form.Group>

              <Form.Group className="col-sm-6">
                <Form.Label className="small mb-1">GST Number</Form.Label>
                <Form.Control
                  value={form.gst_number}
                  onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
                />
              </Form.Group>

              <Form.Group className="col-sm-6">
                <Form.Label className="small mb-1">City</Form.Label>
                <Form.Control
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </Form.Group>

              <Form.Group className="col-sm-6">
                <Form.Label className="small mb-1">Assigned To</Form.Label>
                <Form.Select
                  value={form.assigned_to}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.role})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="col-sm-6">
                <Form.Label className="small mb-1">Tags</Form.Label>
                <Form.Control
                  placeholder="comma, separated, tags"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </Form.Group>

              <Form.Group className="col-12">
                <Form.Label className="small mb-1">Notes</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Form.Group>
            </Form>

            <hr />

            <h6 className="mb-2">Quotations ({customer.quotations.length})</h6>

            {customer.quotations.length === 0 ? (
              <div className="text-muted small">No quotations yet.</div>
            ) : (
              <Table size="sm" bordered className="mb-0">
                <thead>
                  <tr>
                    <th>Quote No.</th>
                    <th>Product</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.quotations.map((q) => (
                    <tr key={q.id}>
                      <td>{quoteNumber(q)}</td>
                      <td>{q.product_name}</td>
                      <td>{q.status}</td>
                      <td>{new Date(q.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" disabled={saving || loading} onClick={handleSave}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default function Customers() {
  const { user } = useAuth();
  const canDelete = user?.role === "admin" || user?.role === "manager";

  const [customers, setCustomers] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function loadCustomers(query) {
    setLoading(true);
    try {
      const data = await getCustomers(query);
      setCustomers(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
    getAssignees().then(setAssignees).catch(() => {});
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => loadCustomers(search), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleDelete(customer) {
    const warning =
      customer.total_quotations > 0
        ? ` This customer has ${customer.total_quotations} quotation(s) - they'll be kept but unlinked from this customer record.`
        : "";

    if (!window.confirm(`Delete ${customer.company_name}?${warning}`)) return;

    setDeletingId(customer.id);
    try {
      await deleteCustomer(customer.id);
      await loadCustomers(search);
    } catch (err) {
      window.alert(errorMessage(err, "Could not delete customer."));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="container mt-4" style={{ paddingBottom: "32px" }}>
      <h2 className="mb-4" style={{ fontWeight: 700, color: "#0b0b0b" }}>
        Customers
      </h2>

      <Form.Control
        className="mb-3"
        style={{ maxWidth: 360 }}
        placeholder="🔍 Search company, phone, email, city..."
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
              <th>Company</th>
              <th>Phone</th>
              <th>Email</th>
              <th>City</th>
              <th>Quotations</th>
              <th>Last Contact</th>
              <th>Assigned To</th>
              <th>Tags</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td style={{ minWidth: 180 }}>
                  <strong>{c.company_name}</strong>
                  {c.contact_person && (
                    <div className="text-muted small">{c.contact_person}</div>
                  )}
                </td>
                <td>{c.phone}</td>
                <td>{c.email || "-"}</td>
                <td>{c.city || "-"}</td>
                <td>{c.total_quotations}</td>
                <td>
                  {c.last_contact
                    ? new Date(c.last_contact).toLocaleDateString()
                    : "-"}
                </td>
                <td>{c.assigned_to_name || "Unassigned"}</td>
                <td>
                  <TagList tags={c.tags} />
                </td>
                <td>
                  <div className="d-flex gap-2">
                    <Button
                      size="sm"
                      variant="light"
                      className="border"
                      onClick={() => setSelectedId(c.id)}
                    >
                      View details
                    </Button>
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="outline-danger"
                        disabled={deletingId === c.id}
                        onClick={() => handleDelete(c)}
                      >
                        {deletingId === c.id ? "Deleting..." : "Delete"}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-muted py-4">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      <CustomerDetailsModal
        customerId={selectedId}
        assignees={assignees}
        onClose={() => setSelectedId(null)}
        onSaved={() => loadCustomers(search)}
      />
    </div>
  );
}
