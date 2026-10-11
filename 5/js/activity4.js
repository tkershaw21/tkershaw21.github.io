// Location of the provided JSON file.
const dataURL = new URL("js/boardingData.json", document.baseURI);

// Fetch the snowboarding information.
async function loadSnowboarding() {
    try {
        const response = await fetch(dataURL);

        if (!response.ok) {
            throw new Error("Could not load the JSON file.");
        }

        const data = await response.json();
        updatePage(data);
    } catch (error) {
        console.error(error);
        alert("Unable to load the snowboarding information. Please try again.");
    }
}

// Update the existing page text and background image.
function updatePage(data) {
    document.title = data.title;

    document.getElementById("styleName").textContent = data.header;
    document.getElementById("heroTitle").textContent = data.hero.headline;
    document.getElementById("heroDesc").textContent = data.hero.description;

    // Resolve the image path relative to the JSON file.
    const imageURL = new URL(data.hero.image, dataURL);

    document.getElementById("heroSection").style.setProperty(
        "--hero-img",
        `url("${imageURL.href}")`
    );

    updateSection("sec1", data.sections.overview);
    updateSection("sec2", data.sections.equipment);
}

// Change section headings, subtitles, and existing card text.
function updateSection(sectionID, sectionData) {
    document.getElementById(sectionID + "Title").textContent =
        sectionData.title;

    document.getElementById(sectionID + "Subtitle").textContent =
        sectionData.subtitle;

    const cards = document.querySelectorAll(
        "#" + sectionID + "Grid .card"
    );

    cards.forEach(function (card, index) {
        card.querySelector("h3").textContent =
            sectionData.cards[index].title;

        card.querySelector("p").textContent =
            sectionData.cards[index].description;
    });
}

// Run when the existing Change button is clicked.
document.getElementById("changeThemeBtn").addEventListener(
    "click",
    loadSnowboarding
);
