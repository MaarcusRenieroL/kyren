import { z } from "zod";
import {
  chatProcedure,
  filesProcedure,
  mailProcedure,
  storageCeiling,
  storageUsed,
} from "./access";
import { checkSize, registerFile, registerInput } from "./helpers";

export const filesUploadProcedures = {
  /** Checked before the bytes are written. */
  authorizeUpload: chatProcedure("chat.files.upload")
    .input(z.object({ size: z.number().int().positive() }))
    .query(({ ctx, input }) => checkSize(ctx, input.size)),

  /** How much of the organization's storage is in use. */
  usage: filesProcedure("files.view").query(async ({ ctx }) => ({
    used: await storageUsed(ctx),
    limit: await storageCeiling(ctx),
  })),

  /** Records a file once its bytes are stored. */
  register: chatProcedure("chat.files.upload")
    .input(registerInput)
    .mutation(({ ctx, input }) => registerFile(ctx, input, "chat")),

  /** Upload check for the Files library. */
  libraryAuthorize: filesProcedure("files.upload")
    .input(z.object({ size: z.number().int().positive() }))
    .query(({ ctx, input }) => checkSize(ctx, input.size)),

  /** Upload check for a mail attachment: it needs the right to send mail. */
  mailAuthorize: mailProcedure("mail.send")
    .input(z.object({ size: z.number().int().positive() }))
    .query(({ ctx, input }) => checkSize(ctx, input.size)),

  /**
   * Records a mail attachment. It stays out of the Files library: only its
   * uploader, and the people the message reaches, can open it.
   */
  mailRegister: mailProcedure("mail.send")
    .input(registerInput)
    .mutation(({ ctx, input }) => registerFile(ctx, input, "mail")),

  /** Records a file uploaded to the Files library. */
  libraryRegister: filesProcedure("files.upload")
    .input(registerInput)
    .mutation(({ ctx, input }) => registerFile(ctx, input, "library")),
};
