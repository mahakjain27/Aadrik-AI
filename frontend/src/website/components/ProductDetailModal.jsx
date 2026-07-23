import { Link } from "react-router-dom";
import { FaTimes } from "react-icons/fa";

import { productTitle } from "../utils/productDisplay";

export default function ProductDetailModal({ product, onClose }) {
  if (!product) return null;

  return (
    <div
      className="tw-fixed tw-inset-0 tw-z-[100] tw-flex tw-items-center tw-justify-center tw-bg-aadrik-charcoal/60 tw-p-4 tw-backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="tw-relative tw-w-full tw-max-w-lg tw-rounded-2xl tw-bg-white tw-p-8 tw-shadow-aadrik-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="tw-absolute tw-right-5 tw-top-5 tw-appearance-none tw-p-0 tw-text-aadrik-charcoal/50 hover:tw-text-aadrik-charcoal"
        >
          <FaTimes size={16} />
        </button>

        <span className="tw-rounded-full tw-bg-aadrik-cream tw-px-3 tw-py-1 tw-text-xs tw-font-semibold tw-text-aadrik-wine">
          {product.category}
        </span>

        <h3 className="tw-mt-4 tw-text-2xl tw-font-bold tw-text-aadrik-charcoal">
          {productTitle(product)}
        </h3>

        {product.brand && (
          <p className="tw-mt-1 tw-text-sm tw-font-medium tw-text-aadrik-charcoal/50">
            {product.brand}
          </p>
        )}

        {product.sizes?.length > 0 && (
          <div className="tw-mt-4">
            <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-aadrik-charcoal/40">
              Available Sizes
            </p>
            <div className="tw-mt-2 tw-flex tw-flex-wrap tw-gap-2">
              {product.sizes.map((size) => (
                <span
                  key={size}
                  className="tw-rounded-full tw-bg-aadrik-charcoal/5 tw-px-3 tw-py-1 tw-text-xs tw-text-aadrik-charcoal/70"
                >
                  {size}
                </span>
              ))}
            </div>
          </div>
        )}

        {product.applications?.length > 0 && (
          <div className="tw-mt-4">
            <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-aadrik-charcoal/40">
              Applications
            </p>
            <p className="tw-mt-2 tw-text-sm tw-leading-relaxed tw-text-aadrik-charcoal/70">
              {product.applications.join(", ")}
            </p>
          </div>
        )}

        <div className="tw-mt-8 tw-flex tw-flex-col tw-gap-3 sm:tw-flex-row">
          <Link
            to="/assistant"
            onClick={onClose}
            className="tw-flex-1 tw-rounded-full tw-bg-aadrik-ombre tw-px-5 tw-py-3 tw-text-center tw-text-sm tw-font-semibold tw-text-white"
          >
            Ask AI About This
          </Link>
          <Link
            to="/contact"
            state={{ requirement: productTitle(product) }}
            onClick={onClose}
            className="tw-flex-1 tw-rounded-full tw-border tw-border-aadrik-wine tw-px-5 tw-py-3 tw-text-center tw-text-sm tw-font-semibold tw-text-aadrik-wine"
          >
            Request Quote
          </Link>
        </div>
      </div>
    </div>
  );
}
