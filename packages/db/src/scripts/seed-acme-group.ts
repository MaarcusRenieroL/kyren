import { seedOrgAndTeams } from "./seed-acme/seed-org";
import { seedHr } from "./seed-acme/seed-hr";
import { seedPayroll } from "./seed-acme/seed-payroll";
import { seedSprints } from "./seed-acme/seed-sprints";
import { seedTasks } from "./seed-acme/seed-tasks";
import { seedGoals } from "./seed-acme/seed-goals";
import { seedKb } from "./seed-acme/seed-kb";
import { seedTickets } from "./seed-acme/seed-tickets";
import { seedChat } from "./seed-acme/seed-chat";
import { seedCalendar } from "./seed-acme/seed-calendar";
import { seedFiles } from "./seed-acme/seed-files";
import { seedWhiteboards } from "./seed-acme/seed-whiteboards";
import { seedMail } from "./seed-acme/seed-mail";
import { seedAdmin } from "./seed-acme/seed-admin";
import { seedActivity } from "./seed-acme/seed-activity";

async function main() {
  console.log("🚀 Starting Acme Group comprehensive mock data seeding...");

  const ctx = await seedOrgAndTeams();
  const empIdMap = await seedHr(ctx);
  await seedPayroll(ctx, empIdMap);
  const sprints = await seedSprints(ctx);
  await seedTasks(ctx, sprints);
  await seedGoals(ctx);
  await seedKb(ctx);
  await seedTickets(ctx);
  await seedChat(ctx);
  await seedCalendar(ctx);
  await seedFiles(ctx);
  await seedWhiteboards(ctx);
  await seedMail(ctx);
  await seedAdmin(ctx);
  await seedActivity(ctx);

  console.log(
    "\n✨ Acme Group comprehensive mock data seeding completed successfully! All 14 modules populated with realistic, interconnected data.",
  );
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
