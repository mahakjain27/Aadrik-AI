import NotificationBell from "./NotificationBell";

function Header({ onOpenCRM }) {
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

          <NotificationBell onOpenCRM={onOpenCRM} />
        </div>
      </div>
    </nav>
  );
}

export default Header;