import { Button } from "../../../shared/ui/Button";
import { Input } from "../../../shared/ui/Input";
import { PasswordInput } from "../../../shared/ui/PasswordInput";
import { Select } from "../../../shared/ui/Select";
import { AuthNotice } from "../components/AuthNotice";
import type { LoginFeedbackVariant } from "../api/auth.errors";
import { USER_ROLES, USER_ROLE_OPTIONS } from "../model/roles";

interface StateSpec {
  number: string;
  title: string;
  description: string;
  notices?: Array<{ message: string; variant: LoginFeedbackVariant }>;
  username?: string;
  password?: string;
  role?: string;
  errors?: {
    username?: string;
    password?: string;
    role?: string;
  };
  buttonLabel?: string;
  isLoading?: boolean;
  isDisabled?: boolean;
  isSuccess?: boolean;
}

const loginStates: StateSpec[] = [
  {
    number: "01",
    title: "Empty / first-use",
    description: "First load of the sign-in URL. No credentials entered yet.",
  },
  {
    number: "02",
    title: "Focused / populated",
    description: "Credentials being entered; a field holds keyboard focus.",
    username: "U-0427",
    password: "validated",
    role: USER_ROLES.REVIEWER_QA,
  },
  {
    number: "03",
    title: "Authenticating",
    description: "Immediately after submit, while credentials are checked.",
    username: "U-0427",
    password: "validated",
    role: USER_ROLES.REVIEWER_QA,
    isLoading: true,
    isDisabled: true,
  },
  {
    number: "04",
    title: "Inline validation",
    description: "Submit attempted with one or more required fields empty.",
    errors: {
      username: "Enter your User ID.",
      password: "Enter your password.",
      role: "Select your role to continue.",
    },
  },
  {
    number: "05",
    title: "Invalid credentials",
    description: "Submitted credentials did not match.",
    username: "U-0427",
    password: "wrong-pass",
    role: USER_ROLES.REVIEWER_QA,
    notices: [
      {
        variant: "danger",
        message: "The User ID or password you entered is incorrect.",
      },
    ],
  },
  {
    number: "06",
    title: "Last attempt",
    description: "Shown only on the final permitted attempt.",
    username: "U-0427",
    password: "validated",
    role: USER_ROLES.REVIEWER_QA,
    notices: [
      {
        variant: "info",
        message: "1 attempt remaining before your account is locked.",
      },
    ],
  },
  {
    number: "07",
    title: "Account locked",
    description: "Failed-attempt threshold reached.",
    username: "U-0427",
    role: USER_ROLES.REVIEWER_QA,
    isDisabled: true,
    notices: [
      {
        variant: "danger",
        message:
          "Your account is locked after multiple failed sign-in attempts. Contact your administrator to unlock it.",
      },
    ],
  },
  {
    number: "08",
    title: "Password expired",
    description: "Credentials valid but password rotation is required.",
    username: "U-0427",
    password: "validated",
    role: USER_ROLES.APPROVED_BY,
    buttonLabel: "Continue",
    notices: [
      {
        variant: "info",
        message:
          "Your password has expired. You'll be asked to set a new one before continuing.",
      },
    ],
  },
  {
    number: "09",
    title: "Role mismatch",
    description: "Credentials valid but selected role is not assigned.",
    username: "U-0427",
    password: "validated",
    notices: [
      {
        variant: "danger",
        message:
          "This account isn't assigned the selected role. Choose the role that matches your account.",
      },
    ],
  },
  {
    number: "10",
    title: "Deactivated / break-glass off",
    description: "Account deactivated or Super Admin access disabled.",
    username: "U-0427",
    role: USER_ROLES.ADMIN,
    isDisabled: true,
    notices: [
      {
        variant: "danger",
        message: "This account is deactivated. Contact your administrator.",
      },
      {
        variant: "danger",
        message:
          "Super Admin access is disabled. Break-glass access must be authorized before sign-in.",
      },
    ],
  },
  {
    number: "11",
    title: "Service unreachable",
    description: "Network or service failure during the request.",
    username: "U-0427",
    password: "validated",
    role: USER_ROLES.REVIEWER_PR,
    buttonLabel: "Try again",
    notices: [
      {
        variant: "danger",
        message:
          "Can't reach the sign-in service. Check your connection and try again.",
      },
    ],
  },
  {
    number: "12",
    title: "Success — role redirect",
    description: "Credentials, role, expiry, and activation checks pass.",
    username: "U-0427",
    password: "validated",
    role: USER_ROLES.APPROVED_BY,
    isSuccess: true,
  },
];

export function LoginStatesPage() {
  return (
    <main className="min-h-screen bg-background p-3 text-text">
      <header className="mb-3 flex items-baseline gap-3">
        <h1 className="text-lg font-semibold">All states</h1>
        <p className="text-xs font-medium text-subdued">
          Every state as a real component instance
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loginStates.map((state) => (
          <StatePreview key={state.number} state={state} />
        ))}
      </div>
    </main>
  );
}

function StatePreview({ state }: { state: StateSpec }) {
  return (
    <section className="overflow-hidden rounded-control border border-border bg-surface shadow-sm">
      <header className="border-b border-border bg-muted px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="font-mono text-xs">{state.number}</span>
          <span
            className={`size-2 rounded-full ${
              state.notices?.some((notice) => notice.variant === "danger")
                ? "bg-danger"
                : "bg-subdued"
            }`}
          />
          {state.title}
        </div>
        <p className="mt-3 text-xs leading-5 text-subdued">{state.description}</p>
      </header>

      <div className="p-5">
        <div className="rounded-panel border border-border bg-surface p-6 shadow-auth">
          {state.isSuccess ? <SuccessContent state={state} /> : <FormContent state={state} />}
        </div>
      </div>
    </section>
  );
}

function FormContent({ state }: { state: StateSpec }) {
  return (
    <>
      <header>
        <h2 className="text-lg font-semibold">Sign in</h2>
        <p className="mt-1 text-xs leading-5 text-subdued">
          Use your assigned User ID and password.
        </p>
      </header>

      <div className="mt-5 space-y-4">
        {state.notices?.map((notice) => (
          <AuthNotice
            key={notice.message}
            message={notice.message}
            variant={notice.variant}
          />
        ))}

        <Input
          id={`${state.number}-username`}
          label="User ID"
          placeholder="e.g. U-0427"
          defaultValue={state.username}
          error={state.errors?.username}
          disabled={state.isDisabled}
          isRequired
        />
        <PasswordInput
          id={`${state.number}-password`}
          label="Password"
          defaultValue={state.password}
          error={state.errors?.password}
          disabled={state.isDisabled}
          isRequired
        />
        <Select
          id={`${state.number}-role`}
          label="Role"
          placeholder="Select your role"
          options={USER_ROLE_OPTIONS}
          defaultValue={state.role}
          error={state.errors?.role}
          disabled={state.isDisabled}
          isRequired
        />
        <Button type="button" isLoading={state.isLoading} disabled={state.isDisabled}>
          {state.buttonLabel ?? "Sign in"}
        </Button>
      </div>
    </>
  );
}

function SuccessContent({ state }: { state: StateSpec }) {
  return (
    <div className="py-3 text-center">
      <h2 className="text-lg font-semibold">Sign in</h2>
      <p className="mt-1 text-xs leading-5 text-subdued">
        Use your assigned User ID and password.
      </p>
      <div className="mx-auto mt-6 flex size-9 items-center justify-center rounded-full border-2 border-success text-success">
        ✓
      </div>
      <p className="mt-4 text-sm font-semibold">Signed in</p>
      <p className="mt-2 text-xs text-subdued">
        Taking you to your workspace...
      </p>
      <div className="mt-4 rounded-control border border-border bg-muted px-3 py-2 font-mono text-xs text-subdued">
        {state.role ?? "APPROVED_BY"} → workspace
      </div>
    </div>
  );
}
