export type ProjectData = {
  name: string;
  slug: string;
  description: string | null;
  teamId: string | null;
  teamName: string | null;
  teamColor: string | null;
  status: string;
  owner: string;
  taskKeyPrefix?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TeamOption = {
  id: string;
  name: string;
  color: string;
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
};
