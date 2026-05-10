"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors-ro";
import { newPasswordSchema, type NewPasswordValues } from "@/schemas/auth";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NewPasswordFormProps = {
  onSuccess: () => void;
};

export function NewPasswordForm({ onSuccess }: NewPasswordFormProps) {
  const form = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(data: NewPasswordValues) {
    form.clearErrors("root");
    const supabase = createClient();
    if (!supabase) {
      form.setError("root", {
        message:
          "Serviciul nu este configurat. Verifică variabilele de mediu.",
      });
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });

    if (error) {
      form.setError("root", { message: translateAuthError(error) });
      return;
    }

    await supabase.auth.signOut();
    onSuccess();
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="mt-8 flex flex-col gap-4"
    >
      {form.formState.errors.root?.message && (
        <p className="text-sm text-destructive" role="alert">
          {form.formState.errors.root.message}
        </p>
      )}

      <Controller
        name="password"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor="new-pw">Parolă nouă</FieldLabel>
            <Input
              {...field}
              id="new-pw"
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

      <Controller
        name="confirm"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor="confirm-pw">Confirmă parola</FieldLabel>
            <Input
              {...field}
              id="confirm-pw"
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

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        size="lg"
        className="h-11 w-full"
      >
        {form.formState.isSubmitting ? "Se salvează…" : "Salvează parola"}
      </Button>
    </form>
  );
}
