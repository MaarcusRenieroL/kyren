import { Label } from "@kyren/ui/shadcn/label";
import { Checkbox } from "@kyren/ui/shadcn/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@kyren/ui/shadcn/select";
import Link from "next/link";
import { useState } from "react";
import { moduleRegistry } from "@kyren/modules";
import { Check } from "lucide-react";
import { workspaceAnnualRate, workspaceRate } from "../../workspace-pricing";
import s from "./pricing.module.css";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
function dollars(amount: number) {
  return usd.format(amount).replace(/\.00$/, "");
}

const serverRate = 24;
const snapshotRate = serverRate * 0.2;
const emailPlans = {
  free: {
    name: "Resend Free",
    rate: 0,
    limit: "3,000 emails per month, up to 100 per day",
  },
  pro: { name: "Resend Pro", rate: 20, limit: "50,000 emails per month" },
} as const;

export function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const licenseMonthly = annual ? workspaceAnnualRate / 12 : workspaceRate;
  const [snapshots, setSnapshots] = useState(true);
  const [email, setEmail] = useState<keyof typeof emailPlans>("free");
  const mail = emailPlans[email];
  const monthly =
    licenseMonthly + serverRate + (snapshots ? snapshotRate : 0) + mail.rate;
  return (
    <div className={s.page}>
      <header className={s.hero}>
        <h1>Self-hosted pricing</h1>
        <p>
          One subscription covers your whole workspace. Run Kyren on your own
          infrastructure and choose the modules your team uses.
        </p>
      </header>
      <div className={s.columns}>
        <section className={s.plan} aria-labelledby="workspace-plan">
          <h2 id="workspace-plan">Kyren workspace</h2>
          <Select
            value={annual ? "annual" : "monthly"}
            onValueChange={(value) => setAnnual(value === "annual")}
          >
            <SelectTrigger
              className={s.emailSelect}
              aria-label="Workspace billing period"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
          <p className={s.rate}>
            <strong>
              {dollars(annual ? workspaceAnnualRate : workspaceRate)}
            </strong>{" "}
            <span>USD / {annual ? "year" : "month"}</span>
          </p>
          <p>
            {annual
              ? `Paid annually. Save ${dollars(workspaceRate * 12 - workspaceAnnualRate)} per workspace per year.`
              : "Per workspace, billed monthly."}
          </p>
          <ul>
            {[
              `All ${moduleRegistry.length} workspace modules`,
              "No per-seat surcharge",
              "Organization, team and project permissions",
              "Self-hosted app with PostgreSQL",
            ].map((item) => (
              <li key={item}>
                <Check aria-hidden="true" size={16} />
                {item}
              </li>
            ))}
          </ul>
          <Link className={s.cta} href="/modules">
            Explore the modules <span aria-hidden="true">→</span>
          </Link>
        </section>
        <section className={s.estimate} aria-labelledby="estimate-title">
          <h2 id="estimate-title">Estimate your monthly cost</h2>
          <p>
            Example for one workspace on a DigitalOcean server, with PostgreSQL
            and uploaded files on the same machine.
          </p>
          <dl className={s.lines}>
            <div>
              <dt>
                Kyren subscription
                {annual && <small>Monthly equivalent of annual billing</small>}
              </dt>
              <dd>{dollars(licenseMonthly)}</dd>
            </div>
            <div>
              <dt>
                Basic Droplet<small>2 vCPUs · 4 GiB memory · 80 GiB SSD</small>
              </dt>
              <dd>{dollars(serverRate)}</dd>
            </div>
            <div>
              <dt>
                <Label>
                  <Checkbox
                    checked={snapshots}
                    onCheckedChange={(checked) =>
                      setSnapshots(checked === true)
                    }
                  />{" "}
                  Weekly VM backups
                </Label>
                <small>20% of the server price</small>
              </dt>
              <dd>{dollars(snapshots ? snapshotRate : 0)}</dd>
            </div>
            <div>
              <dt>
                <Label htmlFor="email-plan">Transactional email</Label>
                <Select
                  value={email}
                  onValueChange={(value) =>
                    setEmail(value === "pro" ? "pro" : "free")
                  }
                >
                  <SelectTrigger id="email-plan" className={s.emailSelect}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(emailPlans).map(([id, plan]) => (
                      <SelectItem key={id} value={id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <small>{mail.limit}</small>
              </dt>
              <dd>{dollars(mail.rate)}</dd>
            </div>
          </dl>
          <div className={s.total}>
            <span>Monthly estimate</span>
            <output aria-live="polite" aria-label="Estimated monthly cost">
              {dollars(monthly)} <small>USD</small>
            </output>
          </div>
          <p className={s.note}>
            The estimate excludes tax, domain registration, off-site database
            and file backups, and usage beyond the listed allowances.
          </p>
          <p className={s.sources}>
            Provider rates checked November 22, 2026.{" "}
            <a href="https://www.digitalocean.com/pricing/droplets">Server</a> ·{" "}
            <a href="https://docs.digitalocean.com/products/backups/details/pricing/">
              Backups
            </a>{" "}
            · <a href="https://resend.com/pricing">Email</a>
          </p>
        </section>
      </div>
    </div>
  );
}
