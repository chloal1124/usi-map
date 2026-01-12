// =====================================================
// app.js — V1.2 (Leaflet + GeoJSON + USI)
// - Popup EXACT format you want (no rounding, no toFixed)
// - Circle radius: min 8, max 18 (smooth linear)
// - Adds "interaction guard": raise z-index + pointer-events,
//   and force-enable leaflet interactions.
// =====================================================

const GEOJSON_FILE = "usi_cities_2025Q4v1.geojson";

// -------------------------------
// 0) Interaction guard (anti-overlay)
// -------------------------------
function hardenMapInteractivity() {
  const el = document.getElementById("map");
  if (!el) return;

  // Make sure the map sits above "normal" content layers
  el.style.position = el.style.position || "fixed"; // ok even if you set in CSS
  el.style.zIndex = "900";
  el.style.pointerEvents = "auto";

  // If some parent blocks events, this helps in most cases
  document.body.style.pointerEvents = "auto";
}

// Call early (before Leaflet creates panes)
hardenMapInteractivity();

// -------------------------------
// 1) Create map
// -------------------------------
const map = L.map("map", {
  worldCopyJump: false,
  zoomControl: true
}).setView([20, 0], 2);

// Force-enable interactions (in case something disabled them)
map.dragging.enable();
map.scrollWheelZoom.enable();
map.doubleClickZoom.enable();
map.boxZoom.enable();
map.keyboard.enable();
if (map.tap) map.tap.enable();
map.touchZoom.enable();

const hardBounds = [
  [-85, -180],
  [85, 180]
];
map.setMaxBounds(hardBounds);
map.options.maxBoundsViscosity = 1.0;

// Use single endpoint (sometimes fewer weird edge cases than {s}.tile...)
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  noWrap: true,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// After Leaflet builds controls/panes, harden again
setTimeout(hardenMapInteractivity, 0);

// -------------------------------
// 2) Helpers
// -------------------------------
function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// Keep decimals EXACTLY as stored (string in → string out; number → String(number))
function keepDecimals(x) {
  if (x === undefined || x === null || x === "") return "N/A";
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
  if (u === null) return "#888888";
  if (u < 30) return "#2ecc71";
  if (u < 35) return "#f1c40f";
  if (u < 40) return "#e67e22";
  if (u < 45) return "#e74c3c";
  if (u < 55) return "#6c3483";
  return "#3b1f4a";
}

// Radius: min 8, max 18 (linear + clamp)
function getRadius(u) {
  const MIN_R = 8;
  const MAX_R = 18;
  if (u === null) return MIN_R;

  const x = Math.max(25, Math.min(60, u));
  return MIN_R + (x - 25) * (MAX_R - MIN_R) / (60 - 25);
}

function pickFirstKey(props, candidates) {
  if (!props) return null;
  for (const k of candidates) {
    if (Object.prototype.hasOwnProperty.call(props, k) && props[k] !== null && props[k] !== "") {
      return k;
    }
  }
  return null;
}

// -------------------------------
// 3) Key detection (robust)
// -------------------------------
const KEY_CANDIDATES = {
  usi: ["usi", "USI", "index", "score", "urban_stress_index", "urbanStressIndex"],
  city: ["city", "City", "name", "NAME", "city_name", "CityName"],
  country: ["country", "Country", "cntry", "COUNTRY", "iso2", "ISO2", "iso3", "ISO3"],

  // your v1 fields (already in %)
  housingPct: ["rental_index", "housing_pct", "rent_pct", "rent_share", "rentShare"],
  foodPct: ["engels_index", "food_pct", "food_share", "foodShare"],

  // raw monthly costs (fallback)
  rentMonthly: ["monthly_rent_1br", "rent_monthly", "monthly_rent"],
  foodMonthly: ["monthly_food", "food_monthly", "monthly_food_cost"],

  // income (monthly, local currency)
  incomeMonthly: ["average_monthly_salary", "monthly_income", "income_monthly", "income"]
};

// -------------------------------
// 4) Popup (exact format)
// -------------------------------
function buildPopup(props, keys) {
  const city = (keys.cityKey ? props[keys.cityKey] : null) || "Unknown city";
  const country = (keys.countryKey ? props[keys.countryKey] : null) || "";
  const title = country ? `${city}, ${country}` : city;

  const usiRaw = keys.usiKey ? props[keys.usiKey] : null;
  const usiNum = keys.usiKey ? toNumber(props[keys.usiKey]) : null;
  const rating = usiRating(usiNum);

  let housingDisplay = "N/A";
  let foodDisplay = "N/A";

  const housingRaw = keys.housingPctKey ? props[keys.housingPctKey] : null;
  const foodRaw = keys.foodPctKey ? props[keys.foodPctKey] : null;

  if (housingRaw !== null && housingRaw !== undefined && housingRaw !== "") housingDisplay = keepDecimals(housingRaw);
  if (foodRaw !== null && foodRaw !== undefined && foodRaw !== "") foodDisplay = keepDecimals(foodRaw);

  const income = keys.incomeMonthlyKey ? toNumber(props[keys.incomeMonthlyKey]) : null;

  // fallback compute if needed (no rounding)
  if (housingDisplay === "N/A" && income !== null && income > 0 && keys.rentMonthlyKey) {
    const rent = toNumber(props[keys.rentMonthlyKey]);
    if (rent !== null) housingDisplay = keepDecimals((rent / income) * 100);
  }
  if (foodDisplay === "N/A" && income !== null && income > 0 && keys.foodMonthlyKey) {
    const food = toNumber(props[keys.foodMonthlyKey]);
    if (food !== null) foodDisplay = keepDecimals((food / income) * 100);
  }

  return `
    <div style="min-width:220px; line-height:1.35">
      <div style="font-weight:700; font-size:14px; margin-bottom:8px;">
        ${title}
      </div>

      <div>
        <b>USI:</b> ${keepDecimals(usiRaw)} (${rating})
      </div>

      <div style="margin-top:10px;">
        <b>Housing:</b> ${housingDisplay}
      </div>

      <div style="margin-top:10px;">
        <b>Food:</b> ${foodDisplay}
      </div>

      <div style="margin-top:12px;">
        <b>Typical Income</b><br>
        <span style="opacity:0.65;">(local currency, monthly)</span> ${fmtIncome(income)}
      </div>
    </div>
  `;
}

// -------------------------------
// 5) Load + render
// -------------------------------
fetch(GEOJSON_FILE)
  .then((res) => {
    if (!res.ok) throw new Error(`Failed to load GeoJSON: ${res.status} ${res.statusText}`);
    return res.json();
  })
  .then((geojson) => {
    const firstProps = geojson?.features?.[0]?.properties || {};

    const keys = {
      usiKey: pickFirstKey(firstProps, KEY_CANDIDATES.usi),
      cityKey: pickFirstKey(firstProps, KEY_CANDIDATES.city),
      countryKey: pickFirstKey(firstProps, KEY_CANDIDATES.country),
      housingPctKey: pickFirstKey(firstProps, KEY_CANDIDATES.housingPct),
      foodPctKey: pickFirstKey(firstProps, KEY_CANDIDATES.foodPct),
      rentMonthlyKey: pickFirstKey(firstProps, KEY_CANDIDATES.rentMonthly),
      foodMonthlyKey: pickFirstKey(firstProps, KEY_CANDIDATES.foodMonthly),
      incomeMonthlyKey: pickFirstKey(firstProps, KEY_CANDIDATES.incomeMonthly)
    };

    console.log("Detected keys:", keys);

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
        const p = feature.properties || {};
        marker.bindPopup(buildPopup(p, keys), { maxWidth: 340 });
      }
    }).addTo(map);

    const b = layer.getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [20, 20] });

    // category count sanity log
    const counts = {
      Comfortable: 0,
      Stretched: 0,
      "High burden": 0,
      "Severe burden": 0,
      Unaffordable: 0,
      Extreme: 0,
      Unknown: 0
    };

    for (const f of (geojson?.features || [])) {
      const p = f.properties || {};
      const u = keys.usiKey ? toNumber(p[keys.usiKey]) : null;
      counts[usiRating(u)] = (counts[usiRating(u)] ?? 0) + 1;
    }
    console.log("USI category counts:", counts);

    // one more harden after everything is in DOM
    setTimeout(hardenMapInteractivity, 50);
  })
  .catch((err) => {
    console.error(err);
    alert(
      "Failed to load the GeoJSON file.\n\n" +
      "Check filename/path and make sure it exists in the deployed folder.\n\n" +
      `Expected: ${GEOJSON_FILE}`
    );
  });
