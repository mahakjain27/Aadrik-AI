import { FaArrowRight } from "react-icons/fa";

import { getCategoryMeta } from "../data/categoryMeta";

export default function CategoryCard({ category, count, onSelect }) {
  const meta = getCategoryMeta(category);
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(category)}
      className="tw-group tw-flex tw-h-full tw-w-full tw-appearance-none tw-flex-col tw-overflow-hidden tw-rounded-2xl tw-border tw-border-aadrik-charcoal/8 tw-bg-white tw-p-0 tw-text-left tw-shadow-aadrik-card tw-transition-all tw-duration-300 hover:tw-shadow-aadrik-lift hover:tw--translate-y-1"
    >
      <div className="tw-relative tw-aspect-[4/3] tw-w-full tw-shrink-0 tw-overflow-hidden">
        {meta.image ? (
          <img
            src={meta.image}
            alt={category}
            className="tw-h-full tw-w-full tw-object-cover tw-transition-transform tw-duration-500 group-hover:tw-scale-105"
          />
        ) : (
          <div className="tw-flex tw-h-full tw-w-full tw-items-center tw-justify-center tw-bg-aadrik-ombre-diag">
            <Icon className="tw-text-white/90" size={56} />
          </div>
        )}
      </div>

      <div className="tw-flex tw-flex-1 tw-flex-col tw-p-6">
        <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
          <h3 className="tw-min-h-[3.5rem] tw-text-lg tw-font-bold tw-leading-snug tw-text-aadrik-charcoal">
            {category}
          </h3>
          <span className="tw-mt-0.5 tw-shrink-0 tw-rounded-full tw-bg-aadrik-cream tw-px-2.5 tw-py-1 tw-text-xs tw-font-semibold tw-text-aadrik-wine">
            {count}
          </span>
        </div>

        <p className="tw-mt-2 tw-line-clamp-2 tw-flex-1 tw-text-sm tw-leading-relaxed tw-text-aadrik-charcoal/60">
          {meta.blurb}
        </p>

        <span className="tw-mt-5 tw-inline-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-aadrik-wine">
          Explore Category
          <FaArrowRight
            size={12}
            className="tw-transition-transform tw-duration-200 group-hover:tw-translate-x-1"
          />
        </span>
      </div>
    </button>
  );
}
