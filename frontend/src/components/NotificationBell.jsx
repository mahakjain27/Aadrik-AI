import { useEffect, useRef, useState } from "react";
import {
  getLeads,
  getActivityLog,
  getSessionNotifications,
  getPendingApprovalQuotations,
  getDismissedNotificationKeys,
  dismissNotifications,
  markSessionRead,
} from "../services/api";
import { getFollowUpAlerts } from "../utils/followUps";
import { timeAgo } from "../utils/timeAgo";
import { useAuth } from "../context/AuthContext";

function quoteNumber(q) {
  const year = new Date(q.created_at).getFullYear();
  return `AD-${year}-${String(q.id).padStart(4, "0")}`;
}

const followupKey = (alertId) => `followup:${alertId}`;
const activityKey = (entryId) => `activity:${entryId}`;
const approvalKey = (quotationId) => `quotation_approval:${quotationId}`;

function DismissButton({ onClick, label }) {
  return (
    <button
      type="button"
      aria-label={label || "Dismiss"}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        background: "none",
        border: "none",
        color: "#898781",
        fontSize: "13px",
        lineHeight: 1,
        padding: "2px 4px",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      ✕
    </button>
  );
}

const POLL_INTERVAL_MS = 120000;
const ACTIVITY_LIMIT = 8;

const SEVERITY_COLOR = {
  overdue: "#d03b3b",
  due: "#eda100",
};

const SEVERITY_BADGE = {
  due: { background: "#f6e3e7", color: "#6b2436" },
  overdue: { background: "#5c1030", color: "#ffffff" },
};

export default function NotificationBell({ onOpenCRM, onOpenSession, onOpenQuotation }) {
  const { user } = useAuth();
  const canApprove = user?.role === "admin" || user?.role === "manager";

  const [alerts, setAlerts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [pendingQuotations, setPendingQuotations] = useState([]);
  const [dismissedKeys, setDismissedKeys] = useState(() => new Set());
  const [open, setOpen] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const containerRef = useRef(null);
  const prevCountRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const leads = await getLeads();
        if (!cancelled) setAlerts(getFollowUpAlerts(leads));
      } catch {
        // Leave the bell at its last known state if the fetch fails.
      }

      try {
        const entries = await getActivityLog(ACTIVITY_LIMIT);
        if (!cancelled) setActivity(entries);
      } catch {
        // Same fallback - keep the last known activity feed.
      }

      try {
        const sessions = await getSessionNotifications();
        if (!cancelled) setAssigned(sessions);
      } catch {
        // Same fallback - keep the last known assigned-to-you list.
      }

      if (canApprove) {
        try {
          const quotations = await getPendingApprovalQuotations();
          if (!cancelled) setPendingQuotations(quotations);
        } catch {
          // Same fallback - keep the last known pending-approval list.
        }
      }

      try {
        const keys = await getDismissedNotificationKeys();
        if (!cancelled) setDismissedKeys(new Set(keys));
      } catch {
        // Same fallback - keep the last known dismissals.
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [canApprove]);

  const visibleAlerts = alerts.filter((a) => !dismissedKeys.has(followupKey(a.id)));
  const visibleActivity = activity.filter((a) => !dismissedKeys.has(activityKey(a.id)));
  const visiblePendingQuotations = pendingQuotations.filter(
    (q) => !dismissedKeys.has(approvalKey(q.id))
  );

  function dismiss(keys) {
    setDismissedKeys((prev) => new Set([...prev, ...keys]));
    dismissNotifications(keys).catch(() => {});
  }

  async function dismissSession(sessionId) {
    setAssigned((prev) => prev.filter((s) => s.id !== sessionId));
    try {
      await markSessionRead(sessionId);
    } catch {
      // Best-effort - worst case it reappears on the next poll.
    }
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const overdueCount = visibleAlerts.filter((a) => a.severity === "overdue").length;
  const count = visibleAlerts.length + assigned.length + visiblePendingQuotations.length;
  const badgeColor = overdueCount > 0 ? SEVERITY_COLOR.overdue : SEVERITY_COLOR.due;

  useEffect(() => {
    if (prevCountRef.current !== null && count > prevCountRef.current) {
      setPulsing(true);
      const timeout = setTimeout(() => setPulsing(false), 500);
      prevCountRef.current = count;
      return () => clearTimeout(timeout);
    }

    prevCountRef.current = count;
  }, [count]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Follow-up notifications"
        style={{
          position: "relative",
          background: "transparent",
          border: "none",
          color: "#ffffff",
          fontSize: "20px",
          lineHeight: 1,
          cursor: "pointer",
          padding: "6px 8px",
        }}
      >
        🔔
        {count > 0 && (
          <span
            className={pulsing ? "notification-pulse" : ""}
            style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              background: badgeColor,
              color: "#ffffff",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 700,
              minWidth: "18px",
              padding: "1px 5px",
              lineHeight: 1.4,
            }}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "340px",
            maxHeight: "420px",
            overflowY: "auto",
            background: "#ffffff",
            color: "#0b0b0b",
            border: "1px solid rgba(11,11,11,0.1)",
            borderRadius: "12px",
            boxShadow: "var(--shadow-popup)",
            zIndex: 1050,
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              fontWeight: 700,
              fontSize: "13.5px",
              borderBottom: "1px solid rgba(11,11,11,0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            Assigned to you
            {assigned.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const ids = assigned.map((s) => s.id);
                  setAssigned([]);
                  ids.forEach((id) => markSessionRead(id).catch(() => {}));
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#5c1030",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Clear all
              </button>
            )}
          </div>

          {assigned.length === 0 ? (
            <div style={{ padding: "20px 16px", color: "#898781", fontSize: "13px" }}>
              No new assigned conversations.
            </div>
          ) : (
            assigned.map((session) => (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setOpen(false);
                  setAssigned((prev) => prev.filter((s) => s.id !== session.id));
                  onOpenSession?.(session.id);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid rgba(92,16,48,0.08)",
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "13.5px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {session.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "#52514e" }}>
                    {session.status}
                    {session.customer_phone ? ` · ${session.customer_phone}` : ""}
                  </div>
                </div>

                <DismissButton onClick={() => dismissSession(session.id)} />
              </div>
            ))
          )}

          {canApprove && (
            <>
              <div
                style={{
                  padding: "12px 16px",
                  fontWeight: 700,
                  fontSize: "13.5px",
                  borderTop: "1px solid rgba(11,11,11,0.08)",
                  borderBottom: "1px solid rgba(11,11,11,0.08)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                Quotations awaiting your approval
                {visiblePendingQuotations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const keys = visiblePendingQuotations.map((q) => approvalKey(q.id));
                      dismiss(keys);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#5c1030",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Clear all
                  </button>
                )}
              </div>

              {visiblePendingQuotations.length === 0 ? (
                <div style={{ padding: "20px 16px", color: "#898781", fontSize: "13px" }}>
                  Nothing waiting on you right now.
                </div>
              ) : (
                visiblePendingQuotations.map((q) => (
                  <div
                    key={q.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setOpen(false);
                      onOpenQuotation?.(q.id);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "8px",
                      width: "100%",
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid rgba(92,16,48,0.08)",
                      padding: "10px 16px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "13.5px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {q.company_name}
                        </span>
                        <span style={{ fontSize: "11px", color: "#898781", flexShrink: 0 }}>
                          {quoteNumber(q)}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "#52514e" }}>
                        {q.product_name}
                        {q.subtotal != null ? ` · Rs. ${q.subtotal.toFixed(2)}` : ""}
                      </div>
                    </div>

                    <DismissButton onClick={() => dismiss([approvalKey(q.id)])} />
                  </div>
                ))
              )}
            </>
          )}

          <div
            style={{
              padding: "12px 16px",
              fontWeight: 700,
              fontSize: "13.5px",
              borderTop: "1px solid rgba(11,11,11,0.08)",
              borderBottom: "1px solid rgba(11,11,11,0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            Follow-ups &amp; overdue leads
            {visibleAlerts.length > 0 && (
              <button
                type="button"
                onClick={() => dismiss(visibleAlerts.map((a) => followupKey(a.id)))}
                style={{
                  background: "none",
                  border: "none",
                  color: "#5c1030",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Clear all
              </button>
            )}
          </div>

          {visibleAlerts.length === 0 ? (
            <div style={{ padding: "20px 16px", color: "#898781", fontSize: "13px" }}>
              Nothing needs attention right now.
            </div>
          ) : (
            visibleAlerts.map((alert) => (
              <div
                key={alert.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setOpen(false);
                  onOpenCRM?.();
                }}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "8px",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid rgba(92,16,48,0.08)",
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: "13.5px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {alert.companyName}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        letterSpacing: "0.4px",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        flexShrink: 0,
                        background: SEVERITY_BADGE[alert.severity].background,
                        color: SEVERITY_BADGE[alert.severity].color,
                      }}
                    >
                      {alert.severity === "overdue" ? "OVERDUE" : "DUE"}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#52514e" }}>
                    {alert.productName} · {alert.status} · open {alert.daysOpen}d
                  </div>
                </div>

                <DismissButton onClick={() => dismiss([followupKey(alert.id)])} />
              </div>
            ))
          )}

          <div
            style={{
              padding: "12px 16px",
              fontWeight: 700,
              fontSize: "13.5px",
              borderTop: "1px solid rgba(11,11,11,0.08)",
              borderBottom: "1px solid rgba(11,11,11,0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            Recent activity
            {visibleActivity.length > 0 && (
              <button
                type="button"
                onClick={() => dismiss(visibleActivity.map((entry) => activityKey(entry.id)))}
                style={{
                  background: "none",
                  border: "none",
                  color: "#5c1030",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Clear all
              </button>
            )}
          </div>

          {visibleActivity.length === 0 ? (
            <div style={{ padding: "20px 16px", color: "#898781", fontSize: "13px" }}>
              Nothing to show yet.
            </div>
          ) : (
            visibleActivity.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "8px",
                  padding: "10px 16px",
                  borderBottom: "1px solid rgba(92,16,48,0.08)",
                  fontSize: "12.5px",
                  color: "#0b0b0b",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  {entry.message}
                  <div style={{ fontSize: "11px", color: "#898781", marginTop: 2 }}>
                    {timeAgo(entry.created_at)}
                  </div>
                </div>

                <DismissButton onClick={() => dismiss([activityKey(entry.id)])} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
