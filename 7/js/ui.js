export function status(id, message = "", kind = "") {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.textContent = message;
  element.dataset.kind = kind;
}

export function busy(form, working) {
  form.querySelector("fieldset").disabled = working;
  form.setAttribute("aria-busy", String(working));
}

export function errorText(error) {
  const hints = {
    "auth/invalid-credential":
      "Check your email and password, then try again.",

    "auth/invalid-login-credentials":
      "Check your email and password, then try again.",

    "auth/wrong-password":
      "The password is incorrect.",

    "auth/email-already-in-use":
      "This email already has an account. Try logging in.",

    "auth/weak-password":
      "Choose a stronger password.",

    "auth/operation-not-allowed":
      "Email/password sign-in has not been enabled for this app.",

    "auth/network-request-failed":
      "Check your internet connection and try again.",

    "auth/too-many-requests":
      "Too many attempts. Wait a little before trying again.",

    "auth/requires-recent-login":
      "Log in again before changing your password.",

    "PERMISSION_DENIED":
      "The database denied this action. Check your sign-in and rules.",

    "permission-denied":
      "The database denied this action. Check your sign-in and rules."
  };

  const message =
    error?.message ||
    "The request could not be completed. Please try again.";

  if (hints[error?.code]) {
    return `${hints[error.code]} ${message}`;
  }

  return message;
}

export function allowedDestination(value) {
  const allowedPages = [
    "explore.html",
    "information.html",
    "contact.html",
    "password.html"
  ];

  return allowedPages.includes(value)
    ? value
    : "explore.html";
}
