import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function KioskGraph() {
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);

  const foodReviewApi = "http://10.0.9.78:3001/api/kiosk/live-display";

  useEffect(() => {
    const fetchFoodData = async () => {
      try {
        const response = await axios.get(foodReviewApi);
        setLiveData(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching live food stats:', error);
        setLoading(false);
      }
    };
    fetchFoodData();
  }, []);

  if (loading || !liveData || !liveData.today_menu) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', fontSize: '1.5rem', color: '#666' }}>
        Syncing HostelSync Live Data...
      </div>
    );
  }

  const activeMeal = liveData.active_meal || 'Breakfast';
  const mealData = liveData.today_menu?.[activeMeal];
  const currentDishes = mealData?.items || [];
  const hof = liveData.hall_of_fame || {};
  const mealTimings = mealData?.timings;

  // Check if current meal is still being served
  const getCurrentTime = () => new Date().toTimeString().split(' ')[0];
  const isMealStillBeingServed = () => {
    if (!mealTimings?.end_time) return true; // Default to showing as live if no timing
    const currentTime = getCurrentTime();
    return currentTime <= mealTimings.end_time;
  };

  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // LOGIC: Find specific items for the "Serving" bar
  const vegDish = currentDishes.find(d => d.diet_type === 'Veg')?.dish_name;
  const nonVegDish = currentDishes.find(d => d.diet_type === 'Non-Veg')?.dish_name;
  const commonDish = currentDishes.find(d => d.diet_type === 'Common')?.dish_name;

  // Debug: Log active meal every time component renders
  console.log(` KioskGraph Active Meal: ${activeMeal} | Current Time: ${new Date().toTimeString().split(' ')[0]}`);

  // Debug: Log all meal timings
  console.log(' All Meal Timings:');
  console.log(`  Breakfast: ${liveData.today_menu?.Breakfast?.timings?.start_time || 'N/A'} - ${liveData.today_menu?.Breakfast?.timings?.end_time || 'N/A'}`);
  console.log(`  Lunch: ${liveData.today_menu?.Lunch?.timings?.start_time || 'N/A'} - ${liveData.today_menu?.Lunch?.timings?.end_time || 'N/A'}`);
  console.log(`  Dinner: ${liveData.today_menu?.Dinner?.timings?.start_time || 'N/A'} - ${liveData.today_menu?.Dinner?.timings?.end_time || 'N/A'}`);
  console.log(`  Is ${activeMeal} still being served? ${isMealStillBeingServed()}`);

  // Determine header text based on serving status
  const getHeaderText = () => {
    if (isMealStillBeingServed()) {
      return `🔥 Live Now: ${activeMeal}`;
    } else {
      return `⭐ Live Rating: ${activeMeal}`;
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', padding: '25px', boxSizing: 'border-box' }}>
      
      {/* 1. TOP SECTION: LIVE MEAL */}
      <div style={{ flex: '1.6', display: 'flex', flexDirection: 'column', marginBottom: '15px' }}>
        <div style={{ borderBottom: '3px solid #f0f0f0', paddingBottom: '10px', marginBottom: '15px' }}>
          <h2 style={{ fontSize: '2.5rem', color: '#2c3e50', margin: 0 }}>{getHeaderText()}</h2>
          {mealTimings && (
            <div style={{ fontSize: '1.1rem', color: '#7f8c8d', marginBottom: '5px' }}>
              ⏰ {formatTime(mealTimings.start_time)} - {formatTime(mealTimings.end_time)}
            </div>
          )}
          <div style={{ display: 'flex', gap: '20px', color: '#27ae60', fontSize: '1.3rem', fontWeight: 'bold' }}>
            <span>Rating: {mealData?.live_rating || "0.0"} ★</span>
            <span style={{ color: '#7f8c8d' }}>({mealData?.votes || 0} votes)</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {currentDishes.slice(0, 3).map((dish, index) => (
            <div key={index} style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '15px 30px', backgroundColor: '#fafffa', borderRadius: '15px', border: '2px solid #27ae60' 
            }}>
              <span style={{ fontSize: '1.7rem', fontWeight: 'bold', color: '#2c3e50' }}>#{index + 1} {dish.dish_name}</span>
              <span style={{ fontSize: '1.7rem', fontWeight: 'bold', color: '#27ae60' }}>{Number(dish.popularity_score).toFixed(1)} ★</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. MIDDLE SECTION: HALL OF FAME */}
<div style={{ flex: '1.6', marginBottom: '15px' }}>
  <h3 style={{ fontSize: '2.5rem', color: '#7f8c8d', marginBottom: '8px', textTransform: 'uppercase' }}>
    🏆 TOP DISHES OF ALL TIME
  </h3>
  <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr 1fr', gap: '10px' }}>
    {['Breakfast', 'Lunch', 'Dinner'].map((mealType) => (
      <div key={mealType} style={{ backgroundColor: '#f8f9fa', borderRadius: '10px', padding: '10px', border: '1px solid #eee' }}>
        {/* Added explicit dark color #2c3e50 to the Heading */}
        <h4 style={{ 
          fontSize: '2.5rem', 
          margin: '0 0 5px 0', 
          textAlign: 'center', 
          borderBottom: '2px solid #27ae60',
          color: '#2c3e50', // Explicit dark color
          fontWeight: 'bold'
        }}>
          {mealType}
        </h4>
        
        {hof[mealType]?.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', marginBottom: '5px' }}>
            {/* Added explicit dark color #333 to Dish Name */}
            <span style={{ 
              color: '#333', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              maxWidth: '120px', 
            }}>
              {i + 1}. {item.dish_name}
            </span>
            <span style={{ fontWeight: 'bold', color: '#f39c12' }}>
              {Number(item.popularity_score).toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    ))}
  </div>
</div>

      {/* 3. DYNAMIC SERVING BAR */}
      <div style={{ 
        backgroundColor: '#000000', padding: '10px 20px', borderRadius: '12px', marginBottom: '10px', 
        borderLeft: '5px solid #3498db', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', justifyContent: 'center' 
      }}>
        <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>🍽️ Currently Serving:</span>
        
        {commonDish && (
          <span style={{ color: '#555', fontWeight: 'bold' }}>COMMON: <span style={{ color: '#3498db' }}>{commonDish}</span></span>
        )}
        
        {vegDish && (
          <span style={{ color: '#fff9f9', fontWeight: 'bold' }}>🟢 VEG: <span style={{ color: '#27ae60' }}>{vegDish}</span></span>
        )}
        
        {nonVegDish && (
          <span style={{ color: 'fff9f9', fontWeight: 'bold' }}>🔴 NON-VEG: <span style={{ color: '#e74c3c' }}>{nonVegDish}</span></span>
        )}
      </div>
    </div>
  );
}