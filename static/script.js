function checkData() {
    const resultDiv = document.getElementById('result');
    if(!resultDiv) return;
    
    resultDiv.style.display = 'block';
    resultDiv.className = '';
    resultDiv.innerHTML = 'Проверка...';

    fetch('/api/validate', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'error') {
                resultDiv.className = 'error';
                resultDiv.innerHTML = '<strong>Обнаружены ошибки:</strong><br>' + data.errors.join('<br>');
            } else {
                resultDiv.className = 'success';
                resultDiv.innerHTML = '<strong>Успех!</strong> ' + data.message;
            }
        });
}

function calculatePlan() {
    const planDiv = document.getElementById('plan-result');
    if(!planDiv) return;
    
    planDiv.innerHTML = 'Расчет маршрутов...';

    fetch('/api/plan', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            let html = '<h3>План по автомобилям</h3>';
            data.plan.forEach(vehicle => {
                html += `<div style="margin-bottom: 20px; border: 1px solid #ccc; padding: 10px;">
                            <h4>${vehicle.vehicle_name} [${vehicle.license_plate}]</h4>
                            <table style="width:100%; margin-bottom: 10px;">
                                <tr><th>Откуда</th><th>Куда</th><th>Расстояние</th></tr>`;
                vehicle.route_details.forEach(seg => {
                    html += `<tr><td>${seg.from}</td><td>${seg.to}</td><td>${seg.distance} км</td></tr>`;
                });
                html += `</table><strong>Общий пробег: ${vehicle.total_km} км</strong></div>`;
            });
            planDiv.innerHTML = html;
        });
}