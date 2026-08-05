import { useState } from "react";
import { FaTimes, FaWhatsapp } from "react-icons/fa";

const NEW_WHATSAPP_NUMBER = "+91 98402 19000";
const WHATSAPP_LINK = "https://wa.me/919840219000";

// Keyed to the number so a future re-announcement (different number) shows
// again automatically instead of staying hidden from an old dismissal.
const DISMISS_KEY = "aadrik-whatsapp-move-banner-919840219000";

export default function WhatsAppMoveBanner() {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1"
  );

  if (dismissed) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="tw-relative tw-flex tw-flex-wrap tw-items-center tw-justify-center tw-gap-x-2 tw-gap-y-1 tw-bg-aadrik-wine tw-px-10 tw-py-2.5 tw-text-center tw-text-sm tw-font-medium tw-text-white">
      <span>
        📢 We've moved! Our new official WhatsApp number is{" "}
        <a
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="tw-inline-flex tw-items-center tw-gap-1 tw-font-semibold tw-underline tw-underline-offset-2 hover:tw-text-aadrik-cream"
        >
          <FaWhatsapp />
          {NEW_WHATSAPP_NUMBER}
        </a>
        .
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="tw-absolute tw-right-3 tw-top-1/2 tw--translate-y-1/2 tw-appearance-none tw-p-1 tw-text-white/70 tw-transition-colors hover:tw-text-white"
      >
        <FaTimes size={14} />
      </button>
    </div>
  );
}
