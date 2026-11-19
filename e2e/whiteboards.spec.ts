import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { query, registerWithOrganization, uniqueName } from "./helpers";
import { orgWithMember } from "./people-helpers";

/** Drags out a shape with a tool, right of the style panel on the left. */
async function drawWith(
  page: Page,
  tool: string,
  from: [number, number],
  size: [number, number] = [140, 90],
) {
  const canvas = page.getByLabel("Whiteboard canvas");
  const box = (await canvas.boundingBox())!;

  await page.getByRole("button", { name: tool, exact: true }).click();
  await page.mouse.move(box.x + from[0], box.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + from[0] + size[0], box.y + from[1] + size[1], {
    steps: 6,
  });
  await page.mouse.up();
}

type Stored = {
  id: string;
  type: string;
  fill?: string;
  text?: string;
  start?: { id: string };
  end?: { id: string };
};

/** Live (not deleted) shapes stored for a board. */
const stored = async (boardId: string) =>
  (
    await query<{ el: Stored }>(
      `select e as el from whiteboard w, jsonb_array_elements(w.elements) e
        where w.id = $1 and coalesce((e ->> 'deleted')::boolean, false) = false`,
      [boardId],
    )
  ).map((row) => row.el);

async function newBoard(page: Page, title: string) {
  await page.goto("/whiteboards");
  page.once("dialog", (dialog) => void dialog.accept(title));
  await page.getByRole("button", { name: "New board" }).first().click();
  await expect(page).toHaveURL(/\/whiteboards\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Whiteboard canvas")).toBeVisible();

  return page.url().split("/").pop()!;
}

test("a board is drawn on, styled, saved, and survives a reload @whiteboards", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "boards",
    orgName: uniqueName("Boards org"),
  });

  const title = uniqueName("Plan board");
  const boardId = await newBoard(page, title);

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await drawWith(page, "Rectangle", [360, 160]);
  await expect.poll(async () => (await stored(boardId)).length).toBe(1);

  // The new shape is selected: a fill applies to it.
  await page
    .getByRole("complementary", { name: "Style" })
    .getByRole("button", { name: "Fill #bde0fe" })
    .click();
  await expect
    .poll(async () => (await stored(boardId))[0]?.fill)
    .toBe("#bde0fe");
  await expect(page.getByRole("status")).toHaveText("Saved");

  await page.reload();
  await expect(page.getByLabel("Whiteboard canvas")).toBeVisible();
  expect(await stored(boardId)).toHaveLength(1);

  await page.goto("/whiteboards");
  await expect(
    page.getByRole("link", { name: new RegExp(title) }),
  ).toBeVisible();
});

test("an arrow drawn between two shapes stays attached to both @whiteboards", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "boards-arrow",
    orgName: uniqueName("Boards arrow org"),
  });

  const boardId = await newBoard(page, uniqueName("Flow board"));

  await drawWith(page, "Rectangle", [340, 120]);
  await drawWith(page, "Ellipse", [700, 320]);
  // From the middle of the rectangle to the middle of the ellipse.
  await drawWith(page, "Arrow", [410, 165], [360, 200]);

  await expect
    .poll(async () => {
      const shapes = await stored(boardId);
      const arrow = shapes.find((el) => el.type === "arrow");
      const ids = new Set(shapes.map((el) => el.id));

      return Boolean(
        arrow?.start &&
        arrow.end &&
        ids.has(arrow.start.id) &&
        ids.has(arrow.end.id),
      );
    })
    .toBe(true);
});

test("double-clicking empty space writes text there @whiteboards", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "boards-text",
    orgName: uniqueName("Boards text org"),
  });

  const boardId = await newBoard(page, uniqueName("Notes board"));
  const box = (await page.getByLabel("Whiteboard canvas").boundingBox())!;

  await page.mouse.dblclick(box.x + 500, box.y + 300);
  await page.getByLabel("Shape text").fill("Ship on Friday");
  await page.getByLabel("Shape text").press("Escape");

  await expect
    .poll(async () => (await stored(boardId)).map((el) => el.text))
    .toEqual(["Ship on Friday"]);
});

test("a comment pinned to the board keeps its text and author @whiteboards", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "boards-comment",
    orgName: uniqueName("Boards comment org"),
  });

  const boardId = await newBoard(page, uniqueName("Review board"));
  const box = (await page.getByLabel("Whiteboard canvas").boundingBox())!;

  await page.getByRole("button", { name: "Comment", exact: true }).click();
  await page.mouse.click(box.x + 600, box.y + 300);
  await page.getByLabel("Shape text").fill("Can we make this bigger?");
  await page.getByLabel("Shape text").press("Escape");

  await expect
    .poll(async () =>
      (await stored(boardId))
        .filter((el) => el.type === "comment")
        .map((el) => [el.text, Boolean((el as { author?: string }).author)]),
    )
    .toEqual([["Can we make this bigger?", true]]);
});

test("a template adds its frames and notes in one go, and Present walks them @whiteboards", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "boards-template",
    orgName: uniqueName("Boards template org"),
  });

  const boardId = await newBoard(page, uniqueName("Retro board"));

  await page.getByRole("button", { name: "Templates" }).click();
  await page.getByRole("button", { name: /Retrospective/ }).click();

  await expect
    .poll(
      async () =>
        (await stored(boardId)).filter((el) => el.type === "frame").length,
    )
    .toBe(3);

  await page.getByRole("button", { name: "Present" }).click();
  await expect(page.getByText(/Went well · 1 of 3/)).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText(/To improve · 2 of 3/)).toBeVisible();
  await page.getByRole("button", { name: "Stop presenting" }).click();
});

test("two people drawing at the same time both keep their shapes @whiteboards", async ({
  page,
  browser,
}) => {
  const team = await orgWithMember(browser, page, "boards-together");
  const boardId = await newBoard(page, uniqueName("Shared board"));

  await team.member.goto(`/whiteboards/${boardId}`);
  await expect(team.member.getByLabel("Whiteboard canvas")).toBeVisible();

  await Promise.all([
    drawWith(page, "Rectangle", [360, 140]),
    drawWith(team.member, "Ellipse", [700, 360]),
  ]);

  await expect.poll(async () => (await stored(boardId)).length).toBe(2);
  // Each editor takes in the other's shape too.
  await expect.poll(() => page.getByTestId("shape-ellipse").count()).toBe(1);

  // The member's pointer shows on the owner's board, with their name.
  const box = (await team.member
    .getByLabel("Whiteboard canvas")
    .boundingBox())!;

  await team.member.mouse.move(box.x + 520, box.y + 260);
  await team.member.mouse.move(box.x + 540, box.y + 280);
  await expect(
    page.getByLabel("Whiteboard canvas").getByText(team.memberName),
  ).toBeVisible({ timeout: 10_000 });

  // "?" lists the keyboard shortcuts.
  await page.keyboard.press("?");
  await expect(
    page.getByRole("dialog", { name: "Keyboard shortcuts" }),
  ).toBeVisible();

  await team.close();
});

test("a deleted board goes to the trash and can be restored @whiteboards", async ({
  page,
}) => {
  await registerWithOrganization(page, {
    label: "boards-trash",
    orgName: uniqueName("Boards trash org"),
  });

  const title = uniqueName("Old plan");

  await page.goto("/whiteboards");
  page.once("dialog", (dialog) => void dialog.accept(title));
  await page.getByRole("button", { name: "New board" }).first().click();
  await expect(page).toHaveURL(/\/whiteboards\/[0-9a-f-]{36}$/);

  await page.goto("/whiteboards");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: `Delete ${title}` }).click();

  const trash = page.getByRole("region", { name: "Trash" });

  await expect(trash.getByText(title)).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(title) })).toHaveCount(
    0,
  );

  await trash.getByRole("button", { name: `Restore ${title}` }).click();
  await expect(
    page.getByRole("link", { name: new RegExp(title) }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Trash" })).toHaveCount(0);
});
