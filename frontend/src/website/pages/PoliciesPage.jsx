import {
  FaBoxOpen,
  FaExchangeAlt,
  FaMoneyCheckAlt,
  FaShippingFast,
  FaTimesCircle,
} from "react-icons/fa";

import Reveal from "../components/Reveal";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

const POLICIES = [
  {
    icon: FaBoxOpen,
    title: "Return Policy",
    body: "Products can be returned within a reasonable window of delivery if unused and in original packaging. Contact our sales team to initiate a return.",
  },
  {
    icon: FaExchangeAlt,
    title: "Replacement Policy",
    body: "Defective or damaged items are replaced promptly once verified. Reach out to sales with your order details and we'll take it from there.",
  },
  {
    icon: FaMoneyCheckAlt,
    title: "Payment Terms",
    body: "We support standard advance and credit payment terms for verified business customers. Terms are confirmed at the time of quotation.",
  },
  {
    icon: FaShippingFast,
    title: "Delivery Terms",
    body: "Delivery timelines depend on product availability and destination. Estimated timelines are shared with every quotation.",
  },
  {
    icon: FaTimesCircle,
    title: "Cancellation Policy",
    body: "Orders can be cancelled before dispatch. Once shipped, cancellation is handled case-by-case through our sales team.",
  },
];

export default function PoliciesPage() {
  useDocumentMeta(
    "Policies | Aadrik Distributors Pvt. Ltd.",
    "Return, replacement, payment, delivery and cancellation policies for orders with Aadrik Distributors Pvt. Ltd."
  );

  return (
    <section className="tw-mx-auto tw-max-w-6xl tw-px-6 tw-py-20 lg:tw-px-10">
      <Reveal className="tw-text-center">
        <p className="tw-text-sm tw-font-semibold tw-uppercase tw-tracking-widest tw-text-aadrik-wine">
          Policies
        </p>
        <h1 className="tw-mt-4 tw-text-4xl tw-font-extrabold tw-text-aadrik-charcoal">
          Business Policies
        </h1>
        <p className="tw-mx-auto tw-mt-4 tw-max-w-2xl tw-text-lg tw-text-aadrik-charcoal/60">
          Clear terms so there are no surprises after you place an order.
        </p>
      </Reveal>

      <div className="tw-mt-16 tw-grid tw-grid-cols-1 tw-gap-6 sm:tw-grid-cols-2 lg:tw-grid-cols-3">
        {POLICIES.map((policy, i) => (
          <Reveal key={policy.title} delay={(i % 3) * 80}>
            <div className="tw-h-full tw-rounded-2xl tw-border tw-border-aadrik-charcoal/8 tw-bg-white tw-p-7 tw-shadow-aadrik-card">
              <div className="tw-flex tw-h-11 tw-w-11 tw-items-center tw-justify-center tw-rounded-xl tw-bg-aadrik-cream tw-text-aadrik-wine">
                <policy.icon size={16} />
              </div>
              <h2 className="tw-mt-4 tw-text-lg tw-font-bold tw-text-aadrik-charcoal">
                {policy.title}
              </h2>
              <p className="tw-mt-2 tw-text-sm tw-leading-relaxed tw-text-aadrik-charcoal/60">
                {policy.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
