import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import logoWatermark from "../../assets/logo-watermark.png";

export default function PublicLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }, [pathname]);

  return (
    <div className="aadrik-site tw-min-h-screen tw-flex tw-flex-col">
      <div className="aadrik-watermark" aria-hidden="true">
        <img src={logoWatermark} alt="" />
      </div>
      <Navbar />
      <main className="tw-flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
