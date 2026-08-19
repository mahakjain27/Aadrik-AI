import { useEffect, useState } from "react";
import { Modal, Table, Badge, Button, Form, Alert } from "react-bootstrap";
import { useAuth } from "../context/AuthContext";
import {
  setQuotationPricing,
  getQuotationPriceHistory,
  submitQuotationForApproval,
  approveQuotation,
  rejectQuotation,
  sendQuotation,
  confirmOrder,
} from "../services/api";
import WhatsAppMessageModal from "./WhatsAppMessageModal";

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
  "Not Required": "light",
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
  const [itemPricing, setItemPricing] = useState([]);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [showMessageCustomer, setShowMessageCustomer] = useState(false);
  const [showConfirmOrder, setShowConfirmOrder] = useState(false);
  const [priceHistory, setPriceHistory] = useState([]);
  const [pendingApprovedConfirm, setPendingApprovedConfirm] = useState(null);

  useEffect(() => {
    setLocal(lead);

    const items = lead?.items?.length
      ? lead.items
      : lead
      ? [
          {
            id: "legacy",
            product_name: lead.product_name,
            brand: lead.brand,
            size: lead.size,
            quantity: lead.quantity,
            unit_price: lead.unit_price,
            gst_percent: lead.gst_percent,
            discount_type: lead.discount_type,
            discount_percent: lead.discount_percent,
            discount_amount: lead.discount_amount,
            special_discount_percent: lead.special_discount_percent,
            special_discount_amount: lead.special_discount_amount,
            subtotal: lead.subtotal,
            grand_total: lead.grand_total,
          },
        ]
      : [];

    setItemPricing(
      items.map((item) => ({
        itemId: item.id,
        productName: item.product_name,
        brand: item.brand,
        size: item.size,
        quantity: item.quantity,
        unitPrice: item.unit_price != null ? String(item.unit_price) : "",
        gstPercent: item.gst_percent != null ? String(item.gst_percent) : "18",
        discountType: item.discount_type || "percent",
        discountPercent: item.discount_percent != null ? String(item.discount_percent) : "0",
        discountAmount: item.discount_amount != null ? String(item.discount_amount) : "0",
        specialDiscountPercent:
          item.special_discount_percent != null ? String(item.special_discount_percent) : "0",
        specialDiscountAmount:
          item.special_discount_amount != null ? String(item.special_discount_amount) : "0",
        subtotal: item.subtotal,
        grandTotal: item.grand_total,
      }))
    );

    setRejectReason("");
    setShowRejectForm(false);
    setError(null);
    setActionMessage(null);
    setPendingApprovedConfirm(null);
    setPriceHistory([]);

    if (lead?.id && show) {
      getQuotationPriceHistory(lead.id)
        .then(setPriceHistory)
        .catch(() => setPriceHistory([]));
    }
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

  function updateItemPricing(index, patch) {
    setItemPricing((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function currentPricingPayload() {
    return itemPricing.map((item) => ({
      itemId: item.itemId,
      unitPrice: Number(item.unitPrice),
      gstPercent: Number(item.gstPercent),
      discountType: item.discountType,
      discountPercent: Number(item.discountPercent) || 0,
      discountAmount: Number(item.discountAmount) || 0,
      specialDiscountPercent: Number(item.specialDiscountPercent) || 0,
      specialDiscountAmount: Number(item.specialDiscountAmount) || 0,
    }));
  }

  function applyPricingResult(result) {
    setLocal((prev) => ({ ...prev, subtotal: result.subtotal, grand_total: result.grand_total }));
    setItemPricing((prev) =>
      prev.map((item) => {
        const updated = result.items.find((r) => r.item_id === item.itemId);
        return updated
          ? { ...item, subtotal: updated.subtotal, grandTotal: updated.grand_total }
          : item;
      })
    );
  }

  // Editing an already-approved quotation's price is allowed, but it's a
  // significant enough action to confirm first - runPricingAction routes
  // through that confirmation when needed, and straight through otherwise.
  function runPricingAction(action) {
    if (approvalStatus === "Approved") {
      setPendingApprovedConfirm(() => action);
      return;
    }

    action();
  }

  async function savePricing() {
    const result = await runAction(() =>
      setQuotationPricing(local.id, currentPricingPayload())
    );

    if (result) {
      applyPricingResult(result);

      if (result.price_change_recorded) {
        getQuotationPriceHistory(local.id)
          .then(setPriceHistory)
          .catch(() => {});
      }

      onUpdated?.();
    }
  }

  async function submitForApproval() {
    if (itemPricing.some((item) => !item.unitPrice)) {
      setError("Enter a unit price for every product first.");
      return;
    }

    // Submit always reflects whatever is currently in the price fields, so a
    // sales rep doesn't have to remember to click "Save Pricing" separately
    // before this button will do anything.
    const pricingResult = await runAction(() =>
      setQuotationPricing(local.id, currentPricingPayload())
    );

    if (!pricingResult) return;

    applyPricingResult(pricingResult);

    const result = await runAction(() => submitQuotationForApproval(local.id));

    if (result) {
      setLocal((prev) => ({
        ...prev,
        approval_status: result.approval_status,
      }));
      onUpdated?.();
    }
  }

  function handleSavePricing() {
    runPricingAction(savePricing);
  }

  function handleSubmitForApproval() {
    runPricingAction(submitForApproval);
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

  async function handleOrderConfirmed() {
    const result = await runAction(() => confirmOrder(local.id));

    if (result) {
      setLocal((prev) => ({
        ...prev,
        status: result.status,
        approval_status: result.approval_status,
      }));
      setActionMessage("Order confirmed - lead marked Won.");
      onUpdated?.();
    }
  }

  const approvalStatus = local.approval_status || "Draft";
  const canSubmitForApproval =
    approvalStatus === "Draft" || approvalStatus === "Rejected";

  return (
    <>
    <Modal
      show={show}
      onHide={onClose}
      size="lg"
      centered
      scrollable
    >
      <Modal.Header closeButton>
        <Modal.Title>
          Quotation Details
        </Modal.Title>

        {local.phone && (
          <div className="ms-auto me-3 d-flex gap-2">
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => setShowMessageCustomer(true)}
            >
              💬 Message Customer
            </Button>

            {local.status !== "Won" && local.status !== "Lost" && (
              <Button
                variant="outline-success"
                size="sm"
                onClick={() => setShowConfirmOrder(true)}
              >
                ✅ Confirm Order
              </Button>
            )}
          </div>
        )}
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
              <th>Products</th>
              <td>
                <Table size="sm" borderless className="mb-0">
                  <tbody>
                    {itemPricing.map((item) => (
                      <tr key={item.itemId}>
                        <td className="ps-0">{item.productName}</td>
                        <td className="text-muted">{item.brand || "-"}</td>
                        <td className="text-muted">{item.size || "-"}</td>
                        <td className="text-end text-muted">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </td>
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
          <Badge
            bg={APPROVAL_BADGE[approvalStatus] || "secondary"}
            text={approvalStatus === "Not Required" ? "dark" : undefined}
            pill
          >
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

        {pendingApprovedConfirm && (
          <Alert variant="warning" className="py-2">
            <div className="mb-2">
              This quotation has already been approved. Changing the price or
              discount will modify the approved quotation. Continue?
            </div>
            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="warning"
                onClick={() => {
                  const action = pendingApprovedConfirm;
                  setPendingApprovedConfirm(null);
                  action();
                }}
              >
                Continue
              </Button>
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => setPendingApprovedConfirm(null)}
              >
                Cancel
              </Button>
            </div>
          </Alert>
        )}

        <Form className="mb-3">
          {itemPricing.map((item, index) => (
            <div key={item.itemId} className="border rounded p-2 mb-2">
              <div className="fw-semibold small mb-2">
                {item.productName}
                {item.size ? ` (${item.size})` : ""} — Qty {item.quantity}
              </div>

              <div className="row g-2 align-items-end mb-2">
                <Form.Group className="col-sm-3">
                  <Form.Label className="small mb-1">Unit Price (Rs.)</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItemPricing(index, { unitPrice: e.target.value })}
                  />
                </Form.Group>

                <Form.Group className="col-sm-2">
                  <Form.Label className="small mb-1">GST %</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.gstPercent}
                    onChange={(e) => updateItemPricing(index, { gstPercent: e.target.value })}
                  />
                </Form.Group>
              </div>

              <div className="mb-2">
                <Form.Label className="small mb-1 fw-semibold d-block">
                  Normal Discount
                </Form.Label>
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  <Form.Check
                    inline
                    type="radio"
                    id={`discount-type-percent-${item.itemId}`}
                    name={`discountType-${item.itemId}`}
                    label="Percentage"
                    checked={item.discountType === "percent"}
                    onChange={() => updateItemPricing(index, { discountType: "percent" })}
                  />
                  <Form.Check
                    inline
                    type="radio"
                    id={`discount-type-amount-${item.itemId}`}
                    name={`discountType-${item.itemId}`}
                    label="Amount (Rs. / unit)"
                    checked={item.discountType === "amount"}
                    onChange={() => updateItemPricing(index, { discountType: "amount" })}
                  />
                  {item.discountType === "percent" ? (
                    <Form.Control
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      style={{ maxWidth: 140 }}
                      value={item.discountPercent}
                      onChange={(e) => updateItemPricing(index, { discountPercent: e.target.value })}
                    />
                  ) : (
                    <Form.Control
                      type="number"
                      min="0"
                      step="0.01"
                      style={{ maxWidth: 160 }}
                      value={item.discountAmount}
                      onChange={(e) => updateItemPricing(index, { discountAmount: e.target.value })}
                    />
                  )}
                </div>
              </div>

              <div className="row g-2">
                <Form.Group className="col-sm-3">
                  <Form.Label className="small mb-1 text-muted">Special Discount %</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={item.specialDiscountPercent}
                    onChange={(e) =>
                      updateItemPricing(index, { specialDiscountPercent: e.target.value })
                    }
                  />
                </Form.Group>
                <Form.Group className="col-sm-3">
                  <Form.Label className="small mb-1 text-muted">
                    Special Discount (Rs. / unit)
                  </Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.specialDiscountAmount}
                    onChange={(e) =>
                      updateItemPricing(index, { specialDiscountAmount: e.target.value })
                    }
                  />
                </Form.Group>
              </div>

              {item.grandTotal != null && (
                <div className="text-end small text-muted mt-1">
                  Line total: Rs. {item.grandTotal.toFixed(2)}
                </div>
              )}
            </div>
          ))}

          <div className="d-flex gap-2">
            <Button
              size="sm"
              variant="outline-primary"
              disabled={busy || itemPricing.some((item) => !item.unitPrice)}
              onClick={handleSavePricing}
            >
              Save Pricing
            </Button>

            {canSubmitForApproval && (
              <Button
                size="sm"
                variant="primary"
                disabled={busy || itemPricing.some((item) => !item.unitPrice)}
                onClick={handleSubmitForApproval}
              >
                Submit for Approval
              </Button>
            )}
          </div>
        </Form>

        {local.grand_total != null && (
          <Table size="sm" borderless className="mb-3" style={{ maxWidth: 340 }}>
            <tbody>
              <tr>
                <td>Subtotal</td>
                <td className="text-end">Rs. {local.subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td>GST</td>
                <td className="text-end">
                  Rs. {(local.grand_total - local.subtotal).toFixed(2)}
                </td>
              </tr>
              <tr className="fw-bold">
                <td>Grand Total</td>
                <td className="text-end">Rs. {local.grand_total.toFixed(2)}</td>
              </tr>
            </tbody>
          </Table>
        )}

        {priceHistory.length > 0 && (
          <div className="mb-3">
            <h6 className="mb-2">Price History</h6>
            {priceHistory.map((entry) => (
              <div
                key={entry.id}
                className="p-2 mb-2 small"
                style={{
                  background: "#fff8e6",
                  border: "1px solid rgba(237,161,0,0.3)",
                  borderRadius: "8px",
                }}
              >
                <div className="fw-semibold mb-1">Price changed after approval</div>
                <div>
                  Previous:{" "}
                  <strong>
                    {entry.old_grand_total != null
                      ? `Rs. ${entry.old_grand_total.toFixed(2)}`
                      : "-"}
                  </strong>
                  {" → "}
                  Updated:{" "}
                  <strong>
                    {entry.new_grand_total != null
                      ? `Rs. ${entry.new_grand_total.toFixed(2)}`
                      : "-"}
                  </strong>
                </div>
                <div className="text-muted">
                  Changed by {entry.changed_by_name || "Unknown"} on{" "}
                  {new Date(entry.changed_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
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

    <WhatsAppMessageModal
      show={showMessageCustomer}
      onClose={() => setShowMessageCustomer(false)}
      onStarted={() => {
        setShowMessageCustomer(false);
        setActionMessage("Message sent.");
      }}
      initialPhone={local.phone}
    />

    <WhatsAppMessageModal
      show={showConfirmOrder}
      onClose={() => setShowConfirmOrder(false)}
      initialPhone={local.phone}
      orderConfirmation
      onOrderConfirmed={handleOrderConfirmed}
      onStarted={() => setShowConfirmOrder(false)}
    />
    </>
  );
}
