import { INK } from "../components/AnalyticsCharts";
import {
  daysSince,
  isOpenLead,
  getFollowUpAlerts,
  FOLLOW_UP_DAYS,
  OVERDUE_DAYS,
} from "../utils/followUps";

const TONE_COLORS = {
  good: "#0ca30c",
  attention: "#eda100",
  risk: "#d03b3b",
};

const TONE_LABELS = {
  good: "On track",
  attention: "Needs attention",
  risk: "At risk",
};

function computeInsights(leads) {
  const total = leads.length;
  if (total === 0) return { cards: [], alerts: [], topLead: null, summary: [] };

  const won = leads.filter((l) => l.status === "Won").length;
  const lost = leads.filter((l) => l.status === "Lost").length;
  const closed = won + lost;
  const open = leads.filter(isOpenLead);

  const conversionRate = (won / total) * 100;
  const winRate = closed > 0 ? (won / closed) * 100 : 0;
  const followUpAlerts = getFollowUpAlerts(leads);
  const staleOpenDue = followUpAlerts.length;
  const staleOpenOverdue = followUpAlerts.filter((a) => a.severity === "overdue").length;

  // Highest priority open lead, ranked by the shared AI score
  const openScored = leads.filter((l) => isOpenLead(l) && l.ai_score != null);
  const topLead =
    openScored.length > 0
      ? [...openScored].sort((a, b) => b.ai_score - a.ai_score)[0]
      : null;

  // City concentration
  const cityMap = {};
  leads.forEach((l) => {
    if (l.delivery_city) cityMap[l.delivery_city] = (cityMap[l.delivery_city] || 0) + 1;
  });
  const [topCityName, topCityCount] =
    Object.entries(cityMap).sort((a, b) => b[1] - a[1])[0] || [];
  const topCityShare = topCityName ? (topCityCount / total) * 100 : 0;

  // Product momentum: last 30 days vs the 30 days before that
  const recentProduct = {};
  const prevProduct = {};
  leads.forEach((l) => {
    if (!l.product_name) return;
    const age = daysSince(l.created_at);
    if (age <= 30) recentProduct[l.product_name] = (recentProduct[l.product_name] || 0) + 1;
    else if (age <= 60) prevProduct[l.product_name] = (prevProduct[l.product_name] || 0) + 1;
  });
  let topGrowth = null;
  Object.entries(recentProduct).forEach(([product, count]) => {
    if (count < 2) return;
    const prevCount = prevProduct[product] || 0;
    const delta = count - prevCount;
    if (delta > 0 && (!topGrowth || delta > topGrowth.delta)) {
      topGrowth = { product, count, prevCount, delta };
    }
  });

  // Monthly trend
  const monthMap = {};
  leads.forEach((l) => {
    const d = new Date(l.created_at);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!monthMap[key]) {
      monthMap[key] = {
        label: d.toLocaleString("default", { month: "short", year: "2-digit" }),
        count: 0,
        sortDate: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
      };
    }
    monthMap[key].count += 1;
  });
  const months = Object.values(monthMap).sort((a, b) => a.sortDate - b.sortDate);

  const cards = [];

  cards.push({
    id: "conversion",
    tone: conversionRate >= 20 ? "good" : conversionRate >= 10 ? "attention" : "risk",
    headline: `${Math.round(conversionRate)}% conversion rate`,
    description: `${won} of ${total} quotations became customers.`,
    suggestion:
      staleOpenOverdue > 0
        ? `Follow up ${staleOpenOverdue} quotation${staleOpenOverdue > 1 ? "s" : ""} older than ${OVERDUE_DAYS} days.`
        : "No quotations are overdue for follow-up.",
    actionType: staleOpenOverdue > 0 ? "crm" : null,
  });

  cards.push({
    id: "open",
    tone: open.length / total >= 0.5 ? "attention" : "good",
    headline: `${open.length} open lead${open.length === 1 ? "" : "s"}`,
    description: `${open.length} quotation${open.length === 1 ? " is" : "s are"} still awaiting a decision.`,
    suggestion: "Contact customers within 48 hours to keep momentum.",
  });

  if (closed > 0) {
    cards.push({
      id: "winrate",
      tone: winRate >= 40 ? "good" : winRate >= 20 ? "attention" : "risk",
      headline: `${Math.round(winRate)}% win rate`,
      description: `${won} won out of ${closed} closed deal${closed === 1 ? "" : "s"}.`,
      suggestion:
        winRate < 25
          ? "Improve the quotation follow-up process to lift win rate."
          : "Win rate is healthy — keep the current process.",
    });
  }

  if (lost > 0) {
    const lostShare = (lost / closed) * 100;
    cards.push({
      id: "lost",
      tone: lostShare > 50 ? "risk" : "attention",
      headline: `${lost} quotation${lost === 1 ? "" : "s"} lost`,
      description: `${Math.round(lostShare)}% of closed deals were lost.`,
      suggestion: "Review pricing and competitor positioning on lost deals.",
    });
  }

  if (topCityName) {
    cards.push({
      id: "city",
      tone: "good",
      headline: `${topCityName} leads the pipeline`,
      description: `${topCityName} contributes ${Math.round(topCityShare)}% of total enquiries (${topCityCount} of ${total}).`,
      suggestion:
        topCityShare >= 40
          ? `Focus sales campaigns in ${topCityName} while diversifying outreach elsewhere.`
          : "No single city dominates — enquiry spread is healthy.",
    });
  }

  if (topGrowth) {
    cards.push({
      id: "product",
      tone: "good",
      headline: `${topGrowth.product} is trending`,
      description: `${topGrowth.count} quotations in the last 30 days vs ${topGrowth.prevCount} in the previous 30.`,
      suggestion: `Prioritize stock and availability for ${topGrowth.product}.`,
    });
  }

  if (months.length >= 2) {
    const last = months[months.length - 1];
    const prev = months[months.length - 2];
    const change = prev.count > 0 ? ((last.count - prev.count) / prev.count) * 100 : 100;
    const declining2 =
      months.length >= 3 &&
      last.count < prev.count &&
      prev.count < months[months.length - 3].count;

    cards.push({
      id: "trend",
      tone: declining2 ? "risk" : change >= 0 ? "good" : "attention",
      headline:
        change >= 0
          ? `Lead generation up ${Math.round(change)}%`
          : `Lead generation down ${Math.round(Math.abs(change))}%`,
      description: `${last.label}: ${last.count} leads vs ${prev.count} in ${prev.label}.`,
      suggestion: declining2
        ? "Declining for two consecutive months — investigate lead sources."
        : change >= 0
        ? "Momentum is building — maintain current outreach."
        : "Monitor lead sources closely.",
    });
  }

  if (staleOpenDue > 0) {
    cards.push({
      id: "followup",
      tone: staleOpenOverdue > 0 ? "risk" : "attention",
      headline: `${staleOpenDue} quotation${staleOpenDue === 1 ? "" : "s"} need follow-up`,
      description: `Open for ${FOLLOW_UP_DAYS}+ days without a status change.`,
      suggestion: "Prioritize outreach before these leads go cold.",
      actionType: "crm",
    });
  }

  // Smart alerts: a compact summary drawn from the same signals
  const alerts = [];
  if (topGrowth) {
    alerts.push({ tone: "good", text: `${topGrowth.product} demand is rising.` });
  }
  if (staleOpenDue > 0) {
    alerts.push({
      tone: "attention",
      text: `${staleOpenDue} quotation${staleOpenDue === 1 ? "" : "s"} require follow-up.`,
    });
  }
  if (staleOpenOverdue > 0) {
    alerts.push({
      tone: "risk",
      text: `${staleOpenOverdue} quotation${staleOpenOverdue === 1 ? "" : "s"} pending ${OVERDUE_DAYS}+ days.`,
    });
  }
  if (alerts.length === 0) {
    alerts.push({ tone: "good", text: "Pipeline is healthy — no urgent follow-ups." });
  }

  // Copilot summary — the same signals as prose, most important first
  const summary = [];
  if (topLead) {
    summary.push(
      `${topLead.company_name} has the highest priority score (${topLead.ai_score}/100) — call today.`
    );
  }
  if (staleOpenDue > 0) {
    summary.push(
      `${staleOpenDue} quotation${staleOpenDue === 1 ? "" : "s"} need follow-up${
        staleOpenOverdue > 0 ? `, ${staleOpenOverdue} of them overdue` : ""
      }.`
    );
  }
  if (topCityName && topCityShare >= 30) {
    summary.push(
      `${topCityName} is your strongest market, contributing ${Math.round(topCityShare)}% of enquiries.`
    );
  }
  if (topGrowth) {
    summary.push(
      `${topGrowth.product} demand is rising — ${topGrowth.count} quotations in the last 30 days.`
    );
  }
  if (winRate > 0 && winRate < 25 && closed >= 3) {
    summary.push(`Win rate is ${Math.round(winRate)}% — focus on converting pending quotations.`);
  }
  if (summary.length === 0) {
    summary.push("Pipeline is healthy — no urgent actions today.");
  }

  return { cards, alerts, topLead, summary };
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function CopilotSummary({ lines }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #2a1030 0%, #4a1a4a 100%)",
        borderRadius: "14px",
        padding: "18px 20px",
        marginBottom: "16px",
        color: "#ffffff",
      }}
    >
      <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: 10 }}>
        🤖 {greeting()} — here's today's summary
      </div>
      <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13.5px", lineHeight: 1.7 }}>
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function PriorityLeadCard({ lead, onOpenCRM }) {
  if (!lead) return null;
  const color = TONE_COLORS[lead.ai_priority === "High" ? "risk" : "attention"];

  return (
    <div className="col-12 mb-3">
      <div
        style={{
          background: "#ffffff",
          border: `1px solid ${INK.border}`,
          borderLeft: `4px solid ${color}`,
          borderRadius: "12px",
          boxShadow: "var(--shadow-card)",
          padding: "16px 18px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
              marginBottom: 6,
            }}
          >
            🔥 Highest Priority Lead
          </div>
          <div style={{ fontSize: "17px", fontWeight: 700, color: INK.primary }}>
            {lead.company_name}
          </div>
          <div style={{ fontSize: "13px", color: INK.secondary, marginTop: 2 }}>
            {lead.product_name} · Qty {lead.quantity} · {lead.delivery_city}
          </div>
          <div style={{ fontSize: "12.5px", color: INK.muted, fontWeight: 600, marginTop: 6 }}>
            Score {lead.ai_score}/100 ({lead.ai_priority}) — {lead.ai_reason}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="btn btn-sm btn-primary">
              📞 Call now
            </a>
          )}
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => onOpenCRM?.(lead.company_name)}
          >
            View in CRM
          </button>
        </div>
      </div>
    </div>
  );
}

function InsightCard({ tone, headline, description, suggestion, actionType, onOpenCRM }) {
  const color = TONE_COLORS[tone];
  return (
    <div className="col-md-6 col-lg-4">
      <div
        style={{
          background: "#ffffff",
          border: `1px solid ${INK.border}`,
          borderLeft: `4px solid ${color}`,
          borderRadius: "12px",
          boxShadow: "var(--shadow-card)",
          padding: "16px 18px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "11px",
            fontWeight: 700,
            color,
            textTransform: "uppercase",
            letterSpacing: "0.02em",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: color,
              display: "inline-block",
            }}
          />
          {TONE_LABELS[tone]}
        </div>
        <div style={{ fontSize: "16px", fontWeight: 700, color: INK.primary, marginBottom: 4 }}>
          {headline}
        </div>
        <div style={{ fontSize: "13px", color: INK.secondary, marginBottom: 10 }}>
          {description}
        </div>
        <div style={{ fontSize: "12.5px", color: INK.muted, fontWeight: 600, marginBottom: actionType ? 10 : 0 }}>
          AI suggestion: <span style={{ fontWeight: 500 }}>{suggestion}</span>
        </div>
        {actionType === "crm" && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary mt-auto align-self-start"
            onClick={() => onOpenCRM?.()}
          >
            View Leads
          </button>
        )}
      </div>
    </div>
  );
}

function AlertPill({ tone, text }) {
  const color = TONE_COLORS[tone];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: `${color}14`,
        border: `1px solid ${color}33`,
        borderRadius: "999px",
        padding: "8px 14px",
        fontSize: "13px",
        fontWeight: 600,
        color: INK.primary,
      }}
    >
      <span
        style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }}
      />
      {text}
    </div>
  );
}

export default function AIInsights({ leads, onOpenCRM }) {
  const { cards, alerts, topLead, summary } = computeInsights(leads);

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <h5 style={{ fontWeight: 700, color: INK.primary, marginBottom: 12 }}>AI Insights</h5>

      <CopilotSummary lines={summary} />

      <div className="row">
        <PriorityLeadCard lead={topLead} onOpenCRM={onOpenCRM} />
      </div>

      <div className="row g-3 mb-3">
        {cards.map((card) => (
          <InsightCard key={card.id} {...card} onOpenCRM={onOpenCRM} />
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {alerts.map((alert, i) => (
          <AlertPill key={i} {...alert} />
        ))}
      </div>
    </div>
  );
}
