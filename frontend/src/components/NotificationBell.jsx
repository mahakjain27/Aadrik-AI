import { useEffect, useRef, useState } from "react";
import { getLeads } from "../services/api";
import { getFollowUpAlerts } from "../utils/followUps";

const POLL_INTERVAL_MS = 120000;

const SEVERITY_COLOR = {
  overdue: "#d03b3b",
  due: "#eda100",
};

const SEVERITY_BADGE = {
  due: { background: "#f6e3e7", color: "#6b2436" },
  overdue: { background: "#5c1030", color: "#ffffff" },
};

export default function NotificationBell({ onOpenCRM }) {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const leads = await getLeads();
        if (!cancelled) setAlerts(getFollowUpAlerts(leads));
      } catch {
        // Leave the bell at its last known state if the fetch fails.
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const overdueCount = alerts.filter((a) => a.severity === "overdue").length;
  const count = alerts.length;
  const badgeColor = overdueCount > 0 ? SEVERITY_COLOR.overdue : SEVERITY_COLOR.due;

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
            }}
          >
            Follow-ups &amp; overdue leads
          </div>

          {alerts.length === 0 ? (
            <div style={{ padding: "20px 16px", color: "#898781", fontSize: "13px" }}>
              Nothing needs attention right now.
            </div>
          ) : (
            alerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenCRM?.();
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid rgba(92,16,48,0.08)",
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
              >
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
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
