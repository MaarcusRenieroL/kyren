import { BoardSkeleton, PageSkeleton } from "@kyren/ui/components/skeletons";

export default function Loading() {
  return (
    <PageSkeleton toolbar>
      <BoardSkeleton />
    </PageSkeleton>
  );
}
