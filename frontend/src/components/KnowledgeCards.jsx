import { useEffect, useState } from "react";
import { Spinner } from "react-bootstrap";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const INK = {
  primary: "#0b0b0b",
  secondary: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  border: "rgba(11,11,11,0.08)",
};

const mdComponents = {
  p: (props) => (
    <p style={{ margin: "0 0 10px", color: INK.secondary, fontSize: 14, lineHeight: 1.6 }} {...props} />
  ),
  ul: (props) => (
    <ul style={{ margin: "0 0 10px", paddingLeft: 20, color: INK.secondary, fontSize: 14, lineHeight: 1.6 }} {...props} />
  ),
  li: (props) => <li style={{ marginBottom: 4 }} {...props} />,
  strong: (props) => <strong style={{ color: INK.primary }} {...props} />,
  table: (props) => (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, margin: "8px 0" }} {...props} />
  ),
  th: (props) => (
    <th
      style={{ textAlign: "left", padding: "6px 10px", borderBottom: `1px solid ${INK.border}`, color: INK.primary, fontWeight: 600 }}
      {...props}
    />
  ),
  td: (props) => (
    <td style={{ padding: "6px 10px", borderBottom: `1px solid ${INK.grid}`, color: INK.secondary }} {...props} />
  ),
};

export default function KnowledgeCards({ title, icon, fetcher }) {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);

  useEffect(() => {
    let active = true;

    fetcher()
      .then((data) => {
        if (active) setSections(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetcher]);

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <div className="container mt-4" style={{ paddingBottom: "32px" }}>
      <h2 className="mb-4" style={{ fontWeight: 700, color: INK.primary }}>
        {icon} {title}
      </h2>

      {sections.length === 0 ? (
        <div style={{ color: INK.muted, fontSize: 14 }}>Nothing to show yet.</div>
      ) : (
        <div className="row g-3">
          {sections.map((section) => (
            <div className="col-md-6" key={section.title}>
              <div
                style={{
                  background: "#ffffff",
                  border: `1px solid ${INK.border}`,
                  borderRadius: "16px",
                  boxShadow: "var(--shadow-card)",
                  padding: "20px",
                  height: "100%",
                }}
              >
                <h6 style={{ fontWeight: 700, color: INK.primary, marginBottom: 12 }}>
                  {section.title}
                </h6>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {section.body}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
