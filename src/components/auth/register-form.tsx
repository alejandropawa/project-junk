"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors-ro";
import { registerSchema, type RegisterValues } from "@/schemas/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type RegisterFormProps = {
  onSuccess: () => void | Promise<void>;
};

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      acceptTerms: false,
      age18: false,
    },
  });

  const [info, setInfo] = React.useState<string | null>(null);

  async function onSubmit(data: RegisterValues) {
    form.clearErrors("root");
    setInfo(null);
    const supabase = createClient();
    if (!supabase) {
      form.setError("root", {
        message:
          "Înregistrarea nu este configurată. Adaugă variabilele Supabase în .env.local.",
      });
      return;
    }

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email.trim(),
      password: data.password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
          username: data.username.trim(),
          display_name: data.username.trim(),
        },
      },
    });

    if (error) {
      form.setError("root", { message: translateAuthError(error) });
      return;
    }

    if (result.session) {
      await Promise.resolve(onSuccess());
      return;
    }

    setInfo(
      "Ți-am trimis un e-mail de confirmare. Deschide linkul din mesaj pentru a-ți activa contul.",
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
    >
      {form.formState.errors.root?.message && (
        <p className="text-sm text-destructive" role="alert">
          {form.formState.errors.root.message}
        </p>
      )}

      <Controller
        name="username"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor="register-username">
              Nume de utilizator
            </FieldLabel>
            <Input
              {...field}
              id="register-username"
              autoComplete="username"
              disabled={form.formState.isSubmitting}
              className={cn("h-11", fieldState.invalid && "border-destructive")}
              aria-invalid={fieldState.invalid}
            />
            <FieldError>{fieldState.error?.message}</FieldError>
          </Field>
        )}
      />

      <Controller
        name="email"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor="register-email">E-mail</FieldLabel>
            <Input
              {...field}
              id="register-email"
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

      <Controller
        name="password"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor="register-password">Parolă</FieldLabel>
            <Input
              {...field}
              id="register-password"
              type="password"
              autoComplete="new-password"
              disabled={form.formState.isSubmitting}
              className={cn("h-11", fieldState.invalid && "border-destructive")}
              aria-invalid={fieldState.invalid}
            />
            <FieldError>{fieldState.error?.message}</FieldError>
          </Field>
        )}
      />

      <div className="flex flex-col gap-3 border-t border-border pt-2">
        <Controller
          name="acceptTerms"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field
              orientation="horizontal"
              data-invalid={fieldState.invalid || undefined}
              className="items-start gap-3"
            >
              <Checkbox
                id="register-terms"
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                disabled={form.formState.isSubmitting}
                aria-invalid={fieldState.invalid}
              />
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="register-terms"
                  className="text-sm leading-snug text-muted-foreground"
                >
                  Sunt de acord cu{" "}
                  <Link
                    href="/termeni"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline underline-offset-2 hover:text-primary/90"
                  >
                    termenii și condițiile
                  </Link>
                  .
                </label>
                <FieldError>{fieldState.error?.message}</FieldError>
              </div>
            </Field>
          )}
        />

        <Controller
          name="age18"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field
              orientation="horizontal"
              data-invalid={fieldState.invalid || undefined}
              className="items-start gap-3"
            >
              <Checkbox
                id="register-age"
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                disabled={form.formState.isSubmitting}
                aria-invalid={fieldState.invalid}
              />
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="register-age"
                  className="text-sm leading-snug text-muted-foreground"
                >
                  Confirm că am cel puțin 18 ani.
                </label>
                <FieldError>{fieldState.error?.message}</FieldError>
              </div>
            </Field>
          )}
        />
      </div>

      {info && (
        <p
          className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
          role="status"
        >
          {info}
        </p>
      )}

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        size="lg"
        className="h-11 w-full"
      >
        {form.formState.isSubmitting ? "Se creează contul…" : "Creează cont"}
      </Button>
    </form>
  );
}
