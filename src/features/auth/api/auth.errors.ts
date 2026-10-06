import axios from "axios";

export type LoginFeedbackVariant = "danger" | "info" | "success";

export interface LoginFeedback {
  variant: LoginFeedbackVariant;
  message: string;
}

const GENERIC_LOGIN_FEEDBACK: LoginFeedback = {
  variant: "danger",
  message: "The User ID or password you entered is incorrect.",
};

export function getLoginFeedback(error: unknown): LoginFeedback {
  if (!axios.isAxiosError(error)) {
    return GENERIC_LOGIN_FEEDBACK;
  }

  const status = error.response?.status;
  const code = String(error.response?.data?.code ?? "").toUpperCase();

  if (status === 423 || code === "ACCOUNT_LOCKED") {
    return {
      variant: "danger",
      message:
        "Your account is locked after multiple failed sign-in attempts. Contact your administrator to unlock it.",
    };
  }

  if (status === 409 || code === "PASSWORD_EXPIRED") {
    return {
      variant: "info",
      message:
        "Your password has expired. You'll be asked to set a new one before continuing.",
    };
  }

  if (status === 403 || code === "ROLE_MISMATCH") {
    return {
      variant: "danger",
      message:
        "This account isn't assigned the selected role. Choose the role that matches your account.",
    };
  }

  if (code === "ACCOUNT_DEACTIVATED") {
    return {
      variant: "danger",
      message: "This account is deactivated. Contact your administrator.",
    };
  }

  if (status === 503 || code === "SERVICE_UNREACHABLE") {
    return {
      variant: "danger",
      message:
        "Can't reach the sign-in service. Check your connection and try again.",
    };
  }

  return GENERIC_LOGIN_FEEDBACK;
}

/** True when the server refused the login because the password must be changed. */
export function isPasswordExpired(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const code = String(error.response?.data?.code ?? "").toUpperCase();
  return error.response?.status === 409 || code === "PASSWORD_EXPIRED";
}
