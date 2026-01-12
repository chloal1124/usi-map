// =====================================================
// app.js — V1.1 (Leaflet + GeoJSON + USI + Composition Popup)
// Popup format follows user's exact preference:
// USI: 47.xxx (Severe burden)
// Housing: 34.xxc
// Food: 13.xxx
// Typical Income
// (local currency, monthly) 3,509
// =====================================================

// IMPORTANT: match this filename to your deployed repo
const GEOJSON_FILE = "usi_cities_2025Q4v1.geojson";

// ===============================
// 1) Create the base map
// ===============================
const map = L.map("map", {
  worldCopyJump: false,
  zoomControl: true
}).setView([20, 0], 2);

// Hard bounds: prevents panning into repeated worlds
const hardBounds = [
  [-85, -180],
  [85, 180]
];
map.setMaxBounds(hardBounds);
map.options.maxBoundsViscosity = 1.0;

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// ===============================
// 2) Helpers
// ===============================
function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
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

function fmtIncome(n) {
  if (n === null) return "N/A";
  // Keep it "human", but not touching decimals (income should be integer-ish anyway)
  try {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  } catch {
    return String(Math.round(n));
  }
}

// Keep decimals EXACTLY as stored (no rounding)
// If it's a number, String(number) will keep as many decimals as the number has.
// If it's already a string, we keep it untouched.
function keepDecimals(x) {
  if (x === undefined || x === null || x === "") return "N/A";
  return String(x);
}

// ===============================
// 3) USI classification (same as your V1 tiers)
// ===============================
function usiRating(usiNumber) {
  if (usiNumber === null) return "Unknown";
  if (usiNumber < 30) return "Comfortable";
  if (usiNumber < 35) return "Stretched";
  if (usiNumber < 40) return "High burden";
  if (usiNumber < 45) return "Severe burden";
  if (usiNumber < 55) return "Unaffordable";
  return "Extreme";
}

function getColor(usiNumber) {
  if (usiNumber === null) return "#888888";
  if (usiNumber < 30) return "#2ecc71";   // green
  if (usiNumber < 35) return "#f1c40f";   // yellow
  if (usiNumber < 40) return "#e67e22";   // orange
  if (usiNumber < 45) return "#e74c3c";   // red
  if (usiNumber < 55) return "#6c3483";   // dark purple
  return "#3b1f4a";                        // darker purple (Extreme)
}

function getRadius(usiNumber) {
  // Visual sweet spot
  const MIN_R = 6;
  const MAX_R = 14;

  if (usiNumber === null) return MIN_R;

  // Clamp USI to expected range
  const u = Math.max(25, Math.min(60, usiNumber));

  // Linear mapping: 25 → 6px, 60 → 14px
  return MIN_R + (u - 25) * (MAX_R - MIN_R) / (60 - 25);
}

// ===============================
// 4) Detect property keys (robust)
// ===============================
const KEY_CANDIDATES = {
  usi: ["usi", "USI", "index", "score", "urban_stress_index", "urbanStressIndex"],
  city: ["city", "City", "name", "NAME", "city_name", "CityName"],
  country: ["country", "Country", "cntry", "COUNTRY", "iso2", "ISO2", "iso3", "ISO3"],

  // Your current v1 GeoJSON uses these (% already)
  housingPct: ["rental_index", "housing_pct", "housing_share_pct", "rent_pct", "rent_share", "rentShare"],
  foodPct: ["engels_index", "food_pct", "food_share_pct", "food_share", "foodShare"],

  // Raw monthly costs for fallback computation
  rentMonthly: ["monthly_rent_1br", "rent_monthly", "monthly_rent", "rent_1br_monthly"],
  foodMonthly: ["monthly_food", "food_monthly", "monthly_food_cost"],

  // Income (monthly, local currency)
  incomeMonthly: ["average_monthly_salary", "median_monthly_income", "monthly_income", "income_monthly", "income"]
};

// ===============================
// 5) Popup formatter (exact format)
// ===============================
function buildPopup(props, keys) {
  const cityKey = keys.cityKey;
  const countryKey = keys.countryKey;

  const city = (cityKey ? props[cityKey] : null) || "Unknown city";
  const country = (countryKey ? props[countryKey] : null) || "";

  // USI (raw string for display; number for rating/color)
  const usiRaw = keys.usiKey ? props[keys.usiKey] : null;
  const usiNum = keys.usiKey ? toNumber(props[keys.usiKey]) : null;
  const rating = usiRating(usiNum);

  // Housing/Food
  // Prefer percent fields if present (already in %)
  let housingDisplay = "N/A";
  let foodDisplay = "N/A";

  const housingRaw = keys.housingPctKey ? props[keys.housingPctKey] : null;
  const foodRaw = keys.foodPctKey ? props[keys.foodPctKey] : null;

  if (housingRaw !== null && housingRaw !== undefined && housingRaw !== "") {
    housingDisplay = keepDecimals(housingRaw);
  }
  if (foodRaw !== null && foodRaw !== undefined && foodRaw !== "") {
    foodDisplay = keepDecimals(foodRaw);
  }

  // Income
  const income = keys.incomeMonthlyKey ? toNumber(props[keys.incomeMonthlyKey]) : null;

  // Fallback compute if % missing but raw monthly costs exist
  // NOTE: This will generate decimals (JS default). We still won't round them.
  if (housingDisplay === "N/A" && income !== null && income > 0 && keys.rentMonthlyKey) {
    const rent = toNumber(props[keys.rentMonthlyKey]);
    if (rent !== null) housingDisplay = keepDecimals((rent / income) * 100);
  }
  if (foodDisplay === "N/A" && income !== null && income > 0 && keys.foodMonthlyKey) {
    const food = toNumber(props[keys.foodMonthlyKey]);
    if (food !== null) foodDisplay = keepDecimals((food / income) * 100);
  }

  // Compose EXACT layout (no extra labels, no rounding)
  const titleLine = country ? `${city}, ${country}` : `${city}`;

  return `
    <div style="min-width:220px; line-height:1.35">
      <div style="font-weight:700; font-size:14px; margin-bottom:8px;">
        ${titleLine}
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

// ===============================
// 6) Load GeoJSON and render
// ===============================
fetch(GEOJSON_FILE)
  .then((res) => {
    if (!res.ok) throw new Error(`Failed to load GeoJSON: ${res.status} ${res.statusText}`);
    return res.json();
  })
  .then((geojson) => {
    const firstProps = geojson?.features?.[0]?.properties || {};

    // Detect keys once (based on first feature)
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
        const props = feature.properties || {};
        const usiNum = keys.usiKey ? toNumber(props[keys.usiKey]) : null;
        const color = getColor(usiNum);

        return L.circleMarker(latlng, {
          radius: getRadius(usiNum),
          color: color,
          fillColor: color,
          fillOpacity: 0.78,
          weight: 1
        });
      },

      onEachFeature: (feature, marker) => {
        const props = feature.properties || {};
        marker.bindPopup(buildPopup(props, keys), { maxWidth: 340 });
      }
    }).addTo(map);

    // Fit map view to your data points
    const b = layer.getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [20, 20] });

    // Optional sanity check counts
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
      const props = f.properties || {};
      const usiNum = keys.usiKey ? toNumber(props[keys.usiKey]) : null;
      counts[usiRating(usiNum)] = (counts[usiRating(usiNum)] ?? 0) + 1;
    }
    console.log("USI category counts:", counts);
  })
  .catch((err) => {
    console.error(err);
    alert(
      "Failed to load the GeoJSON file.\n\n" +
      "Check that the filename in app.js matches your repo, and that the file exists in the root folder.\n\n" +
      `Expected: ${GEOJSON_FILE}`
    );
  });
