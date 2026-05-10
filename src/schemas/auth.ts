import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Introdu adresa de e-mail.")
    .email("Adresa de e-mail nu este validă."),
  password: z.string().min(1, "Introdu parola."),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  username: z
    .string()
    .min(2, "Numele de utilizator trebuie să aibă cel puțin 2 caractere.")
    .max(32, "Numele de utilizator poate avea cel mult 32 de caractere."),
  email: z
    .string()
    .min(1, "Introdu adresa de e-mail.")
    .email("Adresa de e-mail nu este validă."),
  password: z
    .string()
    .min(8, "Parola trebuie să aibă cel puțin 8 caractere."),
  acceptTerms: z.boolean().refine((v) => v === true, {
    message: "Trebuie să fii de acord cu termenii și condițiile.",
  }),
  age18: z.boolean().refine((v) => v === true, {
    message: "Trebuie să confirmi că ai cel puțin 18 ani.",
  }),
});

export type RegisterValues = z.infer<typeof registerSchema>;

export const resetRequestSchema = z.object({
  email: z
    .string()
    .min(1, "Introdu adresa de e-mail.")
    .email("Adresa de e-mail nu este validă."),
});

export type ResetRequestValues = z.infer<typeof resetRequestSchema>;

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Parola trebuie să aibă cel puțin 8 caractere."),
    confirm: z.string().min(1, "Confirmă parola."),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Parolele nu coincid.",
    path: ["confirm"],
  });

export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

export const usernameUpdateSchema = z.object({
  username: registerSchema.shape.username,
});

export type UsernameUpdateValues = z.infer<typeof usernameUpdateSchema>;

export const changeEmailSchema = z.object({
  email: z
    .string()
    .min(1, "Introdu noua adresă de e-mail.")
    .email("Adresa de e-mail nu este validă."),
});

export type ChangeEmailValues = z.infer<typeof changeEmailSchema>;

export const deleteAccountConfirmSchema = z.object({
  confirmationEmail: z
    .string()
    .min(1, "Introdu e-mailul contului pentru confirmare.")
    .email("Adresa de e-mail nu este validă."),
});

export type DeleteAccountConfirmValues = z.infer<
  typeof deleteAccountConfirmSchema
>;
