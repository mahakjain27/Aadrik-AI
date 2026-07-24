import { Link } from "react-router-dom";
import { FaEnvelope, FaMapMarkerAlt, FaPhoneAlt } from "react-icons/fa";

import logo from "../../assets/logo.jpeg";

const YEAR = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="tw-border-t tw-border-aadrik-charcoal/10 tw-bg-aadrik-charcoal">
      <div className="tw-mx-auto tw-max-w-7xl tw-px-6 tw-py-16 lg:tw-px-10">
        <div className="tw-grid tw-grid-cols-1 tw-gap-12 sm:tw-grid-cols-2 lg:tw-grid-cols-4">
          <div>
            <div className="tw-flex tw-items-center tw-gap-3">
              <img
                src={logo}
                alt="Aadrik Distributors Pvt. Ltd."
                className="tw-h-9 tw-w-9 tw-shrink-0 tw-rounded-lg tw-object-cover"
              />
              <span className="tw-font-display tw-text-lg tw-font-bold tw-leading-tight tw-text-white">
                Aadrik Distributors Pvt. Ltd.
              </span>
            </div>
            <p className="tw-mt-4 tw-max-w-xs tw-text-sm tw-leading-relaxed tw-text-white/60">
              Industrial welding solutions from Aadrik Distributors Pvt. Ltd. — now paired
              with an AI assistant that helps you choose the right products, instantly.
            </p>
          </div>

          <div>
            <h4 className="tw-text-sm tw-font-semibold tw-uppercase tw-tracking-wider tw-text-white/40">
              Quick Links
            </h4>
            <ul className="tw-mt-4 tw-space-y-3 tw-text-sm">
              <li><Link to="/" className="tw-text-white/70 hover:tw-text-white">Home</Link></li>
              <li><Link to="/company" className="tw-text-white/70 hover:tw-text-white">Company</Link></li>
              <li><Link to="/assistant" className="tw-text-white/70 hover:tw-text-white">AI Assistant</Link></li>
              <li><Link to="/contact" className="tw-text-white/70 hover:tw-text-white">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="tw-text-sm tw-font-semibold tw-uppercase tw-tracking-wider tw-text-white/40">
              Products &amp; Policies
            </h4>
            <ul className="tw-mt-4 tw-space-y-3 tw-text-sm">
              <li><Link to="/products" className="tw-text-white/70 hover:tw-text-white">Browse Products</Link></li>
              <li><Link to="/policies" className="tw-text-white/70 hover:tw-text-white">Return Policy</Link></li>
              <li><Link to="/policies" className="tw-text-white/70 hover:tw-text-white">Delivery Terms</Link></li>
              <li><Link to="/policies" className="tw-text-white/70 hover:tw-text-white">Payment Terms</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="tw-text-sm tw-font-semibold tw-uppercase tw-tracking-wider tw-text-white/40">
              Contact
            </h4>
            <ul className="tw-mt-4 tw-space-y-3 tw-text-sm tw-text-white/70">
              <li className="tw-flex tw-items-start tw-gap-2">
                <FaPhoneAlt className="tw-mt-1 tw-shrink-0 tw-text-aadrik-wineLight" />
                <span>+91 98400 50923</span>
              </li>
              <li className="tw-flex tw-items-start tw-gap-2">
                <FaEnvelope className="tw-mt-1 tw-shrink-0 tw-text-aadrik-wineLight" />
                <span>ea@aadrik.co.in</span>
              </li>
              <li className="tw-flex tw-items-start tw-gap-2">
                <FaMapMarkerAlt className="tw-mt-1 tw-shrink-0 tw-text-aadrik-wineLight" />
                <span>
                  79C, Nattupilliar Koil Street, Maskan Chavadi, Seven Wells South,
                  George Town, Chennai, Tamil Nadu 600001, India
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="tw-mt-14 tw-flex tw-flex-col tw-items-center tw-justify-between tw-gap-4 tw-border-t tw-border-white/10 tw-pt-8 sm:tw-flex-row">
          <p className="tw-text-xs tw-text-white/40">
            © {YEAR} Aadrik Distributors Pvt. Ltd. All rights reserved.
          </p>
          <Link
            to="/login"
            className="tw-text-xs tw-font-medium tw-text-white/50 hover:tw-text-white"
          >
            Employee Login →
          </Link>
        </div>
      </div>
    </footer>
  );
}
