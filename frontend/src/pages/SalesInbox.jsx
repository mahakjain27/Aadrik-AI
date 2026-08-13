import { useEffect, useRef, useState } from "react";
import { Spinner, Badge } from "react-bootstrap";
import {
  getInboxSessions,
  getArchivedSessions,
  getSessionMessages,
  sendSalesReply,
  closeSession,
  reopenSession,
  archiveSession,
  unarchiveSession,
  deleteSession,
  deleteClosedSessions,
  getSessionAIAssist,
  sendSalesAttachment,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { timeAgo } from "../utils/timeAgo";
import WhatsAppMessageModal from "../components/WhatsAppMessageModal";

const ARCHIVED_STATUS = "__archived__";

const FILTERS = [
  {
    status: "Waiting for Sales",
    label: "Waiting",
    empty: "🎉 No conversations waiting. You're all caught up!",
  },
  {
    status: "AI Handling",
    label: "AI Handling",
    empty: "🤖 No conversations currently being handled by AI.",
  },
  {
    status: "Open",
    label: "Open",
    empty: "📭 No open conversations right now.",
  },
  {
    status: "Closed",
    label: "Closed",
    empty: "🗂️ No closed conversations yet.",
  },
  {
    status: ARCHIVED_STATUS,
    label: "Archived",
    empty: "📦 No archived conversations.",
  },
];

const ROLE_STYLE = {
  user: {
    align: "start",
    bg: "#ffffff",
    color: "#0b0b0b",
    border: "1px solid rgba(11,11,11,0.08)",
    label: "Customer",
    labelColor: "#52514e",
  },
  assistant: {
    align: "end",
    bg: "#ede7f6",
    color: "#3d2467",
    border: "1px solid rgba(111,66,193,0.15)",
    label: "AI",
    labelColor: "#6f42c1",
  },
  sales: {
    align: "end",
    bg: "#e6f4ea",
    color: "#0f5132",
    border: "1px solid rgba(25,135,84,0.18)",
    label: "Sales",
    labelColor: "#198754",
  },
};

const STATUS_META = {
  "Waiting for Sales": { bg: "warning", text: "dark", icon: "🟡" },
  "AI Handling": { bg: "info", text: "dark", icon: "🤖" },
  Open: { bg: "success", text: undefined, icon: "🟢" },
  Closed: { bg: "secondary", text: undefined, icon: "⚫" },
};

function StatusPill({ status, size }) {
  const meta = STATUS_META[status] || { bg: "secondary", icon: "" };

  return (
    <Badge
      bg={meta.bg}
      text={meta.text}
      style={{
        flexShrink: 0,
        fontSize: size === "sm" ? "11px" : undefined,
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        borderRadius: "999px",
      }}
    >
      <span>{meta.icon}</span>
      {status}
    </Badge>
  );
}

function formatTime(iso) {
  if (!iso) return "";

  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function MessageRow({ role, content, createdAt }) {
  const style = ROLE_STYLE[role] || ROLE_STYLE.user;
  const isEnd = style.align === "end";

  return (
    <div
      className={`d-flex flex-column mb-3 ${
        isEnd ? "align-items-end" : "align-items-start"
      }`}
    >
      <div
        className="small fw-semibold mb-1 px-1"
        style={{ color: style.labelColor }}
      >
        {style.label}
      </div>

      <div
        className="px-3 py-2 rounded-3"
        style={{
          maxWidth: "70%",
          whiteSpace: "pre-wrap",
          background: style.bg,
          color: style.color,
          border: style.border,
        }}
      >
        <div>{content}</div>

        {createdAt && (
          <div
            className="text-end mt-1"
            style={{ color: "rgba(11,11,11,0.45)", fontSize: "11px" }}
          >
            {formatTime(createdAt)}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerField({ label, value }) {
  return (
    <div className="mb-3">
      <div
        className="text-muted text-uppercase"
        style={{ fontSize: "11px", letterSpacing: "0.4px", fontWeight: 600 }}
      >
        {label}
      </div>
      <div className="mt-1">{value}</div>
    </div>
  );
}

export default function SalesInbox({ pendingSessionId, onConsumePending }) {
  const { user } = useAuth();

  const [statusFilter, setStatusFilter] = useState("Waiting for Sales");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  const [selectedId, setSelectedId] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [loadingConversation, setLoadingConversation] = useState(false);

  const [reply, setReply] = useState("");
  const [replyAttachment, setReplyAttachment] = useState(null);
  const [sending, setSending] = useState(false);
  const [aiAssist, setAiAssist] = useState(null);
  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const [aiAssistError, setAiAssistError] = useState("");
  const replyRef = useRef(null);
  const replyFileInputRef = useRef(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deletingClosed, setDeletingClosed] = useState(false);

  const isAdmin = user?.role === "admin";

  const [liveConnected, setLiveConnected] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);

  const bottomRef = useRef(null);

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const refreshSessionsRef = useRef();
  const loadConversationRef = useRef();

  function refreshSessions() {
    if (statusFilter === ARCHIVED_STATUS) {
      return getArchivedSessions().then(setSessions);
    }

    return getInboxSessions(statusFilter, search).then(setSessions);
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setLoadingSessions(true);

    const request =
      statusFilter === ARCHIVED_STATUS
        ? getArchivedSessions()
        : getInboxSessions(statusFilter, search);

    request.then(setSessions).finally(() => setLoadingSessions(false));
  }, [statusFilter, search]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  function loadConversation(id, { syncFilter = false } = {}) {
    if (id !== selectedId) {
      setAiAssist(null);
      setAiAssistError("");
    }

    setSelectedId(id);
    setLoadingConversation(true);

    return getSessionMessages(id)
      .then((data) => {
        setConversation(data);

        if (syncFilter && FILTERS.some((f) => f.status === data.status)) {
          setSearchInput("");
          setSearch("");
          setStatusFilter(data.status);
        }

        refreshSessions();
      })
      .finally(() => setLoadingConversation(false));
  }

  refreshSessionsRef.current = refreshSessions;
  loadConversationRef.current = loadConversation;

  useEffect(() => {
    if (!pendingSessionId) return;

    loadConversation(pendingSessionId, { syncFilter: true }).finally(() =>
      onConsumePending?.()
    );
  }, [pendingSessionId]);

  useEffect(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) return;

    const wsBase = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(
      /^http/,
      "ws"
    );

    let socket;
    let reconnectTimer;
    let stopped = false;

    function connect() {
      socket = new WebSocket(`${wsBase}/ws/inbox?token=${encodeURIComponent(token)}`);

      socket.onopen = () => setLiveConnected(true);

      socket.onmessage = (event) => {
        let data;

        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if (data.type === "sessions_changed") {
          refreshSessionsRef.current?.();

          if (selectedIdRef.current) {
            loadConversationRef.current?.(selectedIdRef.current);
          }
        }
      };

      socket.onclose = () => {
        setLiveConnected(false);
        if (!stopped) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  async function handleSend() {
    if ((!reply.trim() && !replyAttachment) || !selectedId) return;

    setSending(true);

    try {
      if (replyAttachment) {
        await sendSalesAttachment(selectedId, replyAttachment, reply.trim() || undefined);
      } else {
        await sendSalesReply(selectedId, reply);
      }
      setReply("");
      setReplyAttachment(null);
      if (replyFileInputRef.current) replyFileInputRef.current.value = "";
    } catch (err) {
      window.alert(err.response?.data?.message || "Could not send reply.");
    } finally {
      await Promise.all([
        loadConversation(selectedId),
        refreshSessions(),
      ]);
      setSending(false);
    }
  }

  async function handleAIAssist() {
    if (!selectedId) return;

    setAiAssistLoading(true);
    setAiAssistError("");

    try {
      const result = await getSessionAIAssist(selectedId);
      setAiAssist(result);
    } catch (err) {
      setAiAssistError(
        err.response?.data?.detail || "Couldn't generate AI assist for this conversation."
      );
    } finally {
      setAiAssistLoading(false);
    }
  }

  function useSuggestedReply() {
    if (!aiAssist) return;

    setReply(aiAssist.suggested_reply);
    replyRef.current?.focus();
  }

  async function handleToggleStatus() {
    if (!selectedId || !conversation) return;

    setUpdatingStatus(true);

    try {
      if (conversation.status === "Closed") {
        await reopenSession(selectedId);
      } else {
        await closeSession(selectedId);
      }

      await Promise.all([
        loadConversation(selectedId),
        refreshSessions(),
      ]);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleToggleArchive() {
    if (!selectedId || !conversation) return;

    setArchiving(true);

    try {
      if (conversation.is_archived) {
        await unarchiveSession(selectedId);
      } else {
        await archiveSession(selectedId);
      }

      setSelectedId(null);
      setConversation(null);
      await refreshSessions();
    } finally {
      setArchiving(false);
    }
  }

  async function handleDeleteSession() {
    if (!selectedId) return;

    if (!window.confirm("Permanently delete this conversation? This cannot be undone.")) {
      return;
    }

    await deleteSession(selectedId);
    setSelectedId(null);
    setConversation(null);
    await refreshSessions();
  }

  async function handleConversationStarted(sessionId) {
    setShowNewConversation(false);
    setSearchInput("");
    setSearch("");
    setStatusFilter("Open");
    await loadConversation(sessionId, { syncFilter: true });
  }

  async function handleDeleteAllClosed() {
    if (
      !window.confirm(
        "Permanently delete every closed conversation? This cannot be undone."
      )
    ) {
      return;
    }

    setDeletingClosed(true);

    try {
      await deleteClosedSessions();

      if (conversation?.status === "Closed") {
        setSelectedId(null);
        setConversation(null);
      }

      await refreshSessions();
    } finally {
      setDeletingClosed(false);
    }
  }

  return (
    <div className="container-fluid mt-4" style={{ paddingBottom: "32px" }}>
      <h2 className="mb-4 d-flex align-items-center gap-2" style={{ fontWeight: 700, color: "#0b0b0b" }}>
        Sales Inbox
        <span
          title={liveConnected ? "Live updates connected" : "Reconnecting..."}
          className="d-inline-flex align-items-center gap-1"
          style={{ fontSize: "12px", fontWeight: 600, color: "#898781" }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: liveConnected ? "#198754" : "#c0392b",
              display: "inline-block",
            }}
          />
          {liveConnected ? "Live" : "Reconnecting"}
        </span>
      </h2>

      <div className="d-flex gap-3" style={{ height: "calc(100vh - 200px)" }}>
        <div
          className="d-flex flex-column"
          style={{
            width: "320px",
            minWidth: "320px",
            background: "#ffffff",
            border: "1px solid rgba(11,11,11,0.08)",
            borderRadius: "16px",
            boxShadow: "var(--shadow-card)",
            overflow: "hidden",
          }}
        >
          <div
            className="p-2"
            style={{ borderBottom: "1px solid rgba(11,11,11,0.08)" }}
          >
            <button
              type="button"
              className="btn btn-sm btn-primary w-100 mb-2"
              onClick={() => setShowNewConversation(true)}
            >
              + New Conversation
            </button>

            <input
              type="search"
              className="form-control form-control-sm mb-2"
              placeholder="Search by phone or title..."
              value={searchInput}
              disabled={statusFilter === ARCHIVED_STATUS}
              onChange={(e) => setSearchInput(e.target.value)}
            />

            <div className="d-flex gap-1">
              {FILTERS.map((filter) => (
                <button
                  key={filter.status}
                  onClick={() => setStatusFilter(filter.status)}
                  disabled={!!search}
                  className={`btn btn-sm flex-grow-1 ${
                    statusFilter === filter.status ? "btn-primary" : "btn-outline-secondary"
                  }`}
                  style={{
                    fontSize: "11px",
                    padding: "5px 4px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {search && (
              <div className="text-muted small mt-1">
                Searching all conversations for &quot;{search}&quot;
              </div>
            )}

            {isAdmin && statusFilter === "Closed" && !search && sessions.length > 0 && (
              <button
                className="btn btn-sm btn-outline-danger w-100 mt-2"
                onClick={handleDeleteAllClosed}
                disabled={deletingClosed}
              >
                {deletingClosed ? "Deleting..." : "Delete All Closed Sessions"}
              </button>
            )}
          </div>

          <div style={{ overflowY: "auto", flexGrow: 1 }}>
            {loadingSessions ? (
              <div className="text-center py-5">
                <Spinner animation="border" size="sm" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center text-muted py-5 px-3">
                {search
                  ? `🔍 No conversations match "${search}".`
                  : FILTERS.find((f) => f.status === statusFilter)?.empty}
              </div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadConversation(session.id)}
                  className="w-100 text-start p-3 border-0"
                  style={{
                    background: session.id === selectedId ? "#f3eefb" : "transparent",
                    borderBottom: "1px solid rgba(11,11,11,0.08)",
                    cursor: "pointer",
                    minHeight: "76px",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div
                      className="d-flex align-items-center gap-2 text-truncate"
                      style={{ minWidth: 0 }}
                    >
                      {session.unread && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            minWidth: 8,
                            borderRadius: "50%",
                            background: "#6f42c1",
                            display: "inline-block",
                          }}
                        />
                      )}

                      <span
                        className="text-truncate"
                        style={{ fontWeight: session.unread ? 700 : 600 }}
                      >
                        {session.customer_name || session.customer_phone || session.title}
                      </span>
                    </div>

                    <StatusPill status={session.status} size="sm" />
                  </div>

                  {(() => {
                    const subtitle = session.customer_name
                      ? [session.company_name, session.customer_phone]
                          .filter(Boolean)
                          .join(" · ")
                      : session.customer_phone
                      ? session.title
                      : null;

                    return subtitle ? (
                      <div className="text-muted small mt-1 text-truncate">
                        {subtitle}
                      </div>
                    ) : null;
                  })()}
                </button>
              ))
            )}
          </div>
        </div>

        <div
          className="flex-grow-1 d-flex flex-column"
          style={{
            background: "#ffffff",
            border: "1px solid rgba(11,11,11,0.08)",
            borderRadius: "16px",
            boxShadow: "var(--shadow-card)",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          {!selectedId ? (
            <div className="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-muted">
              <div style={{ fontSize: "32px" }}>💬</div>
              <div className="mt-2">Select a conversation to view messages.</div>
            </div>
          ) : loadingConversation && !conversation ? (
            <div className="d-flex align-items-center justify-content-center flex-grow-1">
              <Spinner animation="border" />
            </div>
          ) : (
            <>
              <div
                className="p-3"
                style={{ borderBottom: "1px solid rgba(11,11,11,0.08)" }}
              >
                <div className="d-flex justify-content-between align-items-center gap-2">
                  <div
                    className="text-truncate"
                    title={conversation.title}
                    style={{ fontWeight: 600, minWidth: 0 }}
                  >
                    {conversation.title}
                  </div>

                  <div className="d-flex align-items-center gap-2" style={{ flexShrink: 0 }}>
                    <StatusPill status={conversation.status} />

                    {conversation.is_archived && (
                      <Badge bg="dark">Archived</Badge>
                    )}

                    <button
                      className={`btn btn-sm ${
                        conversation.status === "Closed"
                          ? "btn-outline-success"
                          : "btn-outline-secondary"
                      }`}
                      onClick={handleToggleStatus}
                      disabled={updatingStatus}
                    >
                      {conversation.status === "Closed" ? "Reopen" : "Close"}
                    </button>

                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={handleToggleArchive}
                      disabled={archiving}
                    >
                      {conversation.is_archived ? "Unarchive" : "Archive"}
                    </button>

                    {isAdmin && (
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={handleDeleteSession}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-grow-1 p-3" style={{ overflowY: "auto" }}>
                {conversation.messages.map((msg, index) => (
                  <MessageRow
                    key={index}
                    role={msg.role}
                    content={msg.content}
                    createdAt={msg.created_at}
                  />
                ))}

                <div ref={bottomRef}></div>
              </div>

              <div className="p-3" style={{ borderTop: "1px solid rgba(11,11,11,0.08)" }}>
                {conversation.status === "Closed" ? (
                  <div className="text-muted text-center small py-2">
                    This conversation is closed. Reopen it to reply.
                  </div>
                ) : (
                  <>
                    <div className="d-flex justify-content-between align-items-start mb-2 gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={handleAIAssist}
                        disabled={aiAssistLoading}
                      >
                        {aiAssistLoading ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-1" />
                            Thinking...
                          </>
                        ) : (
                          "✨ AI Assist"
                        )}
                      </button>
                    </div>

                    {aiAssistError && (
                      <div className="small text-danger mb-2">{aiAssistError}</div>
                    )}

                    {aiAssist && (
                      <div
                        className="mb-2 p-2"
                        style={{
                          background: "#f3eefb",
                          border: "1px solid rgba(111,66,193,0.18)",
                          borderRadius: "10px",
                        }}
                      >
                        <div
                          style={{ maxHeight: "160px", overflowY: "auto" }}
                          className="aadrik-scrollbar"
                        >
                          <div className="small fw-semibold mb-1" style={{ color: "#6f42c1" }}>
                            Summary
                          </div>
                          <div className="small mb-2">{aiAssist.summary}</div>

                          <div className="small fw-semibold mb-1" style={{ color: "#6f42c1" }}>
                            Suggested reply
                          </div>
                          <div className="small mb-2" style={{ whiteSpace: "pre-wrap" }}>
                            {aiAssist.suggested_reply}
                          </div>
                        </div>

                        <div className="d-flex justify-content-end gap-2 mt-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => setAiAssist(null)}
                          >
                            Dismiss
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={useSuggestedReply}
                          >
                            Use this reply
                          </button>
                        </div>
                      </div>
                    )}

                    <textarea
                      ref={replyRef}
                      className="form-control mb-2"
                      rows={2}
                      placeholder={replyAttachment ? "Optional caption..." : "Type a reply..."}
                      value={reply}
                      disabled={sending}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />

                    <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                      <input
                        ref={replyFileInputRef}
                        type="file"
                        className="form-control form-control-sm"
                        accept="application/pdf,image/jpeg,image/png"
                        disabled={sending}
                        onChange={(e) => setReplyAttachment(e.target.files?.[0] || null)}
                        title="Attach a PDF, JPG, or PNG - e.g. an invoice"
                      />

                      {replyAttachment && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary flex-shrink-0"
                          onClick={() => {
                            setReplyAttachment(null);
                            if (replyFileInputRef.current) replyFileInputRef.current.value = "";
                          }}
                          disabled={sending}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="d-flex justify-content-end">
                      <button
                        className="btn btn-primary"
                        onClick={handleSend}
                        disabled={sending || (!reply.trim() && !replyAttachment)}
                      >
                        {sending ? "Sending..." : replyAttachment ? "Send Attachment" : "Send"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {selectedId && conversation && (
          <div
            className="d-flex flex-column"
            style={{
              width: "280px",
              minWidth: "280px",
              background: "#ffffff",
              border: "1px solid rgba(11,11,11,0.08)",
              borderRadius: "16px",
              boxShadow: "var(--shadow-card)",
              overflow: "hidden",
            }}
          >
            <div
              className="p-3 fw-bold"
              style={{ borderBottom: "1px solid rgba(11,11,11,0.08)" }}
            >
              Customer
            </div>

            <div className="p-3" style={{ overflowY: "auto", flexGrow: 1 }}>
              {conversation.customer_name && (
                <CustomerField label="Name" value={conversation.customer_name} />
              )}

              {conversation.company_name && (
                <CustomerField label="Company" value={conversation.company_name} />
              )}

              <CustomerField label="Phone" value={conversation.customer_phone || "—"} />

              <CustomerField
                label="Status"
                value={<StatusPill status={conversation.status} size="sm" />}
              />

              <CustomerField
                label="Source"
                value={
                  conversation.channel === "internal"
                    ? "Internal (AI Chat)"
                    : conversation.channel === "whatsapp"
                    ? "WhatsApp"
                    : conversation.channel === "website"
                    ? "Website"
                    : conversation.channel
                }
              />

              <CustomerField
                label="Created"
                value={conversation.created_at ? timeAgo(conversation.created_at) : "—"}
              />

              <CustomerField
                label="Last Message"
                value={conversation.updated_at ? timeAgo(conversation.updated_at) : "—"}
              />
            </div>
          </div>
        )}
      </div>

      <WhatsAppMessageModal
        show={showNewConversation}
        onClose={() => setShowNewConversation(false)}
        onStarted={handleConversationStarted}
      />
    </div>
  );
}
