import {
  CardGridSkeleton,
  PageSkeleton,
} from "@kyren/ui/components/skeletons";

export default function Loading() {
  return (
    <PageSkeleton actions={false}>
      <CardGridSkeleton cards={6} />
    </PageSkeleton>
  );
}
