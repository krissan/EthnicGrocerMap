const PROJECT = {
  initialCenter: [43.7630, -79.23697],
  initialZoom: 12,
  minZoom: 10,
  tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileOptions: {
    maxZoom: 19,
    minZoom: 10,
    attribution: "&copy; OpenStreetMap contributors | Data: SEA",
  },
  panes: [
    { name: "basePolys", zIndex: 250 },
    { name: "points", zIndex: 450 },
    { name: "labels", zIndex: 550 },
  ],
  suggestionsUrl:
    "https://docs.google.com/forms/d/e/1FAIpQLSca4fuJbRcvuTP8ze3OnTY0DA6LMXWZmzhUojRb2fXsAeReFw/viewform?usp=header",
};

const map = L.map("map", {
  center: PROJECT.initialCenter,
  zoom: PROJECT.initialZoom,
  minZoom: PROJECT.minZoom,
});

PROJECT.panes.forEach(({ name, zIndex }) => {
  map.createPane(name);
  map.getPane(name).style.zIndex = zIndex;
});

L.tileLayer(PROJECT.tileUrl, PROJECT.tileOptions).addTo(map);

const overlayLayers = {};

let regionFilter = "ALL";
let regionGroups = {};
let groceriesGeojson = null;
let groceriesLayer = null;

const ICON_HTML_CACHE = {};

const LAYER_CONFIGS = [
  {
    id: "groceries",
    name: "Ethnic Grocery Stores",
    url: "data/ethnic-grocery.geojson",
    defaultVisible: true,
    pane: "points",
    pointToLayer: (feature, latlng, cfg) => {
      const props = feature.properties || {};
      return L.marker(latlng, {
        icon: makeStoreDivIcon(props.icon_key),
        pane: cfg.pane,
      });
    },
    popupBuilder: buildGroceryPopupHTML,
    legend: {
      type: "note",
      text: "Tap a point to view store details.",
    },
  },
  {
    id: "scarborough_bdry",
    name: "Scarborough boundary",
    url: "data/scarborough_bdry.geojson",
    defaultVisible: true,
    pane: "basePolys",
    style: () => ({
      color: "#111",
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0,
      dashArray: "6 6",
    }),
  },
];

function esc(value) {
  if (value == null) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanValue(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || s.toLowerCase() === "none") return null;
  return s;
}

function anchor(text, url) {
  return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;
}

function rowHTML(label, contentHtml) {
  return `
    <div class="sea-row">
      <div class="sea-label">${label}</div>
      <div class="sea-value">${contentHtml}</div>
    </div>
  `;
}

function makeStoreDivIcon(iconKeyRaw) {
  const key = String(iconKeyRaw || "general").trim().toLowerCase();

  if (!ICON_HTML_CACHE[key]) {
    ICON_HTML_CACHE[key] = `
      <img src="icons/${key}.png" class="store-icon-img" alt="">
    `.trim();
  }

  return L.divIcon({
    className: "store-divicon",
    html: ICON_HTML_CACHE[key],
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
}

function renderRecipeLinks(raw, hasRecommended) {
  const text = String(raw || "").replace(/\r/g, "").trim();
  if (!text || text.toLowerCase() === "none") return "";

  const urlRe = /(https?:\/\/\S+)/;

  const itemsHtml = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(urlRe);
      if (!match) return "";

      const url = match[1].trim();
      const label =
        line
          .slice(0, match.index)
          .replace(/[:\-–]\s*$/, "")
          .trim() || "Recipe";

      return `<div class="sea-item">${anchor(label, url)}</div>`;
    })
    .filter(Boolean)
    .join("");

  if (!itemsHtml) return "";

  const starHtml = hasRecommended
    ? `
      <span class="sea-star" aria-label="recommended" title="recommended dish">★</span>
    `
    : "";

  return `
    <div class="sea-recipes">
      <div class="sea-list">${itemsHtml}</div>
      ${starHtml}
    </div>
  `;
}

function formatAddressHTML(addressRaw) {
  if (!addressRaw) return "";

  const text = String(addressRaw).replace(/\r/g, "").trim();

  const parts = text.includes("\n")
    ? text.split("\n").map((part) => part.trim()).filter(Boolean)
    : text.split(",").map((part) => part.trim()).filter(Boolean);

  if (!parts.length) return "";

  const lastPart = parts[parts.length - 1] || "";
  const match = lastPart.match(/^([A-Za-z]{2})\s+(.+)$/);

  const province = match ? match[1] : "";
  const postalCode = match ? match[2] : "";
  const city = parts.length >= 2 ? parts[parts.length - 2] : "";
  const street = parts.slice(0, Math.max(0, parts.length - 2)).join(", ");

  const lines = [];

  if (street) lines.push(street);

  if (city && province) {
    lines.push(`${city} ${province}`);
  } else if (city) {
    lines.push(city);
  } else if (province) {
    lines.push(province);
  }

  if (postalCode) {
    lines.push(postalCode);
  } else if (lastPart && !province) {
    lines.push(lastPart);
  }

  return lines.map((line) => `<div>${esc(line)}</div>`).join("");
}

function buildGroceryPopupHTML(props) {
  const name = props.store_name_final ? esc(props.store_name_final) : "Grocery Store";
  const regionText = props.region ? esc(props.region) : null;
  const notes = props.notes_final ? esc(props.notes_final) : "";

  const iconKey = cleanValue(props.icon_key)?.toLowerCase() || "";
  const iconHtml = iconKey
    ? `<img class="popup-flag" src="icons/${esc(iconKey)}.png" alt="${esc(iconKey)}">`
    : "";

  const recipesRaw = props.recipes_out ? String(props.recipes_out) : "";
  const hasRecommended = Boolean(cleanValue(props.recipes_out));
  const recipesHtml = recipesRaw
    ? renderRecipeLinks(recipesRaw, hasRecommended)
    : "";

  const flyerUrl = cleanValue(props.flyer_url_final);
  const orderingUrl = cleanValue(props.ordering_url);
  const directionsUrl = cleanValue(props.directions_url);
  const addressHtml = formatAddressHTML(cleanValue(props.address_full));

  return `
    <div class="sea-card">
      <div class="sea-header">
        <div class="sea-title">${name}</div>
        ${iconHtml}
      </div>

      <div class="sea-rows">
        ${regionText ? rowHTML("Region:", `<span class="sea-text">${regionText}</span>`) : ""}
        ${recipesHtml ? rowHTML("Recipes:", recipesHtml) : ""}
        ${
          flyerUrl || orderingUrl
            ? rowHTML(
                "Website:",
                `
                  ${flyerUrl ? `<div>${anchor("Flyers", flyerUrl)}</div>` : ""}
                  ${orderingUrl ? `<div>${anchor("Ordering", orderingUrl)}</div>` : ""}
                `
              )
            : ""
        }
        ${notes ? rowHTML("Notes:", `<div class="sea-notes">${notes}</div>`) : ""}
      </div>

      ${
        directionsUrl
          ? `
            <div class="sea-footer sea-footer--card">
              ${addressHtml ? `<div class="sea-address">${addressHtml}</div>` : `<div></div>`}
              <a
                class="sea-directions"
                href="${esc(directionsUrl)}"
                target="_blank"
                rel="noopener"
                aria-label="Get directions"
              >
                <span class="sea-dir-icon" aria-hidden="true"></span>
                <span class="sea-dir-label">Get Directions</span>
              </a>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function styleForFeature(feature, cfg) {
  return cfg.style ? cfg.style(feature) : undefined;
}

function onEachFeature(feature, layer, cfg) {
  if (!cfg.popupBuilder) return;

  const props = feature.properties || {};
  const html = cfg.popupBuilder(props);

  if (html) {
    layer.bindPopup(html, { maxWidth: 520 });
  }
}

function makeLayerFromGeojson(geojson, cfg) {
  return L.geoJSON(geojson, {
    pane: cfg.pane,
    style: (feature) => styleForFeature(feature, cfg),
    pointToLayer: cfg.pointToLayer
      ? (feature, latlng) => cfg.pointToLayer(feature, latlng, cfg)
      : undefined,
    onEachFeature: (feature, layer) => onEachFeature(feature, layer, cfg),
  });
}

function buildRegionGroupsFromGeojson(geojson) {
  const groups = {};

  (geojson.features || []).forEach((feature) => {
    const props = feature.properties || {};
    const groupName = String(props.region_group || "Other").trim();
    const regionName = String(props.region || "").trim();

    if (!regionName) return;

    (groups[groupName] ||= new Set()).add(regionName);
  });

  const sortedGroups = {};

  Object.keys(groups)
    .sort()
    .forEach((groupName) => {
      sortedGroups[groupName] = Array.from(groups[groupName]).sort();
    });

  return sortedGroups;
}

function buildGroceriesLayer(cfg) {
  if (!groceriesGeojson) return L.layerGroup();

  const filteredGeojson =
    regionFilter === "ALL"
      ? groceriesGeojson
      : {
          ...groceriesGeojson,
          features: groceriesGeojson.features.filter(
            (feature) => (feature.properties?.region || "").trim() === regionFilter
          ),
        };

  return makeLayerFromGeojson(filteredGeojson, cfg);
}

function refreshGroceriesLayer() {
  const cfg = LAYER_CONFIGS.find((layer) => layer.id === "groceries");
  if (!cfg || !groceriesGeojson) return;

  const layerWasVisible = groceriesLayer && map.hasLayer(groceriesLayer);

  if (layerWasVisible) {
    map.removeLayer(groceriesLayer);
  }

  groceriesLayer = buildGroceriesLayer(cfg);
  overlayLayers[cfg.id] = groceriesLayer;

  if (layerWasVisible) {
    groceriesLayer.addTo(map);
  }

  rebuildLegend();
}

function rebuildLegend() {
  const select = document.getElementById("region-filter");
  if (!select) return;

  select.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "ALL";
  allOption.textContent = "All regions";
  select.appendChild(allOption);

  Object.entries(regionGroups).forEach(([groupName, regions]) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = groupName;

    regions.forEach((region) => {
      const option = document.createElement("option");
      option.value = region;
      option.textContent = region;
      optgroup.appendChild(option);
    });

    select.appendChild(optgroup);
  });

  select.value = regionFilter;

  select.onchange = (event) => {
    regionFilter = event.target.value;
    refreshGroceriesLayer();
  };
}

const legendControl = L.control({ position: "topright" });

legendControl.onAdd = function () {
  const container = L.DomUtil.create("div", "layer-legend");

  container.innerHTML = `
    <div class="legend-panel">
      <div class="legend-panel-header">
        <h3>Ethnic Grocery Stores</h3>
        <button class="legend-close" type="button" aria-label="Close filters">✕</button>
      </div>

      <div class="legend-filter">
        <div class="legend-filter-label">Filter by region</div>
        <select id="region-filter"></select>
      </div>

      <details class="legend-about">
        <summary class="legend-about-summary">About</summary>
        <div class="legend-about-body">
          <p>If any locations or information is out of date, please email scarbenvasc@gmail.com and we will update it ASAP!</p>
          <p>By Hafeez A. @trainguy89 on Twitter Updated by Christina Dinh (Oct 2024)</p>
          <p>DISCLAIMERS: Asia-Wide Supermarkets, although Chinese, generally serve every Asian ethnicity and stock almost all international products. Ethnicities are hard to categorize, especially because there is a lot of cultural overlap, but I tried my best to categorize them. Ethnicities of stores were identified through their website, what they sell, or reviews by customers, so some stores may serve more than one ethnicity even if it may not be marked as such. Restaurants are only on this list if they offer grocery or ethnic specialty items to go (e.g. snacks, meats). Stores that are not on Google Maps will not be on this map.</p>
          <p><a class="legend-link" href="${PROJECT.suggestionsUrl}" target="_blank" rel="noopener">Suggest an update</a></p>
        </div>
      </details>
    </div>
  `;

  L.DomEvent.disableClickPropagation(container);
  return container;
};

legendControl.addTo(map);

function wireLegendControls() {
  const legend = document.querySelector(".layer-legend");
  const closeBtn = document.querySelector(".legend-close");

  if (!legend || !closeBtn) return;

  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    legend.classList.remove("is-open");
  });
}

wireLegendControls();

const legendToggleControl = L.control({ position: "bottomright" });

legendToggleControl.onAdd = function () {
  const container = L.DomUtil.create("div", "legend-toggle-btn leaflet-bar");
  const link = L.DomUtil.create("a", "", container);

  link.href = "#";
  link.title = "Filters";
  link.setAttribute("aria-label", "Open filters");
  link.innerHTML = "☰";

  L.DomEvent.disableClickPropagation(container);

  L.DomEvent.on(link, "click", (event) => {
    L.DomEvent.preventDefault(event);
    const panel = document.querySelector(".layer-legend");
    if (panel) panel.classList.toggle("is-open");
  });

  return container;
};

legendToggleControl.addTo(map);

LAYER_CONFIGS.forEach((cfg) => {
  fetch(cfg.url)
    .then((response) => response.json())
    .then((geojson) => {
      if (cfg.id === "groceries") {
        groceriesGeojson = geojson;
        regionGroups = buildRegionGroupsFromGeojson(geojson);
        groceriesLayer = buildGroceriesLayer(cfg);

        overlayLayers[cfg.id] = groceriesLayer;

        if (cfg.defaultVisible) {
          groceriesLayer.addTo(map);
        }

        rebuildLegend();
        return;
      }

      const layer = makeLayerFromGeojson(geojson, cfg);
      overlayLayers[cfg.id] = layer;

      if (cfg.defaultVisible) {
        layer.addTo(map);
      }
    })
    .catch((err) => {
      console.error(`Error loading ${cfg.url}`, err);
    });
});

const resetControl = L.control({ position: "topleft" });

resetControl.onAdd = function () {
  const container = L.DomUtil.create("div", "leaflet-bar reset-control");
  const link = L.DomUtil.create("a", "", container);

  link.href = "#";
  link.title = "Reset view";
  link.innerHTML = "⟳";

  L.DomEvent.on(link, "click", (event) => {
    L.DomEvent.stop(event);
    map.setView(PROJECT.initialCenter, PROJECT.initialZoom);
  });

  return container;
};

resetControl.addTo(map);


