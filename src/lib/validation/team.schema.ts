import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const uid = z.string().trim().min(1).max(128);

export const lookupTeamAccountSchema = z.object({ email });

export const grantAdminSchema = z.object({ email });

export const changeAdminRoleSchema = z.object({
  uid,
  role: z.enum(["ADMIN", "OWNER"]),
});

export const removeAdminSchema = z.object({
  uid,
  confirmEmail: z.string().trim().min(1, "Type the email to confirm."),
});
