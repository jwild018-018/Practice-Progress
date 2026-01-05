import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Check, Clock, Target, ChevronRight, Sparkles, X, Loader2, AlertCircle, LogOut, ChevronDown, User, Download, Table, FileText, BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

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
        fetchProfile(session.user.id, session.access_token);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id, session.access_token);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId, accessToken) => {
    console.log('fetchProfile called for:', userId);
    
    try {
      const token = accessToken || supabaseAnonKey;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/profiles?select=*&id=eq.${userId}`,
        {
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`
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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-100">Practice Tracker</h1>
          <p className="text-sm text-slate-400 mt-1">
            {mode === 'signin' ? 'Sign in to continue' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none text-slate-100"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/30 px-3 py-2 rounded-lg border border-red-800/50">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-semibold hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-4">
          {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-amber-400 font-medium"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// PRO COMPONENTS
// ----------------------------------------------------------------------------

// Chart colors
const CHART_COLORS = {
  hitting: '#d4a418',    // gold
  pitching: '#60a5fa',   // blue
  fielding: '#34d399',   // green
  conditioning: '#f472b6' // pink
};

// Athlete Selector (Pro only - always shows for Pro users)
function AthleteSelector({ athletes, currentAthlete, onSelectAthlete, onAddAthlete, isPro }) {
  const [isOpen, setIsOpen] = useState(false);

  // Free users only see current athlete name (no selector)
  if (!isPro) {
    return (
      <h1 className="text-lg font-semibold text-slate-100">
        {currentAthlete?.name}'s Practice
      </h1>
    );
  }

  // Pro users always get the dropdown (even with 1 athlete, so they can add more)
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:bg-slate-700 rounded-lg px-2 py-1 -ml-2 transition"
      >
        <h1 className="text-lg font-semibold text-slate-100">
          {currentAthlete?.name}'s Practice
        </h1>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-56 bg-slate-800 rounded-xl shadow-lg border border-slate-700 py-1 z-50">
            <div className="px-3 py-2 border-b border-slate-700">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Switch Athlete</p>
            </div>
            
            {athletes.map(athlete => (
              <button
                key={athlete.id}
                onClick={() => {
                  onSelectAthlete(athlete);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left hover:bg-slate-700 flex items-center gap-3 ${
                  athlete.id === currentAthlete?.id ? 'bg-amber-500/10' : ''
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  athlete.id === currentAthlete?.id ? 'bg-amber-500/20' : 'bg-slate-700'
                }`}>
                  <User className={`w-4 h-4 ${
                    athlete.id === currentAthlete?.id ? 'text-amber-400' : 'text-slate-400'
                  }`} />
                </div>
                <span className={`font-medium ${
                  athlete.id === currentAthlete?.id ? 'text-amber-400' : 'text-slate-300'
                }`}>
                  {athlete.name}
                </span>
              </button>
            ))}
            
            <div className="border-t border-slate-700 mt-1 pt-1">
              <button
                onClick={() => {
                  onAddAthlete();
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2.5 text-left text-amber-400 hover:bg-slate-700 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-amber-400" />
                </div>
                <span className="font-medium">Add Athlete</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Weekly Minutes Bar Chart (Pro only)
function WeeklyMinutesChart({ sessions }) {
  const weeklyData = useMemo(() => {
    const weeks = [];
    const now = new Date();
    
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      weeks.push({
        weekStart,
        weekEnd,
        label: i === 0 ? 'This Week' : i === 1 ? 'Last Week' : `${i + 1}w ago`,
        minutes: 0,
        practices: 0
      });
    }
    
    sessions.forEach(s => {
      const [year, month, day] = s.date.split('-').map(Number);
      const sessionDate = new Date(year, month - 1, day);
      
      weeks.forEach(week => {
        if (sessionDate >= week.weekStart && sessionDate <= week.weekEnd) {
          week.minutes += s.duration;
          week.practices += 1;
        }
      });
    });
    
    return weeks;
  }, [sessions]);

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <XAxis 
            dataKey="label" 
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis 
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={35}
          />
          <Tooltip 
            formatter={(value) => [`${value} min`, 'Duration']}
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#e2e8f0'
            }}
          />
          <Bar dataKey="minutes" fill="#d4a418" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Focus Distribution Pie Chart (Pro only)
function FocusDistributionChart({ sessions, focusOptions }) {
  const focusData = useMemo(() => {
    const counts = {};
    
    sessions.forEach(s => {
      (s.focus || []).forEach(f => {
        counts[f] = (counts[f] || 0) + 1;
      });
    });
    
    return focusOptions
      .map(f => ({
        id: f.id,
        name: f.label,
        emoji: f.emoji,
        value: counts[f.id] || 0,
        color: CHART_COLORS[f.id] || '#78716c'
      }))
      .filter(d => d.value > 0);
  }, [sessions, focusOptions]);

  if (focusData.length === 0) {
    return <p className="text-slate-500 text-sm italic text-center py-4">No practice data yet</p>;
  }

  const total = focusData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex items-center gap-4">
      <div className="h-32 w-32 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={focusData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={25}
              outerRadius={50}
              paddingAngle={2}
            >
              {focusData.map((entry) => (
                <Cell key={entry.id} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value, name) => [`${value} sessions`, name]}
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#e2e8f0'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      <div className="flex-1 space-y-1.5">
        {focusData.map(item => (
          <div key={item.id} className="flex items-center gap-2">
            <div 
              className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-slate-400 flex-1">{item.emoji} {item.name}</span>
            <span className="text-xs font-medium text-slate-200">
              {Math.round((item.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 30-Day Activity Line Chart (Pro only)
function ActivityLineChart({ sessions }) {
  const activityData = useMemo(() => {
    const days = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const dateStr = date.toISOString().split('T')[0];
      const dayMinutes = sessions
        .filter(s => s.date === dateStr)
        .reduce((sum, s) => sum + s.duration, 0);
      
      days.push({
        date: dateStr,
        day: date.getDate(),
        minutes: dayMinutes
      });
    }
    
    return days;
  }, [sessions]);

  return (
    <div className="h-28">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={activityData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <XAxis 
            dataKey="day" 
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            interval={6}
          />
          <YAxis hide />
          <Tooltip 
            formatter={(value) => [`${value} min`, 'Duration']}
            labelFormatter={(label, payload) => {
              const item = payload[0]?.payload;
              if (item) {
                return new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }
              return label;
            }}
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#e2e8f0'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="minutes" 
            stroke="#d4a418" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#d4a418' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Export Button (Pro only)
function ExportButton({ sessions, athlete, isPro }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isPro || !sessions || sessions.length === 0) return null;

  const exportCSV = () => {
    const headers = ['Date', 'Duration (min)', 'Focus Areas', 'Note', 'Reflection'];
    const rows = sessions.map(s => [
      s.date,
      s.duration,
      (s.focus || []).join('; '),
      (s.note || '').replace(/"/g, '""'),
      (s.reflection || '').replace(/"/g, '""')
    ]);
    
    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    downloadFile(csv, `${athlete.name}-practices.csv`, 'text/csv');
    setIsOpen(false);
  };

  const exportPDF = () => {
    // Calculate stats
    const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);
    const focusCounts = {};
    sessions.forEach(s => {
      (s.focus || []).forEach(f => {
        focusCounts[f] = (focusCounts[f] || 0) + 1;
      });
    });
    
    // Calculate weekly data for chart (last 4 weeks)
    const now = new Date();
    const weeklyData = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      let minutes = 0;
      sessions.forEach(s => {
        const [year, month, day] = s.date.split('-').map(Number);
        const sessionDate = new Date(year, month - 1, day);
        if (sessionDate >= weekStart && sessionDate <= weekEnd) {
          minutes += s.duration;
        }
      });
      
      weeklyData.push({
        label: i === 0 ? 'This Week' : i === 1 ? 'Last Week' : `${i + 1}w ago`,
        minutes
      });
    }
    const maxWeeklyMinutes = Math.max(...weeklyData.map(w => w.minutes), 1);
    
    // Focus distribution for pie chart
    const focusColors = {
      hitting: '#d4a418',
      pitching: '#60a5fa',
      fielding: '#34d399',
      conditioning: '#f472b6'
    };
    const totalFocusSessions = Object.values(focusCounts).reduce((a, b) => a + b, 0);
    
    // Build HTML content for PDF
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${athlete.name}'s Practice Report</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1e293b; }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #d4a418; }
          .header h1 { font-size: 24px; color: #1e293b; margin-bottom: 5px; }
          .header p { color: #64748b; font-size: 14px; }
          .stats { display: flex; justify-content: space-around; margin-bottom: 30px; padding: 20px; background: #f8fafc; border-radius: 8px; }
          .stat { text-align: center; }
          .stat-value { font-size: 28px; font-weight: bold; color: #d4a418; }
          .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
          .section { margin-bottom: 25px; }
          .section h2 { font-size: 16px; color: #1e293b; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
          .charts-row { display: flex; gap: 30px; margin-bottom: 25px; }
          .chart-container { flex: 1; background: #f8fafc; border-radius: 8px; padding: 20px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .chart-title { font-size: 13px; font-weight: 600; color: #64748b; margin-bottom: 15px; }
          .bar-chart { display: flex; align-items: flex-end; justify-content: space-around; height: 120px; gap: 10px; }
          .bar-wrapper { display: flex; flex-direction: column; align-items: center; flex: 1; height: 100%; justify-content: flex-end; }
          .bar { width: 100%; max-width: 50px; background-color: #d4a418 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border-radius: 4px 4px 0 0; min-height: 4px; }
          .bar-label { font-size: 10px; color: #64748b; margin-top: 8px; text-align: center; }
          .bar-value { font-size: 11px; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
          .focus-bars { }
          .focus-bar-row { display: flex; align-items: center; margin-bottom: 10px; }
          .focus-bar-label { width: 90px; font-size: 12px; color: #64748b; text-transform: capitalize; }
          .focus-bar-track { flex: 1; height: 20px; background-color: #e2e8f0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border-radius: 10px; overflow: hidden; margin: 0 10px; }
          .focus-bar-fill { height: 100%; border-radius: 10px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; min-width: 4px; }
          .focus-bar-value { width: 50px; font-size: 12px; font-weight: 600; color: #1e293b; text-align: right; }
          .focus-list { display: flex; flex-wrap: wrap; gap: 8px; }
          .focus-item { background: #f1f5f9; padding: 6px 12px; border-radius: 20px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { text-align: left; padding: 10px 8px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-weight: 600; }
          td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; }
          tr:hover { background: #f8fafc; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; }
          @media print {
            body { padding: 20px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .charts-row { break-inside: avoid; }
            .section { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${athlete.name}'s Practice Report</h1>
          <p>Generated on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <div class="stats">
          <div class="stat">
            <div class="stat-value">${sessions.length}</div>
            <div class="stat-label">Total Practices</div>
          </div>
          <div class="stat">
            <div class="stat-value">${totalMinutes}</div>
            <div class="stat-label">Total Minutes</div>
          </div>
          <div class="stat">
            <div class="stat-value">${sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0}</div>
            <div class="stat-label">Avg Duration</div>
          </div>
        </div>
        
        <div class="charts-row">
          <div class="chart-container">
            <div class="chart-title">WEEKLY PROGRESS (Minutes)</div>
            <div class="bar-chart">
              ${weeklyData.map(w => `
                <div class="bar-wrapper">
                  <div class="bar-value">${w.minutes}</div>
                  <div class="bar" style="height: ${Math.max((w.minutes / maxWeeklyMinutes) * 100, w.minutes > 0 ? 8 : 4)}px; background-color: #d4a418 !important;"></div>
                  <div class="bar-label">${w.label}</div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="chart-container">
            <div class="chart-title">FOCUS DISTRIBUTION</div>
            <div class="focus-bars">
              ${Object.entries(focusCounts).map(([focus, count]) => `
                <div class="focus-bar-row">
                  <div class="focus-bar-label">${focus}</div>
                  <div class="focus-bar-track">
                    <div class="focus-bar-fill" style="width: ${(count / totalFocusSessions) * 100}%; background-color: ${focusColors[focus] || '#94a3b8'} !important;"></div>
                  </div>
                  <div class="focus-bar-value">${Math.round((count / totalFocusSessions) * 100)}%</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        
        <div class="section">
          <h2>Practice Log</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Duration</th>
                <th>Focus Areas</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${sessions.slice(0, 50).map(s => `
                <tr>
                  <td>${new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td>${s.duration} min</td>
                  <td>${(s.focus || []).join(', ')}</td>
                  <td>${s.note || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${sessions.length > 50 ? `<p style="margin-top: 10px; font-size: 12px; color: #64748b;">Showing 50 of ${sessions.length} practices</p>` : ''}
        </div>
        
        <div class="footer">
          Practice Tracker • ${new Date().getFullYear()}
        </div>
      </body>
      </html>
    `;
    
    // Open print dialog (user can save as PDF)
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
    setIsOpen(false);
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition"
      >
        <Download className="w-3.5 h-3.5" />
        Export
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-1 w-44 bg-slate-800 rounded-xl shadow-lg border border-slate-700 py-1 z-50">
            <button onClick={exportPDF} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span className="text-slate-300">PDF Report</span>
            </button>
            <button onClick={exportCSV} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700 flex items-center gap-2">
              <Table className="w-4 h-4 text-slate-500" />
              <span className="text-slate-300">CSV Spreadsheet</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Pro Charts Card (wraps all charts)
function ProChartsCard({ sessions, focusOptions, athlete, isPro }) {
  if (!isPro) return null;
  
  if (sessions.length === 0) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-amber-400" />
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Practice Trends</p>
          <span className="pro-badge">Pro</span>
        </div>
        <p className="text-slate-500 text-sm italic text-center py-6">
          Log some practices to see your trends!
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-400" />
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Practice Trends</p>
          <span className="pro-badge">Pro</span>
        </div>
        <ExportButton sessions={sessions} athlete={athlete} isPro={isPro} />
      </div>
      
      <div>
        <p className="text-sm font-medium text-slate-300 mb-2">Weekly Progress</p>
        <WeeklyMinutesChart sessions={sessions} />
      </div>
      
      <div className="border-t border-slate-700 pt-5">
        <p className="text-sm font-medium text-slate-300 mb-2">Focus Distribution</p>
        <FocusDistributionChart sessions={sessions} focusOptions={focusOptions} />
      </div>
      
      <div className="border-t border-slate-700 pt-5">
        <p className="text-sm font-medium text-slate-300 mb-2">30-Day Activity</p>
        <ActivityLineChart sessions={sessions} />
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
- Pro features: drill selection, drill history, drill-linked goals, charts, export, multi-athlete
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
  const [athletes, setAthletes] = useState([]); // Pro: all athletes
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
  console.log('isPro check:', { is_pro: profile?.is_pro, expires: profile?.pro_expires_at, isPro });

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
      // Fetch athletes (Pro gets all, Free gets 1)
      const { data: athleteData, error: athleteError } = await db.select('athletes', {
        is: { archived_at: 'null' },
        limit: isPro ? 10 : 1
      });

      if (athleteError) throw athleteError;

      if (!athleteData || athleteData.length === 0) {
        setShowAddAthlete(true);
        setLoading(false);
        return;
      }

      setAthletes(athleteData);
      
      // Check localStorage for previously selected athlete
      const savedAthleteId = localStorage.getItem('selectedAthleteId');
      const savedAthlete = savedAthleteId 
        ? athleteData.find(a => a.id === savedAthleteId) 
        : null;
      
      // Use saved athlete if found, otherwise first athlete
      const currentAthlete = savedAthlete || athleteData[0];
      setAthlete(currentAthlete);
      
      // Save selection to localStorage
      localStorage.setItem('selectedAthleteId', currentAthlete.id);

      // Load data for this athlete
      await loadAthleteData(currentAthlete.id);

    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const loadAthleteData = async (athleteId) => {
    try {
      // Fetch sessions (most recent first)
      const { data: sessionData, error: sessionError } = await db.select('sessions', {
        eq: { athlete_id: athleteId },
        order: { column: 'date', ascending: false },
        limit: 50 // More for Pro charts
      });

      if (sessionError) throw sessionError;
      
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
        eq: { athlete_id: athleteId, is_active: true }
      });

      if (goalError) throw goalError;

      const goalsMap = {};
      FOCUS_OPTIONS.forEach(opt => { goalsMap[opt.id] = null; });
      (goalData || []).forEach(g => {
        goalsMap[g.skill] = { id: g.id, text: g.text, isActive: true };
      });
      setGoals(goalsMap);

      // Fetch drill frequency (Pro only)
      if (isPro) {
        const { data: drillData } = await db.select('drill_frequency', {
          eq: { athlete_id: athleteId },
          order: { column: 'times_used', ascending: false },
          limit: 10
        });
        setDrillFrequency(drillData || []);
      }

    } catch (err) {
      console.error('Error loading athlete data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Switch athlete (Pro only)
  const handleSelectAthlete = async (selectedAthlete) => {
    setAthlete(selectedAthlete);
    localStorage.setItem('selectedAthleteId', selectedAthlete.id);
    setLoading(true);
    await loadAthleteData(selectedAthlete.id);
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
  const [showMorePractices, setShowMorePractices] = useState(false);
  
  // Calculate stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  const weekSessions = sessions.filter(s => {
    const [year, month, day] = s.date.split('-').map(Number);
    const sessionDate = new Date(year, month - 1, day);
    return sessionDate >= startOfWeek;
  });
  const practicesThisWeek = weekSessions.length;
  const minutesThisWeek = weekSessions.reduce((sum, s) => sum + s.duration, 0);
  const lastSession = sessions[0];
  
  const activeGoals = Object.entries(goals).filter(([_, g]) => g?.isActive);
  const activeGoal = activeGoals[0]?.[1];

  const handleQuickLog = async () => {
    if (logFocus.length === 0 || !athlete) return;
    
    setSaving(true);
    setError(null);

    try {
      const { data: newSession, error: sessionError } = await db.insert('sessions', {
        athlete_id: athlete.id,
        date: logDate,
        duration_minutes: logDuration,
        focus: logFocus,
        note: logNote || null,
        reflection: logReflection || null
      });

      if (sessionError) throw sessionError;

      if (isPro && logDrills.length > 0) {
        for (const drillId of logDrills) {
          const { error: drillError } = await db.insert('session_drills', {
            session_id: newSession.id,
            drill_id: drillId
          }, { returnData: false });

          if (drillError) throw drillError;
        }
      }

      setSessions(prev => [{
        id: newSession.id,
        date: newSession.date,
        duration: newSession.duration_minutes,
        focus: newSession.focus,
        note: newSession.note || '',
        reflection: newSession.reflection || ''
      }, ...prev]);
      
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
        if (existingGoal?.id) {
          const { error } = await db.delete('goals', {
            eq: { id: existingGoal.id }
          });
          
          if (error) throw error;
        }
        
        setGoals(prev => ({ ...prev, [skill]: null }));
      } else if (existingGoal?.id) {
        const { error } = await db.update('goals', { text: editGoalText }, {
          eq: { id: existingGoal.id }
        });
        
        if (error) throw error;
        
        setGoals(prev => ({
          ...prev,
          [skill]: { ...existingGoal, text: editGoalText }
        }));
      } else {
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
        
        const updatedGoals = { ...goals };
        if (!isPro) {
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

      setAthletes(prev => [...prev, newAthlete]);
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
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(todayDate);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.getTime() === todayDate.getTime()) return 'Today';
    if (date.getTime() === yesterday.getTime()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-slate-900" style={{ fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        
        .card {
          background: #1e293b;
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15);
          border: 1px solid rgba(255,255,255,0.05);
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #d4a418 0%, #b8860b 100%);
          color: #1e293b;
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
          border-radius: 12px;
          background: #334155;
          border: 2px solid transparent;
          font-size: 15px;
          font-weight: 500;
          transition: all 0.15s;
          color: #cbd5e1;
        }
        
        .focus-chip.selected {
          border-color: #d4a418;
          background: rgba(212, 164, 24, 0.15);
          color: #d4a418;
        }
        
        .duration-chip {
          padding: 10px 16px;
          border-radius: 10px;
          background: #334155;
          border: 2px solid transparent;
          font-size: 15px;
          font-weight: 500;
          transition: all 0.15s;
          color: #cbd5e1;
        }
        
        .duration-chip.selected {
          border-color: #d4a418;
          background: rgba(212, 164, 24, 0.15);
          color: #d4a418;
        }
        
        .pro-badge {
          background: linear-gradient(135deg, #d4a418 0%, #b8860b 100%);
          color: #1e293b;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 20px;
          text-transform: uppercase;
        }
        
        .drill-chip {
          padding: 8px 12px;
          border-radius: 8px;
          background: #334155;
          border: 1.5px solid #475569;
          font-size: 14px;
          transition: all 0.15s;
          color: #cbd5e1;
        }
        
        .drill-chip.selected {
          border-color: #d4a418;
          background: rgba(212, 164, 24, 0.15);
          color: #d4a418;
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
          <header className="bg-slate-800 border-b border-slate-700 px-4 py-4 sticky top-0 z-40">
            <div className="max-w-lg mx-auto flex items-center justify-between">
              <div>
                <AthleteSelector
                  athletes={athletes}
                  currentAthlete={athlete}
                  onSelectAthlete={handleSelectAthlete}
                  onAddAthlete={() => setShowAddAthlete(true)}
                  isPro={isPro}
                />
                <p className="text-sm text-slate-400">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    isPro 
                      ? 'bg-amber-500/20 text-amber-400' 
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {isPro ? '✨ Pro' : 'Free'}
                </span>
                <button
                  onClick={signOut}
                  className="p-2 rounded-full hover:bg-slate-700 text-slate-400"
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
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/30 px-4 py-3 rounded-xl border border-red-800/50">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
                <button onClick={() => setError(null)} className="ml-auto">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

      <main className="max-w-lg mx-auto px-4 py-6 pb-32 space-y-5">
        
        {/* Tagline */}
        <div className="text-center pb-2">
          <p className="text-sm text-slate-400 leading-relaxed">
            Turn "I think we practiced" into something you can actually see. Track consistency and focus without overthinking it.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="card p-5">
          <div className="mb-3">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Weekly Practice Total</p>
            <p className="text-xs text-slate-500 mt-0.5">Total practice time logged for this week.</p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-white">{practicesThisWeek}</p>
              <p className="text-xs text-slate-400 mt-1">this week</p>
            </div>
            <div className="border-l border-r border-slate-700">
              <p className="text-3xl font-bold text-white">{minutesThisWeek}</p>
              <p className="text-xs text-slate-400 mt-1">minutes</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-400">
                {practicesThisWeek >= 4 ? '🏆' : practicesThisWeek >= 3 ? '🔥' : practicesThisWeek >= 1 ? '👍' : '—'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {practicesThisWeek >= 4 ? 'All-Star!' : practicesThisWeek >= 3 ? 'On fire!' : practicesThisWeek >= 1 ? 'Good start' : "let's go!"}
              </p>
            </div>
          </div>
        </div>

        {/* Pro Charts Section */}
        <ProChartsCard 
          sessions={sessions} 
          focusOptions={FOCUS_OPTIONS} 
          athlete={athlete}
          isPro={isPro} 
        />

        {/* Last Practice */}
        {lastSession && (
          <div className="card p-5">
            <div className="flex items-start justify-between mb-1">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Last Practice Focus Areas</p>
                <p className="text-xs text-slate-500 mt-0.5">What was worked on most recently.</p>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">{lastSession.duration} min</span>
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-3">{formatDate(lastSession.date)}</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {lastSession.focus.map(f => {
                const opt = FOCUS_OPTIONS.find(o => o.id === f);
                return (
                  <span key={f} className="text-sm bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full">
                    {opt?.emoji} {opt?.label}
                  </span>
                );
              })}
            </div>
            {lastSession.note && (
              <p className="text-sm text-slate-400 italic mt-3">"{lastSession.note}"</p>
            )}
          </div>
        )}

        {/* Current Goal(s) */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" />
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Weekly Goal
              </p>
              {isPro && <span className="pro-badge">Up to 3</span>}
            </div>
            <button 
              onClick={() => {
                const skill = Object.entries(goals).find(([_, g]) => g?.isActive)?.[0] || 'hitting';
                setShowGoalEdit(skill);
                setEditGoalText(goals[skill]?.text || '');
              }}
              className="text-xs text-amber-400 font-medium"
            >
              {activeGoals.length > 0 ? 'Edit' : 'Add'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-3">The main focus or objective you're working toward this week.</p>
          
          {isPro ? (
            activeGoals.length > 0 ? (
              <div className="space-y-3">
                {activeGoals.slice(0, 3).map(([skill, goal]) => (
                  <div key={skill} className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">
                      {FOCUS_OPTIONS.find(f => f.id === skill)?.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500 capitalize">{skill}</p>
                      <p className="text-slate-200">{goal.text}</p>
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
                    className="text-sm text-amber-400 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add another goal
                  </button>
                )}
              </div>
            ) : (
              <p className="text-slate-500 italic">Tap "Add" to set up to 3 goals</p>
            )
          ) : (
            activeGoal ? (
              <p className="text-slate-200">{activeGoal.text}</p>
            ) : (
              <p className="text-slate-500 italic">Tap "Add" to set a goal</p>
            )
          )}
        </div>

        {/* Recent History */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Recent Practices</p>
            <p className="text-xs text-slate-500 mt-0.5">A log of recent practices with focus and time spent.</p>
          </div>
          <div className="divide-y divide-slate-700/50">
            {sessions.slice(0, showMorePractices ? 15 : 5).map(session => (
              <div key={session.id} className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-lg">
                  {FOCUS_OPTIONS.find(f => f.id === session.focus[0])?.emoji || '🥎'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{formatDate(session.date)}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {session.focus.map(f => FOCUS_OPTIONS.find(o => o.id === f)?.label).join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-300">{session.duration}m</p>
                </div>
              </div>
            ))}
          </div>
          {sessions.length > 5 && (
            <button
              onClick={() => setShowMorePractices(!showMorePractices)}
              className="w-full p-3 text-sm text-amber-400 font-medium hover:bg-slate-700/50 border-t border-slate-700"
            >
              {showMorePractices ? 'Show Less' : `Show More (${Math.min(sessions.length, 15) - 5} more)`}
            </button>
          )}
        </div>

        {/* Pro Upsell (only show for free users) */}
        {!isPro && (
          <button 
            onClick={() => setShowProUpsell(true)}
            className="card p-4 w-full text-left flex items-center gap-4 hover:bg-slate-700/50 transition"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-slate-900" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-slate-200">Upgrade to Pro</p>
              <p className="text-sm text-slate-400">Charts, trends & multi-athlete support</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </button>
        )}

        {/* Pro: Drill Frequency */}
        {isPro && drillFrequency.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Drill Focus This Month</p>
              <span className="pro-badge">Pro</span>
            </div>
            <div className="space-y-3">
              {drillFrequency.slice(0, 5).map(drill => {
                const maxCount = drillFrequency[0]?.times_used || 1;
                const pct = Math.round((drill.times_used / maxCount) * 100);
                const drillInfo = Object.values(DRILL_CATALOG)
                  .flat()
                  .find(d => d.id === drill.drill_id);
                return (
                  <div key={drill.drill_id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">{drillInfo?.name || drill.drill_id}</span>
                      <span className="text-slate-500">{drill.times_used}×</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
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
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto">
          <button
            onClick={() => setShowQuickLog(true)}
            className="btn-primary w-full flex items-center justify-center gap-2 text-lg shadow-lg shadow-amber-900/30"
          >
            <Plus className="w-5 h-5" />
            Log Practice
          </button>
        </div>
      </div>

      {/* Quick Log Modal */}
      {showQuickLog && (
        <div className="fixed inset-0 bg-black/60 z-50 modal-overlay flex items-end sm:items-center justify-center">
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-auto modal-content">
            <div className="sticky top-0 bg-slate-800 px-5 py-4 border-b border-slate-700 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-slate-100">Log Practice</h2>
              <button 
                onClick={() => setShowQuickLog(false)}
                className="p-2 -mr-2 hover:bg-slate-700 rounded-full"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none text-slate-100"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Duration</label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map(mins => (
                    <button
                      key={mins}
                      onClick={() => setLogDuration(mins)}
                      className={`duration-chip ${logDuration === mins ? 'selected' : ''}`}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus Areas */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Focus Areas</label>
                <div className="flex flex-wrap gap-2">
                  {FOCUS_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => toggleFocus(opt.id)}
                      className={`focus-chip ${logFocus.includes(opt.id) ? 'selected' : ''}`}
                    >
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drills (PRO only) */}
              {isPro && logFocus.length > 0 && (
                <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <label className="text-sm font-medium text-slate-300">Specific Drills</label>
                    <span className="pro-badge">Pro</span>
                  </div>
                  <div className="space-y-3">
                    {logFocus.map(focusId => (
                      <div key={focusId}>
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">
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
                                <Check className="w-3 h-3 ml-1 inline text-amber-400" />
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
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Quick note <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value.slice(0, 200))}
                  placeholder="What did you work on?"
                  className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none text-slate-100 placeholder:text-slate-500"
                />
              </div>

              {/* Reflection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  What felt better today? <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={logReflection}
                  onChange={(e) => setLogReflection(e.target.value.slice(0, 200))}
                  placeholder="e.g., Timing on swing, catching fly balls..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="sticky bottom-0 bg-slate-800 px-5 py-4 border-t border-slate-700">
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
        <div className="fixed inset-0 bg-black/60 z-50 modal-overlay flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg modal-content">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">Set Goal</h2>
              <button 
                onClick={() => setShowGoalEdit(null)}
                className="p-2 -mr-2 hover:bg-slate-700 rounded-full"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Skill Area</label>
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
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  What are you working on?
                </label>
                <textarea
                  value={editGoalText}
                  onChange={(e) => setEditGoalText(e.target.value)}
                  placeholder="e.g., Keep hands back longer on swing"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none text-slate-100 placeholder:text-slate-500 resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-700 flex gap-3">
              <button
                onClick={() => setShowGoalEdit(null)}
                disabled={saving}
                className="flex-1 py-3 rounded-xl border border-slate-600 font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black/60 z-50 modal-overlay flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg modal-content">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-slate-900" />
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-2">Upgrade to Pro</h2>
              <p className="text-slate-400 mb-6">
                Get deeper insights into your practice with charts, trends, and more.
              </p>

              <div className="bg-slate-700/50 rounded-2xl p-5 mb-6 text-left space-y-3">
                {[
                  'Visual charts & progress trends',
                  'Track multiple athletes',
                  'Export practice data (CSV/JSON)',
                  'Set up to 3 goals at once',
                  'Track specific drills',
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-amber-400" />
                    </div>
                    <span className="text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>

              <p className="text-3xl font-bold text-slate-100 mb-1">$4.99<span className="text-lg font-normal text-slate-400">/month</span></p>
              <p className="text-sm text-slate-500 mb-6">Cancel anytime</p>

              <button
                onClick={() => {
                  // In production: redirect to Stripe hosted checkout
                  // window.location.href = '/api/checkout';
                  refreshProfile();
                  setShowProUpsell(false);
                }}
                className="btn-primary w-full mb-3"
              >
                Start Pro Trial
              </button>
              <button
                onClick={() => setShowProUpsell(false)}
                className="w-full py-3 text-slate-500 font-medium hover:text-slate-400"
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <PracticeTrackerApp />;
}