// ===============================
// USI Calculator – Clean Version
// ===============================

let pieChart = null;

document.addEventListener("DOMContentLoaded", () => {
  loadFromURL();
  wireEvents();
  calculate();
});

// ----------------------------------
// Event wiring
// ----------------------------------

function wireEvents() {

  const calcBtn = document.getElementById("calc-btn");
  if (calcBtn) calcBtn.addEventListener("click", calculate);

  const pdfBtn = document.getElementById("export-pdf");
  if (pdfBtn) pdfBtn.addEventListener("click", exportPDF);

  // auto calculate when user types
  document.querySelectorAll("input[type='number']").forEach((el) => {
    el.addEventListener("input", calculate);
  });
}

// ----------------------------------
// Load values from map popup link
// ----------------------------------

function loadFromURL() {

  const params = new URLSearchParams(window.location.search);

  const income = parseFloat((params.get("income") || "").replace(/,/g,"")) || 0;
  const housingPct = parseFloat(params.get("housingPct")) || 0;
  const foodPct = parseFloat(params.get("foodPct")) || 0;

  if (income > 0) {

    setNum("income", income);

    if (housingPct > 0)
      setNum("housing", income * housingPct / 100);

    if (foodPct > 0)
      setNum("food", income * foodPct / 100);
  }
}

// ----------------------------------
// Main calculation
// ----------------------------------

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
      housing
    + food
    + utilities
    + transport
    + car
    + clothing
    + discretionary;

  const remaining = income - total;

  const remainingCell = document.getElementById("remaining-cell");

  if (remainingCell && income > 0) {

    const remainingPct = (remaining / income) * 100;
    const usi = (total / income) * 100;

    const color = remaining >= 0 ? "#2ecc71" : "#e74c3c";

    remainingCell.innerHTML = `
      <div style="color:${color}; font-weight:600;">
        Remaining: ${fmt2(remaining)}
      </div>
      <div style="font-size:13px; color:#555;">
        Your USI: ${usi.toFixed(1)} (${remainingPct.toFixed(1)}% remaining)
      </div>
    `;
  }

  updatePie(total, remaining);
}

// ----------------------------------
// Pie chart (Spent vs Remaining)
// ----------------------------------

function updatePie(spent, remaining) {

  const canvas = document.getElementById("pieChart");
  if (!canvas || typeof Chart === "undefined") return;

  const values = [
    Math.max(spent,0),
    Math.max(remaining,0)
  ];

  const labels = [
    "Spent",
    "Remaining"
  ];

  const sum = values[0] + values[1];

  if (sum <= 0) {

    if (pieChart) pieChart.destroy();
    pieChart = null;
    return;
  }

  if (pieChart) pieChart.destroy();

  pieChart = new Chart(canvas, {

    type: "pie",

    data: {

      labels: labels,

      datasets: [{

        data: values,

        backgroundColor: [
          "#d0d0d0",
          "#2ecc71"
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

// ----------------------------------
// Export PDF
// ----------------------------------

function exportPDF() {

  if (typeof html2pdf === "undefined") {
    alert("html2pdf not loaded.");
    return;
  }

  const target = document.querySelector(".calc-container");

  if (!target) {
    alert("Calculator container not found.");
    return;
  }

  html2pdf()
    .from(target)
    .set({
      margin: 10,
      filename: "USI_Calculation.pdf",
      html2canvas: {
        scale: 2,
        useCORS: true
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait"
      }
    })
    .save();
}

// ----------------------------------
// Helpers
// ----------------------------------

function getNum(id) {

  const el = document.getElementById(id);

  if (!el) return 0;

  const v = parseFloat(el.value);

  return Number.isFinite(v) ? v : 0;
}

function setNum(id, value) {

  const el = document.getElementById(id);

  if (!el) return;

  el.value = round2(value);
}

function round2(n) {

  return Math.round((Number(n) || 0) * 100) / 100;
}

function fmt2(n) {

  return (Number(n) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}