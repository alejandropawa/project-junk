"use client";

import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors-ro";
import { loginSchema, type LoginValues } from "@/schemas/auth";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type LoginFormProps = {
  onSuccess: () => void | Promise<void>;
  onForgotPassword: () => void;
};

export function LoginForm({ onSuccess, onForgotPassword }: LoginFormProps) {
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: LoginValues) {
    form.clearErrors("root");
    const supabase = createClient();
    if (!supabase) {
      form.setError("root", {
        message:
          "Autentificarea nu este configurată. Adaugă NEXT_PUBLIC_SUPABASE_URL și NEXT_PUBLIC_SUPABASE_ANON_KEY în variabilele de mediu.",
      });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email.trim(),
      password: data.password,
    });

    if (error) {
      form.setError("root", { message: translateAuthError(error) });
      return;
    }
    await Promise.resolve(onSuccess());
  }

  const submitting = form.formState.isSubmitting;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      aria-busy={submitting || undefined}
    >
      {form.formState.errors.root?.message && (
        <p className="text-sm text-destructive" role="alert">
          {form.formState.errors.root.message}
        </p>
      )}

      <Controller
        name="email"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor="login-email">E-mail</FieldLabel>
            <Input
              {...field}
              id="login-email"
              type="email"
              autoComplete="email"
              disabled={submitting}
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
            <FieldLabel htmlFor="login-password">Parolă</FieldLabel>
            <Input
              {...field}
              id="login-password"
              type="password"
              autoComplete="current-password"
              disabled={submitting}
              className={cn("h-11", fieldState.invalid && "border-destructive")}
              aria-invalid={fieldState.invalid}
            />
            <FieldError>{fieldState.error?.message}</FieldError>
          </Field>
        )}
      />

      <button
        type="button"
        onClick={onForgotPassword}
        disabled={submitting}
        className={cn(
          "self-end text-sm font-medium text-primary underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        Ai uitat parola?
      </button>

      <Button
        type="submit"
        disabled={submitting}
        size="lg"
        className="h-11 w-full gap-2 [&_svg]:pointer-events-none"
      >
        {submitting ? (
          <>
            <Loader2
              className="size-4 shrink-0 motion-safe:animate-spin motion-reduce:opacity-70"
              aria-hidden
            />
            Se conectează…
          </>
        ) : (
          "Conectează-te"
        )}
      </Button>
    </form>
  );
}
