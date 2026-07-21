import { useScrollReveal } from "../hooks/useScrollReveal";

export default function Reveal({ as: Tag = "div", delay = 0, className = "", children }) {
  const [ref, isVisible] = useScrollReveal();

  return (
    <Tag
      ref={ref}
      className={`aadrik-reveal ${isVisible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: isVisible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}
