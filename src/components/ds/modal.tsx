"use client";

import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

/** Accessible modal aligned with Probix analytical surfaces */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-background/65 backdrop-blur-sm transition-opacity" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-6">
          <Dialog.Popup
            className={cn(
              "max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-[24px] border border-border bg-elevated p-6 text-foreground shadow-[var(--shadow-pb-card)]",
              className,
            )}
          >
            <Dialog.Title className="pb-text-card-title pb-2 text-lg">
              {title}
            </Dialog.Title>
            {description ? (
              <Dialog.Description className="pb-text-caption pb-6">
                {description}
              </Dialog.Description>
            ) : null}
            <div>{children}</div>
            <div className="mt-6 flex justify-end">
              <Dialog.Close className="rounded-xl border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                Închide
              </Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
