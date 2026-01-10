// =====================================================
// app.js — Leaflet V0 (GeoJSON Points + USI coloring)
// Files expected in the same folder:
//   - index.html
//   - style.css
//   - app.js
//   - usi_cities_2025Q4.geojson
// =====================================================


// ===============================
// 1) Create the base map
// ===============================
const map = L.map("map", {
  worldCopyJump: true,
  zoomControl: true
}).setView([20, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);


// ===============================
// 2) Helpers: safe number parsing
// ===============================
function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}


// ===============================
// 3) USI classification (your rules)
// ===============================
function usiRating(usi) {
  if (usi === null) return "Unknown";
  if (usi < 30) return "Comfortable";
  if (usi < 35) return "Stretched";
  if (usi < 40) return "High burden";
  if (usi < 45) return "Severe burden";
  return "Unaffordable";
}

// Color scheme: green, yellow, orange, red, dark purple
function getColor(usi) {
  if (usi === null) return "#888888"; // missing / unknown
  if (usi < 30) return "#2ecc71";     // green
  if (usi < 35) return "#f1c40f";     // yellow
  if (usi < 40) return "#e67e22";     // orange
  if (usi < 45) return "#e74c3c";     // red
  return "#6c3483";                   // dark purple
}

// Optional: make higher stress slightly bigger
function getRadius(usi) {
  if (usi === null) return 4;
  if (usi < 30) return 4;
  if (usi < 35) return 5;
  if (usi < 40) return 6;
  if (usi < 45) return 7;
  return 8;
}


// ===============================
// 4) Detect which property is the USI value
// ===============================
// If your GeoJSON property name is fixed (e.g. "usi"), you can just hardcode it.
// This auto-detection makes the app tolerant to naming changes.
const INDEX_KEYS_CANDIDATES = ["usi", "USI", "index", "score", "urban_stress_index", "urbanStressIndex"];

function pickIndexKey(properties) {
  if (!properties) return null;
  for (const key of INDEX_KEYS_CANDIDATES) {
    const v = properties[key];
    if (v !== undefined && v !== null && v !== "") return key;
  }
  return null;
}


// ===============================
// 5) Pretty popup (human readable)
// ===============================
function formatPopup(props, usiKey, usiValue) {
  const city = props.city || props.City || props.name || props.NAME || "Unknown city";
  const country = props.country || props.Country || props.cntry || props.COUNTRY || "";

  const usiText = (usiValue === null) ? "N/A" : usiValue.toFixed(1);
  const rating = usiRating(usiValue);

  // Optional extra fields (only show if present)
  // If your rent/food fields are already in % not fraction, we handle both nicely.
  const rentRaw = props.rent_share ?? props.rentShare ?? props.rent_pct ?? props.rentPercent;
  const foodRaw = props.food_share ?? props.foodShare ?? props.food_pct ?? props.foodPercent;

  const rent = toNumber(rentRaw);
  const food = toNumber(foodRaw);

  function formatPercent(x) {
    // Accept 0.32 (fraction) or 32 (already percent)
    if (x === null) return null;
    return (x <= 1.2) ? (x * 100) : x;
  }

  const rentPct = formatPercent(rent);
  const foodPct = formatPercent(food);

  const rentLine = (rentPct === null)
    ? ""
    : `<div>Rent share: <b>${rentPct.toFixed(0)}%</b></div>`;

  const foodLine = (foodPct === null)
    ? ""
    : `<div>Food share: <b>${foodPct.toFixed(0)}%</b></div>`;

  return `
    <div style="min-width:220px">
      <div style="font-weight:700; font-size:14px">${city}${country ? ", " + country : ""}</div>

      <div style="margin-top:8px">
        Urban Stress Index: <b>${usiText}</b>
      </div>

      <div style="margin-top:4px">
        Status: <b>${rating}</b>
      </div>

      ${rentLine}
      ${foodLine}

      <div style="opacity:0.65; font-size:11px; margin-top:8px">
        ${usiKey ? `USI field: ${usiKey}` : ""}
      </div>
    </div>
  `;
}


// ===============================
// 6) Load GeoJSON and render as circle markers
// ===============================
fetch("usi_cities_2025Q4.geojson")
  .then((res) => {
    if (!res.ok) throw new Error(`Failed to load GeoJSON: ${res.status} ${res.statusText}`);
    return res.json();
  })
  .then((geojson) => {
    // Detect USI key from the first feature
    const firstFeature = geojson?.features?.[0];
    const usiKey = pickIndexKey(firstFeature?.properties);

    if (!usiKey) {
      console.warn(
        "Could not detect USI property key. " +
        "Please make sure your GeoJSON has one of these fields:",
        INDEX_KEYS_CANDIDATES
      );
    } else {
      console.log("Detected USI property key:", usiKey);
    }

    // Build the layer
    const layer = L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => {
        const props = feature.properties || {};
        const usiValue = usiKey ? toNumber(props[usiKey]) : null;

        const color = getColor(usiValue);

        return L.circleMarker(latlng, {
          radius: getRadius(usiValue),
          color: color,        // stroke
          fillColor: color,    // fill
          fillOpacity: 0.78,
          weight: 1
        });
      },

      onEachFeature: (feature, marker) => {
        const props = feature.properties || {};
        const usiValue = usiKey ? toNumber(props[usiKey]) : null;
        marker.bindPopup(formatPopup(props, usiKey, usiValue), { maxWidth: 320 });
      }
    }).addTo(map);

    // Fit map to data
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }

    // Quick summary in console: counts by category (nice sanity check)
    const counts = {
      Comfortable: 0,
      Stretched: 0,
      "High burden": 0,
      "Severe burden": 0,
      Unaffordable: 0,
      Unknown: 0
    };

    if (geojson?.features?.length) {
      for (const f of geojson.features) {
        const props = f.properties || {};
        const usiValue = usiKey ? toNumber(props[usiKey]) : null;
        const label = usiRating(usiValue);
        counts[label] = (counts[label] ?? 0) + 1;
      }
    }

    console.log("USI category counts:", counts);
  })
  .catch((err) => {
    console.error(err);

    // Common local-dev gotcha:
    // If you open index.html by double-clicking (file://), fetch may be blocked.
    // Use a local server (VS Code Live Server) or deploy to Cloudflare Pages.
    alert(
      "Failed to load the GeoJSON file.\n\n" +
      "If you opened index.html directly (file://), your browser may block fetch().\n" +
      "Use a local dev server (e.g. VS Code Live Server) or deploy to Cloudflare Pages.\n\n" +
      "Check the console for details."
    );
  });
