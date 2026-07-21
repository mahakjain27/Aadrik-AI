import { FaBullseye, FaEye, FaHistory, FaIndustry } from "react-icons/fa";

import Reveal from "../components/Reveal";

const SECTIONS = [
  {
    icon: FaHistory,
    title: "History",
    body: "Aadrik Distributors Pvt. Ltd. was founded to bridge the gap between industrial fabricators and the welding products they rely on every day. Over the years we've grown from a regional supplier into a trusted distribution partner for workshops and manufacturers across the country.",
  },
  {
    icon: FaBullseye,
    title: "Mission",
    body: "To make sourcing welding and industrial supplies fast, transparent and reliable — backed by product expertise and, now, an AI assistant that puts that expertise in every customer's hands instantly.",
  },
  {
    icon: FaEye,
    title: "Vision",
    body: "To be the most trusted name in industrial welding distribution, known equally for product quality and for how easy we make it to do business with us.",
  },
  {
    icon: FaIndustry,
    title: "Infrastructure",
    body: "A network of warehousing and logistics built for fast turnaround, paired with a sales and support team that understands the technical side of every product we carry.",
  },
];

export default function CompanyPage() {
  return (
    <section className="tw-mx-auto tw-max-w-5xl tw-px-6 tw-py-20 lg:tw-px-10">
      <Reveal className="tw-text-center">
        <p className="tw-text-sm tw-font-semibold tw-uppercase tw-tracking-widest tw-text-aadrik-wine">
          Company
        </p>
        <h1 className="tw-mt-4 tw-text-4xl tw-font-extrabold tw-text-aadrik-charcoal">
          About Aadrik Distributors
        </h1>
      </Reveal>

      <div className="tw-mt-16 tw-grid tw-grid-cols-1 tw-gap-8 sm:tw-grid-cols-2">
        {SECTIONS.map((section, i) => (
          <Reveal key={section.title} delay={i * 90}>
            <div className="tw-h-full tw-rounded-2xl tw-border tw-border-aadrik-charcoal/8 tw-bg-white tw-p-8 tw-shadow-aadrik-card">
              <div className="tw-flex tw-h-12 tw-w-12 tw-items-center tw-justify-center tw-rounded-xl tw-bg-aadrik-ombre tw-text-white">
                <section.icon size={18} />
              </div>
              <h2 className="tw-mt-5 tw-text-xl tw-font-bold tw-text-aadrik-charcoal">
                {section.title}
              </h2>
              <p className="tw-mt-3 tw-text-sm tw-leading-relaxed tw-text-aadrik-charcoal/60">
                {section.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
