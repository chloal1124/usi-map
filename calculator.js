// ======================================
// USI Calculator – Clean Final Version
// ======================================

let pieChart = null;

document.addEventListener("DOMContentLoaded", function () {
  loadFromURL();
  setupCalculate();
  setupPDF();
});


// --------------------------------------
// 1. Load from callout URL
// --------------------------------------
function loadFromURL() {

  const params = new URLSearchParams(window.location.search);

  const income = parseFloat(params.get("income")) || 0;
  const housingPct = parseFloat(params.get("housingPct")) || 0;
  const foodPct = parseFloat(params.get("foodPct")) || 0;

  if (!income) return;

  // Convert % to actual amount
  const housingValue = income * (housingPct / 100);
  const foodValue = income * (foodPct / 100);

  document.getElementById("income").value = Math.round(income);
  document.getElementById("housing").value = Math.round(housingValue);
  document.getElementById("food").value = Math.round(foodValue);
}


// --------------------------------------
// 2. Calculation
// --------------------------------------
function setupCalculate() {
  const btn = document.getElementById("calc-btn");
  if (!btn) return;

  btn.addEventListener("click", calculate);
}

function calculate() {

  const income = getNum("income");
  const housing = getNum("housing");
  const food = getNum("food");
  const utilities = getNum("utilities");
  const transport = getNum("public-transport");
  const car = getNum("car");
  const clothing = getNum("clothing");
  const discretionary = getNum("discretionary");

  const total =
    housing +
    food +
    utilities +
    transport +
    car +
    clothing +
    discretionary;

  const remaining = income - total;

  updateRemainingRow(remaining);

  updatePie(
    housing,
    food,
    utilities,
    transport,
    car,
    clothing,
    discretionary,
    remaining
  );
}

function getNum(id) {
  const el = document.getElementById(id);
  return el ? parseFloat(el.value) || 0 : 0;
}


// --------------------------------------
// 3. Update Remaining Row
// --------------------------------------
function updateRemainingRow(remaining) {

  const cell = document.getElementById("remaining-cell");
  if (!cell) return;

  const color = remaining >= 0 ? "#2ecc71" : "#e74c3c";

  cell.innerHTML = `
    <span style="color:${color}; font-weight:bold;">
      ${remaining.toFixed(2)}
    </span>
  `;
}


// --------------------------------------
// 4. Pie Chart
// --------------------------------------
function updatePie(h, f, u, t, c, cl, d, r) {

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
          r >= 0 ? "#2ecc71" : "#999"
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });
}


// --------------------------------------
// 5. PDF Export
// --------------------------------------
function setupPDF() {

  const btn = document.getElementById("export-pdf");
  if (!btn) return;

  btn.addEventListener("click", function () {

    const element = document.getElementById("result");

    html2pdf().from(element).set({
      margin: 1,
      filename: "USI_Calculation.pdf",
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "a4" }
    }).save();

  });
}
