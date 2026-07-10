import { Modal, Button, Table } from "react-bootstrap";

function ProductDetailsModal({
  show,
  onClose,
  product,
  selectedVariant,
  onAsk,
  onQuote,
}) {
  if (!product) return null;

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      size="md"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          {product.brand ? `${product.brand} ` : ""}
          {product.name}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Table borderless responsive className="mb-0">
          <tbody>
            <tr>
              <td width="40%">
                <strong>Category</strong>
              </td>
              <td>{product.category}</td>
            </tr>

            {product.subcategory && (
              <tr>
                <td>
                  <strong>Subcategory</strong>
                </td>
                <td>{product.subcategory}</td>
              </tr>
            )}

            {product.grade && (
              <tr>
                <td>
                  <strong>Grade</strong>
                </td>
                <td>{product.grade}</td>
              </tr>
            )}

            {product.brand && (
              <tr>
                <td>
                  <strong>Brand</strong>
                </td>
                <td>{product.brand}</td>
              </tr>
            )}

            <tr>
              <td>
                <strong>Selected Size</strong>
              </td>
              <td>{selectedVariant || "Not selected"}</td>
            </tr>
          </tbody>
        </Table>
      </Modal.Body>

      <Modal.Footer>
        <Button
          variant="outline-primary"
          onClick={() => onAsk(product, selectedVariant)}
        >
          💬 Ask AI
        </Button>

        <Button
          variant="primary"
          onClick={() => onQuote(product, selectedVariant)}
        >
          📄 Request Quotation
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ProductDetailsModal;