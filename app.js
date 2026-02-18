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

// calculator.js

let pieChart = null;

// 1. 讀取 URL parameter (e.g. ?city=Hiroshima)
const urlParams = new URLSearchParams(window.location.search);
const selectedCity = urlParams.get('city');

// 2. Fetch GeoJSON to get city data (同 app.js 一樣)
fetch('usi_cities_2025Q4v1.geojson')
  .then(res => res.json())
  .then(geojson => {
    const cityData = geojson.features.find(f => 
      f.properties.city?.toLowerCase() === selectedCity?.toLowerCase()
    );

    if (cityData) {
      const p = cityData.properties;
      const income = p.average_monthly_salary || p.typicalIncome || 0;
      const housingPct = p.housing || 0; // 假設 % 或 absolute
      const foodPct = p.food || 0;

      // Auto-fill
      document.getElementById('income').value = Math.round(income);
      document.getElementById('housing').value = Math.round(income * (housingPct / 100));
      document.getElementById('food').value = Math.round(income * (foodPct / 100));

      document.getElementById('result-title').textContent = `Disposable Income for ${p.city || 'Selected City'}`;
    }
  })
  .catch(err => console.error('Failed to load city defaults:', err));

// 3. Calculate button
document.getElementById('calc-btn').addEventListener('click', () => {
  const income = parseFloat(document.getElementById('income').value) || 0;
  const housing = parseFloat(document.getElementById('housing').value) || 0;
  const food = parseFloat(document.getElementById('food').value) || 0;
  const utilities = parseFloat(document.getElementById('utilities').value) || 0;
  const publicTransport = parseFloat(document.getElementById('public-transport').value) || 0;
  const car = parseFloat(document.getElementById('car').value) || 0;
  const clothing = parseFloat(document.getElementById('clothing').value) || 0;
  const discretionary = parseFloat(document.getElementById('discretionary').value) || 0;

  const totalExpenses = housing + food + utilities + publicTransport + car + clothing + discretionary;
  const remaining = income - totalExpenses;

  const resultText = `
    Total Expenses: $${totalExpenses.toFixed(2)}<br>
    <span style="color: ${remaining >= 0 ? '#27ae60' : '#e74c3c'}; font-size: 1.6em;">
      Remaining (Disposable Income): $${remaining.toFixed(2)}
    </span><br>
    ${remaining < 0 ? '<span style="color:red">Not enough — consider adjustments or higher income.</span>' : ''}
  `;

  document.getElementById('remaining-text').innerHTML = resultText;
  document.getElementById('result').style.display = 'block';

  // Pie Chart
  const ctx = document.getElementById('pieChart').getContext('2d');
  const data = {
    labels: ['Housing', 'Food', 'Utilities', 'Public Transport', 'Car', 'Clothing', 'Discretionary', 'Remaining'],
    datasets: [{
      data: [housing, food, utilities, publicTransport, car, clothing, discretionary, Math.max(remaining, 0)],
      backgroundColor: [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED', remaining >= 0 ? '#4CAF50' : '#999'
      ]
    }]
  };

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(ctx, {
    type: 'pie',
    data: data,
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
});

// 4. PDF Export
document.getElementById('export-pdf').addEventListener('click', () => {
  const element = document.getElementById('result');
  html2pdf().from(element).set({
    margin: 1,
    filename: 'USI_Calculator_Results.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  }).save();
});
