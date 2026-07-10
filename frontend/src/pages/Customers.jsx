import { useEffect, useState } from "react";
import { Table, Modal, Button } from "react-bootstrap";
import { getCustomers } from "../services/api";

function CustomerDetailsModal({ customer, onClose }) {
  if (!customer) return null;

  return (
    <Modal show={!!customer} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>{customer.company_name}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Table bordered className="mb-0">
          <tbody>
            <tr>
              <th width="35%">Contact person</th>
              <td>{customer.contact_person}</td>
            </tr>
            <tr>
              <th>Phone</th>
              <td>{customer.phone}</td>
            </tr>
            <tr>
              <th>City</th>
              <td>{customer.delivery_city}</td>
            </tr>
            <tr>
              <th>Total quotations</th>
              <td>{customer.total_quotations}</td>
            </tr>
            <tr>
              <th>Last quotation</th>
              <td>{new Date(customer.last_quotation).toLocaleDateString()}</td>
            </tr>
          </tbody>
        </Table>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);

  async function loadCustomers() {
    const data = await getCustomers();
    setCustomers(data);
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  return (
    <div className="container mt-4" style={{ paddingBottom: "32px" }}>
      <h2 className="mb-4" style={{ fontWeight: 700, color: "#0b0b0b" }}>
        Customers
      </h2>

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
              <th>Contact</th>
              <th>City</th>
              <th>Quotations</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {customers.map((c, index) => (
              <tr key={index}>
                <td style={{ minWidth: 200 }}>
                  <strong>{c.company_name}</strong>
                </td>
                <td>{c.contact_person}</td>
                <td>{c.delivery_city}</td>
                <td>{c.total_quotations}</td>
                <td>
                  <Button
                    size="sm"
                    variant="light"
                    className="border"
                    onClick={() => setSelected(c)}
                  >
                    View details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <CustomerDetailsModal customer={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
