import { JSX } from "react";

import { LandingPage } from "../components/landing-page/landing-page";

// Signed-in visitors are redirected to the dashboard by the proxy before this
// page is served. Keeping the page free of headers()/cookies() lets it be
// prerendered and cached at the edge.
export default function Home(): JSX.Element {
  return <LandingPage />;
}
