const CLOSED_STATUSES = new Set(["Won", "Lost"]);

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
 * Open leads that have gone quiet long enough to need action, ranked most
 * urgent first. Shared by the AI Insights follow-up card and the
 * notification bell so both agree on what counts as "due" vs "overdue".
 */
export function getFollowUpAlerts(leads) {
  return leads
    .filter(isOpenLead)
    .map((lead) => ({ lead, age: daysSince(lead.created_at) }))
    .filter(({ age }) => age >= FOLLOW_UP_DAYS)
    .map(({ lead, age }) => ({
      id: lead.id,
      companyName: lead.company_name,
      productName: lead.product_name,
      status: lead.status,
      daysOpen: Math.floor(age),
      severity: age >= OVERDUE_DAYS ? "overdue" : "due",
    }))
    .sort((a, b) => b.daysOpen - a.daysOpen);
}
