"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors-ro";
import { resetRequestSchema, type ResetRequestValues } from "@/schemas/auth";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ResetPasswordRequestForm() {
  const [info, setInfo] = React.useState<string | null>(null);

  const form = useForm<ResetRequestValues>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(data: ResetRequestValues) {
    form.clearErrors("root");
    setInfo(null);
    const supabase = createClient();
    if (!supabase) {
      form.setError("root", {
        message:
          "Serviciul nu este configurat. Verifică variabilele Supabase în .env.local.",
      });
      return;
    }

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.resetPasswordForEmail(
      data.email.trim(),
      {
        redirectTo: `${origin}/resetare-parola`,
      },
    );

    if (error) {
      form.setError("root", { message: translateAuthError(error) });
      return;
    }

    setInfo(
      "Dacă există un cont cu acest e-mail, vei primi în curând instrucțiunile de resetare.",
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-muted-foreground">
        Introdu adresa de e-mail și îți trimitem un link pentru a seta o parolă
        nouă.
      </p>

      {form.formState.errors.root?.message && (
        <p className="text-sm text-destructive" role="alert">
          {form.formState.errors.root.message}
        </p>
      )}
      {info && (
        <p className="rounded-lg border border-primary/35 bg-primary/10 px-3 py-2 text-sm text-foreground">
          {info}
        </p>
      )}

      <Controller
        name="email"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor="reset-email">E-mail</FieldLabel>
            <Input
              {...field}
              id="reset-email"
              type="email"
              autoComplete="email"
              disabled={form.formState.isSubmitting}
              className={cn("h-11", fieldState.invalid && "border-destructive")}
              aria-invalid={fieldState.invalid}
            />
            <FieldError>{fieldState.error?.message}</FieldError>
          </Field>
        )}
      />

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        size="lg"
        className="h-11 w-full"
      >
        {form.formState.isSubmitting
          ? "Se trimite…"
          : "Trimite linkul de resetare"}
      </Button>
    </form>
  );
}
