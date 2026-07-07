"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

// Create/edit forms render as modal-style pages on a dæmpet baggrund — men MED
// navbar: uden den er man på mobil fanget uden anden vej væk end browser-back
// (QA-fund). Kun /login er helt chromeless.
// Matches /…/new, /…/edit and id-scoped /…/{id}/settings — but NOT the
// top-level /settings (Generelt).
const FORM_ROUTE = /\/(new|edit)(\/|$)|\/\d+\/settings\/?$/;

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return <div className="form-page">{children}</div>;
  }
  if (FORM_ROUTE.test(pathname)) {
    return (
      <>
        <Navbar />
        <div className="app-main form-page form-page--chrome">{children}</div>
      </>
    );
  }
  return (
    <>
      <Navbar />
      <div className="app-main">{children}</div>
    </>
  );
}
