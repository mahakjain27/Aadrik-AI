import { useEffect, useState } from "react";
import { Table, Modal, Button, Form, Alert, Badge, Spinner } from "react-bootstrap";
import {
  getKnowledgeDocuments,
  uploadKnowledgeDocument,
  deleteKnowledgeDocument,
  previewKnowledgeDocumentText,
  getKnowledgeDocumentFile,
  getKnowledgeStats,
  rebuildKnowledgeBase,
} from "../services/api";

function errorMessage(err, fallback) {
  return err.response?.data?.message || err.response?.data?.detail || fallback;
}

const CATEGORIES = [
  "Policies",
  "Catalogues",
  "Technical Datasheets",
  "FAQs",
  "Company Information",
  "Other",
];

const TYPE_BADGE = {
  pdf: "danger",
  docx: "primary",
  txt: "secondary",
  md: "info",
};

function UploadForm({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (!file) {
      setError("Choose a file first.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      await uploadKnowledgeDocument(file, category);
      setFile(null);
      document.getElementById("kb-file-input").value = "";
      onUploaded();
    } catch (err) {
      setError(errorMessage(err, "Upload failed."));
    }

    setUploading(false);
  }

  return (
    <div className="settings-card mb-4">
      <h5 className="settings-card-title">Upload Document</h5>

      {error && (
        <Alert variant="danger" className="py-2">
          {error}
        </Alert>
      )}

      <div className="row g-2 align-items-end">
        <div className="col-sm-5">
          <Form.Label className="small mb-1">File (PDF, DOCX, TXT, Markdown)</Form.Label>
          <Form.Control
            id="kb-file-input"
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="col-sm-4">
          <Form.Label className="small mb-1">Category</Form.Label>
          <Form.Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Form.Select>
        </div>

        <div className="col-sm-3">
          <Button className="w-100" disabled={uploading} onClick={handleUpload}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ document: doc, onClose }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!doc) return;

    setLoading(true);
    setContent(null);

    if (doc.file_type === "pdf") {
      getKnowledgeDocumentFile(doc.id)
        .then((blob) => setContent({ type: "pdf", url: URL.createObjectURL(blob) }))
        .finally(() => setLoading(false));
    } else {
      previewKnowledgeDocumentText(doc.id)
        .then((data) => setContent({ type: "text", text: data.text }))
        .finally(() => setLoading(false));
    }

    return () => {
      if (content?.type === "pdf") URL.revokeObjectURL(content.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  return (
    <Modal show={!!doc} onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{doc?.filename}</Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ minHeight: 300 }}>
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" size="sm" />
          </div>
        ) : content?.type === "pdf" ? (
          <iframe
            src={content.url}
            title={doc?.filename}
            style={{ width: "100%", height: "60vh", border: "none" }}
          />
        ) : (
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>
            {content?.text || "(no extractable text)"}
          </pre>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function StatsPanel({ stats, onRebuild, rebuilding }) {
  if (!stats) return null;

  return (
    <div className="settings-card mb-4">
      <div className="settings-about-header">
        <div>
          <h5 className="settings-card-title mb-1">Knowledge Base</h5>
          <div className="settings-about-version">
            {stats.total_documents} documents · {stats.chunk_count ?? "-"} chunks
            {stats.last_rebuilt_at && (
              <> · Last rebuilt {new Date(stats.last_rebuilt_at).toLocaleString()}</>
            )}
          </div>
        </div>

        <Button size="sm" disabled={rebuilding} onClick={onRebuild}>
          {rebuilding ? "Rebuilding..." : "Rebuild Knowledge Base"}
        </Button>
      </div>

      <hr />

      <h6 className="mb-2">AI Sources</h6>

      <div className="row g-2">
        {Object.entries(stats.ai_sources).map(([source, count]) => (
          <div key={source} className="col-sm-4 d-flex justify-content-between">
            <span className="text-muted small">{source}</span>
            <strong className="small">{count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KnowledgeBaseManager() {
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [previewTarget, setPreviewTarget] = useState(null);
  const [notice, setNotice] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [docs, statsData] = await Promise.all([
        getKnowledgeDocuments(categoryFilter || undefined),
        getKnowledgeStats(),
      ]);
      setDocuments(docs);
      setStats(statsData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter]);

  async function handleRebuild() {
    setRebuilding(true);
    setNotice(null);

    try {
      const statsData = await rebuildKnowledgeBase();
      setStats(statsData);
      setNotice({ variant: "success", text: "Knowledge base rebuilt." });
    } catch (err) {
      setNotice({ variant: "danger", text: errorMessage(err, "Rebuild failed.") });
    }

    setRebuilding(false);
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Remove "${doc.filename}"? This won't take effect for AI answers until you rebuild.`)) {
      return;
    }

    try {
      await deleteKnowledgeDocument(doc.id);
      setNotice({ variant: "success", text: `${doc.filename} removed.` });
      load();
    } catch (err) {
      setNotice({ variant: "danger", text: errorMessage(err, "Could not remove document.") });
    }
  }

  async function handleDownload(doc) {
    try {
      const blob = await getKnowledgeDocumentFile(doc.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice({ variant: "danger", text: "Could not download document." });
    }
  }

  return (
    <div className="container mt-4" style={{ paddingBottom: "32px" }}>
      <h2 className="mb-4" style={{ fontWeight: 700, color: "#0b0b0b" }}>
        Knowledge Base Manager
      </h2>

      {notice && (
        <Alert variant={notice.variant} dismissible onClose={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      <StatsPanel stats={stats} onRebuild={handleRebuild} rebuilding={rebuilding} />

      <UploadForm onUploaded={load} />

      <div className="d-flex align-items-center gap-2 mb-3">
        <Form.Select
          style={{ maxWidth: 260 }}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Form.Select>
      </div>

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
              <th>Filename</th>
              <th>Type</th>
              <th>Category</th>
              <th>Uploaded By</th>
              <th>Uploaded On</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td style={{ minWidth: 200 }}>{doc.filename}</td>
                <td>
                  <Badge bg={TYPE_BADGE[doc.file_type] || "secondary"}>
                    {doc.file_type.toUpperCase()}
                  </Badge>
                </td>
                <td>{doc.category}</td>
                <td>{doc.uploaded_by_name || "Unknown"}</td>
                <td>{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                <td className="d-flex gap-2">
                  <Button size="sm" variant="light" className="border" onClick={() => setPreviewTarget(doc)}>
                    Preview
                  </Button>
                  <Button size="sm" variant="outline-primary" onClick={() => handleDownload(doc)}>
                    Download
                  </Button>
                  <Button size="sm" variant="outline-danger" onClick={() => handleDelete(doc)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}

            {!loading && documents.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-4">
                  No documents uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      <PreviewModal document={previewTarget} onClose={() => setPreviewTarget(null)} />
    </div>
  );
}
