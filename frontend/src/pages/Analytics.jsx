import { useEffect, useState } from "react";
import { Spinner } from "react-bootstrap";
import { getLeads, downloadMonthlyReport } from "../services/api";
import AnalyticsCharts, { INK } from "../components/AnalyticsCharts";
import { useAuth } from "../context/AuthContext";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function MonthlyReportButton() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [downloading, setDownloading] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  async function handleDownload() {
    setDownloading(true);

    try {
      const blob = await downloadMonthlyReport(year, month);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Aadrik-Monthly-Report-${year}-${String(month).padStart(2, "0")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Unable to generate the monthly report.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="d-flex align-items-center gap-2">
      <select
        className="form-select form-select-sm"
        style={{ width: "130px" }}
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
      >
        {MONTH_NAMES.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>

      <select
        className="form-select form-select-sm"
        style={{ width: "100px" }}
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      <button
        className="btn btn-sm btn-primary text-nowrap"
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? "Generating..." : "📥 Download Monthly Report"}
      </button>
    </div>
  );
}

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

export default function Analytics() {
  const { user } = useAuth();
  const canDownloadReport = user?.role === "admin" || user?.role === "manager";
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
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h2 className="mb-0" style={{ fontWeight: 700, color: INK.primary }}>
          Sales Analytics
        </h2>

        {canDownloadReport && <MonthlyReportButton />}
      </div>

      <div className="row g-3 mb-1">
        <KpiTile label="Total leads" value={totalLeads} />
        <KpiTile label="Won" value={won} />
        <KpiTile label="Lost" value={lost} />
        <KpiTile label="Win rate" value={`${winRate}%`} />
      </div>

      <AnalyticsCharts leads={leads} />
    </div>
  );
}
