from flask import Flask, request, jsonify
import random
from datetime import datetime, timedelta
import re

app = Flask(__name__)

def create_mutated_dish(pool, is_friday):
    split_pattern = r'[ ]*[\+&/][ ]*|[ ]+and[ ]+'
    first_parts, second_parts = [], []

    for d in pool:
        parts = re.split(split_pattern, d.get('dish_name', ''), flags=re.IGNORECASE)
        if len(parts) >= 2:
            first_parts.append(parts[0].strip())
            second_parts.append(parts[1].strip())

    if not first_parts:
        first_parts = [d.get('dish_name', 'Special') for d in pool]
        second_parts = first_parts

    new_name = f"{random.choice(first_parts)} & {random.choice(second_parts)}"
    ref = random.choice(pool)
    
    return {
        "is_new_creation": True,
        "dish_name": new_name,
        "diet_type": ref.get('diet_type', 'Veg'),
        "cost": ref.get('cost', 45),
        "effort_score": ref.get('effort_score', 3), 
        "popularity_score": 3.5 
    }

def run_ga(catalog, start_date_str, daily_budget=200, daily_effort_cap=15):
    start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
    mutation_rate = 0.1 

    def generate_random_week():
        week = []
        for day_offset in range(7):
            current_date = start_date + timedelta(days=day_offset)
            is_friday = current_date.weekday() == 4 
            day_meals = []
            
            for meal_type in ["Breakfast", "Lunch", "Dinner"]:
                veg_pool = [d for d in catalog if d.get('diet_type') in ['Veg', 'Common']]
                nv_pool = [d for d in catalog if d.get('diet_type') == 'Non-Veg']

                # 1. Veg Option
                v_dish = create_mutated_dish(veg_pool, is_friday) if random.random() < mutation_rate else random.choice(veg_pool).copy()
                day_meals.append(v_dish | {"serve_date": current_date.strftime('%Y-%m-%d'), "meal_type": meal_type, "diet_type": "Veg", "is_new_creation": v_dish.get('is_new_creation', False)})

                # 2. Non-Veg Option (or 2nd Veg on Friday)
                if not is_friday and nv_pool:
                    nv_dish = create_mutated_dish(nv_pool, is_friday) if random.random() < mutation_rate else random.choice(nv_pool).copy()
                    day_meals.append(nv_dish | {"serve_date": current_date.strftime('%Y-%m-%d'), "meal_type": meal_type, "diet_type": "Non-Veg", "is_new_creation": nv_dish.get('is_new_creation', False)})
                elif is_friday and len(veg_pool) > 1:
                    v2_dish = random.choice([d for d in veg_pool if d.get('id') != v_dish.get('id')]).copy()
                    day_meals.append(v2_dish | {"serve_date": current_date.strftime('%Y-%m-%d'), "meal_type": meal_type, "diet_type": "Veg", "is_new_creation": False})

            week.append(day_meals)
        return week

    def calculate_fitness(week):
        score = 0
        for day in week:
            day_cost = sum(float(m.get('cost', 0)) for m in day)
            day_effort = sum(int(m.get('effort_score', 0)) for m in day)
            score += sum(float(m.get('popularity_score', 0)) for m in day) * 10
            if day_cost > daily_budget: score -= 3000 
            if day_effort > daily_effort_cap: score -= 1500 
        return score

    population = sorted([generate_random_week() for _ in range(100)], key=calculate_fitness, reverse=True)
    
    # Format winner: include full data for Gemini to read
    return [m | {"dish_id": m.get("id")} for day in population[0] for m in day]

@app.route('/generate-menu', methods=['POST'])
def generate_menu():
    data = request.json
    try:
        result = run_ga(data['catalog'], data['start_date'])
        return jsonify({'success': True, 'proposed_menu': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)