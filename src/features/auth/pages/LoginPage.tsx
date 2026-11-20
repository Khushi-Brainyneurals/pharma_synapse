import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getPostLoginPath } from "../../../app/routing/postLoginPath";
import { ROUTES } from "../../../app/routing/routes";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { Callout } from "../../../shared/ui/Callout";
import { Button } from "../../../shared/ps/Button";
import { Field, inputClass, labelClass } from "../../../shared/ps/Field";
import { Icon } from "../../../shared/ps/Icon";
import { TILE_FAMILY } from "../../../shared/ps/IconTile";
import { Logo } from "../../../shared/ps/Logo";
import { PasswordInput } from "../../../shared/ps/PasswordInput";
import { InfoTip } from "../../../shared/ps/Tooltip";
import { getModuleVisual } from "../../modules/model/modules";
import { getRememberedModule, getRememberedModuleDescription, getRememberedModuleName, rememberModule } from "../../modules/model/selectedModule";
import { getModuleRoles, type ModuleRolesResponse } from "../../modules/api/modules.api";
import { login } from "../api/auth.api";
import { getLoginFeedback, isPasswordExpired, type LoginFeedback } from "../api/auth.errors";
import { AuthShell } from "../components/AuthShell";
import { RoleFieldset, RoleFieldsetSkeleton } from "../components/RoleFieldset";
import { groupApiRoles } from "../model/loginRoles";
import { loginSchema, type LoginFormValues } from "../model/login.schema";
import type { UserRole } from "../model/roles";
import { useAuthStore } from "../state/auth.store";

type LoginLocationState = {
  authNotice?: LoginFeedback;
};

const NOTICE_STYLE: Record<LoginFeedback["variant"], { box: string; icon: string; iconClass: string }> = {
  danger: { box: "border-rose-200 bg-rose-50", icon: "error", iconClass: "text-danger-text" },
  info: { box: "border-harbor-200 bg-primary-soft", icon: "info", iconClass: "text-primary" },
  success: { box: "border-sage-200 bg-sage-50", icon: "check_circle", iconClass: "text-sage-700" },
};

/**
 * Sign-in, in the landing design. Opened from the module map with ?module=<key>,
 * it names the module. A successful sign-in goes to the dashboard (admins go to
 * employee management), an expired password goes to set a new one.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);

  const moduleKey = params.get("module") ?? getRememberedModule() ?? undefined;
  const moduleName = moduleKey && getRememberedModule() === moduleKey ? getRememberedModuleName() : null;
  const moduleDescription = moduleKey && getRememberedModule() === moduleKey ? getRememberedModuleDescription() : null;
  const module = moduleKey && moduleName
    ? { key: moduleKey, name: moduleName, description: moduleDescription, ...getModuleVisual(moduleKey) }
    : null;
  const [rolesResponse, setRolesResponse] = useState<ModuleRolesResponse | null>(null);
  const [rolesLoading, setRolesLoading] = useState(Boolean(moduleKey));
  const [rolesError, setRolesError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRolesResponse(null);
    setRolesError(null);
    if (!moduleKey) {
      setRolesLoading(false);
      return () => { active = false; };
    }
    setRolesLoading(true);
    getModuleRoles(moduleKey)
      .then((response) => { if (active) setRolesResponse(response); })
      .catch((cause: unknown) => {
        if (active) setRolesError(getApiErrorMessage(cause, "Available roles could not be loaded. Please try again."));
      })
      .finally(() => { if (active) setRolesLoading(false); });
    return () => { active = false; };
  }, [moduleKey]);

  const roleGroups = rolesResponse ? groupApiRoles(rolesResponse.roles) : [];

  const [capsOn, setCapsOn] = useState(false);
  const [feedback, setFeedback] = useState<LoginFeedback | null>(null);
  const locationNotice = (location.state as LoginLocationState | null)?.authNotice ?? null;
  const notice = feedback ?? locationNotice;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "", role: "" },
  });

  if (isAuthenticated && user) {
    return <Navigate to={getPostLoginPath(user.role)} replace />;
  }

  async function onSubmit(values: LoginFormValues) {
    setFeedback(null);
    if (
      !moduleKey ||
      rolesLoading ||
      rolesError ||
      !rolesResponse?.module_login_available ||
      !rolesResponse.roles.some((role) => role.key === values.role)
    ) {
      setFeedback({ variant: "danger", message: "Select a role available for this module." });
      return;
    }
    try {
      const session = await login({
        username: values.username.trim(),
        password: values.password,
        role: values.role as UserRole,
        module: moduleKey,
      });
      if (module) rememberModule(module.key, module.name, module.description ?? undefined);
      setSession(session);
      navigate(getPostLoginPath(session.user.role), { replace: true });
    } catch (error) {
      // An expired password isn't a dead end: send them to the one place that fixes it.
      if (isPasswordExpired(error)) {
        navigate(ROUTES.setPassword, { state: { username: values.username.trim() } });
        return;
      }
      setFeedback(getLoginFeedback(error));
    }
  }

  const trackCaps = (e: KeyboardEvent<HTMLInputElement>) => setCapsOn(e.getModifierState?.("CapsLock") ?? false);
  const noticeStyle = notice ? NOTICE_STYLE[notice.variant] : null;

  return (
    <AuthShell>
      <section
        aria-labelledby="screen-title"
        className="frosted-card flex flex-col gap-5 rounded-card border border-border p-6 shadow-card backdrop-blur-frame backdrop-saturate-150"
      >
        <div className="flex items-center justify-between gap-3">
          <Logo width={200} />
          <Button variant="ghost" icon="arrow_back" onClick={() => navigate(ROUTES.modules)}>
            Back to modules
          </Button>
        </div>

        {module ? (
          <div className="flex items-center gap-4">
            <span aria-hidden="true" className={`inline-flex size-[72px] flex-none items-center justify-center rounded-2xl ${TILE_FAMILY[module.family]}`}>
              <Icon name={module.icon} size={38} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 id="screen-title" className="m-0 text-lg font-medium leading-[26px] tracking-[-0.015em] text-text">
                Sign in to {module.name}
              </h1>
              <p className="m-0 text-[12.5px] leading-[18px] text-text-3">{module.description}</p>
            </div>
          </div>
        ) : null}

        <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          {!module ? (
            <div className="flex flex-col gap-1">
              <h1 id="screen-title" className="m-0 text-[28px] font-medium leading-9 tracking-[-0.01em] text-text">
                Sign in
              </h1>
            </div>
          ) : null}

          {notice && noticeStyle ? (
            <div
              role={notice.variant === "danger" ? "alert" : "status"}
              className={`flex items-start gap-2.5 rounded-control border px-3.5 py-2.5 text-sm leading-5 text-text ${noticeStyle.box}`}
            >
              <Icon name={noticeStyle.icon} className={noticeStyle.iconClass} />
              <span>{notice.message}</span>
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            <Field
              error={errors.username?.message}
              label={
                <div className="flex items-center gap-1">
                  <label className={labelClass} htmlFor="si-user">
                    User ID
                  </label>
                  <InfoTip label="About the user ID" text="Your employee user ID from your company admin. Not your email address." />
                </div>
              }
            >
              <input
                id="si-user"
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Such as SPL-1001"
                disabled={isSubmitting}
                aria-invalid={errors.username ? "true" : undefined}
                className={`${inputClass} font-mono tracking-[0.02em]`}
                {...register("username")}
              />
            </Field>

            <div className="flex flex-col gap-1.5">
              <Field
                error={errors.password?.message}
                label={
                  <label className={labelClass} htmlFor="si-pass">
                    Password
                  </label>
                }
              >
                <PasswordInput
                  id="si-pass"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  aria-invalid={errors.password ? "true" : undefined}
                  onKeyUp={trackCaps}
                  onKeyDown={trackCaps}
                  {...register("password")}
                />
              </Field>
              {capsOn ? (
                <p role="status" className="m-0 flex items-center gap-1.5 text-[12.5px] leading-[18px] text-[var(--lp-warning)]">
                  <Icon name="warning" size={14} />
                  <span>Caps Lock is on.</span>
                </p>
              ) : null}
            </div>

            {rolesLoading ? (
              <RoleFieldsetSkeleton />
            ) : null}
            {rolesError ? <Callout tone="danger" title="Unable to load roles">{rolesError}</Callout> : null}
            {!moduleKey ? <Callout title="Select a module">Choose a module before signing in.</Callout> : null}
            {!rolesLoading && !rolesError && rolesResponse && !rolesResponse.module_login_available ? (
              <Callout title="Sign-in unavailable">This module is not available for sign-in.</Callout>
            ) : null}
            {!rolesLoading && !rolesError && rolesResponse?.module_login_available && rolesResponse.roles.length === 0 ? (
              <Callout title="No roles available">There are no roles available for this module.</Callout>
            ) : null}
            {roleGroups.length > 0 ? (
              <RoleFieldset groups={roleGroups} field={register("role")} error={errors.role?.message} disabled={isSubmitting || rolesLoading} />
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <Button type="submit" className="w-full !min-h-10" isLoading={isSubmitting} loadingLabel="Signing in">
              Sign in
            </Button>
            <p className="m-0 flex items-start gap-1.5 text-[12.5px] leading-[18px] text-text-3">
              <Icon name="info" size={14} className="mt-0.5" />
              <span>Password resets are handled by your site administrator.</span>
            </p>
          </div>
        </form>
      </section>
    </AuthShell>
  );
}
