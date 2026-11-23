// A realistic load test: people with Kyren open, polling the way the app
// does (notifications and chat every few seconds) and opening pages.
//
//   docker run --rm -i --network host -e BASE_URL=https://your-domain \
//     -e USERS=a@x.com,b@x.com -e PASSWORD=... -e VUS=50 \
//     grafana/k6 run - < deploy/loadtest/kyren.js
//
// Run it against staging or a copy, never against real customers' data.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:3000";
const USERS = (__ENV.USERS || "").split(",").filter(Boolean);
const PASSWORD = __ENV.PASSWORD || "";

export const options = {
  scenarios: {
    people: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: Number(__ENV.VUS || 50) },
        { duration: __ENV.HOLD || "2m", target: Number(__ENV.VUS || 50) },
        { duration: "15s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{kind:poll}": ["p(95)<500"],
    "http_req_duration{kind:page}": ["p(95)<1500"],
  },
};

const trpc = (path, input) =>
  `${BASE}/api/trpc/${path}?batch=1&input=${encodeURIComponent(
    JSON.stringify({ 0: { json: input ?? null } }),
  )}`;

// Signs every test user in once; each virtual person reuses one session.
export function setup() {
  return USERS.map((email) => {
    const jar = http.cookieJar();
    const res = http.post(
      `${BASE}/api/auth/sign-in/email`,
      JSON.stringify({ email, password: PASSWORD }),
      { headers: { "Content-Type": "application/json", Origin: BASE } },
    );

    check(res, { "signed in": (r) => r.status === 200 });

    return jar.cookiesForURL(BASE);
  });
}

export default function (sessions) {
  const cookies = sessions[(__VU - 1) % sessions.length];
  const jar = http.cookieJar();

  for (const [name, values] of Object.entries(cookies)) {
    jar.set(BASE, name, values[0]);
  }

  const page = (path) =>
    check(http.get(`${BASE}${path}`, { tags: { kind: "page" } }), {
      [`${path} ok`]: (r) => r.status === 200,
    });
  const poll = (path, input) =>
    check(http.get(trpc(path, input), { tags: { kind: "poll" } }), {
      [`${path} ok`]: (r) => r.status === 200,
    });

  page(["/dashboard", "/tasks", "/chat", "/docs", "/projects"][__ITER % 5]);

  for (let i = 0; i < 5; i++) {
    poll("notification.list");
    poll("chat.sidebar");
    sleep(3);
  }
}
