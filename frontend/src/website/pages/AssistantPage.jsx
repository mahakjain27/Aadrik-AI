import { useEffect, useRef, useState } from "react";
import { FaPaperPlane, FaRobot } from "react-icons/fa";

import { getSessions, sendMessage, sendPublicMessage } from "../../services/api";
import { groupSessions } from "../../utils/groupSessions";
import { useAuth } from "../../context/AuthContext";
import { getVisitorId } from "../utils/visitorId";

const SUGGESTED_PROMPTS = [
  "Which welding wire should I use?",
  "Explain your return policy.",
  "What products do you sell?",
  "Generate a quotation.",
];

export default function AssistantPage() {
  // Logged-in staff keep using /chat (JWT, tied to their user, same as the
  // dashboard). Anonymous visitors use /public/chat (see backend/app/api/chat.py)
  // - a per-browser visitor_id keyed to a 'website' session, same pattern as
  // the WhatsApp webhook, so these conversations land in the Sales Inbox.
  const { isAuthenticated } = useAuth();

  const [chat, setChat] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionsAvailable, setSessionsAvailable] = useState(isAuthenticated);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    getSessions()
      .then(setSessions)
      .catch(() => setSessionsAvailable(false));
  }, [isAuthenticated]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat, loading]);

  async function ask(message) {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    setChat((prev) => [...prev, { sender: "You", text: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const res = isAuthenticated
        ? await sendMessage(trimmed, sessionId)
        : await sendPublicMessage(trimmed, getVisitorId());

      setSessionId(res.session_id);
      setChat((prev) => [
        ...prev,
        { sender: "Aadrik AI", text: res.reply, sources: res.sources || [] },
      ]);

      if (isAuthenticated) {
        getSessions().then(setSessions).catch(() => {});
      }
    } catch (error) {
      const isRateLimited = error.response?.status === 429;
      setChat((prev) => [
        ...prev,
        {
          sender: "System",
          text: isRateLimited
            ? "You've sent a lot of messages in a short time — please wait a bit before continuing."
            : "Something went wrong reaching the AI assistant. Please try again in a moment.",
        },
      ]);
    }

    setLoading(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    ask(input);
  }

  const grouped = sessionsAvailable ? groupSessions(sessions) : null;

  return (
    <section className="tw-mx-auto tw-flex tw-max-w-7xl tw-flex-col tw-gap-8 tw-px-6 tw-py-12 lg:tw-flex-row lg:tw-px-10 lg:tw-py-16">
      {/* Chat column */}
      <div className="tw-flex tw-min-w-0 tw-flex-1 tw-flex-col">
        <div className="tw-text-center">
          <div className="tw-mx-auto tw-flex tw-h-12 tw-w-12 tw-items-center tw-justify-center tw-rounded-2xl tw-bg-aadrik-ombre tw-text-white tw-shadow-aadrik-card">
            <FaRobot size={20} />
          </div>
          <h1 className="tw-mt-4 tw-text-3xl tw-font-extrabold tw-text-aadrik-charcoal">
            Aadrik AI Assistant
          </h1>
          <p className="tw-mt-2 tw-text-sm tw-text-aadrik-charcoal/50">
            Ask about products, policies, or generate a quotation.
          </p>
        </div>

        <div
          ref={scrollRef}
          className="aadrik-scrollbar tw-mt-8 tw-flex-1 tw-space-y-5 tw-overflow-y-auto tw-rounded-2xl tw-border tw-border-aadrik-charcoal/8 tw-bg-white tw-p-6 tw-shadow-aadrik-card"
          style={{ minHeight: "360px", maxHeight: "56vh" }}
        >
          {chat.length === 0 ? (
            <div className="tw-flex tw-h-full tw-flex-col tw-items-center tw-justify-center tw-gap-3 tw-py-10">
              <p className="tw-text-sm tw-font-medium tw-text-aadrik-charcoal/40">
                Try asking:
              </p>
              <div className="tw-grid tw-w-full tw-max-w-lg tw-grid-cols-1 tw-gap-3 sm:tw-grid-cols-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => ask(prompt)}
                    className="tw-rounded-xl tw-border tw-border-aadrik-charcoal/10 tw-bg-aadrik-cream/40 tw-px-4 tw-py-3 tw-text-left tw-text-sm tw-text-aadrik-charcoal tw-transition-colors tw-duration-200 hover:tw-bg-aadrik-cream"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chat.map((message, i) => (
              <div
                key={i}
                className={`tw-flex ${message.sender === "You" ? "tw-justify-end" : "tw-justify-start"}`}
              >
                <div
                  className={`tw-max-w-[80%] tw-rounded-2xl tw-px-4 tw-py-3 tw-text-sm tw-leading-relaxed ${
                    message.sender === "You"
                      ? "tw-bg-aadrik-ombre tw-text-white"
                      : message.sender === "System"
                        ? "tw-bg-aadrik-cream tw-text-aadrik-wine"
                        : "tw-bg-aadrik-charcoal/5 tw-text-aadrik-charcoal"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="tw-flex tw-justify-start">
              <div className="tw-flex tw-items-center tw-gap-1 tw-rounded-2xl tw-bg-aadrik-charcoal/5 tw-px-4 tw-py-3">
                <span className="tw-h-1.5 tw-w-1.5 tw-animate-bounce tw-rounded-full tw-bg-aadrik-charcoal/40 [animation-delay:-0.3s]" />
                <span className="tw-h-1.5 tw-w-1.5 tw-animate-bounce tw-rounded-full tw-bg-aadrik-charcoal/40 [animation-delay:-0.15s]" />
                <span className="tw-h-1.5 tw-w-1.5 tw-animate-bounce tw-rounded-full tw-bg-aadrik-charcoal/40" />
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="tw-mt-4 tw-flex tw-gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Aadrik AI..."
            className="tw-flex-1 tw-rounded-full tw-border tw-border-aadrik-charcoal/10 tw-bg-white tw-px-5 tw-py-3.5 tw-text-sm tw-text-aadrik-charcoal tw-outline-none tw-transition-shadow tw-duration-200 focus:tw-shadow-aadrik-card"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="tw-flex tw-h-12 tw-w-12 tw-shrink-0 tw-appearance-none tw-items-center tw-justify-center tw-rounded-full tw-bg-aadrik-ombre tw-p-0 tw-text-white tw-shadow-aadrik-card tw-transition-opacity tw-duration-200 disabled:tw-opacity-40"
          >
            <FaPaperPlane size={14} />
          </button>
        </form>
      </div>

      {/* Recent conversations */}
      <aside className="tw-w-full tw-shrink-0 lg:tw-w-72">
        <h2 className="tw-text-sm tw-font-semibold tw-uppercase tw-tracking-wider tw-text-aadrik-charcoal/40">
          Recent Conversations
        </h2>

        <div className="tw-mt-4 tw-max-h-[56vh] tw-space-y-6 tw-overflow-y-auto">
          {!sessionsAvailable && (
            <p className="tw-text-sm tw-text-aadrik-charcoal/40">
              Conversation history isn't available for guests yet.
            </p>
          )}

          {sessionsAvailable && sessions.length === 0 && (
            <p className="tw-text-sm tw-text-aadrik-charcoal/40">
              Your conversations will appear here once you start chatting.
            </p>
          )}

          {sessionsAvailable &&
            grouped &&
            Object.entries(grouped).map(([label, group]) =>
              group.length === 0 ? null : (
                <div key={label}>
                  <p className="tw-mb-2 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-aadrik-charcoal/30">
                    {label}
                  </p>
                  <ul className="tw-space-y-1.5">
                    {group.map((session) => (
                      <li key={session.id}>
                        <button
                          type="button"
                          onClick={() => setSessionId(session.id)}
                          className={`tw-w-full tw-truncate tw-rounded-lg tw-px-3 tw-py-2 tw-text-left tw-text-sm tw-transition-colors tw-duration-200 ${
                            sessionId === session.id
                              ? "tw-bg-aadrik-cream tw-text-aadrik-wine"
                              : "tw-text-aadrik-charcoal/70 hover:tw-bg-aadrik-charcoal/5"
                          }`}
                        >
                          {session.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
        </div>
      </aside>
    </section>
  );
}
