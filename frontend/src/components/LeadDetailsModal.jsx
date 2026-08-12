import { useEffect, useState } from "react";
import { Modal, Table, Badge, Button, Form, Alert } from "react-bootstrap";
import { useAuth } from "../context/AuthContext";
import {
  setQuotationPricing,
  submitQuotationForApproval,
  approveQuotation,
  rejectQuotation,
  sendQuotation,
} from "../services/api";

const SOURCE_LABELS = {
  manual: "Manual",
  whatsapp: "WhatsApp",
  website: "Website",
};

const APPROVAL_BADGE = {
  Draft: "secondary",
  "Pending Approval": "warning",
  Approved: "success",
  Rejected: "danger",
};

const CHANNEL_LABEL = {
  whatsapp: "WhatsApp",
  email: "Email",
};

const WHATSAPP_STATUS_META = {
  sent: { label: "Sent", bg: "#6c757d" },
  delivered: { label: "Delivered", bg: "#0d6efd" },
  read: { label: "Read", bg: "#198754" },
  failed: { label: "Failed", bg: "#dc3545" },
};

export default function LeadDetailsModal({
  show,
  onClose,
  lead,
  onUpdated,
}) {
  const { user } = useAuth();
  const canApprove = user?.role === "admin" || user?.role === "manager";

  const [local, setLocal] = useState(lead);
  const [unitPrice, setUnitPrice] = useState("");
  const [gstPercent, setGstPercent] = useState("18");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  useEffect(() => {
    setLocal(lead);
    setUnitPrice(lead?.unit_price != null ? String(lead.unit_price) : "");
    setGstPercent(lead?.gst_percent != null ? String(lead.gst_percent) : "18");
    setDiscountPercent(
      lead?.discount_percent != null ? String(lead.discount_percent) : "0"
    );
    setRejectReason("");
    setShowRejectForm(false);
    setError(null);
    setActionMessage(null);
  }, [lead, show]);

  if (!local) return null;

  async function runAction(fn) {
    setBusy(true);
    setError(null);

    try {
      return await fn();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Action failed."
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePricing() {
    const result = await runAction(() =>
      setQuotationPricing(
        local.id,
        Number(unitPrice),
        Number(gstPercent),
        Number(discountPercent)
      )
    );

    if (result) {
      setLocal((prev) => ({ ...prev, ...result }));
      onUpdated?.();
    }
  }

  async function handleSubmitForApproval() {
    if (!unitPrice) {
      setError("Enter a unit price first.");
      return;
    }

    // Submit always reflects whatever is currently in the price fields, so a
    // sales rep doesn't have to remember to click "Save Pricing" separately
    // before this button will do anything.
    const pricingResult = await runAction(() =>
      setQuotationPricing(
        local.id,
        Number(unitPrice),
        Number(gstPercent),
        Number(discountPercent)
      )
    );

    if (!pricingResult) return;

    setLocal((prev) => ({ ...prev, ...pricingResult }));

    const result = await runAction(() => submitQuotationForApproval(local.id));

    if (result) {
      setLocal((prev) => ({
        ...prev,
        approval_status: result.approval_status,
      }));
      onUpdated?.();
    }
  }

  async function handleApprove() {
    const result = await runAction(() => approveQuotation(local.id));

    if (result) {
      setLocal((prev) => ({
        ...prev,
        approval_status: result.approval_status,
        approved_by_name: user?.name,
        approved_at: new Date().toISOString(),
        rejection_reason: null,
      }));
      onUpdated?.();
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;

    const result = await runAction(() =>
      rejectQuotation(local.id, rejectReason.trim())
    );

    if (result) {
      setLocal((prev) => ({
        ...prev,
        approval_status: result.approval_status,
        rejection_reason: rejectReason.trim(),
      }));
      setShowRejectForm(false);
      onUpdated?.();
    }
  }

  async function handleSend() {
    const result = await runAction(() => sendQuotation(local.id));

    if (result) {
      setLocal((prev) => ({
        ...prev,
        sent_at: new Date().toISOString(),
        status: "Quotation Sent",
        sent_via: result.sent_via,
        whatsapp_delivery_status: result.whatsapp_delivery_status,
      }));
      setActionMessage(result.message);
      onUpdated?.();
    }
  }

  const quantityNumber = (() => {
    const match = String(local.quantity || "").match(/[\d.]+/);
    return match ? Number(match[0]) : null;
  })();

  const originalAmount =
    local.unit_price != null && quantityNumber != null
      ? Math.round(local.unit_price * quantityNumber * 100) / 100
      : null;

  const discountAmount =
    originalAmount != null && local.discount_percent
      ? Math.round(((originalAmount * local.discount_percent) / 100) * 100) / 100
      : null;

  const gstAmount =
    local.subtotal != null && local.gst_percent != null
      ? Math.round(((local.subtotal * local.gst_percent) / 100) * 100) / 100
      : null;

  const grandTotal =
    local.subtotal != null && gstAmount != null
      ? Math.round((local.subtotal + gstAmount) * 100) / 100
      : null;

  const approvalStatus = local.approval_status || "Draft";
  const canEditPricing = approvalStatus === "Draft" || approvalStatus === "Rejected";

  return (
    <Modal
      show={show}
      onHide={onClose}
      size="lg"
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title>
          Quotation Details
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>

        <Table bordered>

          <tbody>

            <tr>
              <th width="30%">Quote No.</th>
              <td>
                AD-{new Date(local.created_at).getFullYear()}-
                {String(local.id).padStart(4, "0")}
              </td>
            </tr>

            <tr>
              <th>Company</th>
              <td>{local.company_name}</td>
            </tr>

            <tr>
              <th>Contact Person</th>
              <td>{local.contact_person}</td>
            </tr>

            <tr>
              <th>Phone</th>
              <td>{local.phone}</td>
            </tr>

            <tr>
              <th>Email</th>
              <td>{local.email || "-"}</td>
            </tr>

            <tr>
              <th>GST</th>
              <td>{local.gst_number || "-"}</td>
            </tr>

            <tr>
              <th>Product</th>
              <td>{local.product_name}</td>
            </tr>

            <tr>
              <th>Brand</th>
              <td>{local.brand}</td>
            </tr>

            <tr>
              <th>Size</th>
              <td>{local.size}</td>
            </tr>

            <tr>
              <th>Quantity</th>
              <td>{local.quantity}</td>
            </tr>

            <tr>
              <th>Delivery City</th>
              <td>{local.delivery_city}</td>
            </tr>

            <tr>
              <th>Pincode</th>
              <td>{local.pincode || "-"}</td>
            </tr>

            <tr>
              <th>Notes</th>
              <td>{local.notes || "-"}</td>
            </tr>

            <tr>
              <th>Created By</th>
              <td>{local.created_by_name || "Unknown"}</td>
            </tr>

            <tr>
              <th>Assigned To</th>
              <td>{local.assigned_to_name || "Unassigned"}</td>
            </tr>

            <tr>
              <th>Source</th>
              <td>{SOURCE_LABELS[local.source] || local.source || "Manual"}</td>
            </tr>

            <tr>
              <th>Status</th>
              <td>
                <Badge
  pill
  bg={
    local.status === "Pending"
      ? "warning"
      : local.status === "Contacted"
      ? "info"
      : local.status === "Won"
      ? "success"
      : local.status === "Lost"
      ? "danger"
      : undefined
  }
  text={local.status === "Pending" ? "dark" : "white"}
  style={
    local.status === "Quotation Sent"
      ? { backgroundColor: "#4a3aa7" }
      : undefined
  }
>
  {local.status}
</Badge>

              </td>
            </tr>

            <tr>
              <th>Created</th>
              <td>
                {new Date(
                  local.created_at
                ).toLocaleString()}
              </td>
            </tr>

            {(local.status === "Won" || local.status === "Lost") && (
              <tr>
                <th>Closed By</th>
                <td>
                  {local.closed_by_name || "Unknown"}
                  {local.closed_at && (
                    <span className="text-muted">
                      {" "}
                      on {new Date(local.closed_at).toLocaleString()}
                    </span>
                  )}
                </td>
              </tr>
            )}

          </tbody>

        </Table>

        <hr />

        <h6 className="mb-3">Pricing &amp; Approval</h6>

        {error && (
          <Alert variant="danger" className="py-2">
            {error}
          </Alert>
        )}

        {actionMessage && (
          <Alert variant="info" className="py-2">
            {actionMessage}
          </Alert>
        )}

        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <Badge bg={APPROVAL_BADGE[approvalStatus] || "secondary"} pill>
            {approvalStatus}
          </Badge>

          {approvalStatus === "Rejected" && local.rejection_reason && (
            <span className="text-danger small">
              Reason: {local.rejection_reason}
            </span>
          )}

          {approvalStatus === "Approved" && local.approved_by_name && (
            <span className="text-muted small">
              by {local.approved_by_name}
              {local.approved_at &&
                ` on ${new Date(local.approved_at).toLocaleString()}`}
            </span>
          )}

          {local.sent_at && (
            <span className="text-muted small d-flex align-items-center gap-2 flex-wrap">
              Sent {new Date(local.sent_at).toLocaleString()}

              {(local.sent_via || "")
                .split(",")
                .filter(Boolean)
                .map((channel) => (
                  <Badge key={channel} bg="light" text="dark" className="border fw-normal">
                    {CHANNEL_LABEL[channel] || channel}
                    {channel === "whatsapp" && local.whatsapp_delivery_status && (
                      <>
                        {" · "}
                        <span
                          style={{
                            color:
                              WHATSAPP_STATUS_META[local.whatsapp_delivery_status]?.bg,
                            fontWeight: 600,
                          }}
                        >
                          {WHATSAPP_STATUS_META[local.whatsapp_delivery_status]?.label ||
                            local.whatsapp_delivery_status}
                        </span>
                      </>
                    )}
                  </Badge>
                ))}

              {!local.sent_via && (
                <span className="text-danger">
                  (not actually delivered - no email on file, no WhatsApp conversation)
                </span>
              )}
            </span>
          )}
        </div>

        {canEditPricing && (
          <Form className="row g-2 align-items-end mb-3">
            <Form.Group className="col-sm-3">
              <Form.Label className="small mb-1">Unit Price (Rs.)</Form.Label>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="col-sm-3">
              <Form.Label className="small mb-1">Discount %</Form.Label>
              <Form.Control
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="col-sm-2">
              <Form.Label className="small mb-1">GST %</Form.Label>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                value={gstPercent}
                onChange={(e) => setGstPercent(e.target.value)}
              />
            </Form.Group>

            <div className="col-sm-4 d-flex gap-2">
              <Button
                size="sm"
                variant="outline-primary"
                disabled={busy || !unitPrice}
                onClick={handleSavePricing}
              >
                Save Pricing
              </Button>

              <Button
                size="sm"
                variant="primary"
                disabled={busy || !unitPrice}
                onClick={handleSubmitForApproval}
              >
                Submit for Approval
              </Button>
            </div>
          </Form>
        )}

        {local.subtotal != null && (
          <Table size="sm" borderless className="mb-3" style={{ maxWidth: 320 }}>
            <tbody>
              {originalAmount != null && local.discount_percent ? (
                <>
                  <tr>
                    <td>Original Price</td>
                    <td className="text-end">Rs. {originalAmount.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Discount ({local.discount_percent}%)</td>
                    <td className="text-end text-danger">
                      - Rs. {discountAmount.toFixed(2)}
                    </td>
                  </tr>
                </>
              ) : null}
              <tr>
                <td>Subtotal</td>
                <td className="text-end">Rs. {local.subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td>GST ({local.gst_percent}%)</td>
                <td className="text-end">
                  {gstAmount != null ? `Rs. ${gstAmount.toFixed(2)}` : "-"}
                </td>
              </tr>
              <tr className="fw-bold">
                <td>Grand Total</td>
                <td className="text-end">
                  {grandTotal != null ? `Rs. ${grandTotal.toFixed(2)}` : "-"}
                </td>
              </tr>
            </tbody>
          </Table>
        )}

        {approvalStatus === "Pending Approval" && canApprove && !showRejectForm && (
          <div className="d-flex gap-2">
            <Button size="sm" variant="success" disabled={busy} onClick={handleApprove}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline-danger"
              disabled={busy}
              onClick={() => setShowRejectForm(true)}
            >
              Reject
            </Button>
          </div>
        )}

        {showRejectForm && (
          <div className="mt-2">
            <Form.Control
              as="textarea"
              rows={2}
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="d-flex gap-2 mt-2">
              <Button
                size="sm"
                variant="danger"
                disabled={busy || !rejectReason.trim()}
                onClick={handleReject}
              >
                Confirm Reject
              </Button>
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={busy}
                onClick={() => setShowRejectForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {approvalStatus === "Approved" && (
          <Button size="sm" variant="success" disabled={busy} onClick={handleSend}>
            {local.sent_at ? "Re-send" : "Send to Customer"}
          </Button>
        )}

      </Modal.Body>

      <Modal.Footer>

        <Button
          variant="secondary"
          onClick={onClose}
        >
          Close
        </Button>

      </Modal.Footer>

    </Modal>
  );
}
