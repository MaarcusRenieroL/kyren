export type DocComment = {
  id: string;
  parentId: string | null;
  body: string;
  authorName: string | null;
  authorEmail: string | null;
  authorImage: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  canEdit: boolean;
  canDelete: boolean;
};

/** Open threads and their replies; a resolved thread hides with its replies. */
export function openOnly(list: DocComment[]): DocComment[] {
  const open = new Set(
    list
      .filter((comment) => !comment.parentId && !comment.resolvedAt)
      .map((comment) => comment.id),
  );

  return list.filter((comment) => open.has(comment.parentId ?? comment.id));
}
