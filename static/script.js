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

// --- ЛОГИКА ДЛЯ СТРАНИЦЫ СХЕМЫ МАРШРУТОВ ---

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('map-svg')) {
        loadMap();
    }
});

function loadMap() {
    fetch('/api/map-data')
        .then(response => response.json())
        .then(data => {
            const svg = document.getElementById('map-svg');
            svg.innerHTML = ''; // Очищаем холст
            
            const points = data.points;
            const routes = data.routes;
            
            // Цвета для разных машин (чтобы маршруты не сливались)
            const colors = ['#3498db', '#e74c3c', '#9b59b6', '#f1c40f'];
            
            // 1. Рисуем маршруты (линии)
            routes.forEach((route, index) => {
                const color = colors[index % colors.length];
                const stops = route.stops;
                
                // Соединяем точки линиями
                for (let i = 0; i < stops.length - 1; i++) {
                    const p1 = points[stops[i]];
                    const p2 = points[stops[i+1]];
                    
                    if (p1 && p2) {
                        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                        // Умножаем на 1.2, чтобы точки не прилипали к краям
                        line.setAttribute("x1", p1.x * 1.2); 
                        line.setAttribute("y1", p1.y * 1.2);
                        line.setAttribute("x2", p2.x * 1.2);
                        line.setAttribute("y2", p2.y * 1.2);
                        line.setAttribute("stroke", color);
                        line.setAttribute("stroke-width", "2");
                        line.setAttribute("stroke-dasharray", "5,5"); // Пунктирная линия
                        svg.appendChild(line);
                    }
                }
                
                // Добавляем в легенду
                const legendDiv = document.getElementById('route-legend');
                legendDiv.innerHTML += `<div style="margin-bottom: 5px;">
                    <span style="display:inline-block; width:20px; height:2px; background:${color}; margin-right:5px; vertical-align:middle;"></span>
                    Маршрут ${index + 1} (Машина ID: ${route.vehicle_id})
                </div>`;
            });

            // 2. Рисуем точки (кружочки) поверх линий
            for (const [name, coords] of Object.entries(points)) {
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("cx", coords.x * 1.2);
                circle.setAttribute("cy", coords.y * 1.2);
                circle.setAttribute("r", "8");
                // Склад - красный, остальные - зеленые
                circle.setAttribute("fill", name === "склад" ? "red" : "green");
                circle.setAttribute("stroke", "#fff");
                circle.setAttribute("stroke-width", "2");
                svg.appendChild(circle);
                
                // Подпись точки
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", coords.x * 1.2 + 12);
                text.setAttribute("y", coords.y * 1.2 + 5);
                text.setAttribute("fill", "#333");
                text.setAttribute("font-size", "14");
                text.setAttribute("font-weight", "bold");
                text.textContent = name;
                svg.appendChild(text);
            }
        })
        .catch(error => console.error('Ошибка загрузки данных карты:', error));
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

// --- ДОБАВЛЕНИЕ ЗАКАЗА ---
function submitOrder() {
    const data = {
        pickup: document.getElementById('o-pickup').value,
        delivery: document.getElementById('o-delivery').value,
        time: document.getElementById('o-time').value,
        weight: parseInt(document.getElementById('o-weight').value)
    };

    fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(res => {
        if (res.status === 'success') {
            window.location.reload(); // Перезагружаем страницу, чтобы увидеть новый заказ
        } else {
            alert('Ошибка: ' + res.message);
        }
    });
}

// --- ДОБАВЛЕНИЕ МАШИНЫ ---
function submitVehicle() {
    const data = {
        name: document.getElementById('v-name').value,
        license_plate: document.getElementById('v-plate').value,
        capacity: parseInt(document.getElementById('v-capacity').value)
    };

    fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(res => {
        if (res.status === 'success') {
            window.location.reload(); // Перезагружаем страницу, чтобы увидеть новую машину
        } else {
            alert('Ошибка: ' + res.message);
        }
    });
}
// --- ЛОГИКА ДЛЯ СТРАНИЦЫ КООРДИНАТ ---

document.addEventListener('DOMContentLoaded', function() {
    // Если на странице есть таблица точек, значит мы на вкладке координат
    if (document.getElementById('points-table')) {
        loadCoordinates();
    }
});

function loadCoordinates() {
    fetch('/api/coordinates')
        .then(response => response.json())
        .then(data => {
            // Заполняем ограничения (они берутся из settings.json)
            if (data.settings) {
                document.getElementById('max-time').value = data.settings.max_route_time || 480;
                document.getElementById('shift-start').value = data.settings.shift_start || '08:00';
                document.getElementById('shift-end').value = data.settings.shift_end || '20:00';
            }

            // Очищаем таблицу перед заполнением
            const table = document.getElementById('points-table');
            table.innerHTML = '<tr><th>Точка</th><th>X</th><th>Y</th></tr>';
            
            // Заполняем точки из БД
            for (const [name, coords] of Object.entries(data.points)) {
                addPointToTable(name, coords[0], coords[1]);
            }
        })
        .catch(error => console.error('Ошибка загрузки координат:', error));
}

function addPointRow() {
    addPointToTable('', '', '');
}

function addPointToTable(name = '', x = '', y = '') {
    const table = document.getElementById('points-table');
    if (!table) return;

    const row = table.insertRow();
    
    // Очищаем возможные пробелы
    const safeName = String(name).replace(/"/g, '&quot;');
    
    // Создаем ячейки вручную (это надежнее, чем innerHTML)
    row.insertCell(0).innerHTML = `<input type="text" value="${safeName}" style="width: 90%; padding: 5px; background: transparent; border: none; border-bottom: 1px solid #000; font-weight: bold;">`;
    row.insertCell(1).innerHTML = `<input type="number" value="${x}" style="width: 70%; padding: 5px; background: transparent; border: none; border-bottom: 1px solid #000; font-weight: bold;">`;
    row.insertCell(2).innerHTML = `<input type="number" value="${y}" style="width: 70%; padding: 5px; background: transparent; border: none; border-bottom: 1px solid #000; font-weight: bold;">`;
    
    // Ячейка с кнопкой удаления
    const actionCell = row.insertCell(3);
    actionCell.style.textAlign = "center";
    actionCell.innerHTML = `<button onclick="deletePointRow(this)" style="background: #e74c3c; color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer; font-weight: bold;" title="Удалить точку">✕</button>`;
}

function deletePointRow(btn) {
    // btn - это кнопка. btn.parentNode - это ячейка (td). btn.parentNode.parentNode - это строка (tr).
    const row = btn.parentNode.parentNode;
    row.parentNode.removeChild(row);
}

function saveAllData() {
    const settings = {
        max_route_time: parseInt(document.getElementById('max-time').value),
        shift_start: document.getElementById('shift-start').value,
        shift_end: document.getElementById('shift-end').value
    };

    const points = {};
    const rows = document.querySelectorAll('#points-table tr');
    
    for (let i = 1; i < rows.length; i++) {
        const inputs = rows[i].querySelectorAll('input');
        const name = inputs[0].value.trim();
        const x = parseFloat(inputs[1].value);
        const y = parseFloat(inputs[2].value);
        
        if (name) {
            points[name] = [x, y];
        }
    }

    // Отправляем на сервер
    fetch('/api/coordinates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: points, settings: settings })
    })
    .then(response => response.json())
    .then(data => {
        const resDiv = document.getElementById('save-result');
        resDiv.style.display = 'inline-block';
        resDiv.style.padding = '10px';
        
        if (data.status === 'error') {
            // Показываем ошибку красным
            resDiv.className = 'error';
            resDiv.innerHTML = data.message;
        } else {
            // Показываем успех зеленым
            resDiv.className = 'success';
            resDiv.innerHTML = 'Координаты успешно сохранены!';
            setTimeout(() => { resDiv.style.display = 'none'; }, 3000);
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
    });
}

// Этот код сработает, как только страница полностью загрузится
document.addEventListener("DOMContentLoaded", function() {
    loadLatestPlan();
});