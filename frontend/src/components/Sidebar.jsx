import { groupSessions } from "../utils/groupSessions";

const GROUP_LABELS = {
  Today: "Today's Chats",
  Yesterday: "Yesterday",
  Older: "Older",
};

const MODULES = [
  { key: "chat", label: "AI Chat", icon: "🤖", onClickKey: "onOpenChat" },
  { key: "dashboard", label: "Dashboard", icon: "📊", onClickKey: "onOpenCRM" },
  { key: "analytics", label: "Analytics", icon: "📈", onClickKey: "onOpenAnalytics" },
  { key: "customers", label: "Customers", icon: "👥", onClickKey: "onOpenCustomers" },
];

function Sidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onOpenProducts,
  loading,

  activePage,
  onOpenCRM,
  onOpenAnalytics,
  onOpenCustomers,
  onOpenChat,
  onOpenPolicies,
  onOpenCompany,
  onOpenSettings,
}) {
  const grouped = groupSessions(sessions);
  const handlers = {
    onOpenChat,
    onOpenCRM,
    onOpenAnalytics,
    onOpenCustomers,
  };

  return (
    <div
      className="app-sidebar p-3"
      style={{
        width: "220px",
        minWidth: "220px",
        minHeight: "100vh",
        overflowY: "auto",
      }}
    >
      <h5 className="mb-4">Menu</h5>

      <button
        className="btn btn-primary w-100 mb-3"
        onClick={onNewChat}
        disabled={loading}
      >
        💬 New Chat
      </button>

      {activePage === "chat" &&
        ["Today", "Yesterday", "Older"].map((group) =>
          grouped[group].length === 0 ? null : (
            <div key={group} className="mb-3">
              <div className="text-muted small fw-bold mb-1">
                {GROUP_LABELS[group]}
              </div>

              <div className="list-group">
                {grouped[group].map((session) => (
                  <button
                    key={session.id}
                    className={`list-group-item list-group-item-action text-truncate ${
                      session.id === activeSessionId ? "active" : ""
                    }`}
                    onClick={() => onSelectSession(session.id)}
                  >
                    📄 {session.title}
                  </button>
                ))}
              </div>
            </div>
          )
        )}

      <div className="text-muted small fw-bold mb-1">Modules</div>

      <div className="list-group mb-3">
        {MODULES.map((mod) => (
          <button
            key={mod.key}
            className={`list-group-item list-group-item-action ${
              activePage === mod.key ? "active" : ""
            }`}
            onClick={handlers[mod.onClickKey]}
          >
            {mod.icon} {mod.label}
          </button>
        ))}
      </div>

      <div className="text-muted small fw-bold mb-1">📚 Knowledge Base</div>

      <div className="list-group mb-3">
        <button
          className="list-group-item list-group-item-action"
          onClick={onOpenProducts}
        >
          📦 Products
        </button>

        <button
          className={`list-group-item list-group-item-action ${
            activePage === "policies" ? "active" : ""
          }`}
          onClick={onOpenPolicies}
        >
          📄 Policies
        </button>

        <button
          className={`list-group-item list-group-item-action ${
            activePage === "company" ? "active" : ""
          }`}
          onClick={onOpenCompany}
        >
          🏢 Company
        </button>
      </div>

      <div className="list-group">
        <button
          className={`list-group-item list-group-item-action ${
            activePage === "settings" ? "active" : ""
          }`}
          onClick={onOpenSettings}
        >
          ⚙ Settings
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
