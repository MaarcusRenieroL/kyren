/**
 * The legal documents shown on the site. "We" is whoever operates this Kyren
 * installation; "the workspace owner" is the organization that signed up.
 * Have them reviewed by a lawyer for your jurisdiction before charging.
 */
export const LEGAL: Record<
  string,
  {
    tab: string;
    pre: string;
    em: string;
    post: string;
    secs: Array<{ t: string; paras: string[] }>;
  }
> = {
  privacy: {
    tab: "Privacy",
    pre: "Privacy ",
    em: "policy",
    post: ".",
    secs: [
      {
        t: "Who we are",
        paras: [
          "This policy covers the Kyren service run by the operator named on our About page (“we”). For the work an organization puts into its workspace — projects, tasks, docs, messages, files, HR and payroll records — the organization is the controller and we process that data on its behalf under our Data Processing Agreement. For your account itself (name, email, sign-in), we are the controller.",
        ],
      },
      {
        t: "What we collect",
        paras: [
          "Account data: your name, email address, a hashed password (never the password itself), two-factor settings and the organizations you belong to.",
          "Workspace content: whatever you and your colleagues create or upload. Some fields, such as private reasons for time off and bank details, are encrypted in the database with a key kept separately from it.",
          "Technical data: your IP address and browser for sign-in security, rate limiting and the audit log; the time and type of changes you make, which your organization's administrators can see in the audit log.",
          "We do not use advertising trackers and we do not sell or rent personal data.",
        ],
      },
      {
        t: "How we use it",
        paras: [
          "To run the service: signing you in, showing your workspace, sending the emails you ask for (verification, password reset, invitations, notifications) and keeping the service secure.",
          "To protect the service: detecting abuse, limiting repeated sign-in attempts and keeping an audit trail your organization can review.",
          "Optional AI features send the relevant text (for example a ticket or meeting notes) to our AI provider only when an administrator has turned AI on for the organization, and only for the feature being used.",
        ],
      },
      {
        t: "Who we share it with",
        paras: [
          "Only the subprocessors listed on our Subprocessors page, each for one purpose: hosting, email delivery, backups and, if switched on, AI. They are bound to protect the data and use it only for that purpose.",
          "We disclose data to authorities only when the law requires it, and we tell the affected organization unless we are forbidden to.",
        ],
      },
      {
        t: "How long we keep it",
        paras: [
          "Workspace content is kept while the organization uses Kyren and according to the retention settings its administrators choose. Items moved to the trash can be restored until they are deleted for good.",
          "When an organization is deleted, its data is removed after a short grace period. Encrypted backups are kept for 14 days and then deleted, so deleted data leaves the backups within that time.",
        ],
      },
      {
        t: "Your rights",
        paras: [
          "You can download a copy of your data and ask for it to be erased from Settings → Account → Security. Administrators can export or erase a member's data on request.",
          "Depending on where you live you may also have rights to correct, restrict or object to processing and to complain to a data protection authority. For workspace content, contact your organization first, as it decides what is kept; we will help it respond.",
        ],
      },
      {
        t: "Cookies",
        paras: [
          "We use only the cookies needed to keep you signed in and secure, and to remember choices such as the theme. See the Cookie policy.",
        ],
      },
      {
        t: "Contact",
        paras: [
          "Questions about privacy, or a request about your data: use the contact details on our About page. We answer within 30 days.",
        ],
      },
    ],
  },
  terms: {
    tab: "Terms",
    pre: "Terms of ",
    em: "service",
    post: ".",
    secs: [
      {
        t: "Agreement",
        paras: [
          "By creating an account or using Kyren you agree to these terms. If you use it for an organization, you confirm you may accept them on its behalf; the organization is then responsible for how its members use the service.",
        ],
      },
      {
        t: "Your account",
        paras: [
          "Keep your sign-in details safe and turn on two-factor authentication. You are responsible for what happens under your account. Tell us at once if you think it has been misused.",
          "The workspace owner controls the organization: who is a member, what roles they have and which modules are on.",
        ],
      },
      {
        t: "Acceptable use",
        paras: [
          "Do not use Kyren to break the law, to send spam or malware, to harass anyone, to infringe others' rights, or to try to reach data that is not yours, including by probing or overloading the service. We may suspend an account or workspace that does, and will tell the owner why unless the law forbids it.",
        ],
      },
      {
        t: "Plans and payment",
        paras: [
          "Plans, prices and any limits are the ones shown when you sign up or in your agreement with us. If we change them for an existing workspace we will give at least 30 days' notice. The content you put in Kyren stays yours; you give us only the rights needed to run the service for you.",
        ],
      },
      {
        t: "Ending the agreement",
        paras: [
          "You can stop using Kyren and delete your organization at any time from its settings, after exporting what you need. We may end the service for a workspace with 30 days' notice, or at once for serious breaches of these terms. After an organization is deleted its data is removed as described in the Privacy policy.",
        ],
      },
      {
        t: "Liability",
        paras: [
          "We work to keep Kyren available, secure and backed up, but the service is provided as it is, without a promise that it will never be interrupted or error-free. To the extent the law allows, we are not liable for indirect or consequential losses, and our total liability is limited to the amount the organization paid us in the twelve months before the claim. Nothing here limits liability that cannot be limited by law.",
          "Payroll and HR features help you keep records; they are not tax, legal or accounting advice, and you remain responsible for the figures you pay and report.",
        ],
      },
      {
        t: "Changes to these terms",
        paras: [
          "We may update these terms. We will announce material changes in the product or by email at least 30 days before they apply; continuing to use Kyren after that means you accept them.",
        ],
      },
      {
        t: "Contact",
        paras: [
          "Questions about these terms: use the contact details on our About page.",
        ],
      },
    ],
  },
  cookies: {
    tab: "Cookies",
    pre: "Cookie ",
    em: "policy",
    post: ".",
    secs: [
      {
        t: "What cookies are",
        paras: [
          "Cookies are small files a site stores in your browser. Similar storage in the browser (local storage) is covered here too.",
        ],
      },
      {
        t: "Cookies we use",
        paras: [
          "Sign-in: a session cookie that keeps you signed in and the active organization you chose. It is essential; Kyren cannot work without it.",
          "Security: short-lived cookies for two-factor sign-in and protection against forged requests.",
          "Preferences: your theme and a few interface choices, kept in your browser.",
          "We use no advertising, analytics or third-party tracking cookies.",
        ],
      },
      {
        t: "Managing cookies",
        paras: [
          "You can delete or block cookies in your browser settings. Blocking the essential ones signs you out and stops Kyren from working.",
        ],
      },
      {
        t: "Changes to this policy",
        paras: [
          "If we add a new kind of cookie we will update this page first, and ask for your consent where the law requires it.",
        ],
      },
      {
        t: "Contact",
        paras: ["Questions: use the contact details on our About page."],
      },
    ],
  },
  dpa: {
    tab: "DPA",
    pre: "Data processing ",
    em: "agreement",
    post: ".",
    secs: [
      {
        t: "Roles",
        paras: [
          "This agreement applies when an organization (the controller) uses Kyren and we process personal data in its workspace on its behalf (as processor). It forms part of the Terms of service.",
        ],
      },
      {
        t: "What we process and why",
        paras: [
          "Subject matter: the data the organization and its members put into Kyren — names, contact details, work content, messages, files, and where the HR and Payroll modules are used, employment and pay records. Purpose: providing the service as the organization configures it. Duration: as long as the organization uses Kyren, then deletion as below.",
        ],
      },
      {
        t: "Our commitments",
        paras: [
          "We process the data only on the organization's documented instructions — which include its use of the product and its settings — and tell it if we believe an instruction breaks data protection law.",
          "Everyone with access to the data is bound to confidentiality. We do not use the data for our own purposes.",
        ],
      },
      {
        t: "Security measures",
        paras: [
          "Encryption in transit (HTTPS) everywhere; sensitive fields encrypted at rest with a separately held key; encrypted off-site backups; role-based access with organization isolation; two-factor sign-in; rate limits; an audit log of administrative and data changes; network allow-lists per organization.",
        ],
      },
      {
        t: "Subprocessors",
        paras: [
          "The organization authorizes the subprocessors on our Subprocessors page. We give at least 30 days' notice of a new one, during which the organization may object; if we cannot address the objection, it may end the service.",
        ],
      },
      {
        t: "Helping the controller",
        paras: [
          "Kyren's export, erase, retention and audit tools let the organization answer data subject requests itself; we assist where they are not enough. We help with impact assessments and consultations where reasonably needed.",
        ],
      },
      {
        t: "Breaches",
        paras: [
          "We notify the organization without undue delay, and in any case within 48 hours of becoming aware of a personal data breach affecting its data, with what we know and what we are doing about it.",
        ],
      },
      {
        t: "Deletion and audits",
        paras: [
          "When the organization is deleted we delete its data from the live service after the grace period, and it leaves the encrypted backups within 14 days. On reasonable request we provide the information needed to show compliance with this agreement.",
        ],
      },
      {
        t: "International transfers",
        paras: [
          "Where a subprocessor processes data outside the organization's region, the transfer is covered by an adequacy decision or standard contractual clauses.",
        ],
      },
    ],
  },
  subprocessors: {
    tab: "Subprocessors",
    pre: "Sub",
    em: "processors",
    post: ".",
    secs: [
      {
        t: "Hosting",
        paras: [
          "The virtual machine provider named in our agreement with you: runs the application, the database and file storage. All workspace data.",
        ],
      },
      {
        t: "Email delivery — Resend",
        paras: [
          "Sends sign-in codes, password resets, invitations and notifications. Processes recipient addresses and the content of those emails.",
        ],
      },
      {
        t: "Backups",
        paras: [
          "The object storage provider named in our agreement: keeps the nightly backups. Backups are encrypted before they leave our server; the provider cannot read them.",
        ],
      },
      {
        t: "AI — Anthropic (only if switched on)",
        paras: [
          "Used only when an organization's administrator turns AI features on. Receives the text needed for the feature being used (for example a ticket or a meeting's notes). Not used to train models.",
        ],
      },
      {
        t: "Changes",
        paras: [
          "We update this list at least 30 days before a new subprocessor starts, as described in the Data processing agreement.",
        ],
      },
    ],
  },
};
