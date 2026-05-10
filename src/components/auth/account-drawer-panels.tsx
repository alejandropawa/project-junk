"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors-ro";
import {
  changeEmailSchema,
  type ChangeEmailValues,
  deleteAccountConfirmSchema,
  type DeleteAccountConfirmValues,
  newPasswordSchema,
  type NewPasswordValues,
  usernameUpdateSchema,
  type UsernameUpdateValues,
} from "@/schemas/auth";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function sectionTitle(text: string) {
  return (
    <h3 className="text-sm font-semibold tracking-tight text-foreground">
      {text}
    </h3>
  );
}

function sectionHint(text: string) {
  return <p className="pb-text-caption text-muted-foreground">{text}</p>;
}

function divider() {
  return <div className="h-px w-full bg-border/60" aria-hidden />;
}

function successBanner(text: string) {
  return (
    <p
      className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
      role="status"
    >
      <CheckCircle2
        className="mt-0.5 size-4 shrink-0 opacity-90"
        aria-hidden
      />
      <span>{text}</span>
    </p>
  );
}

export type AccountSettingsPanelProps = {
  user: User;
  onUserUpdated?: () => void | Promise<void>;
  onSignOut?: () => void | Promise<void>;
};

export function AccountSettingsPanel({
  user,
  onUserUpdated,
  onSignOut,
}: AccountSettingsPanelProps) {
  const metaUsername =
    typeof user.user_metadata?.username === "string"
      ? user.user_metadata.username
      : "";

  const usernameForm = useForm<UsernameUpdateValues>({
    resolver: zodResolver(usernameUpdateSchema),
    defaultValues: { username: metaUsername },
  });

  useEffect(() => {
    usernameForm.reset({ username: metaUsername });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset este stabil; evită re-randări la fiecare render al instanței useForm
  }, [user.id, metaUsername, usernameForm.reset]);

  const passwordForm = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const emailForm = useForm<ChangeEmailValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { email: "" },
  });

  const deleteForm = useForm<DeleteAccountConfirmValues>({
    resolver: zodResolver(deleteAccountConfirmSchema),
    defaultValues: { confirmationEmail: "" },
  });

  const [sessionsBusy, setSessionsBusy] = useState<"others" | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionsSuccess, setSessionsSuccess] = useState<string | null>(null);
  const [emailInfo, setEmailInfo] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const usernameOkTimer = useRef<number | null>(null);
  const passwordOkTimer = useRef<number | null>(null);
  const emailInfoTimer = useRef<number | null>(null);
  const sessionsOkTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      for (const r of [
        usernameOkTimer,
        passwordOkTimer,
        emailInfoTimer,
        sessionsOkTimer,
      ]) {
        const id = r.current;
        if (id != null) window.clearTimeout(id);
        r.current = null;
      }
    };
  }, []);

  function scheduleClear(
    ref: { current: number | null },
    clear: () => void,
    ms: number,
  ) {
    if (ref.current != null) window.clearTimeout(ref.current);
    ref.current = window.setTimeout(() => {
      clear();
      ref.current = null;
    }, ms);
  }

  const submitUsername = useCallback(async (data: UsernameUpdateValues) => {
    usernameForm.clearErrors("root");
    setUsernameSuccess(null);
    const supabase = createClient();
    if (!supabase) {
      usernameForm.setError("root", {
        message: "Supabase nu este configurat în acest mediu.",
      });
      return;
    }
    const trimmed = data.username.trim();
    if (trimmed === metaUsername) {
      usernameForm.setError("root", {
        message: "Nume neschimbat — modifică textul sau folosește alt nume.",
      });
      return;
    }
    const { error } = await supabase.auth.updateUser({
      data: {
        username: trimmed,
        display_name: trimmed,
      },
    });
    if (error) {
      usernameForm.setError("root", { message: translateAuthError(error) });
      return;
    }
    setUsernameSuccess("Numele de utilizator a fost salvat cu succes.");
    scheduleClear(usernameOkTimer, () => setUsernameSuccess(null), 7000);
    await Promise.resolve(onUserUpdated?.());
  }, [metaUsername, onUserUpdated, usernameForm]);

  const submitPassword = useCallback(async (data: NewPasswordValues) => {
    passwordForm.clearErrors("root");
    setPasswordSuccess(null);
    const supabase = createClient();
    if (!supabase) {
      passwordForm.setError("root", {
        message: "Supabase nu este configurat în acest mediu.",
      });
      return;
    }
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });
    if (error) {
      passwordForm.setError("root", { message: translateAuthError(error) });
      return;
    }
    passwordForm.reset({ password: "", confirm: "" });
    setPasswordSuccess("Parola a fost actualizată cu succes.");
    scheduleClear(passwordOkTimer, () => setPasswordSuccess(null), 7000);
    await Promise.resolve(onUserUpdated?.());
  }, [onUserUpdated, passwordForm]);

  const submitEmail = useCallback(async (data: ChangeEmailValues) => {
    emailForm.clearErrors("root");
    setEmailInfo(null);
    const supabase = createClient();
    if (!supabase) {
      emailForm.setError("root", {
        message: "Supabase nu este configurat în acest mediu.",
      });
      return;
    }
    const next = data.email.trim().toLowerCase();
    if (next === user.email?.trim().toLowerCase()) {
      emailForm.setError("root", {
        message: "Noua adresă trebuie să fie diferită de cea curentă.",
      });
      return;
    }
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.updateUser(
      { email: next },
      { emailRedirectTo: `${origin}/auth/callback` },
    );
    if (error) {
      emailForm.setError("root", { message: translateAuthError(error) });
      return;
    }
    setEmailInfo(
      "Cererea a fost trimisă cu succes. Ți-am trimis un e-mail de confirmare pe noua adresă (și, după setările proiectului, poate fi necesară confirmarea și pe vechea adresă). Urmează linkurile din mesaje pentru a finaliza schimbarea.",
    );
    scheduleClear(emailInfoTimer, () => setEmailInfo(null), 12000);
    emailForm.reset({ email: "" });
  }, [user.email, emailForm]);

  async function revokeOtherSessions() {
    setSessionsError(null);
    setSessionsSuccess(null);
    setSessionsBusy("others");
    const supabase = createClient();
    if (!supabase) {
      setSessionsBusy(null);
      setSessionsError("Clientul Supabase nu este disponibil.");
      return;
    }
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setSessionsBusy(null);
    if (error) {
      setSessionsError(translateAuthError(error));
      return;
    }
    setSessionsSuccess(
      "Celelalte sesiuni au fost închise cu succes. Rămâi conectat pe acest dispozitiv.",
    );
    scheduleClear(sessionsOkTimer, () => setSessionsSuccess(null), 7000);
    await Promise.resolve(onUserUpdated?.());
  }

  const submitDelete = useCallback(async (data: DeleteAccountConfirmValues) => {
    deleteForm.clearErrors("root");
    const supabase = createClient();
    if (!supabase) {
      deleteForm.setError("root", {
        message: "Supabase nu este configurat în acest mediu.",
      });
      return;
    }
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmationEmail: data.confirmationEmail.trim(),
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string;
      ok?: boolean;
    };
    if (!res.ok) {
      deleteForm.setError("root", {
        message: payload.error ?? "Ștergerea contului a eșuat.",
      });
      return;
    }
    deleteForm.reset({ confirmationEmail: "" });
    await supabase.auth.signOut();
    await Promise.resolve(onSignOut?.());
  }, [deleteForm, onSignOut]);

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-3">
        {sectionTitle("Nume afișat")}
        {sectionHint(
          "Salvat în profilul Supabase (user_metadata). Apare în antet ca „Cont”.",
        )}
        <form
          // eslint-disable-next-line react-hooks/refs -- RHF; ref-urile timerelor se citesc doar în handler la submit
          onSubmit={usernameForm.handleSubmit(submitUsername)}
          className="flex flex-col gap-3"
        >
          {usernameForm.formState.errors.root?.message ? (
            <p className="text-sm text-destructive" role="alert">
              {usernameForm.formState.errors.root.message}
            </p>
          ) : null}
          {usernameSuccess ? successBanner(usernameSuccess) : null}
          <Controller
            name="username"
            control={usernameForm.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="settings-username">
                  Nume de utilizator
                </FieldLabel>
                <Input
                  {...field}
                  id="settings-username"
                  autoComplete="username"
                  disabled={usernameForm.formState.isSubmitting}
                  className={cn(
                    "h-11",
                    fieldState.invalid && "border-destructive",
                  )}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError>{fieldState.error?.message}</FieldError>
              </Field>
            )}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={usernameForm.formState.isSubmitting}
            size="lg"
            className="h-11 w-full cursor-pointer gap-2 [&_svg]:pointer-events-none"
          >
            {usernameForm.formState.isSubmitting ? (
              <>
                <Loader2
                  className="size-4 shrink-0 motion-safe:animate-spin motion-reduce:opacity-70"
                  aria-hidden
                />
                Se salvează…
              </>
            ) : (
              "Salvează numele"
            )}
          </Button>
        </form>
      </div>

      {divider()}

      <div className="space-y-3">
        {sectionTitle("Parolă")}
        {sectionHint(
          "Schimbă parola pentru acest cont (sesiunea curentă rămâne activă).",
        )}
        <form
          // eslint-disable-next-line react-hooks/refs -- RHF; ref-uri timer doar în handler
          onSubmit={passwordForm.handleSubmit(submitPassword)}
          className="flex flex-col gap-3"
        >
          {passwordForm.formState.errors.root?.message ? (
            <p className="text-sm text-destructive" role="alert">
              {passwordForm.formState.errors.root.message}
            </p>
          ) : null}
          {passwordSuccess ? successBanner(passwordSuccess) : null}
          <Controller
            name="password"
            control={passwordForm.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="settings-new-pw">Parolă nouă</FieldLabel>
                <Input
                  {...field}
                  id="settings-new-pw"
                  type="password"
                  autoComplete="new-password"
                  disabled={passwordForm.formState.isSubmitting}
                  className={cn(
                    "h-11",
                    fieldState.invalid && "border-destructive",
                  )}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError>{fieldState.error?.message}</FieldError>
              </Field>
            )}
          />
          <Controller
            name="confirm"
            control={passwordForm.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="settings-confirm-pw">
                  Confirmă parola
                </FieldLabel>
                <Input
                  {...field}
                  id="settings-confirm-pw"
                  type="password"
                  autoComplete="new-password"
                  disabled={passwordForm.formState.isSubmitting}
                  className={cn(
                    "h-11",
                    fieldState.invalid && "border-destructive",
                  )}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError>{fieldState.error?.message}</FieldError>
              </Field>
            )}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={passwordForm.formState.isSubmitting}
            size="lg"
            className="h-11 w-full cursor-pointer gap-2 [&_svg]:pointer-events-none"
          >
            {passwordForm.formState.isSubmitting ? (
              <>
                <Loader2
                  className="size-4 shrink-0 motion-safe:animate-spin motion-reduce:opacity-70"
                  aria-hidden
                />
                Se actualizează…
              </>
            ) : (
              "Actualizează parola"
            )}
          </Button>
        </form>
      </div>

      {divider()}

      <div className="space-y-3">
        {sectionTitle("Adresă de e-mail")}
        {sectionHint(
          `E-mail curent: ${user.email ?? "—"}. După salvare, confirmă din mesajele primite (fluxul depinde de setările Supabase Auth).`,
        )}
        <form
          // eslint-disable-next-line react-hooks/refs -- RHF; ref-uri timer doar în handler
          onSubmit={emailForm.handleSubmit(submitEmail)}
          className="flex flex-col gap-3"
        >
          {emailForm.formState.errors.root?.message ? (
            <p className="text-sm text-destructive" role="alert">
              {emailForm.formState.errors.root.message}
            </p>
          ) : null}
          {emailInfo ? successBanner(emailInfo) : null}
          <Controller
            name="email"
            control={emailForm.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="settings-new-email">
                  Noua adresă de e-mail
                </FieldLabel>
                <Input
                  {...field}
                  id="settings-new-email"
                  type="email"
                  autoComplete="email"
                  disabled={emailForm.formState.isSubmitting}
                  className={cn(
                    "h-11",
                    fieldState.invalid && "border-destructive",
                  )}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError>{fieldState.error?.message}</FieldError>
              </Field>
            )}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={emailForm.formState.isSubmitting}
            size="lg"
            className="h-11 w-full cursor-pointer gap-2 [&_svg]:pointer-events-none"
          >
            {emailForm.formState.isSubmitting ? (
              <>
                <Loader2
                  className="size-4 shrink-0 motion-safe:animate-spin motion-reduce:opacity-70"
                  aria-hidden
                />
                Se trimite…
              </>
            ) : (
              "Solicită schimbarea e-mailului"
            )}
          </Button>
        </form>
      </div>

      {divider()}

      <div className="space-y-3">
        {sectionTitle("Sesiuni")}
        {sectionHint(
          "Poți închide sesiunile de pe celelalte dispozitive; rămâi conectat aici. Deconectarea completă (și acest dispozitiv) este din panoul Cont → Deconectare.",
        )}
        {sessionsError ? (
          <p className="text-sm text-destructive" role="alert">
            {sessionsError}
          </p>
        ) : null}
        {sessionsSuccess ? successBanner(sessionsSuccess) : null}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11 w-full cursor-pointer gap-2 [&_svg]:pointer-events-none"
          disabled={sessionsBusy !== null}
          onClick={() => void revokeOtherSessions()}
        >
          {sessionsBusy ? (
            <>
              <Loader2
                className="size-4 shrink-0 motion-safe:animate-spin motion-reduce:opacity-70"
                aria-hidden
              />
              Se aplică…
            </>
          ) : (
            "Închide sesiunile de pe alte dispozitive"
          )}
        </Button>
      </div>

      {divider()}

      <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/[0.06] p-4">
        {sectionTitle("Ștergere cont")}
        {sectionHint(
          "Acțiune ireversibilă: contul Auth și datele asociate din proiect vor fi eliminate conform politicii tale Supabase. Scrie exact e-mailul contului pentru confirmare.",
        )}
        <form
          onSubmit={deleteForm.handleSubmit(submitDelete)}
          className="flex flex-col gap-3"
        >
          {deleteForm.formState.errors.root?.message ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteForm.formState.errors.root.message}
            </p>
          ) : null}
          <Controller
            name="confirmationEmail"
            control={deleteForm.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="settings-delete-confirm">
                  Confirmă cu e-mailul contului
                </FieldLabel>
                <Input
                  {...field}
                  id="settings-delete-confirm"
                  type="email"
                  autoComplete="off"
                  disabled={deleteForm.formState.isSubmitting}
                  className={cn(
                    "h-11",
                    fieldState.invalid && "border-destructive",
                  )}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError>{fieldState.error?.message}</FieldError>
              </Field>
            )}
          />
          <Button
            type="submit"
            variant="destructive"
            size="lg"
            className="h-11 w-full gap-2 [&_svg]:pointer-events-none"
            disabled={deleteForm.formState.isSubmitting}
          >
            {deleteForm.formState.isSubmitting ? (
              <>
                <Loader2
                  className="size-4 shrink-0 motion-safe:animate-spin motion-reduce:opacity-70"
                  aria-hidden
                />
                Se șterge…
              </>
            ) : (
              "Șterge definitiv contul"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

export function AccountBillingPanel() {
  return (
    <div className="flex flex-col gap-3 text-pretty">
      <p className="pb-text-body leading-relaxed text-muted-foreground">
        Momentan optimizăm produsul; monetizarea vine după, când vei ști exact pentru ce plătești.
      </p>
      <p className="pb-text-body leading-relaxed text-muted-foreground">
        Ne concentrăm pe predicții mai solide, interfață mai clară și transparență față de date. Abonamentele sau
        facturarea vor fi introduse într-o etapă următoare.
      </p>
    </div>
  );
}

/** Pagina `/cont/setari`: reîmprospătează datele server după modificări și delogare după ștergere cont. */
export function AccountSettingsPanelForPage({ user }: { user: User }) {
  const router = useRouter();
  return (
    <AccountSettingsPanel
      user={user}
      onUserUpdated={() => void router.refresh()}
      onSignOut={async () => {
        const supabase = createClient();
        await supabase?.auth.signOut();
        router.push("/");
        router.refresh();
      }}
    />
  );
}
