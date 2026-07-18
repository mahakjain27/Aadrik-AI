import { useEffect, useState } from "react";
import { Table, Modal, Button, Form, Alert, Badge, Dropdown } from "react-bootstrap";
import { FaEllipsisV, FaEdit, FaKey, FaLock, FaLockOpen } from "react-icons/fa";

import {
  getUsers,
  createUser,
  updateUser,
  setUserStatus,
  resetUserPassword,
} from "../services/api";
import { useAuth } from "../context/AuthContext";

const ROLES = ["admin", "sales", "manager", "viewer"];

const ROLE_BADGE = {
  admin: "dark",
  sales: "success",
  manager: "info",
  viewer: "secondary",
};

function errorMessage(err, fallback) {
  return err.response?.data?.message || fallback;
}

function CreateUserModal({ show, onClose, onCreated }) {
  const emptyForm = { name: "", email: "", password: "", role: "sales" };
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!show) {
      setForm(emptyForm);
      setError(null);
      setSubmitting(false);
    }
  }, [show]);

  async function handleSubmit() {
    if (!form.name || !form.email || !form.password) {
      setError("Please fill in all fields.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createUser(form);
      onCreated();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not create user."));
    }

    setSubmitting(false);
  }

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Add User</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        <Form.Group className="mb-3">
          <Form.Label>Name</Form.Label>
          <Form.Control
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Email</Form.Label>
          <Form.Control
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Role</Form.Label>
          <Form.Select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={submitting} onClick={handleSubmit}>
          {submitting ? "Creating..." : "Create User"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onUpdated }) {
  const [form, setForm] = useState({ name: "", role: "sales" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ name: user.name, role: user.role });
      setError(null);
      setSubmitting(false);
    }
  }, [user]);

  if (!user) return null;

  async function handleSubmit() {
    if (!form.name) {
      setError("Name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await updateUser(user.id, form);
      onUpdated();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not update user."));
    }

    setSubmitting(false);
  }

  return (
    <Modal show={!!user} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Edit User</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        <Form.Group className="mb-3">
          <Form.Label>Name</Form.Label>
          <Form.Control
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Role</Form.Label>
          <Form.Select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={submitting} onClick={handleSubmit}>
          {submitting ? "Saving..." : "Save Changes"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setPassword("");
      setConfirm("");
      setError(null);
      setSuccess(false);
      setSubmitting(false);
    }
  }, [user]);

  if (!user) return null;

  async function handleSubmit() {
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await resetUserPassword(user.id, password);
      setSuccess(true);
    } catch (err) {
      setError(errorMessage(err, "Could not reset password."));
    }

    setSubmitting(false);
  }

  return (
    <Modal show={!!user} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Reset Password — {user.name}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">Password reset successfully.</Alert>}

        {!success && (
          <>
            <Form.Group className="mb-3">
              <Form.Label>New Password</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Confirm Password</Form.Label>
              <Form.Control
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Form.Group>
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {success ? "Close" : "Cancel"}
        </Button>
        {!success && (
          <Button variant="primary" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Resetting..." : "Reset Password"}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resettingUser, setResettingUser] = useState(null);

  async function loadUsers() {
    setLoading(true);

    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      setError(errorMessage(err, "Could not load users."));
    }

    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function toggleStatus(u) {
    try {
      await setUserStatus(u.id, !u.is_active);
      loadUsers();
    } catch (err) {
      alert(errorMessage(err, "Could not update status."));
    }
  }

  return (
    <div className="container mt-4" style={{ paddingBottom: "32px" }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 style={{ fontWeight: 700, color: "#0b0b0b" }}>User Management</h2>

        <Button variant="primary" onClick={() => setShowCreate(true)}>
          + Add User
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

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
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-4">
                  No users yet.
                </td>
              </tr>
            )}

            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                  {u.id === currentUser?.id && (
                    <span className="text-muted"> (you)</span>
                  )}
                </td>
                <td>{u.email}</td>
                <td>
                  <Badge bg={ROLE_BADGE[u.role] || "secondary"}>
                    {u.role}
                  </Badge>
                </td>
                <td>
                  <Badge bg={u.is_active ? "success" : "secondary"}>
                    {u.is_active ? "Active" : "Disabled"}
                  </Badge>
                </td>
                <td>
                  <Dropdown>
                    <Dropdown.Toggle variant="light" size="sm" className="border">
                      <FaEllipsisV />
                    </Dropdown.Toggle>

                    <Dropdown.Menu>
                      <Dropdown.Item onClick={() => setEditingUser(u)}>
                        <FaEdit className="me-2 text-primary" />
                        Edit
                      </Dropdown.Item>

                      <Dropdown.Item onClick={() => setResettingUser(u)}>
                        <FaKey className="me-2 text-warning" />
                        Reset Password
                      </Dropdown.Item>

                      <Dropdown.Divider />

                      <Dropdown.Item
                        disabled={u.id === currentUser?.id}
                        onClick={() => toggleStatus(u)}
                        className={u.is_active ? "text-danger" : "text-success"}
                      >
                        {u.is_active ? (
                          <>
                            <FaLock className="me-2" />
                            Disable
                          </>
                        ) : (
                          <>
                            <FaLockOpen className="me-2" />
                            Enable
                          </>
                        )}
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <CreateUserModal
        show={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadUsers}
      />

      <EditUserModal
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onUpdated={loadUsers}
      />

      <ResetPasswordModal
        user={resettingUser}
        onClose={() => setResettingUser(null)}
      />
    </div>
  );
}
