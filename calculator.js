function loadFromURL() {

  const params = new URLSearchParams(window.location.search);

  const income = parseFloat(params.get("income")) || 0;
  const housingPct = parseFloat(params.get("housingPct")) || 0;
  const foodPct = parseFloat(params.get("foodPct")) || 0;

  if (!income) return;

  document.getElementById("income").value = income;
  document.getElementById("housing").value = income * housingPct / 100;
  document.getElementById("food").value = income * foodPct / 100;
}

document.addEventListener("DOMContentLoaded", function () {
  loadFromURL();
});

document.addEventListener("DOMContentLoaded", function () {

  console.log("Calculator JS running");

  const calcBtn = document.getElementById("calc-btn");
  if (calcBtn) {
    calcBtn.addEventListener("click", calculate);
  }

  const pdfBtn = document.getElementById("export-pdf");
  if (pdfBtn) {
    pdfBtn.addEventListener("click", exportPDF);
  }

});

function calculate() {

  const income = getVal("income");
  const housing = getVal("housing");
  const food = getVal("food");
  const utilities = getVal("utilities");
  const transport = getVal("public-transport");
  const car = getVal("car");
  const clothing = getVal("clothing");
  const discretionary = getVal("discretionary");

  const total =
    housing +
    food +
    utilities +
    transport +
    car +
    clothing +
    discretionary;

  const remaining = income - total;

  const cell = document.getElementById("remaining-cell");
  if (cell) {
    cell.innerHTML = remaining.toFixed(2);
  }

}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? parseFloat(el.value) || 0 : 0;
}

function exportPDF() {
  html2pdf().from(document.body).save("USI_Calculation.pdf");
}
