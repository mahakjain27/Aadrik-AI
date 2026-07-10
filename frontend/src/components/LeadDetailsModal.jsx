import { Modal, Table, Badge, Button } from "react-bootstrap";

export default function LeadDetailsModal({
  show,
  onClose,
  lead,
}) {
  if (!lead) return null;

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
                AD-{new Date(lead.created_at).getFullYear()}-
                {String(lead.id).padStart(4, "0")}
              </td>
            </tr>

            <tr>
              <th>Company</th>
              <td>{lead.company_name}</td>
            </tr>

            <tr>
              <th>Contact Person</th>
              <td>{lead.contact_person}</td>
            </tr>

            <tr>
              <th>Phone</th>
              <td>{lead.phone}</td>
            </tr>

            <tr>
              <th>Email</th>
              <td>{lead.email || "-"}</td>
            </tr>

            <tr>
              <th>GST</th>
              <td>{lead.gst_number || "-"}</td>
            </tr>

            <tr>
              <th>Product</th>
              <td>{lead.product_name}</td>
            </tr>

            <tr>
              <th>Brand</th>
              <td>{lead.brand}</td>
            </tr>

            <tr>
              <th>Size</th>
              <td>{lead.size}</td>
            </tr>

            <tr>
              <th>Quantity</th>
              <td>{lead.quantity}</td>
            </tr>

            <tr>
              <th>Delivery City</th>
              <td>{lead.delivery_city}</td>
            </tr>

            <tr>
              <th>Pincode</th>
              <td>{lead.pincode || "-"}</td>
            </tr>

            <tr>
              <th>Status</th>
              <td>
                <Badge
  pill
  bg={
    lead.status === "Pending"
      ? "warning"
      : lead.status === "Contacted"
      ? "info"
      : lead.status === "Won"
      ? "success"
      : lead.status === "Lost"
      ? "danger"
      : undefined
  }
  text={lead.status === "Pending" ? "dark" : "white"}
  style={
    lead.status === "Quotation Sent"
      ? { backgroundColor: "#4a3aa7" }
      : undefined
  }
>
  {lead.status}
</Badge>
                
              </td>
            </tr>

            <tr>
              <th>Created</th>
              <td>
                {new Date(
                  lead.created_at
                ).toLocaleString()}
              </td>
            </tr>

          </tbody>

        </Table>

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
