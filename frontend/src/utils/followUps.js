const CLOSED_STATUSES = new Set(["Won", "Lost"]);

// Display copy only - the actual thresholds live in
// backend/app/services/lead_scoring.py (FOLLOW_UP_DAYS/OVERDUE_DAYS), which
// computes follow_up_severity/days_open on every lead from GET /crm/leads.
export const FOLLOW_UP_DAYS = 2;
export const OVERDUE_DAYS = 5;

export function daysSince(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 0;
  return (Date.now() - d.getTime()) / 86400000;
}

export function isOpenLead(lead) {
  return !CLOSED_STATUSES.has(lead.status);
}

/**
 * Leads that have gone quiet long enough to need action, ranked most urgent
 * first. Reads the follow_up_severity/days_open fields the backend already
 * computed on each lead, so this and the notification bell always agree
 * with whatever WhatsApp/ERP automations end up calling server-side.
 */
export function getFollowUpAlerts(leads) {
  return leads
    .filter((lead) => lead.follow_up_severity)
    .map((lead) => ({
      id: lead.id,
      companyName: lead.company_name,
      productName: lead.product_name,
      status: lead.status,
      daysOpen: lead.days_open,
      severity: lead.follow_up_severity,
    }))
    .sort((a, b) => b.daysOpen - a.daysOpen);
}
