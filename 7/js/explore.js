import {
  status,
  errorText
} from "./ui.js";

export function validateCatalog(value) {
  if (
    !value?.categories ||
    typeof value.categories !== "object"
  ) {
    throw new Error(
      "The catalog is empty. Ask the project owner " +
      "to load the exploration data."
    );
  }

  const categories = Object.entries(value.categories);

  if (!categories.length) {
    throw new Error("There are no categories available yet.");
  }

  for (const [, category] of categories) {
    if (
      typeof category.name !== "string" ||
      typeof category.description !== "string" ||
      !category.objects ||
      !Object.keys(category.objects).length
    ) {
      throw new Error(
        "A catalog category is incomplete. " +
        "Please contact the project owner."
      );
    }

    for (const item of Object.values(category.objects)) {
      const requiredFields = [
        "name",
        "summary",
        "description",
        "type",
        "size",
        "location",
        "orbit",
        "fact",
        "image",
        "alt",
        "credit",
        "source"
      ];

      for (const field of requiredFields) {
        if (
          typeof item[field] !== "string" ||
          !item[field].trim()
        ) {
          throw new Error(
            "An object has missing details. " +
            "Please contact the project owner."
          );
        }
      }

      if (
        !item.image.startsWith("https://") ||
        !item.source.startsWith("https://")
      ) {
        throw new Error(
          "An object has an invalid image or source link."
        );
      }
    }
  }

  return value;
}

export function startExplore(services) {
  const {
    db,
    ref,
    onValue
  } = services;

  const params = new URLSearchParams(location.search);

  let catalog;
  let categoryId = params.get("category") || "";
  let objectId = params.get("object") || "";
  let unsubscribe = () => {};
  let slowTimer;
  let disposed = false;

  const element = (id) => document.getElementById(id);
  const retry = element("retry-explore");

  const sorted = (items) => {
    return Object.entries(items).sort(
      (a, b) => (a[1].order ?? 0) - (b[1].order ?? 0)
    );
  };

  function card(label, description, selected, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-card";

    button.setAttribute(
      "aria-pressed",
      String(selected)
    );

    const title = document.createElement("strong");
    title.textContent = label;

    const detail = document.createElement("span");
    detail.textContent = description;

    button.append(title, detail);
    button.addEventListener("click", action);

    return button;
  }

  function render() {
    const categories = element("category-buttons");
    categories.replaceChildren();

    for (const [id, category] of sorted(catalog.categories)) {
      categories.append(
        card(
          category.name,
          category.description,
          id === categoryId,

          () => {
            categoryId = id;
            objectId = "";
            render();
            element("object-title").focus();
          }
        )
      );
    }

    const category = catalog.categories[categoryId];

    element("object-step").hidden = !category;
    element("object-detail").hidden = true;
    element("object-buttons").replaceChildren();

    if (!category) {
      return;
    }

    element("object-title").textContent =
      `2. Choose an object — ${category.name}`;

    for (const [id, item] of sorted(category.objects)) {
      element("object-buttons").append(
        card(
          item.name,
          item.summary,
          id === objectId,

          () => {
            objectId = id;
            render();
            element("detail-title").focus();
          }
        )
      );
    }

    const item = category.objects[objectId];

    if (!item) {
      return;
    }

    element("object-detail").hidden = false;
    element("detail-title").textContent = item.name;
    element("detail-summary").textContent = item.summary;

    const img = element("detail-image");
    img.hidden = false;
    img.alt = item.alt;

    img.onerror = () => {
      img.hidden = true;

      status(
        "explore-status",
        "The image could not load. " +
        "The object details are still available.",
        "error"
      );
    };

    img.src = item.image;

    element("detail-credit").textContent = item.credit;
    element("detail-credit").href = item.source;
    element("detail-source").href = item.source;

    const facts = element("detail-facts");
    facts.replaceChildren();

    const factValues = [
      ["Object type", item.type],
      ["Size", item.size],
      ["Location / distance", item.location],
      ["Orbit / rotation", item.orbit]
    ];

    for (const [label, value] of factValues) {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const definition = document.createElement("dd");

      term.textContent = label;
      definition.textContent = value;

      row.append(term, definition);
      facts.append(row);
    }

    const description = element("detail-description");
    description.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = `Meet ${item.name}`;
    description.append(heading);

    for (const text of item.description.split(/\n\n/)) {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      description.append(paragraph);
    }

    element("detail-fun-fact").textContent = item.fact;
  }

  function load() {
    unsubscribe();
    clearTimeout(slowTimer);

    retry.hidden = true;
    element("explorer").hidden = true;

    status(
      "explore-status",
      "Loading worlds…",
      "loading"
    );

    slowTimer = setTimeout(() => {
      status(
        "explore-status",
        "Still waiting for the catalog. " +
        "Check your connection or try loading again.",
        "error"
      );

      retry.hidden = false;
    }, 12000);

    unsubscribe = onValue(
      ref(db, "catalog"),

      (snapshot) => {
        if (disposed) {
          return;
        }

        clearTimeout(slowTimer);

        try {
          catalog = validateCatalog(snapshot.val());
          render();

          element("explorer").hidden = false;
          retry.hidden = true;

          status(
            "explore-status",
            "Catalog loaded. Choose a category to begin.",
            "success"
          );
        } catch (error) {
          element("explorer").hidden = true;
          retry.hidden = false;

          status(
            "explore-status",
            errorText(error),
            "error"
          );
        }
      },

      (error) => {
        if (disposed) {
          return;
        }

        clearTimeout(slowTimer);
        element("explorer").hidden = true;
        retry.hidden = false;

        status(
          "explore-status",
          errorText(error),
          "error"
        );
      }
    );
  }

  const connectionOff = onValue(
    ref(db, ".info/connected"),

    (snapshot) => {
      if (disposed || !catalog) {
        return;
      }

      const connected = snapshot.val();

      status(
        "explore-status",

        connected
          ? "Connected. Your catalog is up to date."
          : "Connection interrupted. Displayed details may be " +
            "out of date; reconnect to receive updates.",

        connected ? "success" : "error"
      );
    }
  );

  const backCategories = () => {
    categoryId = "";
    objectId = "";
    render();

    element("category-buttons")
      .querySelector("button")
      ?.focus();
  };

  const backObjects = () => {
    objectId = "";
    render();

    element("object-buttons")
      .querySelector("button")
      ?.focus();
  };

  retry.addEventListener("click", load);

  element("back-categories")
    .addEventListener("click", backCategories);

  element("back-objects")
    .addEventListener("click", backObjects);

  load();

  return () => {
    disposed = true;

    unsubscribe();
    connectionOff();
    clearTimeout(slowTimer);

    retry.removeEventListener("click", load);

    element("back-categories")
      .removeEventListener("click", backCategories);

    element("back-objects")
      .removeEventListener("click", backObjects);

    element("explorer").hidden = true;
    element("category-buttons").replaceChildren();
    element("object-buttons").replaceChildren();

    catalog = null;
  };
}
