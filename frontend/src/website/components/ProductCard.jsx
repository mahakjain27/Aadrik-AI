import { productBlurb, productTitle } from "../utils/productDisplay";

export default function ProductCard({ product, onViewDetails }) {
  return (
    <div className="tw-group tw-flex tw-flex-col tw-rounded-2xl tw-border tw-border-aadrik-charcoal/8 tw-bg-white tw-p-6 tw-shadow-aadrik-card tw-transition-all tw-duration-300 hover:tw-shadow-aadrik-lift hover:tw--translate-y-1">
      <div className="tw-flex tw-items-center tw-justify-between">
        <span className="tw-rounded-full tw-bg-aadrik-cream tw-px-3 tw-py-1 tw-text-xs tw-font-semibold tw-text-aadrik-wine">
          {product.category}
        </span>
        {product.brand && (
          <span className="tw-text-xs tw-font-medium tw-text-aadrik-charcoal/40">
            {product.brand}
          </span>
        )}
      </div>

      <h3 className="tw-mt-4 tw-text-lg tw-font-bold tw-text-aadrik-charcoal">
        {productTitle(product)}
      </h3>

      <p className="tw-mt-2 tw-flex-1 tw-text-sm tw-leading-relaxed tw-text-aadrik-charcoal/60">
        {productBlurb(product)}
      </p>

      <button
        type="button"
        onClick={() => onViewDetails(product)}
        className="tw-mt-6 tw-inline-flex tw-items-center tw-justify-center tw-rounded-full tw-border tw-border-aadrik-wine tw-px-4 tw-py-2 tw-text-sm tw-font-semibold tw-text-aadrik-wine tw-transition-colors tw-duration-200 group-hover:tw-bg-aadrik-wine group-hover:tw-text-white"
      >
        View Details
      </button>
    </div>
  );
}
