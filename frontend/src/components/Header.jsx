import NotificationBell from "./NotificationBell";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/permissions";

function Header({ onOpenCRM, onOpenSession, onOpenQuotation }) {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar navbar-dark bg-primary shadow-sm">
      <div className="container-fluid">
        <span className="navbar-brand mb-0 h1">
          🤖 Aadrik AI
        </span>

        <div className="d-flex align-items-center gap-3">
          <span className="text-white d-none d-md-inline">
            Industrial Sales Assistant
          </span>

          {canAccess(user?.role, "dashboard") && (
            <NotificationBell
              onOpenCRM={onOpenCRM}
              onOpenSession={onOpenSession}
              onOpenQuotation={onOpenQuotation}
            />
          )}

          {user?.name && (
            <span className="text-white d-none d-md-inline">
              {user.name}
            </span>
          )}

          <button
            type="button"
            className="btn btn-outline-light btn-sm"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Header;