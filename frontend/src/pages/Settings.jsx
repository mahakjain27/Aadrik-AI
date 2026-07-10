export default function Settings() {
  return (
    <div className="container mt-4">
      <h2 className="mb-4" style={{ fontWeight: 700, color: "#0b0b0b" }}>
        Settings
      </h2>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid rgba(11,11,11,0.08)",
          borderRadius: "16px",
          padding: "48px 24px",
          textAlign: "center",
          color: "#898781",
        }}
      >
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>⚙</div>
        <div style={{ fontWeight: 600, color: "#52514e" }}>
          Settings are coming soon
        </div>
        <div style={{ fontSize: "13px", marginTop: "4px" }}>
          Account, notification, and integration preferences will live here.
        </div>
      </div>
    </div>
  );
}
