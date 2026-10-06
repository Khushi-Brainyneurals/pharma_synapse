import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { getPostLoginPath } from "../../../app/routing/postLoginPath";
import { ROUTES } from "../../../app/routing/routes";
import { Button } from "../../../shared/ui/Button";
import { Input } from "../../../shared/ui/Input";
import { PasswordInput } from "../../../shared/ui/PasswordInput";
import { Select } from "../../../shared/ui/Select";
import { login } from "../api/auth.api";
import { getLoginFeedback, isPasswordExpired, type LoginFeedback } from "../api/auth.errors";
import { AuthNotice } from "../components/AuthNotice";
import { AuthShell } from "../components/AuthShell";
import { loginSchema, type LoginFormValues } from "../model/login.schema";
import { LOGIN_ROLE_OPTIONS, USER_ROLES, type UserRole } from "../model/roles";
import { useAuthStore } from "../state/auth.store";
import { Info } from 'lucide-react';

type LoginLocationState = {
  authNotice?: LoginFeedback;
};

type LoginTab = "user" | "admin";

// Sign-in lands on the dashboard; resume belongs to each document card.
function postLoginTarget(role: UserRole): string {
  return getPostLoginPath(role);
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LoginLocationState | null;
  const [feedback, setFeedback] = useState<LoginFeedback | null>(null);
  const [activeTab, setActiveTab] = useState<LoginTab>("user");
  const visibleFeedback = feedback ?? locationState?.authNotice ?? null;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setSession = useAuthStore((state) => state.setSession);
  const user = useAuthStore((state) => state.user);

  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      role: "",
    },
  });

  function handleTabChange(tab: LoginTab) {
    if (tab === activeTab) {
      return;
    }
    setActiveTab(tab);
    clearErrors("role");
    setValue("role", tab === "admin" ? USER_ROLES.ADMIN : "", { shouldValidate: false });
  }

  if (isAuthenticated && user) {
    return <Navigate to={postLoginTarget(user.role)} replace />;
  }

  async function onSubmit(values: LoginFormValues) {
    setFeedback(null);

    try {
      const session = await login({
        username: values.username.trim(),
        password: values.password,
        role: values.role as UserRole,
      });

      setSession(session);
      navigate(postLoginTarget(session.user.role), { replace: true });
    } catch (error) {
      // An expired password isn't a dead end: the user cannot sign in, so send them to
      // the one place that can fix it. Telling them to set a new password without
      // offering anywhere to do it would trap them.
      if (isPasswordExpired(error)) {
        navigate(ROUTES.setPassword, {
          state: { username: values.username.trim() },
        });
        return;
      }

      setFeedback(getLoginFeedback(error));
    }
  }

  return (
    <AuthShell>
      <section className="rounded-panel border border-border bg-surface px-8 py-8 shadow-auth">
        <header>
          <h1 className="text-2xl font-semibold text-text">Sign in</h1>
          <p className="mt-1 text-base leading-6 text-subdued">
            Use your assigned User ID and password.
          </p>
        </header>

        <div
          role="tablist"
          aria-label="Sign in as"
          className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
        >
          <button
            type="button"
            role="tab"
            id="login-tab-user"
            aria-selected={activeTab === "user"}
            aria-controls="login-form-panel"
            disabled={isSubmitting}
            className={`min-h-9 rounded-full text-sm font-semibold transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-70 ${
              activeTab === "user"
                ? "bg-surface text-primary shadow-md border border-primary"
                : "text-subdued hover:text-text"
            }`}
            onClick={() => handleTabChange("user")}
          >
            User
          </button>
          <button
            type="button"
            role="tab"
            id="login-tab-admin"
            aria-selected={activeTab === "admin"}
            aria-controls="login-form-panel"
            disabled={isSubmitting}
            className={`min-h-9 rounded-full text-sm font-semibold transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-70 ${
              activeTab === "admin"
                ? "bg-surface text-primary shadow-md border border-primary"
                : "text-subdued hover:text-text"
            }`}
            onClick={() => handleTabChange("admin")}
          >
            Admin
          </button>
        </div>

        <form
          id="login-form-panel"
          role="tabpanel"
          aria-labelledby={activeTab === "user" ? "login-tab-user" : "login-tab-admin"}
          className="mt-5 space-y-5"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <AuthNotice message={visibleFeedback?.message} variant={visibleFeedback?.variant} />

          <Input
            id="username"
            label="User ID"
            autoComplete="username"
            placeholder="e.g. U-0427"
            error={errors.username?.message}
            disabled={isSubmitting}
            isRequired
            {...register("username")}
          />

          <PasswordInput
            id="password"
            label="Password"
            autoComplete="current-password"
            error={errors.password?.message}
            disabled={isSubmitting}
            isRequired
            {...register("password")}
          />

          {activeTab === "user" ? (
            <Select
              id="role"
              label="Role"
              error={errors.role?.message}
              options={LOGIN_ROLE_OPTIONS}
              placeholder="Select your role"
              disabled={isSubmitting}
              isRequired
              {...register("role")}
            />
          ) : null}

          <div className="space-y-4">
            <Button type="submit" isLoading={isSubmitting}>
              Sign in
            </Button>
          </div>
        </form>

        <p className="mt-6 flex items-start gap-2 rounded-control border border-border bg-muted px-3 py-3 text-sm leading-6 text-subdued">
          <Info className="mt-1.5 size-4 shrink-0" />
          <span>
            Password resets are handled by your site administrator. Contact your administrator.
          </span>
        </p>
      </section>
    </AuthShell>
  );
}
