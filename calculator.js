document.addEventListener("DOMContentLoaded", function () {

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
  if (!el) return 0;
  return parseFloat(el.value) || 0;
}

function exportPDF() {

  const element = document.getElementById("report-section");

  html2pdf().from(element).set({
    margin: 1,
    filename: "USI_Calculation.pdf"
  }).save();

}
