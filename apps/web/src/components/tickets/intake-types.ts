export type FieldType = "name" | "email" | "text" | "longtext" | "choice";

export type DraftField = {
  label: string;
  type: FieldType;
  required: boolean;
  options: string;
};

export type Draft = {
  id?: string;
  name: string;
  description: string;
  enabled: boolean;
  fields: DraftField[];
};

export type Form = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  token: string;
  fields: {
    label: string;
    type: FieldType;
    required: boolean;
    options?: string[];
  }[];
};

export const typeWords: Record<FieldType, string> = {
  name: "Requester name",
  email: "Requester email",
  text: "Short text (the subject)",
  longtext: "Long text",
  choice: "Choice",
};

export const blank = (): Draft => ({
  name: "",
  description: "",
  enabled: true,
  fields: [
    { label: "Your name", type: "name", required: true, options: "" },
    { label: "Your email", type: "email", required: true, options: "" },
    { label: "What is this about?", type: "text", required: true, options: "" },
    { label: "Details", type: "longtext", required: false, options: "" },
  ],
});
