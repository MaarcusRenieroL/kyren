import { PricingPage } from "./template/pricing/pricing-page";
import { RoadmapPage, ChangelogPage, AboutPage, StatusPage, SecurityPage } from "./template/product-information";
// Generated from the Zentro site design (Zentro Site Page).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SiteHeader } from "./template/header";
import { SiteMobileMenu } from "./template/mobile-menu";
import { SiteCloseSection } from "./template/close-section";
import { SiteFooter } from "./template/footer";
import { ModulesPage } from "./template/modules/modules-page";
import { ModuleDetailPage } from "./template/module-detail/module-detail-page";
import { LegalPage } from "./template/legal/legal-page";

export function SiteTemplate({ v }: { v: any }) {
  const {
    rootRef,
    rootClass,
    rootStyle,
    showNav,
    showMain,
    lineRef,
    track,
    fill,
    pg,
    showClose,
    showFooter,
  } = v;

  return (
    <div ref={rootRef} className={rootClass} style={rootStyle}>
      {showNav ? <SiteHeader v={v} /> : null}
      <SiteMobileMenu v={v} />
      {showMain ? (
        <main style={{ position: "relative" }}>
          <div
            ref={lineRef}
            style={{
              position: "absolute",
              left: "calc(var(--tx) - 0.75px)",
              top: "calc(var(--heroT) + 8px)",
              bottom: "0",
              width: "1.5px",
            }}
          >
            <div style={track}></div>
            <div style={fill}></div>
          </div>
          {pg.pricing ? <PricingPage /> : null}
          {pg.modules ? <ModulesPage v={v} /> : null}
          {pg.module ? <ModuleDetailPage v={v} /> : null}
          {pg.roadmap ? <RoadmapPage /> : null}
          {pg.security ? <SecurityPage /> : null}
          {pg.changelog ? <ChangelogPage /> : null}
          {pg.legal ? <LegalPage v={v} /> : null}
          {pg.about ? <AboutPage /> : null}
          {pg.status ? <StatusPage /> : null}
        </main>
      ) : null}
      {showClose ? <SiteCloseSection v={v} /> : null}
      {showFooter ? <SiteFooter v={v} /> : null}
    </div>
  );
}
