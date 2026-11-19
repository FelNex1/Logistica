from flask import Flask, render_template, jsonify
import json
import os
import math

app = Flask(__name__)

# ==========================================
# 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ==========================================

def load_data(filename):
    """Загружает JSON-файл из папки data."""
    path = os.path.join('data', filename)
    try:
        with open(path, 'r', encoding='utf-8') as file:
            return json.load(file)
    except FileNotFoundError:
        return []

def validate_data(orders, vehicles):
    """Проверяет ограничения (Ф-03, Е-01, Е-02, Е-04)."""
    errors = []
    if not vehicles:
        return ["E-04: Нет доступного транспорта"]
        
    max_capacity = max(v['capacity'] for v in vehicles)
    
    for order in orders:
        # Ошибка E-01: превышение грузоподъемности
        if order['weight'] > max_capacity:
            errors.append(f"E-01: Заказ #{order['id']} невозможно перевезти. Вес {order['weight']}кг превышает макс. вместимость {max_capacity}кг.")
        
        # Ошибка E-02: отсутствие координат
        if not order.get('pickup') or not order.get('delivery'):
            errors.append(f"E-02: В заказе #{order['id']} отсутствуют координаты.")
            
    return errors

def calculate_distance(point1, point2):
    """Считает расстояние между двумя точками по координатам."""
    x1, y1 = point1
    x2, y2 = point2
    return round(math.sqrt((x2 - x1)**2 + (y2 - y1)**2))

# ==========================================
# 2. МАРШРУТЫ ДЛЯ СТРАНИЦ (HTML)
# ==========================================

@app.route('/')
def index():
    orders = load_data('orders.json')
    vehicles = load_data('vehicles.json')
    return render_template('index.html', orders=orders, vehicles=vehicles)

@app.route('/coordinates')
def page_coordinates():
    return render_template('coordinates.html')

@app.route('/map')
def page_map():
    return render_template('map.html')

@app.route('/plan')
def page_plan():
    return render_template('plan.html')

@app.route('/report')
def page_report():
    return render_template('report.html')

# ==========================================
# 3. API МАРШРУТЫ (JSON)
# ==========================================

@app.route('/api/validate', methods=['POST'])
def api_validate():
    """API для проверки данных."""
    orders = load_data('orders.json')
    vehicles = load_data('vehicles.json')
    errors = validate_data(orders, vehicles)
    
    if errors:
        return jsonify({"status": "error", "errors": errors})
    else:
        return jsonify({"status": "success", "message": "Все данные корректны! Можно переходить к расчету маршрутов."})

@app.route('/api/plan', methods=['POST'])
def api_plan():
    """API для расчета плана по машинам (упрощенный алгоритм)."""
    orders = load_data('orders.json')
    vehicles = load_data('vehicles.json')
    points = load_data('points.json')
    
    # Готовим структуру для хранения распределения по машинам
    vehicle_routes = {
        v['id']: {
            "name": v['name'], 
            "license_plate": v.get('license_plate', 'Без номера'), 
            "capacity": v['capacity'], 
            "orders": [], 
            "total_weight": 0
        } for v in vehicles
    }
    
    # Жадный алгоритм: распределяем заказы по машинам
    for order in orders:
        for v_id, v_info in vehicle_routes.items():
            if v_info['total_weight'] + order['weight'] <= v_info['capacity']:
                v_info['orders'].append(order)
                v_info['total_weight'] += order['weight']
                break 
    
    result = []
    # Считаем маршруты и километраж для каждой загруженной машины
    for v_id, v_info in vehicle_routes.items():
        if not v_info['orders']:
            continue
            
        # Строим цепочку: Склад -> Точка1 -> Точка2 -> ... -> Склад
        route_stops = ["склад"]
        for o in v_info['orders']:
            route_stops.append(o['delivery'])
        route_stops.append("склад")
        
        route_details = []
        total_km = 0
        
        # Считаем расстояние между каждой парой соседних точек
        for i in range(len(route_stops) - 1):
            p1_name = route_stops[i]
            p2_name = route_stops[i+1]
            
            if p1_name in points and p2_name in points:
                dist = calculate_distance(points[p1_name], points[p2_name])
                total_km += dist
                route_details.append({
                    "from": p1_name,
                    "to": p2_name,
                    "distance": dist
                })
        
        result.append({
            "vehicle_name": v_info['name'],
            "vehicle_id": v_id,
            "license_plate": v_info['license_plate'],
            "route_details": route_details,
            "total_km": total_km
        })
        
    return jsonify({"status": "success", "plan": result})

# ==========================================
# 4. ЗАПУСК ПРИЛОЖЕНИЯ
# ==========================================

if __name__ == '__main__':
    app.run(debug=True)