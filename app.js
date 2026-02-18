// =====================================================
// app.js — GitHub Pages Project-safe (repo site)
// Works for: https://<user>.github.io/<repo>/
// =====================================================

const GEOJSON_FILE = "usi_cities_2025Q4v1.geojson";

// ---- base path for GitHub Pages project site ----
// If URL is /usi-map/ or /usi-map/index.html => base becomes /usi-map/
function getBasePath() {
  const p = window.location.pathname;
  return p.endsWith("/") ? p : p.replace(/[^/]*$/, "");
}
const BASE = getBasePath(); // e.g. "/usi-map/"

// Build URLs safely under BASE
function urlUnderBase(relativePath) {
  // relativePath like "cities/calgary.html" or "calculator.html?...".
  return new URL(relativePath, window.location.origin + BASE).toString();
}

// -----------------------------------------------------
// 1) Map Setup
// -----------------------------------------------------
const map = L.map("map", { zoomControl: true, worldCopyJump: false }).setView([20, 0], 2);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  noWrap: true,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// -----------------------------------------------------
// 2) Helpers
// -----------------------------------------------------
function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function keepDecimals(x) {
  if (x === null || x === undefined || x === "") return "N/A";
  return String(x);
}

function fmtIncome(n) {
  if (n === null) return "N/A";
  try {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  } catch {
    return String(Math.round(n));
  }
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "");
}

// -----------------------------------------------------
// 3) USI Classification
// -----------------------------------------------------
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
// 4) Property Key Detection
// -----------------------------------------------------
const KEY_CANDIDATES = {
  usi: ["usi", "USI", "urban_stress_index"],
  city: ["city", "name", "place"],
  country: ["country", "nation"],

  // IMPORTANT: add common names used by your generator
  housingPct: ["housing", "housing_pct", "housing_burden", "housing_share"],
  foodPct: ["food", "food_pct", "food_share", "engels_index"],

  incomeMonthly: ["average_monthly_salary", "income_monthly", "typical_income"]
};

function pickKey(obj, candidates) {
  for (const k of candidates) {
    if (obj && obj[k] !== undefined) return k;
  }
  return null;
}

// -----------------------------------------------------
// 5) Popup Builder
// -----------------------------------------------------
function buildPopup(props, keys) {
  const usi = keys.usiKey ? toNumber(props[keys.usiKey]) : null;
  const city = keys.cityKey ? props[keys.cityKey] : "Unknown";
  const country = keys.countryKey ? props[keys.countryKey] : "";
  const housing = keys.housingPctKey ? toNumber(props[keys.housingPctKey]) : null;
  const food = keys.foodPctKey ? toNumber(props[keys.foodPctKey]) : null;
  const income = keys.incomeMonthlyKey ? toNumber(props[keys.incomeMonthlyKey]) : null;

  const citySlug = slugify(city);

  // Your repo has /cities/ folder (flat). Use that.
  const cityReportUrl = urlUnderBase(`cities/${citySlug}.html`);
  const calcUrl = urlUnderBase(
    `calculator.html?income=${income || 0}&housingPct=${housing || 0}&foodPct=${food || 0}`
  );

  return `
    <div style="min-width:200px; font-family:system-ui; font-size:13px; line-height:1.4;">
      <b>${city}${country ? ", " + country : ""}</b>

      <div style="margin-top:8px;">
        USI: ${keepDecimals(usi)} (${usiRating(usi)})
      </div>

      <div style="margin-top:8px;">
        <b>Housing:</b> ${keepDecimals(housing)}
      </div>

      <div>
        <b>Food:</b> ${keepDecimals(food)}
      </div>

      <div style="margin-top:12px;">
        <b>Typical Income</b><br>
        <span style="opacity:0.6;">(monthly, local currency)</span><br>
        ${fmtIncome(income)}
      </div>

      <div style="margin-top:12px;">
        <a href="${cityReportUrl}" target="_blank" rel="noopener">
          See full city report →
        </a>
      </div>

      <div style="margin-top:8px;">
        <a href="${calcUrl}" target="_blank" rel="noopener">
          How much would I have left? →
        </a>
      </div>
    </div>
  `;
}

// -----------------------------------------------------
// 6) Load GeoJSON + Render
// -----------------------------------------------------
const geojsonUrl = urlUnderBase(GEOJSON_FILE);

fetch(geojsonUrl)
  .then((res) => {
    if (!res.ok) throw new Error(`GeoJSON fetch failed: ${res.status} ${res.statusText}`);
    return res.json();
  })
  .then((geojson) => {
    const firstProps = geojson?.features?.[0]?.properties || {};

    const keys = {
      usiKey: pickKey(firstProps, KEY_CANDIDATES.usi),
      cityKey: pickKey(firstProps, KEY_CANDIDATES.city),
      countryKey: pickKey(firstProps, KEY_CANDIDATES.country),
      housingPctKey: pickKey(firstProps, KEY_CANDIDATES.housingPct),
      foodPctKey: pickKey(firstProps, KEY_CANDIDATES.foodPct),
      incomeMonthlyKey: pickKey(firstProps, KEY_CANDIDATES.incomeMonthly)
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
          fillOpacity: 0.8,
          weight: 1
        });
      },
      onEachFeature: (feature, marker) => {
        marker.bindPopup(buildPopup(feature.properties || {}, keys), { maxWidth: 340 });
      }
    }).addTo(map);

    const b = layer.getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [20, 20] });
  })
  .catch((err) => {
    console.error(err);
    alert("Failed to load city data.");
  });

