import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { FaBars, FaTimes } from "react-icons/fa";

import logo from "../../assets/logo.jpeg";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/products", label: "Products" },
  { to: "/company", label: "Company" },
  { to: "/policies", label: "Policies" },
  { to: "/assistant", label: "AI Assistant" },
  { to: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, []);

  const linkClass = ({ isActive }) =>
    `tw-text-sm tw-font-medium tw-transition-colors tw-duration-200 ${
      isActive ? "tw-text-aadrik-wine" : "tw-text-aadrik-charcoal/70 hover:tw-text-aadrik-wine"
    }`;

  return (
    <header
      className={`tw-sticky tw-top-0 tw-z-50 tw-w-full tw-transition-all tw-duration-300 ${
        scrolled
          ? "tw-bg-white/85 tw-backdrop-blur-md tw-shadow-[0_1px_0_rgba(34,31,31,0.08)]"
          : "tw-bg-white/60 tw-backdrop-blur-sm"
      }`}
    >
      <div className="tw-mx-auto tw-flex tw-max-w-7xl tw-items-center tw-justify-between tw-px-6 tw-py-4 lg:tw-px-10">
        <Link to="/" className="tw-flex tw-shrink-0 tw-items-center tw-gap-3">
          <img
            src={logo}
            alt="Aadrik Distributors Pvt. Ltd."
            className="tw-h-9 tw-w-9 tw-shrink-0 tw-rounded-lg tw-object-cover"
          />
          <span className="tw-font-display tw-text-base tw-font-bold tw-leading-tight tw-tracking-tight tw-text-aadrik-charcoal sm:tw-text-lg">
            Aadrik <span className="tw-text-aadrik-wine">Distributors</span>
            <span className="tw-hidden xl:tw-inline"> Pvt. Ltd.</span>
          </span>
        </Link>

        <nav className="tw-hidden tw-items-center tw-gap-8 lg:tw-flex">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="tw-hidden lg:tw-block">
          <Link
            to="/login"
            className="tw-rounded-full tw-bg-aadrik-ombre tw-px-5 tw-py-2.5 tw-text-sm tw-font-semibold tw-text-white tw-shadow-aadrik-card tw-transition-transform tw-duration-200 hover:tw-scale-[1.03]"
          >
            Employee Login
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((prev) => !prev)}
          className="tw-flex tw-h-10 tw-w-10 tw-appearance-none tw-items-center tw-justify-center tw-rounded-full tw-p-0 tw-text-aadrik-charcoal lg:tw-hidden"
        >
          {open ? <FaTimes size={18} /> : <FaBars size={18} />}
        </button>
      </div>

      {open && (
        <div className="tw-border-t tw-border-aadrik-charcoal/10 tw-bg-white tw-px-6 tw-py-4 lg:tw-hidden">
          <nav className="tw-flex tw-flex-col tw-gap-4">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setOpen(false)}
                className={linkClass}
              >
                {link.label}
              </NavLink>
            ))}
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="tw-mt-2 tw-w-full tw-rounded-full tw-bg-aadrik-ombre tw-px-5 tw-py-2.5 tw-text-center tw-text-sm tw-font-semibold tw-text-white"
            >
              Employee Login
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
