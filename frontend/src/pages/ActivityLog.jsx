import { useEffect, useState } from "react";
import { Table, Spinner, Badge, Dropdown } from "react-bootstrap";
import { clearActivityLog, getActivityLog } from "../services/api";
import { useAuth } from "../context/AuthContext";

const ACTION_BADGE = {
  "lead.created": "primary",
  "lead.status_changed": "info",
  "lead.assigned": "secondary",
  "user.created": "success",
  "user.updated": "secondary",
  "user.role_changed": "warning",
  "user.enabled": "success",
  "user.disabled": "danger",
  "user.password_reset": "warning",
};

export default function ActivityLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const { user } = useAuth();

  const loadEntries = () => getActivityLog(100).then(setEntries);

  useEffect(() => {
    loadEntries().finally(() => setLoading(false));
  }, []);

  const handleClear = async (olderThanDays) => {
    const label =
      olderThanDays == null ? "all activity log entries" : `entries older than ${olderThanDays} days`;

    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) {
      return;
    }

    setClearing(true);

    try {
      await clearActivityLog(olderThanDays);
      await loadEntries();
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <div className="container mt-4" style={{ paddingBottom: "32px" }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0" style={{ fontWeight: 700, color: "#0b0b0b" }}>
          Activity Log
        </h2>

        {user?.role === "admin" && (
          <Dropdown>
            <Dropdown.Toggle
              variant="outline-danger"
              size="sm"
              disabled={clearing}
            >
              Delete Old Logs
            </Dropdown.Toggle>

            <Dropdown.Menu align="end">
              <Dropdown.Item onClick={() => handleClear(30)}>
                Older than 30 days
              </Dropdown.Item>
              <Dropdown.Item onClick={() => handleClear(90)}>
                Older than 90 days
              </Dropdown.Item>
              <Dropdown.Item className="text-danger" onClick={() => handleClear(null)}>
                Delete All
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        )}
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid rgba(11,11,11,0.08)",
          borderRadius: "16px",
          boxShadow: "var(--shadow-card)",
          overflow: "hidden",
        }}
      >
        <Table hover responsive className="mb-0">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>

          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center text-muted py-4">
                  No activity yet.
                </td>
              </tr>
            )}

            {entries.map((entry) => (
              <tr key={entry.id}>
                <td style={{ whiteSpace: "nowrap", minWidth: 170 }}>
                  {new Date(entry.created_at).toLocaleString()}
                </td>
                <td>
                  <Badge bg={ACTION_BADGE[entry.action] || "secondary"}>
                    {entry.action}
                  </Badge>
                </td>
                <td>{entry.message}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
