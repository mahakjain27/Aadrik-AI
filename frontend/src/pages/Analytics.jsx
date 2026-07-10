import { useEffect, useState } from "react";
import { Spinner } from "react-bootstrap";
import { getLeads } from "../services/api";
import AnalyticsCharts, { INK } from "../components/AnalyticsCharts";
import AIInsights from "../pages/AIInsights";

function KpiTile({ label, value }) {
  return (
    <div className="col-6 col-md-3">
      <div
        style={{
          background: "#ffffff",
          border: `1px solid ${INK.border}`,
          borderRadius: "14px",
          padding: "14px 16px",
          height: "100%",
        }}
      >
        <div style={{ fontSize: "12.5px", fontWeight: 600, color: INK.secondary }}>
          {label}
        </div>
        <div style={{ fontSize: "22px", fontWeight: 700, color: INK.primary, lineHeight: 1.2 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default function Analytics({ onOpenCRM }) {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);

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

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" />
      </div>
    );
  }

  const totalLeads = leads.length;
  const won = leads.filter((l) => l.status === "Won").length;
  const lost = leads.filter((l) => l.status === "Lost").length;
  const closed = won + lost;
  const winRate = closed > 0 ? Math.round((won / closed) * 100) : 0;

  return (
    <div className="container-fluid mt-4" style={{ paddingBottom: "32px" }}>
      <h2 className="mb-4" style={{ fontWeight: 700, color: INK.primary }}>
        Sales Analytics
      </h2>

      <div className="row g-3 mb-1">
        <KpiTile label="Total leads" value={totalLeads} />
        <KpiTile label="Won" value={won} />
        <KpiTile label="Lost" value={lost} />
        <KpiTile label="Win rate" value={`${winRate}%`} />
      </div>

      <AIInsights leads={leads} onOpenCRM={onOpenCRM} />

      <AnalyticsCharts leads={leads} />
    </div>
  );
}
