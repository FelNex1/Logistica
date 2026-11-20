from flask import Flask, render_template, jsonify
from flask_sqlalchemy import SQLAlchemy
import json
import os
import math
from datetime import datetime

app = Flask(__name__)

# ==========================================
# 1. НАСТРОЙКА БАЗЫ ДАННЫХ
# ==========================================
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///logistics.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# ==========================================
# 2. МОДЕЛИ БАЗЫ ДАННЫХ (ТАБЛИЦЫ)
# ==========================================
class Order(db.Model):
    __tablename__ = 'orders'
    id = db.Column(db.Integer, primary_key=True)
    pickup_point = db.Column(db.String(50), nullable=False)
    delivery_point = db.Column(db.String(50), nullable=False)
    time_window = db.Column(db.String(50), nullable=False)
    cargo_weight = db.Column(db.Integer, nullable=False)

class Vehicle(db.Model):
    __tablename__ = 'vehicles'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    license_plate = db.Column(db.String(20), nullable=False)
    capacity = db.Column(db.Integer, nullable=False)

class Point(db.Model):
    __tablename__ = 'points'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    x_coord = db.Column(db.Float, nullable=False)
    y_coord = db.Column(db.Float, nullable=False)

class ProcessingJob(db.Model):
    __tablename__ = 'processing_jobs'
    id = db.Column(db.Integer, primary_key=True)
    status = db.Column(db.String(20), default='pending')
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)
    error_code = db.Column(db.String(50), nullable=True)

class Route(db.Model):
    __tablename__ = 'routes'
    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id'), nullable=False)
    total_distance = db.Column(db.Float, nullable=False)
    job_id = db.Column(db.Integer, db.ForeignKey('processing_jobs.id'), nullable=False)
    
    # Связь для удобного получения остановок
    stops = db.relationship('RouteStop', backref='route', lazy=True, order_by='RouteStop.sequence')

class RouteStop(db.Model):
    __tablename__ = 'route_stops'
    id = db.Column(db.Integer, primary_key=True)
    route_id = db.Column(db.Integer, db.ForeignKey('routes.id'), nullable=False)
    point_name = db.Column(db.String(50), nullable=False)
    sequence = db.Column(db.Integer, nullable=False) # Порядковый номер точки

# ==========================================
# 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ==========================================
def load_data(filename):
    """Загружает JSON-файл из папки data."""
    path = os.path.join('data', filename)
    try:
        with open(path, 'r', encoding='utf-8') as file:
            return json.load(file)
    except FileNotFoundError:
        return []

def calculate_distance(point1, point2):
    """Считает расстояние между двумя точками."""
    x1, y1 = point1
    x2, y2 = point2
    return round(math.sqrt((x2 - x1)**2 + (y2 - y1)**2))

def init_db():
    """Создает таблицы и переносит данные из JSON в базу"""
    with app.app_context():
        db.create_all()
        
        if not Vehicle.query.first():
            orders_data = load_data('orders.json')
            vehicles_data = load_data('vehicles.json')
            points_data = load_data('points.json')
            
            for o in orders_data:
                new_order = Order(
                    id=o['id'], 
                    pickup_point=o['pickup'], 
                    delivery_point=o['delivery'], 
                    time_window=o['time'], 
                    cargo_weight=o['weight']
                )
                db.session.add(new_order)
                
            for v in vehicles_data:
                new_vehicle = Vehicle(
                    id=v['id'], 
                    name=v['name'], 
                    license_plate=v['license_plate'], 
                    capacity=v['capacity']
                )
                db.session.add(new_vehicle)
                
            for name, coords in points_data.items():
                new_point = Point(
                    name=name, 
                    x_coord=coords[0], 
                    y_coord=coords[1]
                )
                db.session.add(new_point)
                
            db.session.commit()
            print("База данных успешно создана и заполнена из JSON!")

# Вызываем инициализацию базы (теперь функция load_data уже известна Питону)
init_db()

# ==========================================
# 4. МАРШРУТЫ ДЛЯ СТРАНИЦ (HTML)
# ==========================================
@app.route('/')
def index():
    orders = Order.query.all()
    vehicles = Vehicle.query.all()
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
# 5. API МАРШРУТЫ (JSON)
# ==========================================
@app.route('/api/validate', methods=['POST'])
def api_validate():
    orders = Order.query.all()
    vehicles = Vehicle.query.all()
    
    errors = []
    if not vehicles:
        return jsonify({"status": "error", "errors": ["E-04: Нет доступного транспорта"]})
        
    max_capacity = max(v.capacity for v in vehicles)
    
    for order in orders:
        if order.cargo_weight > max_capacity:
            errors.append(f"E-01: Заказ #{order.id} невозможно перевезти. Вес {order.cargo_weight}кг превышает макс. вместимость {max_capacity}кг.")
            
        if not order.pickup_point or not order.delivery_point:
            errors.append(f"E-02: В заказе #{order.id} отсутствуют координаты.")
            
    if errors:
        return jsonify({"status": "error", "errors": errors})
    else:
        return jsonify({"status": "success", "message": "Все данные корректны!"})

@app.route('/api/plan', methods=['POST'])
def api_plan():
    job = ProcessingJob(status='processing')
    db.session.add(job)
    db.session.commit()
    
    try:
        orders = Order.query.all()
        vehicles = Vehicle.query.all()
        points = {p.name: [p.x_coord, p.y_coord] for p in Point.query.all()}
        
        vehicle_routes = {
            v.id: {
                "name": v.name, 
                "license_plate": v.license_plate, 
                "capacity": v.capacity, 
                "orders": [], 
                "total_weight": 0
            } for v in vehicles
        }
        
        # Жадный алгоритм
        unassigned = []
        for order in orders:
            assigned = False
            for v_id, v_info in vehicle_routes.items():
                if v_info['total_weight'] + order.cargo_weight <= v_info['capacity']:
                    v_info['orders'].append(order)
                    v_info['total_weight'] += order.cargo_weight
                    assigned = True
                    break 
            if not assigned:
                unassigned.append(order)
        
        result = []
        for v_id, v_info in vehicle_routes.items():
            if not v_info['orders']:
                continue
                
            route_stops = ["склад"]
            for o in v_info['orders']:
                if o.pickup_point != "склад" and o.pickup_point not in route_stops:
                    route_stops.append(o.pickup_point)
                route_stops.append(o.delivery_point)
            route_stops.append("склад")
            
            route_details = []
            total_km = 0
            
            for i in range(len(route_stops) - 1):
                p1_name = route_stops[i]
                p2_name = route_stops[i+1]
                
                if p1_name in points and p2_name in points:
                    dist = calculate_distance(points[p1_name], points[p2_name])
                    total_km += dist
                    route_details.append({"from": p1_name, "to": p2_name, "distance": dist})
            
            # --- СОХРАНЕНИЕ В БАЗУ ДАННЫХ ---
            new_route = Route(vehicle_id=v_id, total_distance=total_km, job_id=job.id)
            db.session.add(new_route)
            db.session.flush() # Получаем ID нового маршрута

            for seq_index, stop_name in enumerate(route_stops):
                new_stop = RouteStop(route_id=new_route.id, point_name=stop_name, sequence=seq_index)
                db.session.add(new_stop)
            # --------------------------------

            result.append({
                "vehicle_name": v_info['name'],
                "vehicle_id": v_id,
                "license_plate": v_info['license_plate'],
                "route_details": route_details,
                "total_km": total_km
            })
            
        job.status = 'success'
        job.end_time = datetime.utcnow()
        db.session.commit()
        
        return jsonify({"status": "success", "plan": result, "unassigned": [o.id for o in unassigned]})
        
    except Exception as e:
        db.session.rollback() # Откатываем изменения при ошибке
        job.status = 'error'
        job.error_code = str(e)
        job.end_time = datetime.utcnow()
        db.session.commit()
        return jsonify({"status": "error", "message": str(e)}), 500

# ==========================================
# 6. ЗАПУСК
# ==========================================
@app.route('/api/map-data', methods=['GET'])
def api_map_data():
    """Отдает координаты точек и последние маршруты для отрисовки карты"""
    points = Point.query.all()
    points_dict = {p.name: {"x": p.x_coord, "y": p.y_coord} for p in points}
    
    # Берем последние 5 маршрутов
    latest_routes = Route.query.order_by(Route.id.desc()).limit(5).all()
    routes_data = []
    for r in latest_routes:
        routes_data.append({
            "vehicle_id": r.vehicle_id,
            "stops": [stop.point_name for stop in r.stops]
        })
        
    return jsonify({"points": points_dict, "routes": routes_data})

@app.route('/api/plan/latest', methods=['GET'])
def api_plan_latest():
    """Отдает последний успешно рассчитанный план из базы данных"""
    # Ищем последнюю успешную задачу
    job = ProcessingJob.query.filter_by(status='success').order_by(ProcessingJob.id.desc()).first()
    if not job:
        return jsonify({"status": "success", "plan": []})
    
    # Достаем маршруты для этой задачи
    routes = Route.query.filter_by(job_id=job.id).all()
    points = {p.name: [p.x_coord, p.y_coord] for p in Point.query.all()}
    
    result = []
    for r in routes:
        vehicle = Vehicle.query.get(r.vehicle_id)
        stops = [s.point_name for s in r.stops]
        
        # Восстанавливаем детали маршрута (расстояния между точками)
        route_details = []
        for i in range(len(stops) - 1):
            p1, p2 = stops[i], stops[i+1]
            dist = 0
            if p1 in points and p2 in points:
                dist = calculate_distance(points[p1], points[p2])
            route_details.append({"from": p1, "to": p2, "distance": dist})
            
        result.append({
            "vehicle_name": vehicle.name,
            "vehicle_id": vehicle.id,
            "license_plate": vehicle.license_plate,
            "route_details": route_details,
            "total_km": r.total_distance
        })
        
    return jsonify({"status": "success", "plan": result})

if __name__ == '__main__':
    app.run(debug=True)