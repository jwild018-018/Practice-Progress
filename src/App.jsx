import React, { useState, useEffect, createContext, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Check, Clock, Target, ChevronRight, Sparkles, X, Loader2, AlertCircle, LogOut } from 'lucide-react';

// ----------------------------------------------------------------------------
// SUPABASE CLIENT & API HELPERS
// ----------------------------------------------------------------------------
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env file');
}

// Keep supabase client for auth only
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Get current auth token
const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || supabaseAnonKey;
};

// Direct fetch wrapper for database operations
const db = {
  async select(table, { columns = '*', eq = {}, is = {}, order, limit, single = false } = {}) {
    let url = `${supabaseUrl}/rest/v1/${table}?select=${columns}`;
    
    Object.entries(eq).forEach(([col, val]) => {
      url += `&${col}=eq.${val}`;
    });
    
    Object.entries(is).forEach(([col, val]) => {
      url += `&${col}=is.${val}`;
    });
    
    if (order) {
      url += `&order=${order.column}.${order.ascending ? 'asc' : 'desc'}`;
    }
    
    if (limit) {
      url += `&limit=${limit}`;
    }
    
    const token = await getAuthToken();
    const response = await fetch(url, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { data: null, error };
    }
    
    const data = await response.json();
    return { data: single ? (data[0] || null) : data, error: null };
  },

  async insert(table, row, { returnData = true } = {}) {
    const token = await getAuthToken();
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': returnData ? 'return=representation' : 'return=minimal'
      },
      body: JSON.stringify(row)
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { data: null, error };
    }
    
    if (returnData) {
      const data = await response.json();
      return { data: data[0] || data, error: null };
    }
    return { data: null, error: null };
  },

  async update(table, updates, { eq = {} } = {}) {
    let url = `${supabaseUrl}/rest/v1/${table}?`;
    Object.entries(eq).forEach(([col, val]) => {
      url += `${col}=eq.${val}&`;
    });
    
    const token = await getAuthToken();
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { data: null, error };
    }
    
    const data = await response.json();
    return { data, error: null };
  },

  async delete(table, { eq = {} } = {}) {
    let url = `${supabaseUrl}/rest/v1/${table}?`;
    Object.entries(eq).forEach(([col, val]) => {
      url += `${col}=eq.${val}&`;
    });
    
    const token = await getAuthToken();
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { error };
    }
    return { error: null };
  }
};

// ----------------------------------------------------------------------------
// AUTH CONTEXT
// ----------------------------------------------------------------------------
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    console.log('fetchProfile called for:', userId);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=*`,
        {
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`
          },
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);
      console.log('Profile fetch response status:', response.status);
      
      const data = await response.json();
      console.log('Profile data:', data);
      
      if (Array.isArray(data) && data.length > 0) {
        setProfile(data[0]);
      } else {
        setProfile({ id: userId, is_pro: false });
      }
    } catch (err) {
      console.error('fetchProfile error:', err.name, err.message);
      setProfile({ id: userId, is_pro: false });
    }
    
    setLoading(false);
  };

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = () => {
    if (user) fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => useContext(AuthContext);

// ----------------------------------------------------------------------------
// AUTH UI (minimal sign in / sign up)
// ----------------------------------------------------------------------------
function AuthScreen() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password 
      });
      
      if (error) {
        setError(error.message);
      } else if (data?.user?.identities?.length === 0) {
        // Supabase returns empty identities for existing email (security feature)
        setError('An account with this email already exists. Try signing in instead.');
      } else if (data?.user && !data.session) {
        // Success - needs email confirmation
        setError(null);
        alert('Check your email for a confirmation link!');
      }
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-stone-900">Practice Tracker</h1>
          <p className="text-sm text-stone-500 mt-1">
            {mode === 'signin' ? 'Sign in to continue' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-sm text-stone-500 mt-4">
          {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-emerald-600 font-medium"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}

/*
================================================================================
PRACTICE TRACKER MVP - ARCHITECTURE OVERVIEW
================================================================================

DATA MODELS (Supabase):

1. profiles (parent account)
   - id: uuid (FK to auth.users)
   - created_at: timestamp
   - is_pro: boolean (default false)
   - stripe_customer_id: text (nullable)

2. athletes (child profiles - minimal data)
   - id: uuid
   - profile_id: uuid (FK to profiles, RLS enforced)
   - name: text (first name only for privacy)
   - created_at: timestamp

3. sessions
   - id: uuid
   - athlete_id: uuid (FK to athletes, RLS via profile_id)
   - date: date
   - duration_minutes: integer
   - focus: text[] (array of: hitting, pitching, fielding, conditioning)
   - note: text (nullable, max 200 chars)
   - reflection: text (nullable, "What felt better today?")
   - created_at: timestamp

4. session_drills (PRO only)
   - id: uuid
   - session_id: uuid (FK to sessions)
   - drill_id: text (references DRILL_CATALOG)
   - created_at: timestamp

5. goals (one active per skill category)
   - id: uuid
   - athlete_id: uuid (FK to athletes, RLS via profile_id)
   - skill: text (hitting, pitching, fielding, conditioning)
   - text: text (plain text goal description)
   - is_active: boolean
   - linked_drill_id: text (nullable, PRO only)
   - created_at: timestamp

ROW LEVEL SECURITY (Supabase):
- All tables enforce: auth.uid() = profile_id (directly or via join)
- No public access, no cross-user visibility

FEATURE GATING:
- Check profiles.is_pro before rendering Pro features
- Pro features: drill selection, drill history, drill-linked goals
- Free features: quick log, basic stats, one text goal per skill

================================================================================
*/

// Simplified drill catalog (PRO feature) - softball focused for MVP
const DRILL_CATALOG = {
  hitting: [
    { id: 'tee-work', name: 'Tee Work', difficulty: 'beginner' },
    { id: 'soft-toss', name: 'Soft Toss', difficulty: 'beginner' },
    { id: 'front-toss', name: 'Front Toss', difficulty: 'intermediate' },
    { id: 'live-bp', name: 'Live BP', difficulty: 'intermediate' },
    { id: 'machine-bp', name: 'Machine BP', difficulty: 'intermediate' },
    { id: 'bunting', name: 'Bunting', difficulty: 'beginner' },
  ],
  pitching: [
    { id: 'warmup-throws', name: 'Warmup Throws', difficulty: 'beginner' },
    { id: 'fastball-spots', name: 'Fastball Spots', difficulty: 'intermediate' },
    { id: 'changeup-work', name: 'Changeup Work', difficulty: 'intermediate' },
    { id: 'rise-ball', name: 'Rise Ball', difficulty: 'advanced' },
    { id: 'drop-ball', name: 'Drop Ball', difficulty: 'advanced' },
    { id: 'full-bullpen', name: 'Full Bullpen', difficulty: 'intermediate' },
  ],
  fielding: [
    { id: 'ground-balls', name: 'Ground Balls', difficulty: 'beginner' },
    { id: 'fly-balls', name: 'Fly Balls', difficulty: 'beginner' },
    { id: 'throwing', name: 'Throwing Accuracy', difficulty: 'beginner' },
    { id: 'double-plays', name: 'Double Plays', difficulty: 'intermediate' },
    { id: 'backhand', name: 'Backhand Plays', difficulty: 'intermediate' },
    { id: 'first-base', name: 'First Base Footwork', difficulty: 'intermediate' },
  ],
  conditioning: [
    { id: 'warmup', name: 'Dynamic Warmup', difficulty: 'beginner' },
    { id: 'sprints', name: 'Sprint Work', difficulty: 'beginner' },
    { id: 'agility', name: 'Agility Drills', difficulty: 'intermediate' },
    { id: 'base-running', name: 'Base Running', difficulty: 'beginner' },
    { id: 'cooldown', name: 'Cooldown Stretch', difficulty: 'beginner' },
  ],
};

const FOCUS_OPTIONS = [
  { id: 'hitting', label: 'Hitting', emoji: '🏏' },
  { id: 'pitching', label: 'Pitching', emoji: '🥎' },
  { id: 'fielding', label: 'Fielding', emoji: '🧤' },
  { id: 'conditioning', label: 'Conditioning', emoji: '🏃‍♀️' },
];

const DURATION_PRESETS = [15, 30, 45, 60, 90];

// ----------------------------------------------------------------------------
// MAIN APP COMPONENT
// ----------------------------------------------------------------------------
function PracticeTrackerApp() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  
  // Data state
  const [athlete, setAthlete] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [goals, setGoals] = useState({});
  const [drillFrequency, setDrillFrequency] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showGoalEdit, setShowGoalEdit] = useState(null);
  const [showProUpsell, setShowProUpsell] = useState(false);
  const [showAddAthlete, setShowAddAthlete] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Derived state
  const isPro = profile?.is_pro && (!profile?.pro_expires_at || new Date(profile.pro_expires_at) > new Date());

  // ----------------------------------------------------------------------------
  // DATA FETCHING
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch athlete (get first non-archived athlete for this user)
      const { data: athletes, error: athleteError } = await db.select('athletes', {
        is: { archived_at: 'null' },
        limit: 1
      });

      if (athleteError) throw athleteError;

      if (!athletes || athletes.length === 0) {
        // No athlete yet - show add athlete prompt
        setShowAddAthlete(true);
        setLoading(false);
        return;
      }

      const currentAthlete = athletes[0];
      setAthlete(currentAthlete);

      // Fetch sessions (most recent first)
      const { data: sessionData, error: sessionError } = await db.select('sessions', {
        eq: { athlete_id: currentAthlete.id },
        order: { column: 'date', ascending: false },
        limit: 20
      });

      if (sessionError) throw sessionError;
      
      // Map to frontend format
      setSessions((sessionData || []).map(s => ({
        id: s.id,
        date: s.date,
        duration: s.duration_minutes,
        focus: s.focus,
        note: s.note || '',
        reflection: s.reflection || ''
      })));

      // Fetch active goals
      const { data: goalData, error: goalError } = await db.select('goals', {
        eq: { athlete_id: currentAthlete.id, is_active: true }
      });

      if (goalError) throw goalError;

      // Convert to { skill: { id, text, isActive } } format
      const goalsMap = {};
      FOCUS_OPTIONS.forEach(opt => { goalsMap[opt.id] = null; });
      (goalData || []).forEach(g => {
        goalsMap[g.skill] = { id: g.id, text: g.text, isActive: true };
      });
      setGoals(goalsMap);

      // Fetch drill frequency (Pro only, uses view)
      if (isPro) {
        const { data: drillData } = await db.select('drill_frequency', {
          eq: { athlete_id: currentAthlete.id },
          order: { column: 'times_used', ascending: false },
          limit: 10
        });
        
        setDrillFrequency(drillData || []);
      }

    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Quick log state
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logDuration, setLogDuration] = useState(30);
  const [logFocus, setLogFocus] = useState([]);
  const [logNote, setLogNote] = useState('');
  const [logReflection, setLogReflection] = useState('');
  const [logDrills, setLogDrills] = useState([]);
  
  // Goal edit state
  const [editGoalText, setEditGoalText] = useState('');
  
  // Calculate stats
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  const weekSessions = sessions.filter(s => new Date(s.date) >= startOfWeek);
  const practicesThisWeek = weekSessions.length;
  const minutesThisWeek = weekSessions.reduce((sum, s) => sum + s.duration, 0);
  const lastSession = sessions[0];
  
  const activeGoals = Object.entries(goals).filter(([_, g]) => g?.isActive);
  const activeGoal = activeGoals[0]?.[1]; // For Free tier display

  const handleQuickLog = async () => {
    if (logFocus.length === 0 || !athlete) return;
    
    setSaving(true);
    setError(null);

    try {
      // Insert session
      const { data: newSession, error: sessionError } = await db.insert('sessions', {
        athlete_id: athlete.id,
        date: logDate,
        duration_minutes: logDuration,
        focus: logFocus,
        note: logNote || null,
        reflection: logReflection || null
      });

      if (sessionError) throw sessionError;

      // Insert drills if Pro and drills selected
      if (isPro && logDrills.length > 0) {
        for (const drillId of logDrills) {
          const { error: drillError } = await db.insert('session_drills', {
            session_id: newSession.id,
            drill_id: drillId
          }, { returnData: false });

          if (drillError) throw drillError;
        }
      }

      // Add to local state (optimistic update already done, this confirms)
      setSessions(prev => [{
        id: newSession.id,
        date: newSession.date,
        duration: newSession.duration_minutes,
        focus: newSession.focus,
        note: newSession.note || '',
        reflection: newSession.reflection || ''
      }, ...prev]);
      
      // Reset form
      setLogDate(new Date().toISOString().split('T')[0]);
      setLogDuration(30);
      setLogFocus([]);
      setLogNote('');
      setLogReflection('');
      setLogDrills([]);
      setShowQuickLog(false);

    } catch (err) {
      console.error('Error saving session:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleFocus = (id) => {
    setLogFocus(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const toggleDrill = (drillId) => {
    setLogDrills(prev =>
      prev.includes(drillId) ? prev.filter(d => d !== drillId) : [...prev, drillId]
    );
  };

  const saveGoal = async (skill) => {
    if (!athlete) return;
    
    setSaving(true);
    setError(null);

    try {
      const existingGoal = goals[skill];
      
      if (!editGoalText) {
        // Delete goal if text is empty
        if (existingGoal?.id) {
          const { error } = await db.delete('goals', {
            eq: { id: existingGoal.id }
          });
          
          if (error) throw error;
        }
        
        setGoals(prev => ({ ...prev, [skill]: null }));
      } else if (existingGoal?.id) {
        // Update existing goal
        const { error } = await db.update('goals', { text: editGoalText }, {
          eq: { id: existingGoal.id }
        });
        
        if (error) throw error;
        
        setGoals(prev => ({
          ...prev,
          [skill]: { ...existingGoal, text: editGoalText }
        }));
      } else {
        // Insert new goal
        // For Free users, deactivate other goals first (enforced by DB trigger, but update UI)
        if (!isPro) {
          const otherActiveGoals = Object.entries(goals)
            .filter(([k, g]) => k !== skill && g?.isActive);
          
          for (const [, g] of otherActiveGoals) {
            if (g?.id) {
              await db.update('goals', { is_active: false }, {
                eq: { id: g.id }
              });
            }
          }
        }

        const { data: newGoal, error } = await db.insert('goals', {
          athlete_id: athlete.id,
          skill: skill,
          text: editGoalText,
          is_active: true
        });
        
        if (error) throw error;
        
        // Update local state
        const updatedGoals = { ...goals };
        if (!isPro) {
          // Clear other goals for Free users
          Object.keys(updatedGoals).forEach(k => {
            if (k !== skill && updatedGoals[k]) {
              updatedGoals[k] = { ...updatedGoals[k], isActive: false };
            }
          });
        }
        updatedGoals[skill] = { id: newGoal.id, text: newGoal.text, isActive: true };
        setGoals(updatedGoals);
      }
      
      setShowGoalEdit(null);
      setEditGoalText('');

    } catch (err) {
      console.error('Error saving goal:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------------------------------
  // CREATE ATHLETE
  // ----------------------------------------------------------------------------
  const [newAthleteName, setNewAthleteName] = useState('');

  const createAthlete = async () => {
    if (!newAthleteName.trim()) return;
    
    setSaving(true);
    setError(null);

    try {
      const { data: newAthlete, error } = await db.insert('athletes', {
        profile_id: user.id,
        name: newAthleteName.trim()
      });

      if (error) throw error;

      setAthlete(newAthlete);
      setShowAddAthlete(false);
      setNewAthleteName('');

    } catch (err) {
      console.error('Error creating athlete:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-stone-50" style={{ fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        
        .card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          font-weight: 600;
          border-radius: 12px;
          padding: 14px 24px;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        
        .btn-primary:active {
          transform: scale(0.98);
        }
        
        .focus-chip {
          padding: 10px 16px;
          border-radius: 20px;
          border: 2px solid #e5e7eb;
          background: white;
          transition: all 0.15s;
        }
        
        .focus-chip.selected {
          border-color: #10b981;
          background: #ecfdf5;
        }
        
        .duration-btn {
          padding: 12px 16px;
          border-radius: 12px;
          border: 2px solid #e5e7eb;
          background: white;
          font-weight: 500;
          min-width: 60px;
          transition: all 0.15s;
        }
        
        .duration-btn.selected {
          border-color: #10b981;
          background: #10b981;
          color: white;
        }
        
        .pro-badge {
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          color: white;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .drill-chip {
          padding: 8px 12px;
          border-radius: 8px;
          border: 1.5px solid #e5e7eb;
          background: white;
          font-size: 14px;
          transition: all 0.15s;
        }
        
        .drill-chip.selected {
          border-color: #8b5cf6;
          background: #f5f3ff;
        }
        
        .modal-overlay {
          animation: fadeIn 0.2s ease;
        }
        
        .modal-content {
          animation: slideUp 0.25s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Loading State */}
      {loading && (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      )}

      {/* Add Athlete Modal */}
      {showAddAthlete && !loading && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-xl font-semibold text-stone-900 mb-2">Add Your Athlete</h2>
            <p className="text-sm text-stone-500 mb-4">Enter your child's first name to get started.</p>
            
            <input
              type="text"
              value={newAthleteName}
              onChange={(e) => setNewAthleteName(e.target.value)}
              placeholder="First name"
              maxLength={50}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none mb-4"
            />

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={createAthlete}
              disabled={!newAthleteName.trim() || saving}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Main App (only show when we have an athlete) */}
      {!loading && athlete && (
        <>
          {/* Header */}
          <header className="bg-white border-b border-stone-100 px-4 py-4 sticky top-0 z-40">
            <div className="max-w-lg mx-auto flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-stone-900">
                  {athlete.name}'s Practice
                </h1>
                <p className="text-sm text-stone-500">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    isPro 
                      ? 'bg-violet-100 text-violet-700' 
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {isPro ? '✨ Pro' : 'Free'}
                </span>
                <button
                  onClick={signOut}
                  className="p-2 rounded-full hover:bg-stone-100 text-stone-400"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Error Banner */}
          {error && (
            <div className="max-w-lg mx-auto px-4 pt-4">
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
                <button onClick={() => setError(null)} className="ml-auto">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

      <main className="max-w-lg mx-auto px-4 py-6 pb-32 space-y-5">
        
        {/* Quick Stats */}
        <div className="card p-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-stone-900">{practicesThisWeek}</p>
              <p className="text-xs text-stone-500 mt-1">this week</p>
            </div>
            <div className="border-l border-r border-stone-100">
              <p className="text-3xl font-bold text-stone-900">{minutesThisWeek}</p>
              <p className="text-xs text-stone-500 mt-1">minutes</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-600">
                {practicesThisWeek >= 3 ? '🔥' : practicesThisWeek >= 1 ? '👍' : '—'}
              </p>
              <p className="text-xs text-stone-500 mt-1">
                {practicesThisWeek >= 3 ? 'on fire!' : practicesThisWeek >= 1 ? 'good start' : 'let\'s go!'}
              </p>
            </div>
          </div>
        </div>

        {/* Last Practice */}
        {lastSession && (
          <div className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Last Practice</p>
                <p className="text-sm text-stone-600 mt-0.5">{formatDate(lastSession.date)}</p>
              </div>
              <div className="flex items-center gap-1 text-stone-500">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">{lastSession.duration} min</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {lastSession.focus.map(f => {
                const opt = FOCUS_OPTIONS.find(o => o.id === f);
                return (
                  <span key={f} className="text-sm bg-stone-100 px-2.5 py-1 rounded-full">
                    {opt?.emoji} {opt?.label}
                  </span>
                );
              })}
            </div>
            {lastSession.note && (
              <p className="text-sm text-stone-600 italic">"{lastSession.note}"</p>
            )}
          </div>
        )}

        {/* Current Goal(s) */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-600" />
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">
                {isPro ? 'Goals' : 'Current Goal'}
              </p>
              {isPro && <span className="pro-badge">Up to 3</span>}
            </div>
            <button 
              onClick={() => {
                const skill = Object.entries(goals).find(([_, g]) => g?.isActive)?.[0] || 'hitting';
                setShowGoalEdit(skill);
                setEditGoalText(goals[skill]?.text || '');
              }}
              className="text-xs text-emerald-600 font-medium"
            >
              {activeGoals.length > 0 ? 'Edit' : 'Add'}
            </button>
          </div>
          
          {isPro ? (
            // Pro: Show up to 3 goals
            activeGoals.length > 0 ? (
              <div className="space-y-3">
                {activeGoals.slice(0, 3).map(([skill, goal]) => (
                  <div key={skill} className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">
                      {FOCUS_OPTIONS.find(f => f.id === skill)?.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-stone-400 capitalize">{skill}</p>
                      <p className="text-stone-900">{goal.text}</p>
                    </div>
                  </div>
                ))}
                {activeGoals.length < 3 && (
                  <button
                    onClick={() => {
                      const unusedSkill = FOCUS_OPTIONS.find(f => !goals[f.id]?.isActive)?.id || 'hitting';
                      setShowGoalEdit(unusedSkill);
                      setEditGoalText('');
                    }}
                    className="flex items-center gap-2 text-sm text-emerald-600 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add another goal ({3 - activeGoals.length} remaining)
                  </button>
                )}
              </div>
            ) : (
              <p className="text-stone-400 italic">Tap "Add" to set up to 3 goals</p>
            )
          ) : (
            // Free: Show single goal
            activeGoal ? (
              <p className="text-stone-900">{activeGoal.text}</p>
            ) : (
              <p className="text-stone-400 italic">Tap "Add" to set a goal</p>
            )
          )}
        </div>

        {/* Recent History */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-stone-100">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Recent Practices</p>
          </div>
          <div className="divide-y divide-stone-50">
            {sessions.slice(0, 5).map(session => (
              <div key={session.id} className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-lg">
                  {FOCUS_OPTIONS.find(f => f.id === session.focus[0])?.emoji || '🥎'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900">{formatDate(session.date)}</p>
                  <p className="text-xs text-stone-500 truncate">
                    {session.focus.map(f => FOCUS_OPTIONS.find(o => o.id === f)?.label).join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-stone-700">{session.duration}m</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pro Upsell (only show for free users) */}
        {!isPro && (
          <button 
            onClick={() => setShowProUpsell(true)}
            className="card p-4 w-full text-left flex items-center gap-4 hover:bg-stone-50 transition"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-stone-900">Upgrade to Pro</p>
              <p className="text-sm text-stone-500">Track specific drills & see trends</p>
            </div>
            <ChevronRight className="w-5 h-5 text-stone-400" />
          </button>
        )}

        {/* Pro: Drill Frequency */}
        {isPro && drillFrequency.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Drill Focus This Month</p>
              <span className="pro-badge">Pro</span>
            </div>
            <div className="space-y-3">
              {drillFrequency.slice(0, 5).map(drill => {
                const maxCount = drillFrequency[0]?.times_used || 1;
                const pct = Math.round((drill.times_used / maxCount) * 100);
                // Look up drill name from catalog
                const drillInfo = Object.values(DRILL_CATALOG)
                  .flat()
                  .find(d => d.id === drill.drill_id);
                return (
                  <div key={drill.drill_id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-stone-700">{drillInfo?.name || drill.drill_id}</span>
                      <span className="text-stone-500">{drill.times_used}×</span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Floating Log Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-stone-50 via-stone-50 to-transparent pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto">
          <button
            onClick={() => setShowQuickLog(true)}
            className="btn-primary w-full flex items-center justify-center gap-2 text-lg shadow-lg shadow-emerald-200"
          >
            <Plus className="w-5 h-5" />
            Log Practice
          </button>
        </div>
      </div>

      {/* Quick Log Modal */}
      {showQuickLog && (
        <div className="fixed inset-0 bg-black/40 z-50 modal-overlay flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto modal-content">
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-stone-100 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-stone-900">Log Practice</h2>
              <button 
                onClick={() => setShowQuickLog(false)}
                className="p-2 -mr-2 hover:bg-stone-100 rounded-full"
              >
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Date</label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-stone-900"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Duration (minutes)</label>
                <div className="flex gap-2 flex-wrap">
                  {DURATION_PRESETS.map(d => (
                    <button
                      key={d}
                      onClick={() => setLogDuration(d)}
                      className={`duration-btn ${logDuration === d ? 'selected' : ''}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus Areas */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">What did you work on?</label>
                <div className="flex flex-wrap gap-2">
                  {FOCUS_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => toggleFocus(opt.id)}
                      className={`focus-chip flex items-center gap-2 ${logFocus.includes(opt.id) ? 'selected' : ''}`}
                    >
                      <span>{opt.emoji}</span>
                      <span className="font-medium">{opt.label}</span>
                      {logFocus.includes(opt.id) && <Check className="w-4 h-4 text-emerald-600" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pro: Drill Selection */}
              {isPro && logFocus.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-medium text-stone-700">Specific Drills</label>
                    <span className="pro-badge">Pro</span>
                  </div>
                  <div className="space-y-3">
                    {logFocus.map(focusId => (
                      <div key={focusId}>
                        <p className="text-xs text-stone-500 uppercase tracking-wide mb-2">
                          {FOCUS_OPTIONS.find(f => f.id === focusId)?.label}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {DRILL_CATALOG[focusId]?.map(drill => (
                            <button
                              key={drill.id}
                              onClick={() => toggleDrill(drill.id)}
                              className={`drill-chip ${logDrills.includes(drill.id) ? 'selected' : ''}`}
                            >
                              {drill.name}
                              {logDrills.includes(drill.id) && (
                                <Check className="w-3 h-3 ml-1 inline text-violet-600" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Quick note <span className="text-stone-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value.slice(0, 200))}
                  placeholder="What did you work on?"
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-stone-900 placeholder:text-stone-400"
                />
              </div>

              {/* Reflection */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  What felt better today? <span className="text-stone-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={logReflection}
                  onChange={(e) => setLogReflection(e.target.value.slice(0, 200))}
                  placeholder="e.g., Timing on swing, catching fly balls..."
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-stone-900 placeholder:text-stone-400"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-stone-100">
              <button
                onClick={handleQuickLog}
                disabled={logFocus.length === 0 || saving}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : 'Save Practice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goal Edit Modal */}
      {showGoalEdit && (
        <div className="fixed inset-0 bg-black/40 z-50 modal-overlay flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg modal-content">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-900">Set Goal</h2>
              <button 
                onClick={() => setShowGoalEdit(null)}
                className="p-2 -mr-2 hover:bg-stone-100 rounded-full"
              >
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Skill Area</label>
                <div className="flex flex-wrap gap-2">
                  {FOCUS_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setShowGoalEdit(opt.id);
                        setEditGoalText(goals[opt.id]?.text || '');
                      }}
                      className={`focus-chip ${showGoalEdit === opt.id ? 'selected' : ''}`}
                    >
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  What are you working on?
                </label>
                <textarea
                  value={editGoalText}
                  onChange={(e) => setEditGoalText(e.target.value)}
                  placeholder="e.g., Keep hands back longer on swing"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-stone-900 placeholder:text-stone-400 resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-stone-100 flex gap-3">
              <button
                onClick={() => setShowGoalEdit(null)}
                disabled={saving}
                className="flex-1 py-3 rounded-xl border border-stone-200 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => saveGoal(showGoalEdit)}
                disabled={saving}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : 'Save Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pro Upsell Modal */}
      {showProUpsell && (
        <div className="fixed inset-0 bg-black/40 z-50 modal-overlay flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg modal-content">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900 mb-2">Upgrade to Pro</h2>
              <p className="text-stone-600 mb-6">
                Get deeper insights into your practice with drill tracking and progress trends.
              </p>

              <div className="bg-stone-50 rounded-2xl p-5 mb-6 text-left space-y-3">
                {[
                  'Track specific drills in each session',
                  'See which drills you practice most',
                  'Set up to 3 goals at once',
                  'Link goals to specific drills',
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center">
                      <Check className="w-3 h-3 text-violet-600" />
                    </div>
                    <span className="text-stone-700">{feature}</span>
                  </div>
                ))}
              </div>

              <p className="text-3xl font-bold text-stone-900 mb-1">$4.99<span className="text-lg font-normal text-stone-500">/month</span></p>
              <p className="text-sm text-stone-500 mb-6">Cancel anytime</p>

              <button
                onClick={() => {
                                  // In production: redirect to Stripe hosted checkout
                  // window.location.href = '/api/checkout';
                  refreshProfile(); // Re-fetch profile after upgrade
                  setShowProUpsell(false);
                }}
                className="btn-primary w-full mb-3"
                style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}
              >
                Start Pro Trial
              </button>
              <button
                onClick={() => setShowProUpsell(false)}
                className="w-full py-3 text-stone-500 font-medium"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// ROOT COMPONENT WITH AUTH WRAPPER
// ----------------------------------------------------------------------------
export default function PracticeTrackerMVP() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <PracticeTrackerApp />;
}
