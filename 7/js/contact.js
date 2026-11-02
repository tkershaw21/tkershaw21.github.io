import {
  status,
  busy,
  errorText
} from "./ui.js";

export function validateContact({
  name,
  subject,
  message
}) {
  if (name.length < 2 || name.length > 80) {
    throw new Error(
      "Enter a name between 2 and 80 characters."
    );
  }

  const subjects = [
    "General question",
    "Report a correction",
    "Suggest an object",
    "Website feedback"
  ];

  if (!subjects.includes(subject)) {
    throw new Error("Choose a subject.");
  }

  if (message.length < 20 || message.length > 1500) {
    throw new Error(
      "Write a message between 20 and 1,500 characters."
    );
  }
}

export function startContact(services, user) {
  const form = document.getElementById("contact-form");
  const email = document.getElementById("contact-email");

  email.value = user.email;

  let sending = false;
  let disposed = false;
  let waitingTimer;

  const beforeLeave = (event) => {
    if (sending) {
      event.preventDefault();
      event.returnValue = "";
    }
  };

  const submit = async (event) => {
    event.preventDefault();

    if (sending || disposed) {
      return;
    }

    if (services.auth.currentUser?.uid !== user.uid) {
      status(
        "contact-status",
        "Please log in again before sending your message.",
        "error"
      );
      return;
    }

    const data = {
      name: document
        .getElementById("contact-name")
        .value.trim(),

      email: user.email,

      subject: document
        .getElementById("contact-subject")
        .value,

      message: document
        .getElementById("contact-message")
        .value.trim()
    };

    try {
      validateContact(data);
    } catch (error) {
      status(
        "contact-status",
        errorText(error),
        "error"
      );
      return;
    }

    if (!navigator.onLine) {
      status(
        "contact-status",
        "You are offline. Reconnect before sending. " +
        "Your message is still in the form.",
        "error"
      );
      return;
    }

    sending = true;
    busy(form, true);

    status(
      "contact-status",
      "Sending your message…",
      "loading"
    );

    waitingTimer = setTimeout(() => {
      if (!disposed) {
        status(
          "contact-status",
          "Still waiting for confirmation. Keep this page open " +
          "and check your connection. Your message has not " +
          "been confirmed saved yet.",
          "loading"
        );
      }
    }, 12000);

    try {
      const messageRef = services.push(
        services.ref(
          services.db,
          `contacts/${user.uid}`
        )
      );

      await services.set(messageRef, {
        ...data,
        createdAt: services.serverTimestamp()
      });

      if (disposed) {
        return;
      }

      form.reset();
      email.value = user.email;

      status(
        "contact-status",
        "Thank you! Your message was received and saved. " +
        `Reference: ${messageRef.key}`,
        "success"
      );
    } catch (error) {
      if (!disposed) {
        status(
          "contact-status",
          `Your message was not saved. ${errorText(error)}`,
          "error"
        );
      }
    } finally {
      clearTimeout(waitingTimer);
      sending = false;

      if (!disposed) {
        busy(form, false);
      }
    }
  };

  form.addEventListener("submit", submit);
  window.addEventListener("beforeunload", beforeLeave);

  return () => {
    disposed = true;
    clearTimeout(waitingTimer);

    form.removeEventListener("submit", submit);
    window.removeEventListener("beforeunload", beforeLeave);

    form.reset();
  };
}
