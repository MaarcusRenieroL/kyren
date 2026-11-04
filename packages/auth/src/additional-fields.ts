export const userAdditionalFields = {
  role: {
    type: ["member", "admin", "owner", "platform_admin"] as string[],
    required: true,
    defaultValue: "member",
    input: false,
  },
};
