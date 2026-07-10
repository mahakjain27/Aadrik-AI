import { categorizeQuantity } from "./productQuantity";

const CLOSED_STATUSES = new Set(["Won", "Lost"]);

const STATUS_BASE_SCORE = {
  New: 40,
  Pending: 40,
  Contacted: 55,
  "Quotation Sent": 70,
};

function daysSince(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 0;
  return (Date.now() - d.getTime()) / 86400000;
}

function parseQuantity(raw) {
  if (!raw) return 0;
  const match = String(raw).match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

function priorityFromScore(score) {
  if (score >= 70) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

/**
 * Rule-based lead priority score (0-100). Shared across the CRM table, the
 * follow-up engine, risk prediction, and the sales copilot so every module
 * ranks leads the same way.
 */
export function scoreLeads(leads) {
  const companyCount = {};
  leads.forEach((l) => {
    companyCount[l.company_name] = (companyCount[l.company_name] || 0) + 1;
  });

  const categoryMax = {};
  leads.forEach((l) => {
    const { key } = categorizeQuantity(l.product_name);
    categoryMax[key] = Math.max(categoryMax[key] || 1, parseQuantity(l.quantity));
  });

  return leads.map((lead) => {
    if (CLOSED_STATUSES.has(lead.status)) {
      return {
        ...lead,
        aiScore: null,
        aiPriority: null,
        aiReason: null,
        aiQuantityUnit: categorizeQuantity(lead.product_name).unit,
      };
    }

    const base = STATUS_BASE_SCORE[lead.status] ?? 40;

    const age = daysSince(lead.created_at);
    const recencyBonus = Math.max(0, 20 - age * 2);

    const repeatCount = companyCount[lead.company_name] || 1;
    const repeatBonus = repeatCount >= 3 ? 20 : repeatCount === 2 ? 12 : 0;

    const category = categorizeQuantity(lead.product_name);
    const quantityBonus = (parseQuantity(lead.quantity) / categoryMax[category.key]) * 15;

    const score = Math.min(100, Math.round(base + recencyBonus + repeatBonus + quantityBonus));

    const reasons = [];
    if (quantityBonus >= 10) reasons.push(`large ${category.label}`);
    if (recencyBonus >= 10) reasons.push("recent inquiry");
    if (repeatBonus >= 12) reasons.push("multiple quotations");
    if (base >= 70) reasons.push("quotation already sent");
    if (reasons.length === 0) reasons.push("low activity");

    const reason = reasons.join(" + ");

    return {
      ...lead,
      aiScore: score,
      aiPriority: priorityFromScore(score),
      aiReason: reason.charAt(0).toUpperCase() + reason.slice(1),
      aiQuantityUnit: category.unit,
    };
  });
}
