import { useEffect, useRef, useState } from "react";
import { Modal, Form, Button } from "react-bootstrap";
import {
  checkWhatsAppNumber,
  sendSalesReply,
  sendSalesAttachment,
  sendWhatsAppTemplate,
} from "../services/api";

const SALES_TEMPLATE_PREVIEW =
  "Hi, this is Aadrik AI from Aadrik Distributors. We supply welding " +
  "consumables and would be happy to assist with your requirements. " +
  "Please let us know if you currently have any requirements we can help with.";

const ORDER_CONFIRMATION_DEFAULT_MESSAGE =
  "Hi, we have received your order. We will send you the bill shortly.";

const ORDER_RECEIVED_TEMPLATE_PREVIEW =
  "Hi, we have received your order. We will send you the bill shortly.";

// Shared by Sales Inbox's "+ New Conversation" (manual number entry), any
// "Message Customer" entry point that already knows the customer's phone
// (e.g. from a quotation) - initialPhone skips straight to the 24h window
// check instead of asking the user to type the number in - and "Confirm
// Order" (orderConfirmation), which pre-fills the order-received message
// and, once it actually sends, tells the caller via onOrderConfirmed so the
// lead can be marked Won without ever going through the quotation flow.
export default function WhatsAppMessageModal({
  show,
  onClose,
  onStarted,
  initialPhone,
  orderConfirmation = false,
  onOrderConfirmed,
}) {
  const [phone, setPhone] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [result, setResult] = useState(null); // { session_id, customer_phone, window_open, is_new }
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const fileInputRef = useRef(null);

  function reset() {
    setPhone("");
    setChecking(false);
    setCheckError("");
    setResult(null);
    setMessage("");
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSending(false);
    setSendError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleCheck(overridePhone) {
    const target = (overridePhone ?? phone).trim();
    if (!target) return;

    setChecking(true);
    setCheckError("");

    try {
      const data = await checkWhatsAppNumber(target);
      setResult(data);
    } catch (err) {
      setCheckError(err.response?.data?.message || "Could not check this number.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (show && initialPhone) {
      setPhone(initialPhone);
      handleCheck(initialPhone);
    }

    if (!show) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, initialPhone]);

  useEffect(() => {
    if (orderConfirmation && result?.window_open && !message) {
      setMessage(ORDER_CONFIRMATION_DEFAULT_MESSAGE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderConfirmation, result]);

  async function handleSendFreeform() {
    if ((!message.trim() && !attachment) || !result?.session_id) return;

    setSending(true);
    setSendError("");

    try {
      if (attachment) {
        await sendSalesAttachment(result.session_id, attachment, message.trim() || undefined);
      } else {
        await sendSalesReply(result.session_id, message);
      }
      onStarted?.(result.session_id);
      if (orderConfirmation) await onOrderConfirmed?.();
      reset();
    } catch (err) {
      setSendError(err.response?.data?.message || "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  async function handleSendTemplate() {
    setSending(true);
    setSendError("");

    try {
      const data = await sendWhatsAppTemplate(
        result.customer_phone,
        initialPhone || orderConfirmation ? "order_received" : "sales"
      );
      onStarted(data.session_id);
      reset();
    } catch (err) {
      setSendError(err.response?.data?.message || "Could not send WhatsApp template.");
    } finally {
      setSending(false);
    }
  }

  const title = orderConfirmation
    ? "Confirm Order"
    : initialPhone
    ? "Message Customer"
    : "New WhatsApp Conversation";

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {!result ? (
          initialPhone ? (
            <div className="small text-muted">
              {checking
                ? `Checking WhatsApp status for ${initialPhone}...`
                : checkError || "Preparing..."}
            </div>
          ) : (
            <>
              <Form.Label className="small mb-1">Customer WhatsApp Number</Form.Label>
              <Form.Control
                placeholder="+91 98765 43210"
                value={phone}
                disabled={checking}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCheck();
                  }
                }}
                autoFocus
              />
              {checkError && (
                <div className="small text-danger mt-2">{checkError}</div>
              )}
            </>
          )
        ) : result.window_open ? (
          <>
            <div className="small text-muted mb-2">
              This customer's 24-hour conversation window is open - you can send a
              normal message to <strong>{result.customer_phone}</strong>.
            </div>
            {orderConfirmation && (
              <div
                className="p-2 small mb-2"
                style={{ background: "#fff8e6", border: "1px solid rgba(237,161,0,0.3)", borderRadius: "8px" }}
              >
                Sending this will mark the lead as <strong>Won</strong> with approval{" "}
                <strong>Not Required</strong> - no quotation will be created.
              </div>
            )}
            <Form.Control
              as="textarea"
              rows={3}
              placeholder={attachment ? "Optional caption..." : "Type a message..."}
              value={message}
              disabled={sending}
              onChange={(e) => setMessage(e.target.value)}
              autoFocus
              className="mb-2"
            />

            <Form.Label className="small mb-1">
              Attachment <span className="text-muted">(PDF, JPG, or PNG - e.g. an invoice)</span>
            </Form.Label>
            <Form.Control
              ref={fileInputRef}
              type="file"
              size="sm"
              accept="application/pdf,image/jpeg,image/png"
              disabled={sending}
              onChange={(e) => setAttachment(e.target.files?.[0] || null)}
            />
          </>
        ) : (
          <>
            <div className="small text-muted mb-2">
              {result.is_new
                ? "This number hasn't messaged before."
                : "This conversation's 24-hour window has closed."}{" "}
              WhatsApp requires an approved template to start it -
              free text isn't allowed yet for <strong>{result.customer_phone}</strong>.
            </div>
            <div
              className="p-2 small"
              style={{ background: "#f3eefb", border: "1px solid rgba(111,66,193,0.18)", borderRadius: "10px" }}
            >
              <div className="fw-semibold mb-1" style={{ color: "#6f42c1" }}>
                Template preview
              </div>
              {initialPhone || orderConfirmation
                ? ORDER_RECEIVED_TEMPLATE_PREVIEW
                : SALES_TEMPLATE_PREVIEW}
            </div>
            <div className="small text-muted mt-2">
              Once they reply, this becomes a normal conversation.
            </div>
            {orderConfirmation && (
              <div className="small text-danger mt-2">
                This generic template isn't an order confirmation, so sending it
                here won't mark the lead Won - wait for their reply, then use
                Confirm Order again.
              </div>
            )}
          </>
        )}

        {sendError && <div className="small text-danger mt-2">{sendError}</div>}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>

        {!result ? (
          initialPhone ? (
            checkError && (
              <Button onClick={() => handleCheck(initialPhone)} disabled={checking}>
                Retry
              </Button>
            )
          ) : (
            <Button onClick={() => handleCheck()} disabled={!phone.trim() || checking}>
              {checking ? "Checking..." : "Check Number"}
            </Button>
          )
        ) : result.window_open ? (
          <Button
            onClick={handleSendFreeform}
            disabled={(!message.trim() && !attachment) || sending}
          >
            {sending ? "Sending..." : attachment ? "Send Attachment" : "Send"}
          </Button>
        ) : (
          <Button onClick={handleSendTemplate} disabled={sending}>
            {sending ? "Sending..." : "Send Template"}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
