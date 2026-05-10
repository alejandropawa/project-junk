/** Traduce erorile Supabase Auth în română. */
export function translateAuthError(
  error: { message: string; code?: string } | Error | null,
): string {
  if (!error) {
    return "A apărut o eroare necunoscută. Încearcă din nou.";
  }

  const raw = error.message ?? "";
  const lower = raw.toLowerCase();

  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";

  if (code === "invalid_credentials" || lower.includes("invalid login credentials")) {
    return "E-mail sau parolă incorectă.";
  }
  if (
    code === "email_not_confirmed" ||
    lower.includes("email not confirmed")
  ) {
    return "Te rugăm să confirmi adresa de e-mail înainte de autentificare.";
  }
  if (
    code === "user_already_exists" ||
    lower.includes("user already registered") ||
    lower.includes("already been registered")
  ) {
    return "Există deja un cont cu această adresă de e-mail.";
  }
  if (
    lower.includes("password") &&
    (lower.includes("at least") || lower.includes("least 6") || lower.includes("short"))
  ) {
    return "Parola nu îndeplinește cerințele de securitate. Folosește cel puțin 8 caractere.";
  }
  if (
    lower.includes("invalid email") ||
    lower.includes("unable to validate email")
  ) {
    return "Adresa de e-mail nu este validă.";
  }
  if (
    lower.includes("rate limit") ||
    lower.includes("email rate limit") ||
    code === "over_email_send_rate_limit"
  ) {
    return "Prea multe încercări. Așteaptă câteva minute și încearcă din nou.";
  }
  if (lower.includes("signup") && lower.includes("disabled")) {
    return "Înregistrările sunt temporar dezactivate.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Eroare de rețea. Verifică conexiunea și încearcă din nou.";
  }
  if (
    (lower.includes("session") && lower.includes("expired")) ||
    lower.includes("jwt expired") ||
    (lower.includes("token") && lower.includes("expired"))
  ) {
    return "Sesiunea a expirat. Autentifică-te din nou.";
  }
  if (lower.includes("same") && lower.includes("password")) {
    return "Parola nouă trebuie să fie diferită de cea veche.";
  }

  return "Nu am putut finaliza operațiunea. Încearcă din nou.";
}
