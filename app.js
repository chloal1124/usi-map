// =====================================================
// app.js — V2.0(Leaflet + GeoJSON + USI)
// - Popup EXACT format you want (no rounding, no toFixed)
// - Circle radius: min 8, max 18 (smooth linear)
// - Adds "interaction guard": raise z-index + pointer-events,
//   and force-enable leaflet interactions.
// - Added link to calculator.html with city parameter in popup
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
  if (u === null) return "#999";
  if (u < 30) return "#2ecc71"; // green
  if (u < 35) return "#f1c40f"; // yellow
  if (u < 40) return "#e67e22"; // orange
  if (u < 45) return "#e74c3c"; // red
  if (u < 55) return "#6c3483"; // purple
  return "#3b1f4a"; // dark purple
}

function getRadius(u) {
  if (u === null) return 10;
  const minR = 8, maxR = 18;
  const minU = 0, maxU = 100; // adjust if USI max is different
  return minR + (maxR - minR) * ((u - minU) / (maxU - minU));
}

const KEY_CANDIDATES = {
  usi: ["usi", "USI", "urban_stress_index"],
  city: ["city", "name", "place"],
  country: ["country", "nation"],
  housingPct: ["housing", "housing_pct", "rental_index"],
  foodPct: ["food", "food_pct", "engels_index"],
  rentMonthly: ["monthly_rent_1br", "rent_monthly"],
  foodMonthly: ["monthly_food", "food_monthly"],
  incomeMonthly: ["average_monthly_salary", "typicalIncome", "income_monthly"]
};

function pickFirstKey(obj, candidates) {
  for (const k of candidates) {
    if (obj[k] !== undefined) return k;
  }
  return null;
}

// -------------------------------
// 4) Build popup content
// -------------------------------
function buildPopup(p, keys) {
  const usi = keys.usiKey ? toNumber(p[keys.usiKey]) : null;
  const city = p[keys.cityKey] || "Unknown";
  const country = p[keys.countryKey] ? `, ${p[keys.countryKey]}` : "";
  const housing = keys.housingPctKey ? toNumber(p[keys.housingPctKey]) : null;
  const food = keys.foodPctKey ? toNumber(p[keys.foodPctKey]) : null;
  const income = keys.incomeMonthlyKey ? toNumber(p[keys.incomeMonthlyKey]) : null;

  const housingDisplay = keepDecimals(housing);
  const foodDisplay = keepDecimals(food);
  const rating = usiRating(usi);
  const usiDisplay = keepDecimals(usi);

  return `
    <div style="min-width: 180px; font-family: system-ui; font-size: 13px; line-height: 1.4;">
      <b>${city}${country}</b>
      <div style="margin-top: 8px;">
        USI: ${usiDisplay} (${rating})
      </div>

      <div style="margin-top: 8px;">
        <b>Housing:</b> ${housingDisplay}
      </div>

      <div>
        <b>Food:</b> ${foodDisplay}
      </div>

      <div style="margin-top:12px;">
        <b>Typical Income</b><br>
        <span style="opacity:0.65;">(local currency, monthly)</span> ${fmtIncome(income)}
      </div>

      <div style="margin-top:12px;">
        <a href="calculator.html?city=${encodeURIComponent(city)}" target="_blank">How much would I left? →</a>
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

// =========================================
// USI Calculator – Clean Version
// =========================================

let pieChart = null;

// -----------------------------------------
// 1. Wait for DOM
// -----------------------------------------
document.addEventListener("DOMContentLoaded", function () {

  loadCityDefaults();
  setupCalculateButton();
  setupPDFExport();

});


// -----------------------------------------
// 2. Load city data from URL
// -----------------------------------------
function loadCityDefaults() {

  const urlParams = new URLSearchParams(window.location.search);
  const selectedCity = urlParams.get("city");

  if (!selectedCity) return;

  fetch("usi_cities_2025Q4v1.geojson")
    .then(res => {
      if (!res.ok) throw new Error("GeoJSON not found");
      return res.json();
    })
    .then(geojson => {

      const cityData = geojson.features.find(f =>
        f.properties.city &&
        f.properties.city.toLowerCase() === selectedCity.toLowerCase()
      );

      if (!cityData) return;

      const p = cityData.properties;

      const income = Number(p.average_monthly_salary || 0);
      const housingPct = Number(p.housing || 0);
      const foodPct = Number(p.food || 0);

      const housingValue = income * (housingPct / 100);
      const foodValue = income * (foodPct / 100);

      document.getElementById("income").value = Math.round(income);
      document.getElementById("housing").value = Math.round(housingValue);
      document.getElementById("food").value = Math.round(foodValue);

      document.getElementById("result-title").textContent =
        "Disposable Income for " + selectedCity;

    })
    .catch(err => {
      console.error("City default loading failed:", err);
    });
}


// -----------------------------------------
// 3. Setup Calculate Button
// -----------------------------------------
function setupCalculateButton() {

  const btn = document.getElementById("calc-btn");
  if (!btn) return;

  btn.addEventListener("click", calculate);
}


// -----------------------------------------
// 4. Main Calculation Logic
// -----------------------------------------
function calculate() {

  const income = getNumber("income");
  const housing = getNumber("housing");
  const food = getNumber("food");
  const utilities = getNumber("utilities");
  const publicTransport = getNumber("public-transport");
  const car = getNumber("car");
  const clothing = getNumber("clothing");
  const discretionary = getNumber("discretionary");

  const totalExpenses =
    housing +
    food +
    utilities +
    publicTransport +
    car +
    clothing +
    discretionary;

  const remaining = income - totalExpenses;

  displayResult(totalExpenses, remaining);

  updatePieChart(
    housing,
    food,
    utilities,
    publicTransport,
    car,
    clothing,
    discretionary,
    remaining
  );
}


// -----------------------------------------
// 5. Utility: Get numeric value safely
// -----------------------------------------
function getNumber(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  return parseFloat(el.value) || 0;
}


// -----------------------------------------
// 6. Display Result
// -----------------------------------------
function displayResult(totalExpenses, remaining) {

  const resultDiv = document.getElementById("result");
  const resultText = document.getElementById("remaining-text");

  const color = remaining >= 0 ? "#2ecc71" : "#e74c3c";

  resultText.innerHTML = `
    Total Expenses: ${totalExpenses.toFixed(2)}<br>
    <span style="color:${color}; font-size:1.6em;">
      Remaining: ${remaining.toFixed(2)}
    </span>
  `;

  resultDiv.style.display = "block";
}


// -----------------------------------------
// 7. Pie Chart
// -----------------------------------------
function updatePieChart(h, f, u, t, c, cl, d, r) {

  const ctx = document.getElementById("pieChart");
  if (!ctx) return;

  if (pieChart) pieChart.destroy();

  pieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: [
        "Housing",
        "Food",
        "Utilities",
        "Transport",
        "Car",
        "Clothing",
        "Discretionary",
        "Remaining"
      ],
      datasets: [{
        data: [
          h,
          f,
          u,
          t,
          c,
          cl,
          d,
          Math.max(r, 0)
        ],
        backgroundColor: [
          "#ff6384",
          "#36a2eb",
          "#ffce56",
          "#4bc0c0",
          "#9966ff",
          "#ff9f40",
          "#cfd8dc",
          r >= 0 ? "#2ecc71" : "#999999"
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}


// -----------------------------------------
// 8. PDF Export
// -----------------------------------------
function setupPDFExport() {

  const btn = document.getElementById("export-pdf");
  if (!btn) return;

  btn.addEventListener("click", function () {

    const element = document.getElementById("result");
    if (!element) return;

    html2pdf().from(element).set({
      margin: 1,
      filename: "USI_Calculation.pdf",
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" }
    }).save();

  });
}
