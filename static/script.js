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

// Новая функция: отрисовка плана на странице
function renderPlan(data) {
    const planDiv = document.getElementById('plan-result');
    if (!planDiv) return;

    if (!data.plan || data.plan.length === 0) {
        planDiv.innerHTML = '<p>Нет рассчитанных маршрутов. Нажмите "Рассчитать".</p>';
        return;
    }

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
}

// Функция: загрузка последнего плана при открытии страницы
function loadLatestPlan() {
    const planDiv = document.getElementById('plan-result');
    if (!planDiv) return; // Если мы не на странице плана, ничего не делаем

    fetch('/api/plan/latest')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                renderPlan(data);
            }
        })
        .catch(err => console.error("Ошибка загрузки последнего плана:", err));
}

// Функция: расчет нового плана (вызывается по кнопке)
function calculatePlan() {
    const planDiv = document.getElementById('plan-result');
    if (!planDiv) return;

    planDiv.innerHTML = 'Расчет маршрутов...';

    fetch('/api/plan', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                renderPlan(data);
            } else {
                planDiv.innerHTML = `<div class="error">Ошибка: ${data.message}</div>`;
            }
        })
        .catch(err => {
            planDiv.innerHTML = '<div class="error">Ошибка соединения с сервером</div>';
        });
}

// Этот код сработает, как только страница полностью загрузится
document.addEventListener("DOMContentLoaded", function() {
    loadLatestPlan();
});