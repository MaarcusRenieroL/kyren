import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { orgWithMember } from "./people-helpers";

const channelName = (label: string) => `${label}-${randomUUID().slice(0, 6)}`;

async function createChannel(
  page: Page,
  name: string,
  visibility: "Public" | "Private",
) {
  await page.goto("/chat");
  await page.getByRole("button", { name: "New channel" }).click();

  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("radio", { name: new RegExp(visibility) }).click();
  await dialog.getByRole("button", { name: "Create channel" }).click();
  await expect(page).toHaveURL(new RegExp(`/chat/${name}$`));
}

async function post(page: Page, name: string, text: string) {
  const composer = page.getByLabel(`Message #${name}`);

  await composer.fill(text);
  await composer.press("Enter");
  await expect(page.getByText(text)).toBeVisible();
}

test("a public channel carries messages between colleagues @chat", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "chat");
  const name = channelName("launch");

  await createChannel(page, name, "Public");
  await post(page, name, "Launch checklist is up.");

  await team.member.goto(`/chat/${name}`);
  await expect(team.member.getByText("Launch checklist is up.")).toBeVisible();
  await post(team.member, name, "On it.");

  await page.reload();
  await expect(page.getByText("On it.")).toBeVisible();

  await team.close();
});

test("a private channel stays out of reach for people not in it @chat", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "chat-private");
  const name = channelName("exec");

  await createChannel(page, name, "Private");
  await post(page, name, "Board meeting notes.");

  await team.member.goto(`/chat/${name}`);
  await expect(team.member.getByText("Board meeting notes.")).toHaveCount(0);
  await expect(team.member.getByLabel(`Message #${name}`)).toHaveCount(0);

  await team.close();
});
