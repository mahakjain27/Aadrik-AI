
import { useEffect, useMemo, useState } from "react";
import { Table, Spinner } from "react-bootstrap";
import LeadDetailsModal from "../components/LeadDetailsModal";
import { scoreLeads } from "../utils/leadScoring";
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
} from "react-icons/fa";


import { Dropdown } from "react-bootstrap";
import {
  getLeads,
  updateLeadStatus,
  deleteLead,
} from "../services/api";

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

const PRIORITY_META = {
  High: { emoji: "🔥", color: "#d03b3b" },
  Medium: { emoji: "⚠", color: "#eda100" },
  Low: { emoji: "⬇", color: "#898781" },
};

function PriorityBadge({ priority, score, reason, quantityUnit }) {
  if (!priority) {
    return <span style={{ color: "#898781", fontSize: "12px" }}>—</span>;
  }

  const meta = PRIORITY_META[priority];

  return (
    <span
      title={`Score ${score}/100 — ${reason} · Quantity unit: ${quantityUnit}`}
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
      {meta.emoji} {priority}
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

export default function CRMDashboard({ initialSearch = "" }) {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [search,setSearch]=useState(initialSearch);
  const [activeFilter,setActiveFilter]=useState("All");
  const [selectedLead, setSelectedLead] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
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

  const scoredLeads = useMemo(() => scoreLeads(leads), [leads]);

  const filteredLeads = scoredLeads.filter((lead) => {
  const query = search.toLowerCase();

  const matchesSearch =
    getQuoteNumber(lead).toLowerCase().includes(query) ||
    lead.company_name.toLowerCase().includes(query) ||
    lead.product_name.toLowerCase().includes(query) ||
    lead.phone.toLowerCase().includes(query) ||
    (lead.contact_person || "").toLowerCase().includes(query);

  const matchesStatus =
    activeFilter === "All" ||
    lead.status === activeFilter;

  return matchesSearch && matchesStatus;
});
  
  async function loadLeads() {
    try {
      const data = await getLeads();
      setLeads(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

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

        <div className="col-md-6">
          <input
            className="form-control"
            placeholder="🔍 Search Quote No, Company, Product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="col-md-6 text-md-end">
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

      <div
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
            responsive
            className="mb-0"
          >

            <thead>
              <tr>
                <th>Quote No</th>
                <th>Company</th>
                <th>AI Priority</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>City</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>

              {filteredLeads.map((lead) => (

                <tr key={lead.id}>

                  <td style={{ whiteSpace: "nowrap"}}><strong>{getQuoteNumber(lead)}</strong></td>

                  <td style ={{ minWidth: "200px"}}>{lead.company_name}</td>

                  <td>
                    <PriorityBadge
                      priority={lead.aiPriority}
                      score={lead.aiScore}
                      reason={lead.aiReason}
                      quantityUnit={lead.aiQuantityUnit}
                    />
                  </td>

                  <td style={{ minWidth: "260px"}}>{lead.product_name}</td>

                  <td>{lead.quantity}</td>

                  <td>{lead.delivery_city}</td>

                  <td style={{ minWidth: "170px" }}>
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

    <Dropdown.Item
      onClick={() =>
        window.open(
          `http://127.0.0.1:8000/quotation/${lead.id}/pdf`,
          "_blank"
        )
      }
    >
      <FaFilePdf className="me-2 text-danger" />
      Download PDF
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

    <Dropdown.Item disabled>
      <FaEnvelope className="me-2" />
      Send Email
      <small className="text-muted ms-2">(Coming Soon)</small>
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
      />
    </div>
  );
}