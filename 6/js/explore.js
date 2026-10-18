"use strict";

// Keep the explorer's functions and variables out of the global scope.
(function initializeExplorer() {
    const DATA_URL = "js/solarsystem.json";
    const REQUEST_TIMEOUT_MS = 15000;

    const UI = {
        heading: document.getElementById("explore-heading"),
        step: document.getElementById("step-label"),
        description: document.getElementById("explore-description"),
        status: document.getElementById("load-status"),
        retry: document.getElementById("retry-button"),
        categoriesButton: document.getElementById("categories-button"),
        objectsButton: document.getElementById("objects-button"),
        content: document.getElementById("explorer-content"),
        choices: document.getElementById("choices"),
        details: document.getElementById("object-details")
    };

    // Create an element using textContent so data is treated as text.
    function createElement(tagName, text = "", className = "") {
        const ELEMENT = document.createElement(tagName);

        ELEMENT.textContent = text;

        if (className) {
            ELEMENT.className = className;
        }

        return ELEMENT;
    }

    // Create an object image with a source link and a failure fallback.
    function createFigure(object, largeImage = false) {
        const FIGURE = document.createElement("figure");
        const IMAGE = document.createElement("img");
        const CAPTION = document.createElement("figcaption");
        const SOURCE = createElement(
            "a",
            "Image credits and information: NASA"
        );

        IMAGE.alt = object.alt;
        IMAGE.loading = "lazy";
        IMAGE.className = largeImage ? "object-image" : "choice-image";

        SOURCE.href = object.source;
        CAPTION.append(SOURCE);

        IMAGE.addEventListener("error", function handleImageError() {
            IMAGE.hidden = true;

            const MESSAGE = createElement(
                "p",
                "This image is unavailable. You can still read the facts below.",
                "form-note"
            );

            FIGURE.prepend(MESSAGE);
        }, { once: true });

        IMAGE.src = object.image;
        FIGURE.append(IMAGE, CAPTION);

        return FIGURE;
    }

    // Create a selection button with information for the click handler.
    function createChoiceButton(label, action, index) {
        const BUTTON = createElement("button", label, "button");

        BUTTON.type = "button";
        BUTTON.dataset.action = action;
        BUTTON.dataset.index = String(index);

        return BUTTON;
    }

    // Update the visible heading and instructions for the current step.
    function updateHeading(title, step, description) {
        UI.heading.textContent = title;
        UI.step.textContent = step;
        UI.description.textContent = description;
        UI.status.textContent = "";
    }

    // Display category cards using the first object as each preview image.
    function renderCategories(categories) {
        updateHeading(
            "Choose a category",
            "Step 1 of 2",
            "Select a category to see the objects you can explore."
        );

        UI.choices.replaceChildren();
        UI.choices.hidden = false;
        UI.details.hidden = true;
        UI.categoriesButton.hidden = true;
        UI.objectsButton.hidden = true;

        categories.forEach(function renderCategory(category, index) {
            const CARD = createElement("article", "", "choice");
            const HEADING = createElement("h2", category.name);
            const DESCRIPTION = createElement("p", category.description);
            const FIGURE = createFigure(category.objects[0]);
            const BUTTON = createChoiceButton(
                "Explore " + category.name,
                "category",
                index
            );

            CARD.append(FIGURE, HEADING, DESCRIPTION, BUTTON);
            UI.choices.append(CARD);
        });
    }

    // Display the objects belonging to the selected category.
    function renderObjects(category) {
        updateHeading(
            "Choose an object: " + category.name,
            "Step 2 of 2",
            category.description
        );

        UI.choices.replaceChildren();
        UI.choices.hidden = false;
        UI.details.hidden = true;
        UI.categoriesButton.hidden = false;
        UI.objectsButton.hidden = true;

        category.objects.forEach(function renderObject(object, index) {
            const CARD = createElement("article", "", "choice");
            const HEADING = createElement("h2", object.name);
            const DESCRIPTION = createElement("p", object.type);
            const FIGURE = createFigure(object);
            const BUTTON = createChoiceButton(
                "Learn about " + object.name,
                "object",
                index
            );

            CARD.append(FIGURE, HEADING, DESCRIPTION, BUTTON);
            UI.choices.append(CARD);
        });
    }

    // Build a definition list containing an object's main facts.
    function createFacts(object) {
        const LIST = createElement("dl", "", "facts");
        const ENTRIES = [
            ["Object type", object.type],
            ["Size", object.size],
            ["Location or distance", object.location]
        ];

        for (const [LABEL, VALUE] of ENTRIES) {
            const ROW = document.createElement("div");
            const TERM = createElement("dt", LABEL);
            const DESCRIPTION = createElement("dd", VALUE);

            ROW.append(TERM, DESCRIPTION);
            LIST.append(ROW);
        }

        return LIST;
    }

    // Display the selected object's complete educational information.
    function renderDetails(object) {
        updateHeading(
            object.name,
            "Your discovery",
            "Explore these facts, then choose another object or category."
        );

        UI.choices.hidden = true;
        UI.details.hidden = false;
        UI.categoriesButton.hidden = false;
        UI.objectsButton.hidden = false;
        UI.details.replaceChildren();

        const FIGURE = createFigure(object, true);
        const INFORMATION = document.createElement("div");
        const HEADING = createElement("h2", "About " + object.name);
        const DESCRIPTION = createElement("p", object.description);
        const FACTS = createFacts(object);
        const FACT_HEADING = createElement("h3", "Interesting fact");
        const FACT = createElement("p", object.fact);

        INFORMATION.append(
            HEADING,
            DESCRIPTION,
            FACTS,
            FACT_HEADING,
            FACT
        );

        UI.details.append(FIGURE, INFORMATION);
    }

    // Reject incomplete JSON before any of it is displayed.
    function validateData(data) {
        const REQUIRED_FIELDS = [
            "name",
            "type",
            "description",
            "size",
            "location",
            "fact",
            "image",
            "alt",
            "source"
        ];

        if (!data || !Array.isArray(data.categories)) {
            throw new Error("The category list is missing.");
        }

        if (data.categories.length === 0) {
            throw new Error("The category list is empty.");
        }

        for (const CATEGORY of data.categories) {
            if (
                !CATEGORY ||
                typeof CATEGORY.name !== "string" ||
                typeof CATEGORY.description !== "string" ||
                !Array.isArray(CATEGORY.objects) ||
                CATEGORY.objects.length === 0
            ) {
                throw new Error("A category is incomplete.");
            }

            for (const OBJECT of CATEGORY.objects) {
                for (const FIELD of REQUIRED_FIELDS) {
                    if (
                        !OBJECT ||
                        typeof OBJECT[FIELD] !== "string" ||
                        OBJECT[FIELD].trim() === ""
                    ) {
                        throw new Error("An object is incomplete.");
                    }
                }
            }
        }

        return data.categories;
    }

    // Fetch the external JSON and stop requests that take too long.
    async function fetchCategories() {
        const CONTROLLER = new AbortController();

        const TIMEOUT_ID = window.setTimeout(
            function cancelSlowRequest() {
                CONTROLLER.abort();
            },
            REQUEST_TIMEOUT_MS
        );

        try {
            const RESPONSE = await fetch(DATA_URL, {
                signal: CONTROLLER.signal
            });

            if (!RESPONSE.ok) {
                throw new Error("The data request failed.");
            }

            const DATA = await RESPONSE.json();

            return validateData(DATA);
        } finally {
            window.clearTimeout(TIMEOUT_ID);
        }
    }

    // Connect the page controls and keep selection state inside this function.
    function setUpExplorer() {
        let categories = [];
        let selectedCategory = null;

        // Load categories while keeping navigation and static content usable.
        async function loadAndShowCategories(moveFocus = false) {
            UI.status.textContent = "Loading solar system information...";
            UI.retry.hidden = true;
            UI.content.setAttribute("aria-busy", "true");

            try {
                categories = await fetchCategories();
                selectedCategory = null;

                renderCategories(categories);

                UI.status.textContent =
                    categories.length + " categories loaded. Choose one to begin.";

                if (moveFocus) {
                    UI.heading.focus();
                }
            } catch {
                UI.status.textContent =
                    "Unable to load the solar system information. " +
                    "Check your connection and select Try Again.";

                UI.retry.hidden = false;

                if (moveFocus) {
                    UI.retry.focus();
                }
            } finally {
                UI.content.setAttribute("aria-busy", "false");
            }
        }

        // Handle dynamically created category and object buttons.
        function handleChoiceClick(event) {
            const BUTTON = event.target.closest("button[data-action]");

            if (!BUTTON || !UI.choices.contains(BUTTON)) {
                return;
            }

            const INDEX = Number(BUTTON.dataset.index);

            if (BUTTON.dataset.action === "category") {
                selectedCategory = categories[INDEX];
                renderObjects(selectedCategory);
            } else if (
                BUTTON.dataset.action === "object" &&
                selectedCategory
            ) {
                renderDetails(selectedCategory.objects[INDEX]);
            }

            UI.heading.focus();
        }

        // Return to the first step without fetching the JSON again.
        function returnToCategories() {
            selectedCategory = null;
            renderCategories(categories);
            UI.heading.focus();
        }

        // Return to the objects within the currently selected category.
        function returnToObjects() {
            if (selectedCategory) {
                renderObjects(selectedCategory);
                UI.heading.focus();
            }
        }

        // Retry a failed data request after the user selects Try Again.
        function retryLoading() {
            loadAndShowCategories(true);
        }

        UI.choices.addEventListener("click", handleChoiceClick);
        UI.categoriesButton.addEventListener("click", returnToCategories);
        UI.objectsButton.addEventListener("click", returnToObjects);
        UI.retry.addEventListener("click", retryLoading);

        loadAndShowCategories();
    }

    setUpExplorer();
})();
