// =====================================================
// app.js — V1 (Leaflet + GeoJSON + USI 6-level scheme)
// =====================================================

// ===============================
// 1) Create the base map (NO world repeat + good zoom UX)
// ===============================
const map = L.map("map", {
  worldCopyJump: false,
  zoomControl: true,
  scrollWheelZoom: true,
  minZoom: 2,
  maxZoom: 7
}).setView([20, 0], 2);

// Clamp to one world (prevents recurring continents)
const WORLD_BOUNDS = [
  [-80, -180],
  [80, 180]
];
map.setMaxBounds(WORLD_BOUNDS);
map.options.maxBoundsViscosity = 0.6; // gentle, not a prison

// Base tiles (NO wrap)
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  noWrap: true,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// ===============================
// 2) Helpers: safe number parsing
// ===============================
function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// ===============================
// 3) USI classification (V1: 6 tiers)
//   <30  Comfortable
//   30-35 Stretched
//   35-40 High burden
//   40-45 Severe burden
//   45-55 Unaffordable
//   >55  Extreme
// ===============================
function usiRating(usi) {
  if (usi === null) return "Unknown";
  if (usi < 30) return "Comfortable";
  if (usi < 35) return "Stretched";
  if (usi < 40) return "High burden";
  if (usi < 45) return "Severe burden";
  if (usi < 55) return "Unaffordable";
  return "Extreme";
}

function getColor(usi) {
  if (usi === null) return "#9ca3af";        // grey unknown
  if (usi < 30) return "#22c55e";            // green
  if (usi < 35) return "#facc15";            // yellow
  if (usi < 40) return "#fb923c";            // orange
  if (usi < 45) return "#ef4444";            // red
  if (usi < 55) return "#7c3aed";            // purple
  return "#4c1d95";                          // dark purple
}

// Your base radius scheme (still used, but scaled with zoom)
function getRadius(usi) {
  if (usi === null) return 4;
  if (usi < 30) return 4;
  if (usi < 35) return 6;
  if (usi < 40) return 8;
  if (usi < 45) return 12;
  if (usi < 55) return 20;
  return 28;
}

// Zoom-scaled radius so zoom feels meaningful
function scaledRadius(usi, zoom) {
  const base = getRadius(usi);
  // At zoom=2 => ~base; every zoom step multiplies size a bit
  return base * Math.pow(1.35, zoom - 2);
}

// ===============================
// 4) Detect which property is the USI value
// ===============================
const INDEX_KEYS_CANDIDATES = [
  "usi",
  "USI",
  "index",
  "score",
  "urban_stress_index",
  "urbanStressIndex"
];

function pickIndexKey(properties) {
  if (!properties) return null;
  for (const key of INDEX_KEYS_CANDIDATES) {
    if (Object.prototype.hasOwnProperty.call(properties, key)) return key;
  }
  return null;
}

// ===============================
// 5) Popup formatter
// ===============================
function formatPopup(props, usiKey, usiValue) {
  const city =
    props.city ||
    props.City ||
    props.name ||
    props.Name ||
    props.place ||
    "Unknown city";

  const country = props.country || props.Country || props.iso2 || props.ISO2 || "";

  const usiLabel = usiRating(usiValue);
  const usiText = usiValue === null ? "N/A" : usiValue.toFixed(1);

  return `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;">
      <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px;">
        ${city}${country ? `, ${country}` : ""}
      </div>

      <div style="font-size: 13px; line-height: 1.4;">
        <div><b>USI:</b> ${usiText} <span style="opacity:.8">(${usiLabel})</span></div>
        <div style="opacity:.75; margin-top: 6px;">
          ${usiKey ? `Source field: <code>${usiKey}</code>` : ""}
        </div>
      </div>
    </div>
  `;
}

// ===============================
// 6) Load GeoJSON + render circles
// ===============================
// IMPORTANT: match this filename to your repo
const GEOJSON_FILE = "usi_cities_2025Q4v1.geojson";

let geoLayer = null;

fetch(GEOJSON_FILE)
  .then((res) => {
    if (!res.ok) throw new Error(`Failed to load GeoJSON: ${res.status} ${res.statusText}`);
    return res.json();
  })
  .then((geojson) => {
    const firstFeature = geojson?.features?.[0];
    const usiKey = pickIndexKey(firstFeature?.properties);

    if (!usiKey) {
      console.warn(
        "Could not detect USI property key. Please ensure one of these fields exists:",
        INDEX_KEYS_CANDIDATES
      );
    } else {
      console.log("Detected USI property key:", usiKey);
    }

    geoLayer = L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => {
        const props = feature.properties || {};
        const usiValue = usiKey ? toNumber(props[usiKey]) : null;

        const color = getColor(usiValue);

        return L.circleMarker(latlng, {
          radius: scaledRadius(usiValue, map.getZoom()),
          color: "#2b2b2b",     // stroke for readability
          weight: 1,
          fillColor: color,
          fillOpacity: 0.78
        });
      },

      onEachFeature: (feature, marker) => {
        const props = feature.properties || {};
        const usiValue = usiKey ? toNumber(props[usiKey]) : null;
        marker.bindPopup(formatPopup(props, usiKey, usiValue), { maxWidth: 340 });
      }
    }).addTo(map);

    // Fit map view to your data points (respects your zoom limits)
    const bounds = geoLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }

    // Console sanity check: category counts
    const counts = {
      Comfortable: 0,
      Stretched: 0,
      "High burden": 0,
      "Severe burden": 0,
      Unaffordable: 0,
      Extreme: 0,
      Unknown: 0
    };

    for (const f of geojson?.features || []) {
      const props = f.properties || {};
      const usiValue = usiKey ? toNumber(props[usiKey]) : null;
      const label = usiRating(usiValue);
      counts[label] = (counts[label] ?? 0) + 1;
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

// ===============================
// 7) On zoom: rescale circle radii (makes zoom feel real)
// ===============================
map.on("zoomend", () => {
  if (!geoLayer) return;

  const z = map.getZoom();
  geoLayer.eachLayer((layer) => {
    if (!layer?.feature?.properties) return;

    // We must re-pick key safely in case dataset differs
    const props = layer.feature.properties || {};
    const key = pickIndexKey(props);
    const usiValue = key ? toNumber(props[key]) : null;

    if (typeof layer.setRadius === "function") {
      layer.setRadius(scaledRadius(usiValue, z));
    }
  });
});
