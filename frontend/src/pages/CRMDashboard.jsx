
import { useEffect, useRef, useState } from "react";
import { Table, Spinner, Modal, Form, Button, Alert, Badge } from "react-bootstrap";
import LeadDetailsModal from "../components/LeadDetailsModal";
import AIInsights from "./AIInsights";
import { useAuth } from "../context/AuthContext";
import {
  FaUsers,
  FaClock,
  FaPhoneAlt,
  FaFileInvoiceDollar,
  FaTrophy,
  FaTimesCircle,
  FaEllipsisV,
  FaEye,
  FaFilePdf,
  FaEnvelope,
  FaPrint,
  FaUserTag,
} from "react-icons/fa";


import { Dropdown } from "react-bootstrap";
import {
  getLeads,
  updateLeadStatus,
  deleteLead,
  archiveLead,
  unarchiveLead,
  downloadQuotationPdf,
  getAssignees,
  assignLead,
  sendQuotation,
} from "../services/api";

const APPROVAL_BADGE = {
  Draft: "secondary",
  "Pending Approval": "warning",
  Approved: "success",
  Rejected: "danger",
  "Not Required": "light",
};

function getQuoteNumber(lead) {
  const year = new Date(lead.created_at).getFullYear();
  return `AD-${year}-${String(lead.id).padStart(4, "0")}`;
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const SOURCE_META = {
  website: { label: "Website", emoji: "🌐", color: "#1baf7a" },
  whatsapp: { label: "WhatsApp", emoji: "💬", color: "#25d366" },
  manual: { label: "Manual", emoji: "✍", color: "#898781" },
};

function SourceBadge({ source }) {
  const meta = SOURCE_META[source] || { label: source || "—", emoji: "", color: "#898781" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 600,
        whiteSpace: "nowrap",
        background: hexToRgba(meta.color, 0.12),
        color: meta.color,
      }}
    >
      {meta.emoji} {meta.label}
    </span>
  );
}

const STATUS_FILTERS = [
  { key: "All", label: "Total leads", icon: FaUsers, color: "#5c1030" },
  { key: "Pending", label: "Pending", icon: FaClock, color: "#eda100" },
  { key: "Contacted", label: "Contacted", icon: FaPhoneAlt, color: "#1baf7a" },
  { key: "Quotation Sent", label: "Quoted", icon: FaFileInvoiceDollar, color: "#4a3aa7" },
  { key: "Won", label: "Won", icon: FaTrophy, color: "#0ca30c" },
  { key: "Lost", label: "Lost", icon: FaTimesCircle, color: "#d03b3b" },
];

function StatCard({ label, value, Icon, color, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        textAlign: "left",
        background: active ? hexToRgba(color, 0.07) : "#ffffff",
        border: active ? `1.5px solid ${color}` : "1px solid rgba(11,11,11,0.08)",
        borderRadius: "14px",
        padding: "14px 16px",
        cursor: "pointer",
        boxShadow: active
          ? `0 4px 14px ${hexToRgba(color, 0.18)}`
          : "var(--shadow-card)",
        transition: "box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: "38px",
          height: "38px",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color,
          color: "#ffffff",
        }}
      >
        <Icon size={16} />
      </span>

      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: "12.5px",
            fontWeight: 600,
            color: "#52514e",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: "block",
            fontSize: "22px",
            fontWeight: 700,
            lineHeight: 1.15,
            color: active ? color : "#0b0b0b",
          }}
        >
          {value}
        </span>
      </span>
    </button>
  );
}

function AssignLeadModal({ lead, assignees, onClose, onAssigned }) {
  const [selected, setSelected] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (lead) {
      setSelected(lead.assigned_to ? String(lead.assigned_to) : "");
      setError(null);
      setSubmitting(false);
    }
  }, [lead]);

  if (!lead) return null;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      await assignLead(lead.id, selected ? Number(selected) : null);
      onAssigned();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Could not assign lead.");
    }

    setSubmitting(false);
  }

  return (
    <Modal show={!!lead} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Assign Lead — {lead.company_name}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        <Form.Group>
          <Form.Label>Assigned To</Form.Label>
          <Form.Select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Unassigned</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={submitting} onClick={handleSubmit}>
          {submitting ? "Saving..." : "Save"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default function CRMDashboard({ pendingQuotationId, onConsumePending }) {
  const { user } = useAuth();
  const canAssign = user?.role === "admin" || user?.role === "manager";
  const [assignees, setAssignees] = useState([]);
  const [assigningLead, setAssigningLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [search,setSearch]=useState("");
  const [activeFilter,setActiveFilter]=useState("All");
  const [yearFilter, setYearFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [yearOptions, setYearOptions] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const tableRef = useRef(null);
  const totalLeads = leads.length;

  const pending = leads.filter(
    (l) => l.status === "Pending"
  ).length;

  const contacted = leads.filter(
    (l) => l.status === "Contacted"
  ).length;

  const quotationSent = leads.filter(
    (l) => l.status === "Quotation Sent"
  ).length;

  const won = leads.filter(
    (l) => l.status === "Won"
  ).length;

  const lost = leads.filter(
    (l) => l.status === "Lost"
  ).length;

  const filteredLeads = leads.filter((lead) => {
  const query = search.toLowerCase();

  const matchesSearch =
    getQuoteNumber(lead).toLowerCase().includes(query) ||
    lead.company_name.toLowerCase().includes(query) ||
    lead.product_name.toLowerCase().includes(query) ||
    (lead.items || []).some((item) =>
      (item.product_name || "").toLowerCase().includes(query)
    ) ||
    lead.phone.toLowerCase().includes(query) ||
    (lead.contact_person || "").toLowerCase().includes(query) ||
    (lead.created_by_name || "").toLowerCase().includes(query) ||
    (lead.assigned_to_name || "").toLowerCase().includes(query);

  const matchesStatus =
    activeFilter === "All" ||
    lead.status === activeFilter;

  const matchesSource =
    !sourceFilter ||
    lead.source === sourceFilter;

  return matchesSearch && matchesStatus && matchesSource;
});
  
  async function loadLeads() {
    try {
      const data = await getLeads(
        yearFilter ? Number(yearFilter) : undefined,
        showArchived
      );
      setLeads(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, [yearFilter, showArchived]);

  useEffect(() => {
    // Pulled once, independent of the year/archived filters above, so the
    // dropdown always lists every year that has ever had a quotation
    // rather than collapsing to whatever the current filter returns.
    getLeads(undefined, true)
      .then((all) => {
        const years = [...new Set(all.map((l) => new Date(l.created_at).getFullYear()))];
        setYearOptions(years.sort((a, b) => b - a));
      })
      .catch(() => {});

    if (canAssign) {
      getAssignees()
        .then(setAssignees)
        .catch(() => {});
    }
  }, [canAssign]);

  useEffect(() => {
    if (!pendingQuotationId || leads.length === 0) return;

    const lead = leads.find((l) => l.id === pendingQuotationId);

    if (lead) {
      setSelectedLead(lead);
      setShowDetails(true);
      onConsumePending?.();
    }
  }, [pendingQuotationId, leads]);

  if (loading)
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" />
      </div>
    );

  const counts = {
    All: totalLeads,
    Pending: pending,
    Contacted: contacted,
    "Quotation Sent": quotationSent,
    Won: won,
    Lost: lost,
  };

  return (
    <div className="container mt-4" style={{ paddingBottom: "32px" }}>

      <h2 className="mb-4" style={{ fontWeight: 700, color: "#0b0b0b" }}>
        Sales Dashboard
      </h2>

      <div className="row mb-4 align-items-center g-2">

        <div className="col-md-4">
          <input
            className="form-control"
            placeholder="🔍 Search Quote No, Company, Product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="col-md-2">
          <select
            className="form-select"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="">All Years</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-2">
          <select
            className="form-select"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="">All Sources</option>
            <option value="website">Website</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        <div className="col-md-2 form-check d-flex align-items-center">
          <input
            type="checkbox"
            className="form-check-input me-2"
            id="show-archived"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="show-archived">
            Show Archived
          </label>
        </div>

        <div className="col-md-2 text-md-end">
          <span style={{ color: "#52514e", fontSize: "13px", fontWeight: 600 }}>
            Showing
          </span>
          <span className="ms-2 fw-semibold" style={{ color: "#0b0b0b" }}>
            {activeFilter === "All" ? "All leads" : activeFilter}
          </span>
        </div>

      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        {STATUS_FILTERS.map((filter) => (
          <StatCard
            key={filter.key}
            label={filter.label}
            value={counts[filter.key]}
            Icon={filter.icon}
            color={filter.color}
            active={activeFilter === filter.key}
            onClick={() => setActiveFilter(filter.key)}
          />
        ))}
      </div>

      <AIInsights
        leads={leads}
        onOpenCRM={(company) => {
          setActiveFilter("All");
          setSearch(company || "");
          tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <div
        ref={tableRef}
        style={{
          background: "#ffffff",
          border: "1px solid rgba(11,11,11,0.08)",
          borderRadius: "16px",
          boxShadow: "var(--shadow-card)",
          overflow: "hidden",
          marginTop: "24px",
        }}
      >
      <Table
            hover
            striped
            size="sm"
            className="mb-0"
            style={{ tableLayout: "fixed", width: "100%", fontSize: "13px" }}
          >

            <thead>
              <tr>
                <th style={{ width: "9%" }}>Quote No</th>
                <th style={{ width: "17%" }}>Company</th>
                <th style={{ width: "9%" }}>Source</th>
                <th style={{ width: "37%" }}>Product(s)</th>
                <th style={{ width: "14%" }}>Status</th>
                <th style={{ width: "8%" }}>Approval</th>
                <th style={{ width: "6%" }}>Action</th>
              </tr>
            </thead>

            <tbody>

              {filteredLeads.map((lead) => (

                <tr key={lead.id}>

                  <td style={{ whiteSpace: "nowrap"}}>
                    <strong>{getQuoteNumber(lead)}</strong>
                    {lead.is_archived ? (
                      <Badge bg="dark" className="ms-2">Archived</Badge>
                    ) : null}
                  </td>

                  <td style={{ wordBreak: "break-word" }}>{lead.company_name}</td>

                  <td>
                    <SourceBadge source={lead.source} />
                  </td>

                  <td style={{ wordBreak: "break-word" }}>
                    {lead.items_summary || lead.product_name}
                  </td>

                  <td>
  <select
    className="form-select form-select-sm"
    value={lead.status}
    onChange={async (e) => {
      const newStatus = e.target.value;

      try {
        await updateLeadStatus(lead.id, newStatus);

        setLeads((prev) =>
          prev.map((item) =>
            item.id === lead.id
              ? { ...item, status: newStatus }
              : item
          )
        );
      } catch {
        alert("Unable to update lead status.");
      }
    }}
  >
    <option value="Pending">Pending</option>
    <option value="Contacted">Contacted</option>
    <option value="Quotation Sent">Quotation Sent</option>
    <option value="Won">Won</option>
    <option value="Lost">Lost</option>
  </select>
</td>

                  <td>
                    <Badge
                      bg={APPROVAL_BADGE[lead.approval_status] || "secondary"}
                      text={lead.approval_status === "Not Required" ? "dark" : undefined}
                      pill
                    >
                      {lead.approval_status || "Draft"}
                    </Badge>
                  </td>

<td>

<Dropdown>

  <Dropdown.Toggle
    variant="light"
    size="sm"
    className="border"
  >
    <FaEllipsisV />
  </Dropdown.Toggle>

  <Dropdown.Menu>

    <Dropdown.Item
      onClick={() => {
        setSelectedLead(lead);
        setShowDetails(true);
      }}
    >
      <FaEye className="me-2 text-primary" />
      View Details
    </Dropdown.Item>

    {canAssign && (
      <Dropdown.Item onClick={() => setAssigningLead(lead)}>
        <FaUserTag className="me-2 text-info" />
        {lead.assigned_to_name ? "Reassign" : "Assign"}
      </Dropdown.Item>
    )}

    <Dropdown.Item
      onClick={async () => {
        try {
          const blob = await downloadQuotationPdf(lead.id);
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${getQuoteNumber(lead)}.pdf`;
          link.click();
          URL.revokeObjectURL(url);
        } catch {
          alert("Unable to download PDF.");
        }
      }}
    >
      <FaFilePdf className="me-2 text-danger" />
      Download PDF
    </Dropdown.Item>

    <Dropdown.Item
      onClick={async () => {
        try {
          if (lead.is_archived) {
            await unarchiveLead(lead.id);
          } else {
            await archiveLead(lead.id);
          }

          setLeads((prev) =>
            prev.map((item) =>
              item.id === lead.id
                ? { ...item, is_archived: item.is_archived ? 0 : 1 }
                : item
            )
          );
        } catch {
          alert("Unable to update archive status.");
        }
      }}
    >
      📦 {lead.is_archived ? "Unarchive" : "Archive"}
    </Dropdown.Item>

    <Dropdown.Divider />

<Dropdown.Item
  className="text-danger"
  onClick={async () => {

    const confirmDelete = window.confirm(
      `Delete quotation ${getQuoteNumber(lead)} ?`
    );

    if (!confirmDelete) return;

    try {

      await deleteLead(lead.id);

      setLeads(prev =>
        prev.filter(item => item.id !== lead.id)
      );

    } catch {
      alert("Unable to delete quotation.");
    }

  }}
>
  🗑 Delete
</Dropdown.Item>

    <Dropdown.Item
      disabled={lead.approval_status !== "Approved"}
      onClick={async () => {
        try {
          const result = await sendQuotation(lead.id);
          alert(result.message);
          loadLeads();
        } catch (err) {
          alert(err.response?.data?.detail || "Unable to send quotation.");
        }
      }}
    >
      <FaEnvelope className="me-2" />
      Send Quotation
      {lead.approval_status !== "Approved" && (
        <small className="text-muted ms-2">(Needs approval)</small>
      )}
    </Dropdown.Item>

    <Dropdown.Item disabled>
      <FaPrint className="me-2" />
      Print
      <small className="text-muted ms-2">(Coming Soon)</small>
    </Dropdown.Item>

  </Dropdown.Menu>

</Dropdown>

</td>

                </tr>

              ))}

            </tbody>

          </Table>
      </div>

      <LeadDetailsModal
        show={showDetails}
        onClose={() => setShowDetails(false)}
        lead={selectedLead}
        onUpdated={loadLeads}
      />

      <AssignLeadModal
        lead={assigningLead}
        assignees={assignees}
        onClose={() => setAssigningLead(null)}
        onAssigned={loadLeads}
      />
    </div>
  );
}