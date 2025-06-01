import { startWebSocket, sendStartChargeCommand, sendStopChargeCommand } from "./ws-handler.js";

let socChart = null;
let tempChart = null;
let voltageChart = null;
let chargeTimer = null;

const drawLineChart = (id, labels, data, label) => {
  if (voltageChart) voltageChart.destroy();

    voltageChart = new Chart(document.getElementById(id), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: label,
          data: data,
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        animation: false,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  };

const doubleLineChart = (id, labels, dataSets, labelsForData) => {
  const colors = ['rgba(54, 162, 235, 1)', 'purple'];
  const bgColors = ['rgba(54, 162, 235, 0.2)', 'rgba(70, 70, 70, 0.3)'];

  const datasets = dataSets.map((data, index) => ({
    label: labelsForData[index],
    data: data,
    borderColor: colors[index],
    backgroundColor: bgColors[index],
    fill: true,
    tension: 0.3
  }));

  if (tempChart) tempChart.destroy();

  tempChart = new Chart(document.getElementById(id), {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      animation: false,
      responsive: true,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

  const drawDoughnutChart = (id, value, fillcolor) => {
    const centerTextPlugin = {
      id: 'centerText',
      beforeDraw: (chart) => {
        const {width, height, ctx} = chart;
        ctx.restore();
        const fontSize = (height / 7).toFixed(2);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#333';
        const text = `${value}%`;
        const textX = Math.round((width - ctx.measureText(text).width) / 2);
        const textY = height / 2;
        ctx.fillText(text, textX, textY);
        ctx.save();
      }
    };
  
    if (socChart) socChart.destroy();

    socChart = new Chart(document.getElementById(id), {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [value, 100 - value],
          backgroundColor: [fillcolor, '#eeeeee'],
          borderWidth: 0,
        }]
      },
      options: {
        cutout: '78%',
        rotation: -90,
        circumference: 180,
        animation: false,
        plugins: {
          tooltip: { enabled: false },
          legend: { display: false }
        }
      },
      plugins: [centerTextPlugin]
    });
  };
  


let charging = false;
function getDoughnutColor(charging) {
    return charging ? '#2ecc71' : '#b0b0b0';
  }


// Real-time updates via WebSocket
startWebSocket(
  (soc, soh, data) => {
    const socElem = document.getElementById("soc-percent");
    const sohElem = document.getElementById("sohChartBar");
    if (socElem) socElem.textContent = `${soc}%`;
    if (sohElem) sohElem.value = soh;
    drawDoughnutChart("socChartDoughnut", soc, getDoughnutColor(charging));

    // VIN_car_info: 차대번호
    if (data && data.id == 1569) {
      const vinBytes = data.data;
      const vin = vinBytes.map(b => String.fromCharCode(b)).join('').replace(/\0/g, '');
      const vinElem = document.querySelector("p strong");
      if (vinElem) vinElem.textContent = vin;
    }

    // BMS_Company_Info: 차종 (예시로 회사 이름을 차종으로 사용)
    if (data && data.id == 1568) {
      const carnameBytes = data.data;
      const carname = carnameBytes.map(b => String.fromCharCode(b)).join('').replace(/\0/g, '');
      const carElem = document.querySelectorAll("p strong")[1];
      if (carElem) carElem.textContent = carname;
    }
  },
  (batteryTempBuffer, externalTempBuffer, labels) => {
    doubleLineChart(
      "tempChart",
      labels,
      [batteryTempBuffer, externalTempBuffer],
      ["배터리 온도", "외부 온도"]
    );
  },
  (voltageBuffer, labels) => {
    drawLineChart(
      "voltageChart",
      labels,
      voltageBuffer,
      "전압"
    );
  }
);

const modal = document.getElementById("startChargeModal");
const confirmBtn = document.getElementById("confirmStart");
const cancelBtn = document.getElementById("cancelStart");

document.querySelector(".start-btn").addEventListener("click", () => {
    modal.style.display = "block";
});

confirmBtn.addEventListener("click", () => {
  modal.style.display = "none";
  const durationInput = document.getElementById("chargeDuration");
  let seconds = parseInt(durationInput.value) || 60;
  if (isNaN(seconds) || seconds < 0 || seconds > 100000) {
    seconds = 20;
  }
  sendStartChargeCommand();
  let remaining = seconds;
  const timeElem = document.getElementById("remaining-time");
  timeElem.textContent = `(${remaining}s 남음)`;
  if (chargeTimer) clearInterval(chargeTimer);
  chargeTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(chargeTimer);
      timeElem.textContent = `(0s 남음)`;
      sendStopChargeCommand(); // Automatically stop charging
    } else {
      timeElem.textContent = `(${remaining}s 남음)`;
    }
  }, 1000);
});

cancelBtn.addEventListener("click", () => {
  modal.style.display = "none";
});

document.querySelector(".stop-btn").addEventListener("click", () => {
  if (chargeTimer) clearInterval(chargeTimer);
  sendStopChargeCommand();
  const timeElem = document.getElementById("remaining-time");
  if (timeElem) timeElem.textContent = "(충전시간 설정안됨)";
});

document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("closeEmergencyModal");
  const emergencyModal = document.getElementById("emergencyStopModal");
  if (closeBtn && emergencyModal) {
    closeBtn.addEventListener("click", () => {
      if (chargeTimer) clearInterval(chargeTimer);
      emergencyModal.style.display = "none";
    });
  }
});