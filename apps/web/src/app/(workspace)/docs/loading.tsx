import {
  CardGridSkeleton,
  ListSkeleton,
  PageSkeleton,
} from "@kyren/ui/components/skeletons";

export default function Loading() {
  return (
    <PageSkeleton toolbar>
      <CardGridSkeleton cards={4} className="xl:grid-cols-4" />
      <ListSkeleton rows={6} />
    </PageSkeleton>
  );
}
