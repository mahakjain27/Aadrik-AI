import { useState } from "react";
import { FaCheckCircle, FaEnvelope, FaMapMarkerAlt, FaPhoneAlt } from "react-icons/fa";

import Reveal from "../components/Reveal";
import { submitPublicContact } from "../../services/api";

const FIELDS = [
  { name: "name", label: "Name", type: "text", placeholder: "Your full name" },
  { name: "phone", label: "Phone", type: "tel", placeholder: "+91 00000 00000" },
  { name: "company", label: "Company", type: "text", placeholder: "Your company name" },
  { name: "requirement", label: "Requirement", type: "text", placeholder: "e.g. MIG welding wire, 500kg" },
];

const EMPTY_FORM = { name: "", phone: "", company: "", requirement: "", message: "" };

export default function ContactPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.name.trim() || !form.phone.trim()) {
      setError("Please fill in your name and phone number.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await submitPublicContact(form);
      setSubmitted(true);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(
        err.response?.status === 429
          ? "You've submitted a few times already — please wait a bit before trying again."
          : "Something went wrong sending your message. Please try again."
      );
    }

    setSubmitting(false);
  }

  return (
    <section className="tw-mx-auto tw-max-w-6xl tw-px-6 tw-py-20 lg:tw-px-10">
      <Reveal className="tw-text-center">
        <p className="tw-text-sm tw-font-semibold tw-uppercase tw-tracking-widest tw-text-aadrik-wine">
          Contact
        </p>
        <h1 className="tw-mt-4 tw-text-4xl tw-font-extrabold tw-text-aadrik-charcoal">
          Let's Talk
        </h1>
        <p className="tw-mx-auto tw-mt-4 tw-max-w-2xl tw-text-lg tw-text-aadrik-charcoal/60">
          Tell us what you need and our team will get back to you.
        </p>
      </Reveal>

      <div className="tw-mt-16 tw-grid tw-grid-cols-1 tw-gap-12 lg:tw-grid-cols-5">
        <Reveal className="lg:tw-col-span-3">
          <form
            onSubmit={handleSubmit}
            className="tw-rounded-2xl tw-border tw-border-aadrik-charcoal/8 tw-bg-white tw-p-8 tw-shadow-aadrik-card"
          >
            {submitted && (
              <div className="tw-mb-6 tw-flex tw-items-center tw-gap-2 tw-rounded-xl tw-bg-aadrik-cream tw-px-4 tw-py-3 tw-text-sm tw-font-medium tw-text-aadrik-wine">
                <FaCheckCircle />
                Thanks — we've received your message and will be in touch soon.
              </div>
            )}

            {error && (
              <div className="tw-mb-6 tw-rounded-xl tw-bg-red-50 tw-px-4 tw-py-3 tw-text-sm tw-font-medium tw-text-red-700">
                {error}
              </div>
            )}

            <div className="tw-grid tw-grid-cols-1 tw-gap-5 sm:tw-grid-cols-2">
              {FIELDS.map((field) => (
                <div key={field.name} className={field.name === "requirement" ? "sm:tw-col-span-2" : ""}>
                  <label className="tw-mb-1.5 tw-block tw-text-sm tw-font-semibold tw-text-aadrik-charcoal">
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    name={field.name}
                    value={form[field.name]}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    className="tw-w-full tw-rounded-xl tw-border tw-border-aadrik-charcoal/10 tw-bg-white tw-px-4 tw-py-3 tw-text-sm tw-text-aadrik-charcoal tw-outline-none tw-transition-shadow tw-duration-200 focus:tw-shadow-aadrik-card"
                  />
                </div>
              ))}

              <div className="sm:tw-col-span-2">
                <label className="tw-mb-1.5 tw-block tw-text-sm tw-font-semibold tw-text-aadrik-charcoal">
                  Message
                </label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Tell us more about what you're looking for..."
                  className="tw-w-full tw-resize-none tw-rounded-xl tw-border tw-border-aadrik-charcoal/10 tw-bg-white tw-px-4 tw-py-3 tw-text-sm tw-text-aadrik-charcoal tw-outline-none tw-transition-shadow tw-duration-200 focus:tw-shadow-aadrik-card"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="tw-mt-8 tw-w-full tw-rounded-full tw-bg-aadrik-ombre tw-px-7 tw-py-3.5 tw-text-sm tw-font-semibold tw-text-white tw-shadow-aadrik-card tw-transition-transform tw-duration-200 hover:tw-scale-[1.01] disabled:tw-opacity-60"
            >
              {submitting ? "Sending..." : "Send Message"}
            </button>
          </form>
        </Reveal>

        <Reveal delay={100} className="tw-flex tw-flex-col tw-gap-6 lg:tw-col-span-2">
          <div className="tw-rounded-2xl tw-border tw-border-aadrik-charcoal/8 tw-bg-white tw-p-8 tw-shadow-aadrik-card">
            <dl className="tw-space-y-5 tw-text-sm">
              <div className="tw-flex tw-items-start tw-gap-3">
                <FaPhoneAlt className="tw-mt-1 tw-shrink-0 tw-text-aadrik-wine" />
                <div>
                  <dt className="tw-font-semibold tw-text-aadrik-charcoal">Phone</dt>
                  <dd className="tw-text-aadrik-charcoal/60">+91 98400 50923</dd>
                </div>
              </div>
              <div className="tw-flex tw-items-start tw-gap-3">
                <FaEnvelope className="tw-mt-1 tw-shrink-0 tw-text-aadrik-wine" />
                <div>
                  <dt className="tw-font-semibold tw-text-aadrik-charcoal">Email</dt>
                  <dd className="tw-text-aadrik-charcoal/60">sales@aadrik.co.in</dd>
                </div>
              </div>
              <div className="tw-flex tw-items-start tw-gap-3">
                <FaMapMarkerAlt className="tw-mt-1 tw-shrink-0 tw-text-aadrik-wine" />
                <div>
                  <dt className="tw-font-semibold tw-text-aadrik-charcoal">Address</dt>
                  <dd className="tw-text-aadrik-charcoal/60">
                    79C, Nattupilliar Koil Street, Maskan Chavadi, Seven Wells South,
                    George Town, Chennai, Tamil Nadu 600001, India
                  </dd>
                </div>
              </div>
            </dl>
          </div>

          <div className="tw-flex tw-min-h-[220px] tw-flex-1 tw-items-center tw-justify-center tw-rounded-2xl tw-border tw-border-aadrik-charcoal/10 tw-bg-white tw-text-sm tw-text-aadrik-charcoal/40">
            Google Maps embed placeholder
          </div>
        </Reveal>
      </div>
    </section>
  );
}
