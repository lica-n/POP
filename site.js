const catalogue = { frbs: [], pulsars: [], fields: { frb: [], pulsar: [] }, showMedia: { frb: false, pulsar: false } };

// Shortcut for getElementById
const byId = (id) => document.getElementById(id);
// Detect static mirror deployment mode
const staticMirror = document.documentElement.dataset.staticMirror === "true";
// Set data source endpoints based on deployment mode
const contentEndpoint = staticMirror ? "./content.json" : "/api/content";
const catalogEndpoint = staticMirror ? "./catalog.json" : "/api/catalog";

// Global pagination config
let currentPage = 1;
const pageSize = 20;
// Store filtered full dataset for pagination & export
let fullFilteredFrbs = [];
let fullFilteredPulsars = [];

/**
 * Create standard table cell element
 * @param {string|null} value Cell display content
 * @param {string} className Optional CSS class name
 * @returns {HTMLTableCellElement} Generated <td> node
 */
const cell = (value, className = "") => {
  const element = document.createElement("td");
  if (className) element.className = className;
  element.textContent = value ?? "—";
  return element;
};

/**
 * Format numeric value with fixed decimal digits
 * @param {number|null} value Raw numeric input
 * @param {number} digits Decimal precision count
 * @returns {string} Formatted number or placeholder dash
 */
const number = (value, digits = 2) => value == null ? "—" : Number(value).toFixed(digits);

/**
 * Format value to 6 significant figures for scientific parameters
 * @param {number|null} value Raw numeric input
 * @returns {string} Formatted value or placeholder dash
 */
const significant = (value) => {
  const numeric = Number(value);
  return value == null || !Number.isFinite(numeric) ? "—" : numeric.toPrecision(6);
};

/**
 * Copy plain text content to system clipboard
 * @param {string} text Text to copy
 */
function copyText(text) {
  navigator.clipboard.writeText(text.trim());
  alert("Copied to clipboard");
}

/**
 * Generate coordinate cell with built-in copy button
 * @param {string} text Coordinate string to display & copy
 * @returns {HTMLTableCellElement} Coordinate cell with copy button
 */
function coordCell(text) {
  const td = cell(text, "coord");
  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-btn";
  copyBtn.textContent = "Copy";
  copyBtn.onclick = () => copyText(text);
  td.appendChild(copyBtn);
  return td;
}

/**
 * Append custom metadata field columns to table row
 * @param {HTMLTableRowElement} row Target table row
 * @param {object} item Single catalogue source entry
 * @param {Array} fields Custom field definition list
 * @returns {HTMLTableRowElement} Modified table row
 */
function addCustomCells(row, item, fields) {
  fields.forEach((field) => row.append(cell(item.custom_values?.[field.key] ?? "—")));
  return row;
}

/**
 * Append media figure link column to table row if media data exists
 * @param {HTMLTableRowElement} row Target table row
 * @param {object} item Single catalogue source entry
 * @param {boolean} visible Flag to toggle media column rendering
 * @returns {HTMLTableRowElement} Modified table row
 */
function addMediaCell(row, item, visible) {
  if (!visible) return row;
  const container = document.createElement("td");
  const images = Array.isArray(item.media) ? item.media : [];
  images.forEach((image, index) => {
    if (index) container.append(document.createTextNode(" · "));
    const link = document.createElement("a");
    link.href = image.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = image.caption || `Figure ${index + 1}`;
    container.append(link);
  });
  if (!images.length) container.textContent = "—";
  row.append(container);
  return row;
}

/**
 * Build complete table row for single FRB source entry
 * @param {object} item Single FRB catalogue record
 * @returns {HTMLTableRowElement} Fully assembled FRB table row
 */
function addFrbRow(item) {
  const row = document.createElement("tr");
  const name = cell("");
  const strong = document.createElement("strong");
  strong.textContent = item.frb_name;
  const id = document.createElement("small");
  id.textContent = item.frb_id;
  name.append(strong, id);
  // Combine RA & Dec into one coordinate cell with copy button
  const raDecText = `${item.ra}\n${item.dec}`;
  row.append(
    name,
    coordCell(raDecText),
    cell(item.burst_count),
    cell(number(item.max_dm, 1)),
    cell(item.note || "—"),
  );
  return addMediaCell(addCustomCells(row, item, catalogue.fields.frb), item, catalogue.showMedia.frb);
}

/**
 * Build complete table row for single pulsar source entry
 * @param {object} item Single pulsar catalogue record
 * @returns {HTMLTableRowElement} Fully assembled pulsar table row
 */
function addPulsarRow(item) {
  const row = document.createElement("tr");
  // Separate RA & Dec coordinate cells each with copy button
  row.append(
    cell(item.display_name),
    cell(item.catalog_id),
    coordCell(item.ra),
    coordCell(item.dec),
    cell(number(item.dm)),
    cell(significant(item.period_s)),
  );
  return addMediaCell(addCustomCells(row, item, catalogue.fields.pulsar), item, catalogue.showMedia.pulsar);
}

/**
 * Dynamically inject custom field & media column table headers
 * @param {string} tableId Target table DOM ID
 * @param {Array} fields Custom field definition list
 * @param {boolean} showMedia Flag to render media figure header
 */
function addCustomHeaders(tableId, fields, showMedia) {
  const headerRow = byId(tableId).tHead.rows[0];
  // Remove old dynamic headers before re-rendering
  headerRow.querySelectorAll(".custom-field, .media-field").forEach((header) => header.remove());
  fields.forEach((field) => {
    const header = document.createElement("th");
    header.className = "custom-field";
    header.textContent = field.label;
    headerRow.append(header);
  });
  if (showMedia) {
    const header = document.createElement("th");
    header.className = "media-field";
    header.textContent = "Figures";
    headerRow.append(header);
  }
}

/**
 * Filter dataset by search keyword & render current pagination slice to tables
 */
function draw() {
  const query = byId("catalogue-search").value.toLowerCase();
  // Filter all catalogue entries by search text
  const filterItem = (item) => JSON.stringify(item).toLowerCase().includes(query);
  fullFilteredFrbs = catalogue.frbs.filter(filterItem);
  fullFilteredPulsars = catalogue.pulsars.filter(filterItem);

  // Slice filtered dataset for current page
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = currentPage * pageSize;
  const pageFrbs = fullFilteredFrbs.slice(startIdx, endIdx);
  const pagePulsars = fullFilteredPulsars.slice(startIdx, endIdx);

  // Clear old table content & inject new page rows
  byId("frb-table").tBodies[0].replaceChildren(...pageFrbs.map(addFrbRow));
  byId("pulsar-table").tBodies[0].replaceChildren(...pagePulsars.map(addPulsarRow));

  // Update page number display & match count status text
  byId("page-info").textContent = `Page ${currentPage}`;
  const totalMatch = fullFilteredFrbs.length + fullFilteredPulsars.length;
  byId("catalogue-status").textContent = `${totalMatch} matching source(s)`;
}

/**
 * Inject page content text & image assets loaded from content.json
 * @param {object} content Content JSON payload object
 */
function applyContent(content) {
  // Helper to set text content of target element
  const text = (id, value) => {
    if (typeof value === "string") byId(id).textContent = value;
  };
  // Helper to update image src attribute
  const image = (id, value) => {
    if (typeof value === "string" && (value.startsWith("/") || value.startsWith("./"))) byId(id).src = value;
  };
  text("hero-lede", content.hero_lede);
  text("survey-intro", content.survey_intro);
  text("survey-methods", content.survey_methods);
  text("survey-footer", content.survey_footer);
  image("hero-image", content.hero_image_url);
  image("survey-pop-figure", content.survey_pop_figure_url);
  image("survey-fast19-figure", content.survey_fast19_figure_url);
}

/**
 * Async fetch static page text content from content.json
 */
async function loadContent() {
  try {
    const response = await fetch(contentEndpoint, { headers: { Accept: "application/json" } });
    if (response.ok) applyContent(await response.json());
  } catch {
    // Fallback: retain default HTML text if content fetch fails
  }
}

/**
 * Async fetch full pulsar & FRB catalogue dataset from catalog.json
 */
async function loadCatalogue() {
  try {
    const response = await fetch(catalogEndpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("catalogue request failed");
    const payload = await response.json();
    // Cache full catalogue dataset globally
    catalogue.frbs = payload.frbs;
    catalogue.pulsars = payload.pulsars;
    catalogue.fields = payload.fields || catalogue.fields;
    // Auto-detect if any source contains media figures to toggle media column
    catalogue.showMedia.frb = payload.frbs.some((item) => item.media?.length);
    catalogue.showMedia.pulsar = payload.pulsars.some((item) => item.media?.length);
    // Re-render dynamic table headers for custom fields & media
    addCustomHeaders("frb-table", catalogue.fields.frb, catalogue.showMedia.frb);
    addCustomHeaders("pulsar-table", catalogue.fields.pulsar, catalogue.showMedia.pulsar);
    // Update total source count statistics
    byId("pulsar-count").textContent = payload.summary.pulsars;
    byId("frb-source-count").textContent = payload.summary.frb_sources;
    // Clear loading status message
    byId("catalogue-status").textContent = "";
    // Initial table render after data load
    draw();
  } catch {
    // Display error text if catalogue data cannot be loaded
    byId("catalogue-status").textContent = "Catalogue data is temporarily unavailable.";
  }
}

/**
 * Bind click events for pagination prev/next buttons
 */
function bindPagination() {
  const prevBtn = byId("page-prev");
  const nextBtn = byId("page-next");
  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      draw();
    }
  });
  nextBtn.addEventListener("click", () => {
    currentPage++;
    draw();
  });
}

/**
 * Generate CSV file from currently filtered catalogue data & trigger browser download
 */
function exportCatalogueCSV() {
  let csvRows = [];
  // CSV column header row
  csvRows.push(`"Type","Name","Catalog ID","RA","Dec","Bursts/DM","Period","Note"`);
  // Write filtered FRB entries to CSV lines
  fullFilteredFrbs.forEach(item => {
    const line = [
      `"FRB"`,
      `"${item.frb_name} ${item.frb_id}"`,
      `""`,
      `"${item.ra}"`,
      `"${item.dec}"`,
      `"${item.burst_count}, DM:${number(item.max_dm,1)}"`,
      `""`,
      `"${item.note || ""}"`
    ];
    csvRows.push(line.join(","));
  });
  // Write filtered pulsar entries to CSV lines
  fullFilteredPulsars.forEach(item => {
    const line = [
      `"Pulsar"`,
      `"${item.display_name}"`,
      `"${item.catalog_id}"`,
      `"${item.ra}"`,
      `"${item.dec}"`,
      `"DM:${number(item.dm)}"`,
      `"${significant(item.period_s)}"`,
      `""`
    ];
    csvRows.push(line.join(","));
  });
  // Create blob file & trigger download link
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "POP_catalogue.csv";
  link.click();
}

/**
 * Bind scroll event handler for floating back-to-top button visibility toggle
 */
function bindScrollTop() {
  const scrollBtn = byId("scroll-top");
  window.addEventListener("scroll", () => {
    // Show button when page scrolled down more than 300px
    if (window.scrollY > 300) scrollBtn.classList.add("show");
    else scrollBtn.classList.remove("show");
  });
  // Smooth scroll to page top on button click
  scrollBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/**
 * Bind click handler for BibTeX copy button in citation section
 */
function bindCopyBibtex() {
  const bibBtn = document.querySelector(".copy-btn[data-copy-target='bibtex-text']");
  if (bibBtn) {
    bibBtn.addEventListener("click", () => {
      const bibText = byId("bibtex-text").innerText;
      copyText(bibText);
    });
  }
}

/**
 * Initialize all interactive event listeners after full DOM load
 */
document.addEventListener("DOMContentLoaded", () => {
  // Reset to page 1 on new search input
  byId("catalogue-search").addEventListener("input", () => {
    currentPage = 1;
    draw();
  });
  // Bind CSV export button click action
  byId("export-csv").addEventListener("click", exportCatalogueCSV);
  bindPagination();
  bindScrollTop();
  bindCopyBibtex();
});

// Initialize page data fetching sequence
loadContent();
loadCatalogue();
