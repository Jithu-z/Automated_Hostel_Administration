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
from flask import Flask, request, jsonify
import random
from datetime import datetime, timedelta
import re # Add this import at the top of your file


app = Flask(__name__)


def create_mutated_dish(catalog, is_friday):
    allowed_diets = ['Veg', 'Common'] if is_friday else ['Veg', 'Non-Veg', 'Common']
    valid_dishes = [d for d in catalog if d.get('diet_type') in allowed_diets]
    
    if not valid_dishes:
        valid_dishes = catalog
        
    first_parts = []
    second_parts = []

    # Regex pattern to split by: +, &, /, or the word "and" (with optional spaces)
    # The [ ]* ensures we handle "Rice & Curry" and "Rice&Curry" the same way
    split_pattern = r'[ ]*[\+&/][ ]*|[ ]+and[ ]+'

    for d in valid_dishes:
        name = d.get('dish_name', '')
        # Split using the regex pattern
        parts = re.split(split_pattern, name, flags=re.IGNORECASE)
        
        # Only collect parts if the dish actually contained a separator
        if len(parts) >= 2:
            first_parts.append(parts[0].strip())
            second_parts.append(parts[1].strip())

    # Fallback: If no dishes in the catalog have separators, 
    # we use the full names to avoid a crash.
    if not first_parts:
        first_parts = [d['dish_name'] for d in valid_dishes]
        second_parts = first_parts

    part1 = random.choice(first_parts)
    part2 = random.choice(second_parts)
    
    # Combine using a standard separator like " & "
    new_name = f"{part1} & {part2}"
    
    reference_dish = random.choice(valid_dishes)
    
    return {
        "is_new_creation": True,
        "dish_name": new_name,
        "diet_type": reference_dish.get('diet_type', 'Veg'),
        "cost": reference_dish.get('cost', 50),       
        "effort_score": reference_dish.get('effort_score', 5), 
        "popularity_score": 3.5               
    }

def run_ga(catalog, start_date_str, categories, daily_budget=150, daily_effort_cap=12, mutation_rate=0.08):
    start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
    veg_common = [d for d in catalog if d['diet_type'] in ['Veg', 'Common']]
    all_dishes = catalog

    # --- UPDATED: GEMINI FILTER + HARD RICE CONSTRAINT ---
    def get_smart_pool(pool, meal_type):
        key = meal_type.lower()
        
        # 1. Start with the category Gemini suggested
        if categories and key in categories:
            allowed_ids = categories[key]
            smart_pool = [d for d in pool if d.get('id') in allowed_ids]
        else:
            smart_pool = pool

        # 2. HARD CONSTRAINT: If Lunch, it MUST contain Rice keywords
        if meal_type == "Lunch":
            # List of keywords that identify a "Rice" dish in your region
            rice_keywords = ['rice', 'biryani', 'pulao', 'meals', 'choru', 'fried rice']
            
            # Filter the current pool for rice dishes
            rice_only_pool = [
                d for d in smart_pool 
                if any(word in d.get('dish_name', '').lower() for word in rice_keywords)
            ]
            
            # If we found rice dishes, use them. If catalog has NONE, 
            # we keep the smart_pool to avoid a crash, but warn in console.
            if rice_only_pool:
                return rice_only_pool
            else:
                print(f"Warning: No 'Rice' dishes found in catalog for {meal_type}")
        
        return smart_pool if smart_pool else pool

    def generate_random_week():
        week = []
        for day_offset in range(7):
            current_date = start_date + timedelta(days=day_offset)
            is_friday = current_date.weekday() == 4 
            
            day_meals = []
            for meal_type in ["Breakfast", "Lunch", "Dinner"]:
                base_pool = veg_common if is_friday else all_dishes
                
                # Apply the Smart Pool (Gemini + Rice Rule)
                smart_pool = get_smart_pool(base_pool, meal_type)
                
                if random.random() < mutation_rate:
                    # Pass the filtered smart_pool so Frankenstein only creates 
                    # Rice-based mutations for lunch!
                    dish = create_mutated_dish(smart_pool, is_friday)
                else:
                    dish = random.choice(smart_pool).copy()
                    dish['is_new_creation'] = False
                
                day_meals.append({
                    "serve_date": current_date.strftime('%Y-%m-%d'),
                    "meal_type": meal_type,
                    "dish_id": dish.get('id', None),
                    "is_new_creation": dish.get('is_new_creation', False),
                    "dish_name": dish.get('dish_name'),
                    "diet_type": dish.get('diet_type'),
                    "cost": dish.get('cost', 0),
                    "effort_score": dish.get('effort_score', 0),
                    "popularity_score": dish.get('popularity_score', 0)
                })
            week.append(day_meals)
        return week

    def calculate_fitness(week):
        score = 0
        for day in week:
            day_cost = sum(float(m['cost']) for m in day)
            day_effort = sum(int(m['effort_score']) for m in day)
            day_pop = sum(float(m['popularity_score']) for m in day)
            score += day_pop * 10
            if day_cost > daily_budget: score -= 2000 
            if day_effort > daily_effort_cap: score -= 1000 
        return score

    population = [generate_random_week() for _ in range(100)]
    population.sort(key=calculate_fitness, reverse=True)
    
    best_week = []
    for day in population[0]:
        for m in day:
            if m.get('is_new_creation'):
                best_week.append({
                    "serve_date": m["serve_date"], 
                    "meal_type": m["meal_type"], 
                    "is_new_creation": True, 
                    "dish_name": m["dish_name"], 
                    "diet_type": m["diet_type"], 
                    "cost": m["cost"], 
                    "effort_score": m["effort_score"]
                })
            else:
                best_week.append({
                    "serve_date": m["serve_date"], 
                    "meal_type": m["meal_type"], 
                    "is_new_creation": False, 
                    "dish_id": m["dish_id"]
                })
    return best_week

@app.route('/generate-menu', methods=['POST'])
def generate_menu():
    data = request.json
    if not data or 'catalog' not in data or 'start_date' not in data:
        return jsonify({'error': 'Missing catalog or start_date'}), 400
    
    try:
        result = run_ga(data['catalog'], data['start_date'], data.get('categories', {}))
        return jsonify({'success': True, 'proposed_menu': result})
    except Exception as e:
        print("AI Engine Error:", str(e))
        return jsonify({'error': 'Failed to generate menu mathematically.'}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)