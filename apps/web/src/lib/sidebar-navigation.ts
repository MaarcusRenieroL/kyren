export const sidebarSections = [
  { label: "Work", modules: ["dashboard", "tasks", "projects", "calendar"] },
  { label: "Knowledge", modules: ["docs", "files", "whiteboards"] },
  { label: "Communication", modules: ["chat", "mail", "tickets"] },
  { label: "People", modules: ["team", "hr", "payroll"] },
  { label: "Administration", modules: ["overview", "admin"] },
];

export function sidebarSectionLabel(id: string) {
  return (
    sidebarSections.find((section) => section.modules.includes(id))?.label ??
    "More"
  );
}
