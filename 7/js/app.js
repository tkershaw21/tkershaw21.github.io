import { connectFirebase } from "./firebase.js";

import {
  status,
  busy,
  errorText,
  allowedDestination
} from "./ui.js";

const page = document.body.dataset.page;

const protectedPage =
  document.body.dataset.protected === "true";

const nextPage = allowedDestination(
  new URLSearchParams(location.search).get("next")
);

let services;
let cleanupPage = () => {};
let activeUid = null;
let authRevision = 0;

/* Switch between login and signup forms. */

document.getElementById("show-login")
  ?.addEventListener("click", () => switchForm(false));

document.getElementById("show-signup")
  ?.addEventListener("click", () => switchForm(true));

function switchForm(signup) {
  document.getElementById("login-form").hidden = signup;
  document.getElementById("signup-form").hidden = !signup;

  document.getElementById("show-login")
    .setAttribute("aria-pressed", String(!signup));

  document.getElementById("show-signup")
    .setAttribute("aria-pressed", String(signup));

  document.getElementById(
    signup ? "signup-email" : "login-email"
  ).focus();
}

/* Login and signup. */

for (const name of ["login", "signup"]) {
  const form = document.getElementById(`${name}-form`);

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (
      !services ||
      form.getAttribute("aria-busy") === "true"
    ) {
      return;
    }

    const email = document
      .getElementById(`${name}-email`)
      .value.trim();

    const password = document
      .getElementById(`${name}-password`)
      .value;

    if (
      name === "signup" &&
      password !== document.getElementById("signup-confirm").value
    ) {
      status(
        "signup-status",
        "The passwords do not match.",
        "error"
      );

      document.getElementById("signup-confirm").focus();
      return;
    }

    busy(form, true);

    status(
      `${name}-status`,
      name === "login"
        ? "Logging in…"
        : "Creating your account…",
      "loading"
    );

    try {
      if (name === "signup") {
        await services.createUserWithEmailAndPassword(
          services.auth,
          email,
          password
        );
      } else {
        await services.signInWithEmailAndPassword(
          services.auth,
          email,
          password
        );
      }

      form.reset();
      location.assign(nextPage);
    } catch (error) {
      status(
        `${name}-status`,
        errorText(error),
        "error"
      );
    } finally {
      busy(form, false);
    }
  });
}

/* Logout. */

document.getElementById("logout")
  ?.addEventListener("click", async (event) => {
    const button = event.currentTarget;

    if (!services) {
      return;
    }

    button.disabled = true;
    status("app-status", "Logging out…", "loading");

    try {
      await services.signOut(services.auth);
      location.replace("index.html?loggedout=1");
    } catch (error) {
      status("app-status", errorText(error), "error");
      button.disabled = false;
    }
  });

/* Change password. */

document.getElementById("password-form")
  ?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.currentTarget;

    if (
      !services?.auth.currentUser ||
      form.getAttribute("aria-busy") === "true"
    ) {
      return;
    }

    const currentPassword =
      document.getElementById("current-password").value;

    const newPassword =
      document.getElementById("new-password").value;

    const confirmation =
      document.getElementById("confirm-password").value;

    if (newPassword !== confirmation) {
      status(
        "password-status",
        "The new passwords do not match.",
        "error"
      );

      document.getElementById("confirm-password").focus();
      return;
    }

    if (newPassword === currentPassword) {
      status(
        "password-status",
        "Choose a password different from your current password.",
        "error"
      );
      return;
    }

    busy(form, true);

    status(
      "password-status",
      "Verifying your current password and saving the new one…",
      "loading"
    );

    try {
      const user = services.auth.currentUser;

      const credential =
        services.EmailAuthProvider.credential(
          user.email,
          currentPassword
        );

      await services.reauthenticateWithCredential(
        user,
        credential
      );

      await services.updatePassword(
        user,
        newPassword
      );

      form.reset();

      document.getElementById("account-email").value =
        user.email;

      status(
        "password-status",
        "Your password has been changed. Use the new password " +
        "the next time you log in.",
        "success"
      );
    } catch (error) {
      status(
        "password-status",
        errorText(error),
        "error"
      );
    } finally {
      busy(form, false);
    }
  });

/* Show the correct page content for the user's login state. */

async function updateSession(user) {
  const revision = ++authRevision;

  document.getElementById("session-label").textContent =
    user
      ? `Signed in as ${user.email}`
      : "Sign in to open Explore, Learn, and Contact.";

  document.querySelectorAll("[data-member]")
    .forEach((element) => {
      element.hidden = !user;
    });

  if (!user) {
    activeUid = null;
    cleanupPage();
    cleanupPage = () => {};

    if (protectedPage) {
      document.getElementById("page-content").hidden = true;

      location.replace(
        `index.html?next=${encodeURIComponent(page + ".html")}#account`
      );

      return;
    }
  }

  if (page === "index") {
    document.getElementById("signed-in-home").hidden = !user;

    document.getElementById("signed-out-home").hidden =
      Boolean(user);

    const hero = document.getElementById("hero-action");

    hero.textContent = user
      ? "Open Explore"
      : "Sign in to explore";

    hero.href = user
      ? "explore.html"
      : "#account";

    document.getElementById("welcome-email").textContent =
      user?.email || "";

    document.getElementById("continue-link").href =
      nextPage;

    for (const name of ["login", "signup"]) {
      busy(
        document.getElementById(`${name}-form`),
        false
      );
    }

    const loggedOut =
      !user &&
      new URLSearchParams(location.search).has("loggedout");

    status(
      "app-status",
      loggedOut ? "You have been logged out." : ""
    );

    return;
  }

  if (user) {
    document.getElementById("auth-gate").hidden = true;
    document.getElementById("page-content").hidden = false;
    status("app-status");

    if (activeUid === user.uid) {
      return;
    }

    cleanupPage();
    activeUid = user.uid;

    if (page === "explore") {
      const module = await import("./explore.js");

      if (revision === authRevision) {
        cleanupPage = module.startExplore(services);
      }
    }

    if (page === "contact") {
      const module = await import("./contact.js");

      if (revision === authRevision) {
        cleanupPage = module.startContact(services, user);
      }
    }

    if (page === "password") {
      document.getElementById("account-email").value =
        user.email;
    }

    if (page === "information" && location.hash) {
      document.getElementById(
        location.hash.slice(1)
      )?.scrollIntoView();
    }
  }
}

function startupError(error) {
  status("app-status", errorText(error), "error");

  document.getElementById("session-label").textContent =
    "Sign-in unavailable. See the message below.";

  if (protectedPage) {
    document.getElementById("page-content").hidden = true;
    document.getElementById("auth-gate").hidden = false;

    document.getElementById("gate-title").textContent =
      "We couldn’t check your sign-in.";

    document.getElementById("gate-message").textContent =
      "Reload this page when the connection or setup " +
      "problem is resolved.";
  }
}

/* Check authentication again when restoring a cached Back-button page. */

window.addEventListener("pagehide", () => {
  cleanupPage();

  if (protectedPage) {
    document.getElementById("page-content").hidden = true;
  }
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    location.reload();
  }
});

/* Connect to Firebase. */

const slowStart = setTimeout(() => {
  status(
    "app-status",
    "Still connecting. Check your internet connection " +
    "if this continues.",
    "loading"
  );
}, 12000);

try {
  services = await connectFirebase();

  services.onAuthStateChanged(
    services.auth,

    (user) => {
      clearTimeout(slowStart);
      updateSession(user).catch(startupError);
    },

    (error) => {
      clearTimeout(slowStart);
      startupError(error);
    }
  );
} catch (error) {
  clearTimeout(slowStart);
  startupError(error);
}
