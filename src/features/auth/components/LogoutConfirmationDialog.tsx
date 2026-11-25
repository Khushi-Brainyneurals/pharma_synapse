import { LogOut } from "lucide-react";
import { Dialog } from "../../../shared/ui/Dialog";

export function LogoutConfirmationDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog title="Sign out?" onClose={onClose} size="sm">
      <p className="text-small text-subdued">
        Are you sure you want to sign out of your account?
      </p>
      <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-control px-4 text-small font-semibold text-subdued hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex h-9 items-center gap-2 rounded-control bg-danger px-4 text-small font-semibold text-white"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </Dialog>
  );
}
