import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaBolt,
  FaCommentDots,
  FaHeadset,
  FaSearch,
  FaShieldAlt,
  FaTruck,
} from "react-icons/fa";

import Reveal from "../components/Reveal";
import ProductCard from "../components/ProductCard";
import ProductDetailModal from "../components/ProductDetailModal";
import { useProductCatalog } from "../hooks/useProductCatalog";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { productSearchText } from "../utils/productDisplay";
import heroImage from "../../assets/hero.png";
import rasiLogo from "../../assets/rasi.png";

const WHY_US = [
  {
    icon: FaTruck,
    title: "Fast Delivery",
    description: "Reliable dispatch across regions so your projects never wait on supply.",
  },
  {
    icon: FaShieldAlt,
    title: "Quality Products",
    description: "Sourced from trusted, industry-certified brands you already know.",
  },
  {
    icon: FaHeadset,
    title: "Expert Support",
    description: "A sales team that understands welding, not just order forms.",
  },
  {
    icon: FaCommentDots,
    title: "AI Assistant",
    description: "Instant product guidance and quotations, day or night.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Ask",
    description: "Tell our AI assistant what you're working on — material, process, or product name.",
  },
  {
    step: "02",
    title: "Receive Recommendations",
    description: "Get tailored product suggestions matched to your exact requirement.",
  },
  {
    step: "03",
    title: "Connect with Sales",
    description: "Generate a quotation instantly or get routed to our sales team for the rest.",
  },
];

export default function Home() {
  useDocumentMeta(
    "Aadrik Distributors Pvt. Ltd. | RASI Electrodes & Welding Consumables Supplier",
    "Aadrik Distributors Pvt. Ltd. is a Chennai-based supplier of RASI Electrodes, welding consumables, MIG/TIG wire, abrasives, and industrial safety products, with an AI assistant for instant product guidance and quotations."
  );

  const { catalog, loading, error } = useProductCatalog();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [activeProduct, setActiveProduct] = useState(null);

  const categories = ["All", ...(catalog?.categories || [])];

  const filteredProducts = useMemo(() => {
    if (!catalog) return [];

    return catalog.products.filter((product) => {
      const matchesCategory = category === "All" || product.category === category;
      const matchesSearch = productSearchText(product).includes(search.trim().toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [catalog, search, category]);

  return (
    <>
      {/* Hero */}
      <section className="tw-relative tw-overflow-hidden tw-bg-aadrik-ombre-diag">
        <div className="tw-mx-auto tw-grid tw-max-w-7xl tw-grid-cols-1 tw-items-center tw-gap-12 tw-px-6 tw-py-24 lg:tw-grid-cols-2 lg:tw-px-10 lg:tw-py-32">
          <div>
            <Reveal>
              <h1 className="tw-text-4xl tw-font-extrabold tw-leading-[1.1] tw-text-white sm:tw-text-5xl lg:tw-text-6xl">
                Industrial Welding Solutions,
                <br />
                Powered by AI
              </h1>
            </Reveal>

            <Reveal delay={120}>
              <p className="tw-mt-6 tw-max-w-lg tw-text-lg tw-leading-relaxed tw-text-white/70">
                Helping customers choose the right products, generate quotations, and
                connect instantly with our sales team.
              </p>
              <p className="tw-mt-3 tw-max-w-lg tw-text-sm tw-font-medium tw-text-white/60">
                Stockists of RASI Electrodes and other trusted welding brands.
              </p>
            </Reveal>

            <Reveal delay={220}>
              <div className="tw-mt-10 tw-flex tw-flex-col tw-gap-4 sm:tw-flex-row">
                <Link
                  to="/assistant"
                  className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-full tw-bg-white tw-px-7 tw-py-3.5 tw-text-sm tw-font-semibold tw-text-aadrik-charcoal tw-shadow-aadrik-lift tw-transition-transform tw-duration-200 hover:tw-scale-[1.03]"
                >
                  Talk to AI
                </Link>
                <Link
                  to="/products"
                  className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-full tw-border tw-border-white/30 tw-px-7 tw-py-3.5 tw-text-sm tw-font-semibold tw-text-white tw-transition-colors tw-duration-200 hover:tw-bg-white/10"
                >
                  Browse Products
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={160} className="tw-relative tw-flex tw-justify-center">
            <div className="tw-relative tw-animate-float">
              <img
                src={heroImage}
                alt=""
                aria-hidden="true"
                className="tw-w-64 tw-drop-shadow-2xl sm:tw-w-80 lg:tw-w-96"
              />
              <img
                src={rasiLogo}
                alt="RASI Electrodes"
                className="tw-absolute tw-left-1/2 tw-top-[31%] tw-w-[67%] tw-h-auto tw--translate-x-1/2 tw--translate-y-1/2 tw-drop-shadow-[0_0_14px_rgba(255,60,90,0.65)]"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* About */}
      <section className="tw-mx-auto tw-max-w-5xl tw-px-6 tw-py-24 tw-text-center lg:tw-px-10">
        <Reveal>
          <p className="tw-text-sm tw-font-semibold tw-uppercase tw-tracking-widest tw-text-aadrik-wine">
            About Us
          </p>
          <h2 className="tw-mt-4 tw-text-3xl tw-font-bold tw-text-aadrik-charcoal sm:tw-text-4xl">
            Trusted by fabricators and workshops for decades
          </h2>
          <p className="tw-mx-auto tw-mt-6 tw-max-w-3xl tw-text-lg tw-leading-relaxed tw-text-aadrik-charcoal/60">
            Aadrik Distributors Pvt. Ltd. supplies welding electrodes, wires, machines,
            cutting equipment and safety gear to industrial customers nationwide. Today,
            we're pairing that expertise with an AI assistant that helps every customer
            find the right product in seconds, not days.
          </p>
        </Reveal>
      </section>

      {/* Products */}
      <section className="tw-bg-aadrik-cream/40 tw-py-24">
        <div className="tw-mx-auto tw-max-w-7xl tw-px-6 lg:tw-px-10">
          <Reveal className="tw-text-center">
            <p className="tw-text-sm tw-font-semibold tw-uppercase tw-tracking-widest tw-text-aadrik-wine">
              Catalog
            </p>
            <h2 className="tw-mt-4 tw-text-3xl tw-font-bold tw-text-aadrik-charcoal sm:tw-text-4xl">
              Explore Our Products
            </h2>
          </Reveal>

          <Reveal delay={100}>
            <div className="tw-mx-auto tw-mt-10 tw-flex tw-max-w-3xl tw-flex-col tw-gap-4 sm:tw-flex-row">
              <div className="tw-relative tw-flex-1">
                <FaSearch className="tw-pointer-events-none tw-absolute tw-left-4 tw-top-1/2 tw--translate-y-1/2 tw-text-aadrik-charcoal/30" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products or brands..."
                  className="tw-w-full tw-rounded-full tw-border tw-border-aadrik-charcoal/10 tw-bg-white tw-py-3 tw-pl-11 tw-pr-4 tw-text-sm tw-text-aadrik-charcoal tw-outline-none tw-transition-shadow tw-duration-200 focus:tw-shadow-aadrik-card"
                />
              </div>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="tw-rounded-full tw-border tw-border-aadrik-charcoal/10 tw-bg-white tw-px-4 tw-py-3 tw-text-sm tw-text-aadrik-charcoal tw-outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </Reveal>

          {loading && (
            <p className="tw-mt-12 tw-text-center tw-text-aadrik-charcoal/50">
              Loading products...
            </p>
          )}

          {error && (
            <p className="tw-mt-12 tw-text-center tw-text-aadrik-wine">{error}</p>
          )}

          {!loading && !error && (
            <>
              <div className="tw-mt-12 tw-grid tw-grid-cols-1 tw-gap-6 sm:tw-grid-cols-2 lg:tw-grid-cols-3">
                {filteredProducts.slice(0, 6).map((product, i) => (
                  <Reveal key={product.id} delay={i * 60}>
                    <ProductCard product={product} onViewDetails={setActiveProduct} />
                  </Reveal>
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <p className="tw-mt-12 tw-text-center tw-text-aadrik-charcoal/50">
                  No products match your search.
                </p>
              )}
            </>
          )}

          <Reveal className="tw-mt-12 tw-text-center">
            <Link
              to="/products"
              className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-full tw-bg-aadrik-ombre tw-px-7 tw-py-3.5 tw-text-sm tw-font-semibold tw-text-white tw-shadow-aadrik-card tw-transition-transform tw-duration-200 hover:tw-scale-[1.03]"
            >
              View Full Catalog
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="tw-mx-auto tw-max-w-7xl tw-px-6 tw-py-24 lg:tw-px-10">
        <Reveal className="tw-text-center">
          <p className="tw-text-sm tw-font-semibold tw-uppercase tw-tracking-widest tw-text-aadrik-wine">
            Why Choose Us
          </p>
          <h2 className="tw-mt-4 tw-text-3xl tw-font-bold tw-text-aadrik-charcoal sm:tw-text-4xl">
            Built for people who build things
          </h2>
        </Reveal>

        <div className="tw-mt-14 tw-grid tw-grid-cols-1 tw-gap-8 sm:tw-grid-cols-2 lg:tw-grid-cols-4">
          {WHY_US.map((item, i) => (
            <Reveal key={item.title} delay={i * 80} className="tw-text-center">
              <div className="tw-mx-auto tw-flex tw-h-14 tw-w-14 tw-items-center tw-justify-center tw-rounded-2xl tw-bg-aadrik-ombre tw-text-white tw-shadow-aadrik-card">
                <item.icon size={22} />
              </div>
              <h3 className="tw-mt-5 tw-text-lg tw-font-bold tw-text-aadrik-charcoal">
                {item.title}
              </h3>
              <p className="tw-mt-2 tw-text-sm tw-leading-relaxed tw-text-aadrik-charcoal/60">
                {item.description}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How the AI Works */}
      <section className="tw-bg-aadrik-charcoal tw-py-24">
        <div className="tw-mx-auto tw-max-w-7xl tw-px-6 lg:tw-px-10">
          <Reveal className="tw-text-center">
            <p className="tw-text-sm tw-font-semibold tw-uppercase tw-tracking-widest tw-text-aadrik-wineLight">
              How It Works
            </p>
            <h2 className="tw-mt-4 tw-text-3xl tw-font-bold tw-text-white sm:tw-text-4xl">
              From question to quotation in three steps
            </h2>
          </Reveal>

          <div className="tw-mt-16 tw-grid tw-grid-cols-1 tw-gap-10 lg:tw-grid-cols-3">
            {HOW_IT_WORKS.map((item, i) => (
              <Reveal key={item.step} delay={i * 100} className="tw-relative">
                <span className="tw-font-display tw-text-6xl tw-font-bold tw-text-white/10">
                  {item.step}
                </span>
                <h3 className="tw-mt-2 tw-text-xl tw-font-bold tw-text-white">
                  {item.title}
                </h3>
                <p className="tw-mt-3 tw-text-sm tw-leading-relaxed tw-text-white/60">
                  {item.description}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Request a Quotation CTA */}
      <section className="tw-mx-auto tw-max-w-7xl tw-px-6 tw-py-24 lg:tw-px-10">
        <Reveal>
          <div className="tw-flex tw-flex-col tw-items-center tw-gap-8 tw-rounded-3xl tw-bg-aadrik-ombre-diag tw-px-8 tw-py-16 tw-text-center tw-shadow-aadrik-lift">
            <FaBolt className="tw-text-3xl tw-text-white/80" />
            <h2 className="tw-max-w-2xl tw-text-3xl tw-font-bold tw-text-white sm:tw-text-4xl">
              Ready to get a quotation for your next project?
            </h2>
            <p className="tw-max-w-xl tw-text-white/70">
              Tell us what you need and we'll get pricing back to you fast — no back and
              forth required.
            </p>
            <Link
              to="/contact"
              className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-full tw-bg-white tw-px-8 tw-py-3.5 tw-text-sm tw-font-semibold tw-text-aadrik-charcoal tw-transition-transform tw-duration-200 hover:tw-scale-[1.03]"
            >
              Request Quote
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Contact */}
      <section className="tw-bg-aadrik-cream/40 tw-py-24">
        <div className="tw-mx-auto tw-grid tw-max-w-6xl tw-grid-cols-1 tw-gap-12 tw-px-6 lg:tw-grid-cols-2 lg:tw-px-10">
          <Reveal>
            <p className="tw-text-sm tw-font-semibold tw-uppercase tw-tracking-widest tw-text-aadrik-wine">
              Contact
            </p>
            <h2 className="tw-mt-4 tw-text-3xl tw-font-bold tw-text-aadrik-charcoal">
              We're here to help
            </h2>
            <dl className="tw-mt-8 tw-space-y-5 tw-text-sm">
              <div>
                <dt className="tw-font-semibold tw-text-aadrik-charcoal">Phone</dt>
                <dd className="tw-text-aadrik-charcoal/60">+91 99401 16155</dd>
              </div>
              <div>
                <dt className="tw-font-semibold tw-text-aadrik-charcoal">Email</dt>
                <dd className="tw-text-aadrik-charcoal/60">ea@aadrik.co.in</dd>
              </div>
              <div>
                <dt className="tw-font-semibold tw-text-aadrik-charcoal">Address</dt>
                <dd className="tw-text-aadrik-charcoal/60">
                  79C, Nattupilliar Koil Street, Maskan Chavadi, Seven Wells South,
                  George Town, Chennai, Tamil Nadu 600001, India
                </dd>
              </div>
            </dl>
          </Reveal>

          <Reveal delay={120}>
            <div className="tw-h-full tw-min-h-[280px] tw-overflow-hidden tw-rounded-2xl tw-border tw-border-aadrik-charcoal/10 tw-bg-white">
              <iframe
                title="Aadrik Distributors location"
                src="https://maps.google.com/maps?q=79C%2C%20Nattupilliar%20Koil%20Street%2C%20Maskan%20Chavadi%2C%20Seven%20Wells%20South%2C%20George%20Town%2C%20Chennai%2C%20Tamil%20Nadu%20600001%2C%20India&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: 280 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </Reveal>
        </div>
      </section>

      <ProductDetailModal product={activeProduct} onClose={() => setActiveProduct(null)} />
    </>
  );
}
