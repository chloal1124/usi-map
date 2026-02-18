// ===============================
// USI Calculator – Pie + PDF Final
// ===============================

let pieChart = null;

document.addEventListener("DOMContentLoaded", () => {
  loadFromURL();
  wireEvents();
  calculate(); // run once to populate remaining + chart
});

function wireEvents() {
  const calcBtn = document.getElementById("calc-btn");
  if (calcBtn) calcBtn.addEventListener("click", calculate);

  const pdfBtn = document.getElementById("export-pdf");
  if (pdfBtn) pdfBtn.addEventListener("click", exportPDF);

  // Auto-recalc whenever user edits any number field
  document.querySelectorAll("input[type='number']").forEach((el) => {
    el.addEventListener("input", calculate);
  });
}

// ----------------------------------
// Load from URL (income + % values)
// ----------------------------------
function loadFromURL() {
  const params = new URLSearchParams(window.location.search);

  const income = parseFloat(params.get("income")) || 0;
  const housingPct = parseFloat(params.get("housingPct")) || 0;
  const foodPct = parseFloat(params.get("foodPct")) || 0;

  if (!income) return;

  setNum("income", income, 2);
  setNum("housing", income * housingPct / 100, 2);
  setNum("food", income * foodPct / 100, 2);
}

// ----------------------------------
// Main Calculation
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
    housing +
    food +
    utilities +
    transport +
    car +
    clothing +
    discretionary;

  const remaining = income - total;

  // Update Remaining row
  const remainingCell = document.getElementById("remaining-cell");
  if (remainingCell) {
    const color = remaining >= 0 ? "#2ecc71" : "#e74c3c";
    remainingCell.innerHTML = `
      <span style="color:${color}; font-weight:600;">
        ${fmt2(remaining)}
      </span>
    `;
  }

  // Update pie chart (remaining shown as 0 if negative)
  updatePie({
    Housing: housing,
    Food: food,
    Utilities: utilities,
    "Public Transport": transport,
    "Car Expenses": car,
    Clothing: clothing,
    Discretionary: discretionary,
    Remaining: Math.max(remaining, 0)
  });

  // Optional: if you want a text summary somewhere
  const title = document.getElementById("result-title");
  if (title) title.textContent = "Breakdown & Remaining";
}

// ----------------------------------
// Pie chart (Chart.js)
// ----------------------------------
function updatePie(dataObj) {

  const canvas = document.getElementById("pieChart");
  if (!canvas || typeof Chart === "undefined") return;

  const labels = Object.keys(dataObj);
  const values = Object.values(dataObj);

  const sum = values.reduce(function(a, b) {
    return a + b;
  }, 0);

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
        backgroundColor: labels.map(function(label) {
          if (label === "Remaining") {
            return "#2ecc71";
          } else {
            return "#bbbbbb";
          }
        })
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
// PDF Export (html2pdf)
// ----------------------------------
// ----------------------------------
// PDF Export (html2pdf)
// ----------------------------------
function exportPDF() {

  if (typeof html2pdf === "undefined") {
    alert("html2pdf not loaded. Check the script include in calculator.html");
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
  return el ? (parseFloat(el.value) || 0) : 0;
}

function setNum(id, value, dp = 2) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = roundTo(value, dp);
}

function roundTo(n, dp) {
  return (Number(n) || 0).toFixed(dp);
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
