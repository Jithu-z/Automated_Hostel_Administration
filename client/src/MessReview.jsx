import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Star, Utensils, Send, CheckCircle, Sunrise, Sun, Moon, Leaf, Drumstick, AlertCircle, AlertTriangle } from 'lucide-react';

const MessReview = () => {
  // Hardcode a dummy UID or use the logged-in one
  const user = JSON.parse(localStorage.getItem('user'));
  const uid = user ? user.uid : 'TEST_USER_001';
  
  const [loading, setLoading] = useState(false);
  const [dietType, setDietType] = useState('Non-Veg'); 
  const [activeMeal, setActiveMeal] = useState(null); 
  const [showModal, setShowModal] = useState(false);

  // --- NEW: TIME TRAVEL STATE ---
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));

  const [todayMenu, setTodayMenu] = useState([]);
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [dishIssues, setDishIssues] = useState({}); 
  const [comment, setComment] = useState('');
  const [dayMenu, setDayMenu] = useState({ Breakfast: [], Lunch: [], Dinner: [] });

  const [availableTags, setAvailableTags] = useState(["Too Spicy", "Bland", "Undercooked", "Cold", "Stale/Smell", "Foreign Object"]);
  const [newCustomTag, setNewCustomTag] = useState('');

  const handleAddNewTag = (e) => {
    e.preventDefault(); 
    const tag = newCustomTag.trim();
    if (!tag) return;
    const formattedTag = tag.charAt(0).toUpperCase() + tag.slice(1);
    if (!availableTags.includes(formattedTag)) setAvailableTags([...availableTags, formattedTag]);
    setNewCustomTag(''); 
  };

  // Fetch the menu based on the selectedDate (not CURDATE)
  useEffect(() => {
    const fetchFullDayMenu = async () => {
      try {
        const [bfastRes, lunchRes, dinnerRes] = await Promise.all([
          axios.get(`http://10.0.8.126:3001/api/student/mess/test/menu?date=${selectedDate}&meal=Breakfast&diet=${dietType}`),
          axios.get(`http://10.0.8.126:3001/api/student/mess/test/menu?date=${selectedDate}&meal=Lunch&diet=${dietType}`),
          axios.get(`http://10.0.8.126:3001/api/student/mess/test/menu?date=${selectedDate}&meal=Dinner&diet=${dietType}`)
        ]);
        
        setDayMenu({
          Breakfast: bfastRes.data,
          Lunch: lunchRes.data,
          Dinner: dinnerRes.data
        });
      } catch (err) {
        console.error("Failed to fetch the test menu", err);
      }
    };

    fetchFullDayMenu();
  }, [dietType, selectedDate]); 

  const handleOpenReview = (mealName) => {
    const menuForMeal = dayMenu[mealName];
    if (!menuForMeal || menuForMeal.length === 0) {
      alert(`No menu scheduled for ${mealName} on ${selectedDate}!`);
      return; 
    } 
    setTodayMenu(menuForMeal);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!dayMenu[activeMeal] || dayMenu[activeMeal].length === 0) return alert("Menu empty.");
    const hasFlaggedDishes = Object.keys(dishIssues).length > 0;
    if (rating <= 3 && !hasFlaggedDishes) return alert("Please select which item(s) had an issue.");
    
    setLoading(true);
    const cleanIssues = {};
    Object.entries(dishIssues).forEach(([key, tags]) => {
      if (tags.length > 0) {
        const itemName = key.split('::')[1]; 
        cleanIssues[itemName] = tags;
      }
    });

    const payload = {
      uid: uid,
      serve_date: selectedDate, // USING OUR CUSTOM DATE!
      meal_type: activeMeal,
      diet_type: dietType,
      rating: rating,
      dish_issues: JSON.stringify(cleanIssues), 
      comment: comment
    };

    try {
      await axios.post('http://10.0.8.126:3001/api/student/mess/test/review', payload);
      resetForm();
      alert(`Test review injected for ${selectedDate}!`);
    } catch (err) {
      console.error(err);
      alert("Failed to submit test review.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowModal(false);
    setActiveMeal(null);
    setRating(0);
    setDishIssues({});
    setComment('');
  };

  const toggleDish = (dishId) => {
    setDishIssues(prev => {
      const newState = { ...prev };
      if (newState[dishId]) delete newState[dishId]; 
      else newState[dishId] = []; 
      return newState;
    });
  };

  const toggleTagForDish = (dishId, tag) => {
    setDishIssues(prev => {
      const currentTags = prev[dishId] || [];
      const updatedTags = currentTags.includes(tag) ? currentTags.filter(t => t !== tag) : [...currentTags, tag];
      return { ...prev, [dishId]: updatedTags };
    });
  };

  const splitDishName = (name) => {
    if (!name) return [];
    return name.split(/ \+ | & | and |, /i).map(s => s.trim()).filter(Boolean);
  };

  const mealCards = [
    { name: 'Breakfast', icon: <Sunrise size={32} /> },
    { name: 'Lunch', icon: <Sun size={32} /> },
    { name: 'Dinner', icon: <Moon size={32} /> }
  ];

  return (
    <div className="animate-fade-in max-w-4xl mx-auto space-y-8 p-4">
      
      {/* TEST MODE BANNER */}
      <div className="bg-red-500 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg animate-pulse">
        <AlertTriangle size={20} />
        TEST MODE: All locks disabled. Submitting dummy data directly to database.
        NB: Don't use custom tab
      </div>

      {/* DATE & DIET CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border-2 border-red-200 gap-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Time Travel Date</h2>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="mt-2 border-2 border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-red-400 font-bold text-red-600"
          />
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setDietType('Veg')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all ${dietType === 'Veg' ? 'bg-green-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>
            <Leaf size={18} /> Veg
          </button>
          <button onClick={() => setDietType('Non-Veg')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all ${dietType === 'Non-Veg' ? 'bg-red-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>
            <Drumstick size={18} /> Non-Veg
          </button>
        </div>
      </div>

      {/* MEAL CARDS GRID (LOCKS REMOVED) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {mealCards.map((meal) => {
          const isActive = activeMeal === meal.name;
          const isPending = !dayMenu[meal.name] || dayMenu[meal.name].length === 0;
          const theme = dietType === 'Veg' ? { activeBorder: 'border-green-400', hoverBorder: 'hover:border-green-200', iconColors: 'bg-green-50 text-green-600', actionText: 'text-green-600' } : { activeBorder: 'border-red-400', hoverBorder: 'hover:border-red-200', iconColors: 'bg-red-50 text-red-600', actionText: 'text-red-600' };
          
          return (
            <div 
              key={meal.name}
              className={`p-6 rounded-2xl border-2 transition-all relative overflow-hidden flex flex-col items-center text-center ${isActive ? `bg-white ${theme.activeBorder} shadow-md` : `bg-white border-transparent shadow-sm hover:shadow-md ${theme.hoverBorder} cursor-pointer`}`}
              onClick={() => { 
                if (isActive) return;
                if (isPending) return alert(`No menu scheduled for ${meal.name} on this date!`);
                setActiveMeal(meal.name); 
              }}
            >
              <div className={`mb-3 w-fit p-4 rounded-full ${theme.iconColors} ${theme.actionText}`}>
                {meal.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-800">{meal.name}</h3>
              
              <div className="mt-2 min-h-[40px] px-2 text-sm flex items-center justify-center text-gray-600">
                {dayMenu[meal.name] && dayMenu[meal.name].length > 0 ? (
                  <p className="line-clamp-2 leading-tight">
                    {dayMenu[meal.name].map(d => d.dish_name).join(' • ')}
                  </p>
                ) : (
                  <p className="italic text-gray-400 text-xs">No Data</p>
                )}
              </div>

              <div className="mt-4 w-full h-16 flex items-center justify-center">
                {!isActive ? (
                  <span className={`${theme.actionText} text-sm font-bold`}>Force Submit Review &rarr;</span>
                ) : (
                  <div className="flex flex-col items-center animate-slide-up w-full">
                    <div className="flex gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={(e) => { e.stopPropagation(); setRating(star); }} onMouseEnter={() => setHoveredStar(star)} onMouseLeave={() => setHoveredStar(0)} className="transition-transform hover:scale-125 focus:outline-none">
                          <Star size={28} className={`${(hoveredStar || rating) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} transition-colors`} />
                        </button>
                      ))}
                    </div>
                    
                    {rating > 0 && (
                       rating >= 4 ? (
                         <button onClick={(e) => { e.stopPropagation(); handleSubmit(); }} className="w-full bg-green-500 text-white text-sm py-2 rounded-lg font-bold animate-fade-in flex items-center justify-center gap-2 hover:bg-green-600">
                           Submit <Send size={14}/>
                         </button>
                       ) : (
                         <button onClick={(e) => { e.stopPropagation(); handleOpenReview(meal.name); }} className="w-full bg-gray-800 text-white text-sm py-2 rounded-lg font-bold animate-fade-in hover:bg-gray-900">
                           Add Details
                         </button>
                       )
                    )}
                  </div>
                )}
              </div>
              {isActive && rating === 0 && <button onClick={(e) => { e.stopPropagation(); setActiveMeal(null); }} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">✕</button>}
            </div>
          );
        })}
      </div>

      {/* MODAL: IDENTICAL TO PRODUCTION */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 pb-24">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up flex flex-col max-h-[75vh]">
            
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">{activeMeal} Feedback</h3>
                <p className="text-xs text-red-500 font-bold">TEST ENTRY • {selectedDate}</p>
              </div>
              <button onClick={resetForm} className="text-gray-400 hover:text-red-500 transition bg-white p-2 rounded-full shadow-sm">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* STEP 1: SELECT DISHES */}
              <div>
                <p className="font-bold text-gray-800 mb-3 text-sm">1. Which item(s) had an issue? *</p>
                <div className="flex flex-wrap gap-2">
                  {todayMenu.map(dish => {
                    const subItems = splitDishName(dish.dish_name);
                    return subItems.map(subItem => {
                      const uniqueKey = `${dish.id}::${subItem}`;
                      const isSelected = dishIssues[uniqueKey] !== undefined;
                      return (
                        <button key={uniqueKey} onClick={() => toggleDish(uniqueKey)} className={`px-4 py-2 rounded-xl text-sm font-bold border transition ${isSelected ? 'bg-red-50 border-red-200 text-red-600 shadow-inner' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {subItem}
                        </button>
                      );
                    });
                  })}
                </div>
              </div>

              {/* STEP 2: DYNAMIC TAGS */}
              {Object.keys(dishIssues).length > 0 && (
                <div className="space-y-4 animate-fade-in border-l-2 border-red-100 pl-4">
                  <p className="font-bold text-gray-800 text-sm flex items-center gap-2"><AlertCircle size={16} className="text-red-500"/> 2. What was wrong with them?</p>
                  {Object.keys(dishIssues).map(uniqueKey => {
                    const [, subItemName] = uniqueKey.split('::');
                    return (
                      <div key={uniqueKey} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">{subItemName}</p>
                        <div className="flex flex-wrap gap-2">
                          {availableTags.map(tag => {
                            const isTagSelected = dishIssues[uniqueKey].includes(tag);
                            return (
                              <button key={tag} onClick={() => toggleTagForDish(uniqueKey, tag)} className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${isTagSelected ? 'bg-gray-800 border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2 mt-4 pt-2 border-t border-gray-100">
                            <input 
                              type="text" value={newCustomTag} onChange={(e) => setNewCustomTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddNewTag(e); }} placeholder="Other issue?"
                              className="flex-1 border border-gray-200 rounded-xl p-2 text-sm outline-none bg-white"
                            />
                            <button type="button" onClick={handleAddNewTag} className="bg-gray-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-900">+ Add Tag</button>
                          </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* STEP 3: COMMENT BOX */}
              <div>
                 <p className="font-bold text-gray-800 mb-2 text-sm">3. Additional Details</p>
                 <textarea className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none resize-none bg-gray-50" rows="3" value={comment} onChange={(e) => setComment(e.target.value)}></textarea>
              </div>
            </div>

            <div className="p-4 bg-white border-t">
              <button disabled={loading || Object.keys(dishIssues).length === 0} onClick={handleSubmit} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition ${Object.keys(dishIssues).length > 0 ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-md' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                {loading ? 'Submitting...' : 'Submit Dummy Data'} <Send size={16} />
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};

export default MessReview;