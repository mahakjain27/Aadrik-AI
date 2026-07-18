import { useEffect, useState } from "react";
import { Form, Button, Alert, Badge, Spinner } from "react-bootstrap";
import {
  FaUser,
  FaEnvelope,
  FaShieldAlt,
  FaClock,
  FaSync,
  FaDatabase,
  FaRobot,
  FaWhatsapp,
  FaBook,
  FaServer,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
} from "react-icons/fa";

import {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  getSystemHealth,
} from "../services/api";
import { useAuth } from "../context/AuthContext";

const ROLE_LABEL = {
  admin: "Administrator",
  sales: "Sales",
  manager: "Manager",
  viewer: "Viewer",
};

function errorMessage(err, fallback) {
  return err.response?.data?.message || fallback;
}

function MyAccountTab() {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [lastLogin, setLastLogin] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    getMyProfile()
      .then((data) => {
        setName(data.name);
        setEmail(data.email);
        setLastLogin(data.last_login_at);
      })
      .catch(() => {});
  }, []);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);
    setSavingProfile(true);

    try {
      const updated = await updateMyProfile(name, email);
      updateUser({ name: updated.name, email: updated.email });
      setProfileSuccess(true);
    } catch (err) {
      setProfileError(errorMessage(err, "Could not update profile."));
    }

    setSavingProfile(false);
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setSavingPassword(true);

    try {
      await changeMyPassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(errorMessage(err, "Could not update password."));
    }

    setSavingPassword(false);
  }

  return (
    <>
      <div className="settings-card">
        <h5 className="settings-card-title">Profile</h5>

        <Form onSubmit={handleSaveProfile}>
          <Form.Group className="mb-3">
            <Form.Label>
              <FaUser className="me-2" />
              Name
            </Form.Label>
            <Form.Control
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>
              <FaEnvelope className="me-2" />
              Email
            </Form.Label>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Form.Group>

          <div className="settings-readonly-row">
            <div>
              <div className="settings-readonly-label">
                <FaShieldAlt className="me-2" />
                Role
              </div>
              <Badge bg="dark">{ROLE_LABEL[user?.role] || user?.role}</Badge>
            </div>

            <div>
              <div className="settings-readonly-label">
                <FaClock className="me-2" />
                Last Login
              </div>
              <div className="settings-readonly-value">
                {lastLogin
                  ? new Date(lastLogin).toLocaleString()
                  : "This is your first login"}
              </div>
            </div>
          </div>

          {profileError && (
            <Alert variant="danger" className="mt-3 mb-0">
              {profileError}
            </Alert>
          )}
          {profileSuccess && (
            <Alert variant="success" className="mt-3 mb-0">
              Profile updated.
            </Alert>
          )}

          <Button type="submit" className="mt-3" disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save"}
          </Button>
        </Form>
      </div>

      <div className="settings-card">
        <h5 className="settings-card-title">Change Password</h5>

        <Form onSubmit={handleChangePassword}>
          <Form.Group className="mb-3">
            <Form.Label>Current Password</Form.Label>
            <Form.Control
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>New Password</Form.Label>
            <Form.Control
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Confirm New Password</Form.Label>
            <Form.Control
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />
          </Form.Group>

          {passwordError && (
            <Alert variant="danger" className="mb-0">
              {passwordError}
            </Alert>
          )}
          {passwordSuccess && (
            <Alert variant="success" className="mb-0">
              Password updated.
            </Alert>
          )}

          <Button type="submit" className="mt-3" disabled={savingPassword}>
            {savingPassword ? "Updating..." : "Update Password"}
          </Button>
        </Form>
      </div>
    </>
  );
}

const HEALTH_META = {
  connected: { Icon: FaCheckCircle, color: "#1a9c5f", label: "Connected" },
  running: { Icon: FaCheckCircle, color: "#1a9c5f", label: "Running" },
  ready: { Icon: FaCheckCircle, color: "#1a9c5f", label: "Ready" },
  not_configured: {
    Icon: FaExclamationTriangle,
    color: "#c98a1b",
    label: "Not Configured",
  },
  unreachable: { Icon: FaTimesCircle, color: "#c0392b", label: "Unreachable" },
  error: { Icon: FaTimesCircle, color: "#c0392b", label: "Error" },
};

function HealthRow({ Icon, label, status, detail }) {
  const meta = HEALTH_META[status] || HEALTH_META.error;
  const StatusIcon = meta.Icon;

  return (
    <div className="settings-health-row">
      <div className="settings-health-name">
        <Icon className="settings-health-icon" />
        {label}
      </div>

      <div className="settings-health-status" style={{ color: meta.color }}>
        <StatusIcon />
        {meta.label}
        {detail && <span className="settings-health-detail">{detail}</span>}
      </div>
    </div>
  );
}

function AboutTab() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    setError(null);

    getSystemHealth()
      .then(setHealth)
      .catch((err) => setError(errorMessage(err, "Could not load system status.")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="settings-card">
      <div className="settings-about-header">
        <div>
          <h5 className="settings-card-title mb-1">Aadrik AI Employee</h5>
          <div className="settings-about-version">
            Version {health?.version || "—"}
          </div>
        </div>

        <Button
          size="sm"
          variant="outline-secondary"
          onClick={load}
          disabled={loading}
        >
          <FaSync className={loading ? "settings-spin" : ""} /> Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="mt-3 mb-0">
          {error}
        </Alert>
      )}

      {loading && !health ? (
        <div className="text-center py-4">
          <Spinner animation="border" size="sm" />
        </div>
      ) : health ? (
        <div className="settings-health-list">
          <HealthRow Icon={FaServer} label="Backend" status="connected" />

          <HealthRow
            Icon={FaDatabase}
            label="Database"
            status={health.database.status}
            detail={
              health.database.response_ms != null
                ? `${health.database.response_ms} ms`
                : null
            }
          />

          <HealthRow
            Icon={FaRobot}
            label="AI Engine"
            status={health.ai.status}
            detail={
              health.ai.response_ms != null
                ? `${health.ai.response_ms} ms`
                : null
            }
          />

          <HealthRow
            Icon={FaWhatsapp}
            label="WhatsApp"
            status={health.whatsapp.status}
          />

          <HealthRow
            Icon={FaBook}
            label="Knowledge Base"
            status={health.knowledge_base.status}
            detail={
              health.knowledge_base.documents != null
                ? `${health.knowledge_base.documents} documents`
                : null
            }
          />
        </div>
      ) : null}
    </div>
  );
}

const TABS = [
  { key: "account", label: "My Account" },
  { key: "about", label: "About" },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("account");

  return (
    <div className="container mt-4" style={{ paddingBottom: "32px" }}>
      <h2 className="mb-4" style={{ fontWeight: 700, color: "#0b0b0b" }}>
        Settings
      </h2>

      <div className="settings-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`settings-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "account" ? <MyAccountTab /> : <AboutTab />}
    </div>
  );
}
