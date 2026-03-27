import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Star, Utensils, Send, CheckCircle, Sunrise, Sun, Moon, Clock, Leaf, Drumstick, AlertCircle, Map, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = 'http://192.168.1.11:3001/api';

const MessReview = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  const uid = user ? user.uid : 'Unknown';
  const [loading, setLoading] = useState(false);
  const [hostelStatus, setHostelStatus] = useState('in'); 
  const [reviewedMeals, setReviewedMeals] = useState([]);
  
  const [dietType, setDietType] = useState('Non-Veg'); 
  const [activeMeal, setActiveMeal] = useState(null); 
  const [showModal, setShowModal] = useState(false);

  const [todayMenu, setTodayMenu] = useState([]);
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  
  const [dishIssues, setDishIssues] = useState({}); 
  const [comment, setComment] = useState('');

  const [mealSchedule, setMealSchedule] = useState({
    Breakfast: { startHour: 7, label: "7:00 AM" }, 
    Lunch: { startHour: 12, label: "12:00 PM" },   
    Dinner: { startHour: 19, label: "7:00 PM" }    
  });

  const [dayMenu, setDayMenu] = useState({ Breakfast: [], Lunch: [], Dinner: [] });

  const [availableTags, setAvailableTags] = useState(["Too Spicy", "Bland", "Undercooked", "Cold", "Stale/Smell", "Foreign Object"]);
  const [newCustomTag, setNewCustomTag] = useState('');

  const handleAddNewTag = (e) => {
    e.preventDefault(); 
    const tag = newCustomTag.trim();
    if (!tag) return;
    
    const formattedTag = tag.charAt(0).toUpperCase() + tag.slice(1);
    
    if (!availableTags.includes(formattedTag)) {
      setAvailableTags([...availableTags, formattedTag]);
      toast.success(`Added "${formattedTag}" to options!`);
    }
    
    setNewCustomTag(''); 
  };

  const checkStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/gate/status/${uid}`);
      setHostelStatus(res.data.status); 
    } catch (err) {
      console.error("Failed to fetch campus status", err);
    }
  };

  useEffect(() => {
    setLoading(true);
    checkStatus();
    fetchReviewedStatus();
    fetchMealTimings();
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    const fetchFullDayMenu = async () => {
      try {
        const [bfastRes, lunchRes, dinnerRes] = await Promise.all([
          axios.get(`${API_BASE}/student/mess/today?meal=Breakfast&diet=${dietType}`),
          axios.get(`${API_BASE}/student/mess/today?meal=Lunch&diet=${dietType}`),
          axios.get(`${API_BASE}/student/mess/today?meal=Dinner&diet=${dietType}`)
        ]);
        
        setDayMenu({
          Breakfast: bfastRes.data,
          Lunch: lunchRes.data,
          Dinner: dinnerRes.data
        });
      } catch (err) {
        console.error("Failed to fetch the full day's menu", err);
        toast.error("Failed to load today's menu.");
      }
    };

    fetchFullDayMenu();
  }, [dietType]); 

  const fetchReviewedStatus = () => {
    axios.get(`${API_BASE}/student/mess/reviewed-today?uid=${uid}`)
      .then(res => setReviewedMeals(res.data))
      .catch(err => console.error("Failed to fetch reviewed status", err));
  };
  
  const fetchMealTimings = () => {
    axios.get(`${API_BASE}/admin/meal-timings`)
      .then(res => {
        const timings = res.data;
        const dynamicSchedule = {};
        
        Object.keys(timings).forEach(meal => {
          const [hourStr, minuteStr] = timings[meal].start.split(':');
          const hourInt = parseInt(hourStr, 10);
          
          const suffix = hourInt >= 12 ? 'PM' : 'AM';
          const displayHour = hourInt % 12 || 12;
          
          dynamicSchedule[meal] = {
            startHour: hourInt,
            label: `${displayHour}:${minuteStr} ${suffix}`
          };
        });
        
        setMealSchedule(dynamicSchedule);
      })
      .catch(err => console.error("Failed to fetch dynamic meal timings", err));
  };

  const currentHour = new Date().getHours();

  const handleOpenReview = (mealName) => {
    const menuForMeal = dayMenu[mealName];
    
    if (!menuForMeal || menuForMeal.length === 0) {
      toast.error(`The Warden hasn't published the ${dietType} menu for ${mealName} yet!`);
      return; 
    } 
    
    setTodayMenu(menuForMeal);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!dayMenu[activeMeal] || dayMenu[activeMeal].length === 0) {
      return toast.error("You cannot review an unpublished menu.");
    }
    const hasFlaggedDishes = Object.keys(dishIssues).length > 0;
    if (rating <= 2 && !hasFlaggedDishes) {
      return toast.error("Please select which item(s) had an issue.");
    }
    
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
      meal_type: activeMeal,
      diet_type: dietType,
      rating: rating,
      dish_issues: JSON.stringify(cleanIssues), 
      comment: comment
    };

    toast.promise(
      axios.post(`${API_BASE}/student/mess/review`, payload),
      {
        loading: 'Submitting review...',
        success: () => {
          setReviewedMeals(prev => [...prev, activeMeal]);
          resetForm();
          return "Review submitted successfully! Thank you.";
        },
        error: "Failed to submit review. Please try again."
      }
    ).finally(() => setLoading(false));
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
      if (newState[dishId]) {
        delete newState[dishId]; 
      } else {
        newState[dishId] = []; 
      }
      return newState;
    });
  };

  const toggleTagForDish = (dishId, tag) => {
    setDishIssues(prev => {
      const currentTags = prev[dishId] || [];
      const updatedTags = currentTags.includes(tag) 
        ? currentTags.filter(t => t !== tag) 
        : [...currentTags, tag];
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

  if (loading) {
    return <div className="flex justify-center items-center h-64 text-gray-500 font-medium animate-pulse">Checking campus status...</div>;
  }

  // --- THE LOCK SCREEN ---
  if (hostelStatus === 'out') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in px-4">
        <div className="bg-orange-50 text-orange-500 p-6 rounded-full mb-6 relative">
          <Map size={48} />
          <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1.5 shadow-sm border border-gray-100">
            <Lock size={20} className="text-gray-700" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-3">You are currently away!</h2>
        <p className="text-gray-500 max-w-md mx-auto leading-relaxed mb-8">
          Mess reviews and complaints are paused while you are checked out of the hostel. Enjoy your time away, and we'll see you when you get back!
        </p>
        <div className="bg-white border border-gray-200 px-6 py-3 rounded-xl shadow-sm text-sm font-bold text-gray-600 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
          Status: Checked Out
        </div>
      </div>
    );
  }
  
  return (
    <div className="animate-fade-in max-w-4xl mx-auto space-y-8 pb-20">
      
      {/* DIET TOGGLE HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Mess Feedback</h2>
          <p className="text-gray-500 text-sm">Select your diet type to view today's menu</p>
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

      {/* MEAL CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {mealCards.map((meal) => {
          const isReviewed = reviewedMeals.includes(meal.name);
          const isTimeLocked = currentHour < mealSchedule[meal.name].startHour;
          const isActive = activeMeal === meal.name;
          const isPending = !dayMenu[meal.name] || dayMenu[meal.name].length === 0;
          const theme = dietType === 'Veg' ? {
            activeBorder: 'border-green-400',
            hoverBorder: 'hover:border-green-200',
            iconColors: 'bg-green-50 text-green-600',
            actionText: 'text-green-600'
          } : {
            activeBorder: 'border-red-400',
            hoverBorder: 'hover:border-red-200',
            iconColors: 'bg-red-50 text-red-600',
            actionText: 'text-red-600'
          };
          
          return (
            <div 
              key={meal.name}
              className={`p-6 rounded-2xl border-2 transition-all relative overflow-hidden flex flex-col items-center text-center ${isReviewed ? 'bg-gray-50 border-gray-200 opacity-80' : isTimeLocked ? 'bg-gray-50 border-gray-100' : isActive ? `bg-white ${theme.activeBorder} shadow-md` : `bg-white border-transparent shadow-sm hover:shadow-md ${theme.hoverBorder} cursor-pointer`}`}
              onClick={() => { 
                if (isReviewed || isTimeLocked || isActive) return;
                if (isPending) {
                  toast.error(`The Warden hasn't published the ${dietType} menu for ${meal.name} yet!`);
                  return;
                }
                setActiveMeal(meal.name); 
              }}
            >
              <div className={`mb-3 w-fit p-4 rounded-full transition-colors ${isReviewed ? 'bg-gray-200 text-gray-400' : isTimeLocked ? 'bg-gray-100 text-gray-300' : `${theme.iconColors} ${theme.actionText}`}`}>
                {meal.icon}
              </div>
              <h3 className={`text-xl font-bold transition-colors ${isReviewed || isTimeLocked ? 'text-gray-400' : 'text-gray-800'}`}>{meal.name}</h3>
              
              <div className={`mt-2 min-h-[40px] px-2 text-sm flex items-center justify-center transition-colors ${isReviewed || isTimeLocked ? 'text-gray-400' : 'text-gray-600'}`}>
                {dayMenu[meal.name] && dayMenu[meal.name].length > 0 ? (
                  <p className="line-clamp-2 leading-tight">
                    {dayMenu[meal.name].map(d => d.dish_name).join(' • ')}
                  </p>
                ) : (
                  <p className="italic text-gray-400 text-xs">Menu pending approval</p>
                )}
              </div>
              
              <div className="mt-4 w-full h-16 flex items-center justify-center">
                {isReviewed ? (
                  <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle size={18} /> Done</span>
                ) : isTimeLocked ? (
                  <span className="text-gray-400 text-sm font-medium flex items-center gap-1"><Clock size={16} /> Opens at {mealSchedule[meal.name].label}</span>
                ) : !isActive ? (
                  <span className={`${theme.actionText} text-sm font-bold`}>Tap to Rate &rarr;</span>
                ) : (
                  <div className="flex flex-col items-center animate-slide-up w-full">
                    <div className="flex gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const activeValue = hoveredStar || rating;
                        const isActiveStar = activeValue >= star;
                        let starColor = 'text-gray-200'; 
                        if (isActiveStar) {
                          if (activeValue <= 2) starColor = 'text-red-500 fill-red-500';
                          else if (activeValue === 3) starColor = 'text-yellow-400 fill-yellow-400';
                          else starColor = 'text-green-500 fill-green-500';
                        }

                        return (
                          <button 
                            key={star} 
                            onClick={(e) => { e.stopPropagation(); setRating(star); }} 
                            onMouseEnter={() => setHoveredStar(star)} 
                            onMouseLeave={() => setHoveredStar(0)} 
                            className="transition-transform hover:scale-125 focus:outline-none"
                          >
                            <Star size={28} className={`${starColor} transition-colors duration-200`} />
                          </button>
                        );
                      })}
                    </div>
                    
                   {rating > 0 && (
                      <div className="flex gap-2 w-full animate-fade-in mt-1">
                        {rating >= 3 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleSubmit(); }} 
                            className="flex-1 bg-green-500 text-white text-sm py-2 rounded-lg font-bold flex items-center justify-center gap-1 hover:bg-green-600 active:scale-95"
                          >
                            Submit <Send size={14}/>
                          </button>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleOpenReview(meal.name); }} 
                          className={`bg-gray-800 text-white text-sm py-2 rounded-lg font-bold hover:bg-gray-900 active:scale-95 transition-all ${rating >= 3 ? 'flex-1' : 'w-full'}`}
                        >
                          {rating >= 3 ? '+ Details' : 'Add Details'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {isActive && rating === 0 && <button onClick={(e) => { e.stopPropagation(); setActiveMeal(null); }} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full p-1 transition-colors">✕</button>}
            </div>
          );
        })}
      </div>

      {/* MODAL: ITEM-FIRST FEEDBACK FLOW */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 pb-24">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up flex flex-col max-h-[75vh]">
            
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">{activeMeal} Feedback</h3>
                <p className="text-xs text-gray-500">{rating} Stars • {dietType} Menu</p>
              </div>
              <button onClick={resetForm} className="text-gray-400 hover:text-red-500 transition bg-white p-2 rounded-full shadow-sm border border-gray-100 hover:border-red-100">✕</button>
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
                        <button
                          key={uniqueKey}
                          onClick={() => toggleDish(uniqueKey)}
                          className={`px-4 py-2 rounded-xl text-sm font-bold border transition ${isSelected ? 'bg-red-50 border-red-200 text-red-600 shadow-inner' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                          {subItem}
                        </button>
                      );
                    });
                  })}
                </div>
              </div>

              {/* STEP 2: DYNAMIC TAGS PER SELECTED DISH */}
              {Object.keys(dishIssues).length > 0 && (
                <div className="space-y-4 animate-fade-in border-l-2 border-red-100 pl-4">
                  <p className="font-bold text-gray-800 text-sm flex items-center gap-2"><AlertCircle size={16} className="text-red-500"/> 2. What was wrong with them?</p>
                  
                  {Object.keys(dishIssues).map(uniqueKey => {
                    const [dishIdStr, subItemName] = uniqueKey.split('::');
                    
                    return (
                      <div key={uniqueKey} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">{subItemName}</p>
                        <div className="flex flex-wrap gap-2">
                          {availableTags.map(tag => {
                            const isTagSelected = dishIssues[uniqueKey].includes(tag);
                            return (
                              <button
                                key={tag}
                                onClick={() => toggleTagForDish(uniqueKey, tag)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${isTagSelected ? 'bg-gray-800 border-gray-800 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2 mt-4 pt-2 border-t border-gray-100">
                            <input 
                              type="text" 
                              value={newCustomTag}
                              onChange={(e) => setNewCustomTag(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAddNewTag(e); }}
                              placeholder="Other issue? (e.g. Too Salty)"
                              className="flex-1 border border-gray-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-orange-200 outline-none bg-white"
                            />
                            <button 
                              type="button"
                              onClick={handleAddNewTag}
                              className="bg-gray-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-900 transition active:scale-95"
                            >
                              + Add Tag
                            </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* STEP 3: COMMENT BOX */}
              <div>
                 <p className="font-bold text-gray-800 mb-2 text-sm">3. Additional Details</p>
                 <textarea 
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-200 outline-none resize-none bg-gray-50 transition-all"
                    rows="3"
                    placeholder="Type specific complaints here...(eg 'combo was bad')"
                    value={comment}
                    onChange={(e) => setComment(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                 ></textarea>
              </div>
            </div>

            <div className="p-4 bg-white border-t shrink-0">
              <button 
                disabled={loading || Object.keys(dishIssues).length === 0}
                onClick={handleSubmit}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition ${Object.keys(dishIssues).length > 0 ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-md active:scale-[0.98]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
              >
                {loading ? 'Submitting...' : 'Submit Review'} <Send size={16} />
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};

export default MessReview;