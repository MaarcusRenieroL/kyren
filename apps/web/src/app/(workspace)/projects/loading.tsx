import { ListSkeleton, PageSkeleton } from "@kyren/ui/components/skeletons";

export default function Loading() {
  return (
    <PageSkeleton toolbar>
      <ListSkeleton rows={7} />
    </PageSkeleton>
  );
}
