import { useState, useEffect } from 'react';
import { 
  Star, Send, Clock, BookOpen, X, 
  Utensils, CheckCircle, Coffee, Sun, Moon 
} from 'lucide-react';

function  MessReview() {
  // --- STATE ---
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [activeServing, setActiveServing] = useState(null); // Which meal is SPECIFICALLY serving now
  const [expandedMeal, setExpandedMeal] = useState(null); 
  const [showMenuModal, setShowMenuModal] = useState(false);
  
  const [submittedMeals, setSubmittedMeals] = useState({
    Breakfast: false,
    Lunch: false,
    Dinner: false
  });

  // Form State
  const [rating, setRating] = useState(0);
  const [feedbackTags, setFeedbackTags] = useState([]);
  const [culpritItems, setCulpritItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // --- CONFIG (Added startHour for logic) ---
  const mealConfig = [
    { id: 'Breakfast', label: 'Breakfast', startHour: 7, endHour: 10, time: '7:30 AM - 9:30 AM', icon: <Coffee size={24}/>, color: 'orange' },
    { id: 'Lunch', label: 'Lunch', startHour: 12, endHour: 15, time: '12:30 PM - 2:30 PM', icon: <Sun size={24}/>, color: 'blue' },
    { id: 'Dinner', label: 'Dinner', startHour: 19, endHour: 22, time: '7:30 PM - 9:30 PM', icon: <Moon size={24}/>, color: 'purple' }
  ];

  const menuItems = {
    Breakfast: ["Idli", "Sambar", "Chutney", "Tea/Coffee"],
    Lunch: ["Rice", "Sambar", "Avial", "Fish Fry", "Pickle"],
    Dinner: ["Chapati", "Dal Fry", "Jeera Rice", "Salad"]
  };

  const negativeTags = ["Too Spicy", "Bland", "Undercooked", "Overcooked", "Cold", "Bad Combo"];
  const positiveTags = ["Tasty", "Fresh", "Good Portion", "Healthy", "Great Variety"];

  // --- 1. CHECK TIME & UPDATE STATE ---
  useEffect(() => {
    checkTime();
    const interval = setInterval(checkTime, 60000); 
    return () => clearInterval(interval);
  }, []);

  const checkTime = () => {
    const now = new Date();
    const hour = now.getHours();
    setCurrentHour(hour);

    // Determine what is literally being served RIGHT NOW for the header indicator
    let serving = null;
    if (hour >= 7 && hour < 10) serving = 'Breakfast';
    else if (hour >= 12 && hour < 15) serving = 'Lunch';
    else if (hour >= 19 && hour < 22) serving = 'Dinner';
    setActiveServing(serving);
  };

  // --- 2. HANDLERS ---
  const handleExpand = (meal) => {
    if (currentHour < meal.startHour) {
      alert(`Review opens at start of serving time (${meal.time.split('-')[0]}).`);
      return;
    }
    if (submittedMeals[meal.id]) return;
    
    setExpandedMeal(meal.id);
    setRating(0);
    setFeedbackTags([]);
    setCulpritItems([]);
  };

  const handleSubmit = () => {
    if (rating === 0) return alert("Please select a star rating.");
    setSubmitting(true);
    
    setTimeout(() => {
      setSubmittedMeals(prev => ({ ...prev, [expandedMeal]: true }));
      setSubmitting(false);
      setExpandedMeal(null); 
      setRating(0);
      setFeedbackTags([]);
      setCulpritItems([]);
    }, 800);
  };

  const handleTagToggle = (tag) => {
    setFeedbackTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  return (
    <div className="animate-fade-in pb-24 p-4 max-w-lg mx-auto relative">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mess Feedback</h1>
          <div className="flex items-center gap-2 mt-1">
             <div className={`w-2 h-2 rounded-full ${activeServing ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
             <p className="text-gray-500 text-sm font-medium">
               {activeServing ? `Serving ${activeServing} Now` : 'Mess Open for Review'}
             </p>
          </div>
        </div>
        <button 
          onClick={() => setShowMenuModal(true)}
          className="bg-white border border-blue-200 text-blue-600 px-3 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-50 transition flex items-center gap-2"
        >
          <BookOpen size={18} /> Menu
        </button>
      </div>

      {/* CARDS CONTAINER */}
      <div className="space-y-4">
        {mealConfig.map((meal) => {
          const isServingNow = activeServing === meal.id;
          const hasStarted = currentHour >= meal.startHour;
          const isSubmitted = submittedMeals[meal.id];
          const isExpanded = expandedMeal === meal.id;

          // DYNAMIC CARD STYLING
          let cardClasses = "border transition-all duration-300 rounded-2xl overflow-hidden ";
          
          if (isExpanded) {
            // Case 1: Currently Reviewing
            cardClasses += "bg-white border-blue-400 shadow-lg ring-2 ring-blue-100 scale-[1.02]";
          } 
          else if (isSubmitted) {
            // Case 2: Done
            cardClasses += "bg-green-50 border-green-200 opacity-70";
          } 
          else if (isServingNow) {
            // Case 3: Serving NOW (Highlight)
            cardClasses += "bg-white border-blue-300 shadow-md cursor-pointer hover:shadow-lg hover:border-blue-400";
          } 
          else if (hasStarted) {
            // Case 4: Review Pending (Served earlier today)
            cardClasses += "bg-white border-gray-200 cursor-pointer hover:border-gray-300";
          } 
          else {
            // Case 5: Future Meal (Locked)
            cardClasses += "bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed";
          }

          return (
            <div key={meal.id} className={cardClasses} onClick={() => !isExpanded && handleExpand(meal)}>
              
              {/* CARD HEADER */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl transition-colors ${
                    isSubmitted ? 'bg-green-100 text-green-600' : 
                    isServingNow ? `bg-${meal.color}-100 text-${meal.color}-600` : 
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {isSubmitted ? <CheckCircle size={24} /> : meal.icon}
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg ${hasStarted ? 'text-gray-800' : 'text-gray-400'}`}>
                      {meal.label}
                    </h3>
                    <div className="flex items-center gap-2">
                       <p className="text-xs text-gray-500 flex items-center gap-1">
                         <Clock size={12} /> {meal.time}
                       </p>
                       {isServingNow && (
                         <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full animate-pulse">
                           LIVE
                         </span>
                       )}
                    </div>
                  </div>
                </div>

                {/* Status Badge / Button */}
                {isSubmitted && <span className="text-xs font-bold bg-green-200 text-green-800 px-2 py-1 rounded-lg">Done</span>}
                
                {!isSubmitted && !isExpanded && hasStarted && (
                  <button className={`font-bold text-sm px-4 py-1.5 rounded-lg transition ${
                    isServingNow 
                      ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                    {isServingNow ? 'Rate Now' : 'Review'}
                  </button>
                )}
              </div>

              {/* EXPANDED FORM AREA (Same as before) */}
              {isExpanded && (
                <div className="px-4 pb-4 animate-slide-up">
                  <div className="h-px bg-gray-100 mb-4"></div>
                  
                  {/* Menu Preview */}
                  <div className="mb-4">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2">On the Menu</p>
                    <div className="flex flex-wrap gap-2">
                      {menuItems[meal.id].map(item => (
                        <span key={item} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md border border-gray-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Star Rating */}
                  <div className="flex justify-center gap-2 mb-4">
                    {[1,2,3,4,5].map(star => (
                      <button key={star} onClick={(e) => { e.stopPropagation(); setRating(star); }} className="focus:outline-none transition hover:scale-110">
                         <Star size={36} className={`${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} transition-colors`}/>
                      </button>
                    ))}
                  </div>

                  {/* Feedback UI */}
                  {rating > 0 && (
                    <div className="animate-fade-in space-y-4">
                      <div className={`p-4 rounded-xl ${rating < 4 ? 'bg-orange-50 border border-orange-100' : 'bg-green-50 border border-green-100'}`}>
                         <p className={`text-xs font-bold uppercase mb-2 ${rating < 4 ? 'text-orange-700' : 'text-green-700'}`}>
                           {rating < 4 ? 'What went wrong?' : 'What was good?'}
                         </p>
                         <div className="flex flex-wrap gap-2">
                            {(rating < 4 ? negativeTags : positiveTags).map(tag => (
                              <button 
                                key={tag} 
                                onClick={(e) => { e.stopPropagation(); handleTagToggle(tag); }}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                                  feedbackTags.includes(tag) 
                                    ? 'bg-white shadow-sm border-current scale-105' 
                                    : 'bg-transparent border-transparent hover:bg-white/50'
                                } ${rating < 4 ? 'text-orange-700' : 'text-green-700'}`}
                              >
                                {tag}
                              </button>
                            ))}
                         </div>
                      </div>

                      <button 
                        onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
                        disabled={submitting}
                        className={`w-full py-3 rounded-xl text-white font-bold shadow-lg transition active:scale-95 flex items-center justify-center gap-2 ${
                          rating < 4 ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'
                        }`}
                      >
                         {submitting ? 'Sending...' : 'Submit Feedback'} <Send size={18} />
                      </button>
                    </div>
                  )}

                  <button 
                    onClick={(e) => { e.stopPropagation(); setExpandedMeal(null); }}
                    className="w-full mt-3 py-2 text-gray-400 text-xs font-bold hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MENU MODAL */}
      {showMenuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-slide-up">
              <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
                 <h3 className="font-bold text-lg flex items-center gap-2"><Utensils size={20}/> Today's Menu</h3>
                 <button onClick={() => setShowMenuModal(false)} className="bg-white/20 p-1 rounded-full hover:bg-white/30"><X size={18}/></button>
              </div>
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                 {Object.entries(menuItems).map(([meal, items]) => (
                    <div key={meal} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                       <h4 className="text-sm font-bold text-blue-600 uppercase mb-2">{meal}</h4>
                       <div className="flex flex-wrap gap-2">
                          {items.map(item => (
                             <span key={item} className="bg-gray-50 text-gray-600 px-3 py-1 rounded-lg text-xs font-medium border border-gray-100">
                                {item}
                             </span>
                          ))}
                       </div>
                    </div>
                 ))}
              </div>
              <div className="bg-gray-50 p-3 text-center">
                 <button onClick={() => setShowMenuModal(false)} className="text-blue-600 font-bold text-sm">Close</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default MessReview;