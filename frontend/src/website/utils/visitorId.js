const STORAGE_KEY = "aadrik_visitor_id";

// Stable per-browser identity for anonymous website visitors, so the
// backend can thread their messages into one ongoing session (see
// resolve_website_session) without requiring login.
export function getVisitorId() {
  let id = localStorage.getItem(STORAGE_KEY);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }

  return id;
}
