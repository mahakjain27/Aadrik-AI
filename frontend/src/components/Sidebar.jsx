import { canAccess } from "../utils/permissions";

const MODULES = [
  { key: "dashboard", label: "Dashboard", icon: "📊", onClickKey: "onOpenCRM" },
  { key: "analytics", label: "Analytics", icon: "📈", onClickKey: "onOpenAnalytics" },
  { key: "customers", label: "Customers", icon: "👥", onClickKey: "onOpenCustomers" },
  { key: "inbox", label: "Sales Inbox", icon: "💬", onClickKey: "onOpenInbox" },
];

function Sidebar({
  onOpenProducts,
  role,

  activePage,
  onOpenCRM,
  onOpenAnalytics,
  onOpenCustomers,
  onOpenInbox,
  onOpenPolicies,
  onOpenCompany,
  onOpenSettings,
  onOpenUsers,
  onOpenActivity,
  onOpenProductAdmin,
  onOpenKnowledgeAdmin,
}) {
  const handlers = {
    onOpenCRM,
    onOpenAnalytics,
    onOpenCustomers,
    onOpenInbox,
  };
  const visibleModules = MODULES.filter((mod) => canAccess(role, mod.key));
  const canProducts = canAccess(role, "products");
  const canPolicies = canAccess(role, "policies");
  const canCompany = canAccess(role, "company");
  const canSettings = canAccess(role, "settings");
  const canUsers = canAccess(role, "users");
  const canActivity = canAccess(role, "activity");
  const canManageProducts = canAccess(role, "product_admin");
  const canManageKnowledge = canAccess(role, "knowledge_admin");
  const showKnowledgeBase = canProducts || canPolicies || canCompany;

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

      <div className="text-muted small fw-bold mb-1">Modules</div>

      <div className="list-group mb-3">
        {visibleModules.map((mod) => (
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

      {showKnowledgeBase && (
        <>
          <div className="text-muted small fw-bold mb-1">📚 Knowledge Base</div>

          <div className="list-group mb-3">
            {canProducts && (
              <button
                className="list-group-item list-group-item-action"
                onClick={onOpenProducts}
              >
                📦 Products
              </button>
            )}

            {canPolicies && (
              <button
                className={`list-group-item list-group-item-action ${
                  activePage === "policies" ? "active" : ""
                }`}
                onClick={onOpenPolicies}
              >
                📄 Policies
              </button>
            )}

            {canCompany && (
              <button
                className={`list-group-item list-group-item-action ${
                  activePage === "company" ? "active" : ""
                }`}
                onClick={onOpenCompany}
              >
                🏢 Company
              </button>
            )}
          </div>
        </>
      )}

      {(canSettings || canUsers || canActivity || canManageProducts || canManageKnowledge) && (
        <div className="list-group">
          {canManageProducts && (
            <button
              className={`list-group-item list-group-item-action ${
                activePage === "product_admin" ? "active" : ""
              }`}
              onClick={onOpenProductAdmin}
            >
              🛠 Manage Products
            </button>
          )}

          {canManageKnowledge && (
            <button
              className={`list-group-item list-group-item-action ${
                activePage === "knowledge_admin" ? "active" : ""
              }`}
              onClick={onOpenKnowledgeAdmin}
            >
              🧠 Knowledge Base Manager
            </button>
          )}

          {canSettings && (
            <button
              className={`list-group-item list-group-item-action ${
                activePage === "settings" ? "active" : ""
              }`}
              onClick={onOpenSettings}
            >
              ⚙ Settings
            </button>
          )}

          {canUsers && (
            <button
              className={`list-group-item list-group-item-action ${
                activePage === "users" ? "active" : ""
              }`}
              onClick={onOpenUsers}
            >
              👤 User Management
            </button>
          )}

          {canActivity && (
            <button
              className={`list-group-item list-group-item-action ${
                activePage === "activity" ? "active" : ""
              }`}
              onClick={onOpenActivity}
            >
              📜 Activity Log
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default Sidebar;
