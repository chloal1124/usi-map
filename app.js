// =====================================================
// app.js — Final Production Version
// Leaflet + GeoJSON + Active Report Gate
// =====================================================

const GEOJSON_FILE = "usi_cities_2025Q4v1.geojson";
const ACTIVE_REPORTS_FILE = "active-cities.json";

let activeCitySlugs = new Set();

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------
function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function keepDecimals(x) {
  if (x === undefined || x === null || x === "") return "N/A";
  return String(x);
}

function fmtIncome(n) {
  if (n === null) return "N/A";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "");
}

function countryToFolder(countryRaw) {
  const c = String(countryRaw || "").toLowerCase();
  if (c === "usa" || c.includes("united")) return "usa";
  if (c === "canada") return "canada";
  return slugify(countryRaw);
}

function usiRating(u) {
  if (u === null) return "Unknown";
  if (u < 30) return "Comfortable";
  if (u < 35) return "Stretched";
  if (u < 40) return "High burden";
  if (u < 45) return "Severe burden";
  if (u < 55) return "Unaffordable";
  return "Extreme";
}

function getColor(u) {
  if (u === null) return "#999";
  if (u < 30) return "#2ecc71";
  if (u < 35) return "#f1c40f";
  if (u < 40) return "#e67e22";
  if (u < 45) return "#e74c3c";
  if (u < 55) return "#6c3483";
  return "#3b1f4a";
}

function getRadius(u) {
  if (u === null) return 10;
  const minR = 8, maxR = 18;
  return minR + (maxR - minR) * (u / 100);
}

// -----------------------------------------------------
// Load active cities → convert to slug Set
// -----------------------------------------------------
function extractSlugFromPath(path) {
  const parts = path.split("/");
  const filename = parts[parts.length - 1]; // "quebec-city.html"
  return filename.replace(".html", "");
}

function loadActiveCities() {
  return fetch(ACTIVE_REPORTS_FILE)
    .then(res => res.json())
    .then(list => {
      activeCitySlugs = new Set(list.map(extractSlugFromPath));
      console.log("Active city slugs:", activeCitySlugs);
    })
    .catch(err => {
      console.warn("Failed to load active cities:", err);
      activeCitySlugs = new Set();
    });
}

// -----------------------------------------------------
// Map Setup
// -----------------------------------------------------
const map = L.map("map", {
  worldCopyJump: false,
  zoomControl: true
}).setView([20, 0], 2);

map.setMaxBounds([[-85, -180],[85, 180]]);
map.options.maxBoundsViscosity = 1.0;

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  noWrap: true,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// -----------------------------------------------------
// Key detection (old naming retained)
// -----------------------------------------------------
const KEY_CANDIDATES = {
  usi: ["usi"],
  city: ["city"],
  country: ["country"],
  housingPct: ["rental_index"],
  foodPct: ["engels_index"],
  incomeMonthly: ["average_monthly_salary"]
};

function pickFirstKey(obj, candidates) {
  for (const k of candidates) {
    if (obj[k] !== undefined) return k;
  }
  return null;
}

// -----------------------------------------------------
// Popup builder
// -----------------------------------------------------
function buildPopup(p, keys) {

  const usi = keys.usiKey ? toNumber(p[keys.usiKey]) : null;
  const city = p[keys.cityKey] || "Unknown";
  const countryRaw = p[keys.countryKey] || "";
  const countryLabel = countryRaw ? `, ${countryRaw}` : "";

  const housing = keys.housingPctKey ? toNumber(p[keys.housingPctKey]) : null;
  const food = keys.foodPctKey ? toNumber(p[keys.foodPctKey]) : null;
  const income = keys.incomeMonthlyKey ? toNumber(p[keys.incomeMonthlyKey]) : null;

  const rating = usiRating(usi);
  const citySlug = slugify(city);
  const countryFolder = countryToFolder(countryRaw);

  const hasReport = activeCitySlugs.has(citySlug);

  const reportLink = hasReport
    ? `
      <div style="margin-top:12px;">
        <a href="./cities/${countryFolder}/${citySlug}.html" target="_blank" rel="noopener">
          See full city report →
        </a>
      </div>
    `
    : "";

  return `
    <div style="min-width:180px; font-family:system-ui; font-size:13px; line-height:1.4;">
      <b>${city}${countryLabel}</b>

      <div style="margin-top:8px;">
        USI: ${keepDecimals(usi)} (${rating})
      </div>

      <div style="margin-top:8px;">
        <b>Housing:</b> ${keepDecimals(housing)}
      </div>

      <div>
        <b>Food:</b> ${keepDecimals(food)}
      </div>

      <div style="margin-top:12px;">
        <b>Typical Income</b><br>
        <span style="opacity:0.65;">(local currency, monthly)</span>
        ${fmtIncome(income)}
      </div>

      ${reportLink}

      <div style="margin-top:8px;">
        <a href="calculator.html?income=${income || 0}&housingPct=${housing || 0}&foodPct=${food || 0}" target="_blank">
          How much would I have left? →
        </a>
      </div>
    </div>
  `;
}

// -----------------------------------------------------
// Boot sequence (load active cities FIRST)
// -----------------------------------------------------
Promise.all([
  loadActiveCities(),
  fetch(GEOJSON_FILE).then(r => r.json())
])
.then(([, geojson]) => {

  const firstProps = geojson?.features?.[0]?.properties || {};

  const keys = {
    usiKey: pickFirstKey(firstProps, KEY_CANDIDATES.usi),
    cityKey: pickFirstKey(firstProps, KEY_CANDIDATES.city),
    countryKey: pickFirstKey(firstProps, KEY_CANDIDATES.country),
    housingPctKey: pickFirstKey(firstProps, KEY_CANDIDATES.housingPct),
    foodPctKey: pickFirstKey(firstProps, KEY_CANDIDATES.foodPct),
    incomeMonthlyKey: pickFirstKey(firstProps, KEY_CANDIDATES.incomeMonthly)
  };

  const layer = L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) => {
      const p = feature.properties || {};
      const u = keys.usiKey ? toNumber(p[keys.usiKey]) : null;
      const c = getColor(u);

      return L.circleMarker(latlng, {
        radius: getRadius(u),
        color: c,
        fillColor: c,
        fillOpacity: 0.78,
        weight: 1
      });
    },
    onEachFeature: (feature, marker) => {
      marker.bindPopup(buildPopup(feature.properties || {}, keys), {
        maxWidth: 340
      });
    }
  }).addTo(map);

  const b = layer.getBounds();
  if (b.isValid()) map.fitBounds(b, { padding: [20,20] });
})
.catch(err => {
  console.error(err);
  alert("Failed to load city data.");
});