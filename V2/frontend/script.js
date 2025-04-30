const drawLineChart = (id, labels, data, label) => {
    new Chart(document.getElementById(id), {
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
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  };

    
  drawLineChart('battempChart', ['00:00','00:10','00:20','00:30','00:40','01:00'], [27, 28, 29, 29.5, 28.5, 28], '온도');
  drawLineChart('cartempChart', ['00:00','00:10','00:20','00:30','00:40','01:00'], [27, 28, 29, 29.5, 28.5, 28], '온도');
  drawLineChart('batteryChart', ['00:00','00:10','00:20','00:30','00:40','01:00'], [65, 67, 69, 70, 70, 70], '배터리 상태');
  drawLineChart('lifeChart', ['00','04','08','12','16','20','24'], [25,28,30,32,29,27,26], '수명');
  drawLineChart('voltageChart', ['00','04','08','12','16','20','24'], [380, 382, 385, 384, 383, 382, 384], '전압');ㄴ