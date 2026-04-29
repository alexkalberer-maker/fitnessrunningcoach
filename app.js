// === CONFIG ===
// Alle anpassbaren Werte zentral - ändere hier statt im Code

const CONFIG = {
  // Workout-Dauer in Minuten
  WORKOUT_DURATIONS: {
    KRAFT_BASE: 45,
    KRAFT_ADVANCED_BONUS: 15,
    // Lauf
    EASY_RUN: 45,
    LONG_RUN_BASE: 75,
    TEMPO_RUN: 55,
    INTERVAL_SHORT: 50,
    INTERVAL_LONG: 60,
    FARTLEK: 40,
    PROGRESSION_RUN: 55,
    HILL_REPEATS: 50,
    RACE_PACE_RUN: 50,
    // Rad
    RAD_Z2: 70,
    RAD_SWEET_SPOT: 75,
    RAD_THRESHOLD: 65,
    RAD_VO2MAX: 60,
    RAD_RECOVERY: 40,
    RAD_LONG: 110,
    // Sonstiges
    SCHWIMMEN: 45,
    BRICK: 95,
    // Legacy (für Kompatibilität mit alten Logs)
    LAUF_LONG: 90,
    LAUF_INTERVAL: 60,
    LAUF_Z2: 45,
    LAUF_TEMPO: 50
  },

  // Phasen-Schwellenwerte (Wochen bis Race)
  PHASE_THRESHOLDS: {
    BUILD: 12,   // <= 12 Wochen → Build
    PEAK: 6,     // <= 6 Wochen → Peak
    TAPER: 2     // <= 2 Wochen → Taper
  },

  // Phasen-Labels für UI
  PHASE_UI: {
    base:      { label: 'BASE',      desc: 'Grundlagen aufbauen',     color: '#4a9eff' },
    build:     { label: 'BUILD',     desc: 'Tempo & Intervalle',      color: '#f5a623' },
    peak:      { label: 'PEAK',      desc: 'Race-spezifisch',         color: '#e84545' },
    taper:     { label: 'TAPER',     desc: 'Schärfen & Erholen',      color: '#9b59b6' },
    post_race: { label: 'POST RACE', desc: 'Erholung & neues Ziel',   color: '#27ae60' }
  },

  // Pace-Offsets in Sek/km relativ zur Ziel-Race-Pace
  PACE_OFFSETS: {
    EASY:          75,
    MARATHON:      37,
    HALF_MARATHON: 20,
    TEMPO:         10,
    TEN_K:         -5,
    FIVE_K:        -12,
    INTERVAL_1K:   -20,
    INTERVAL_400:  -35
  },

  // Standard-Paces (Sek/km) wenn kein PB vorhanden
  DEFAULT_EASY_PACE_SEC: {
    beginner:     390,  // 6:30/km
    intermediate: 330,  // 5:30/km
    advanced:     300   // 5:00/km
  },

  // Standard Long-Run Dauern (Sek/km) für Phase-Progression
  LONG_RUN_DURATIONS_BY_PHASE: {
    base:  [75,  80,  85,  90 ],
    build: [90,  100, 110, 120],
    peak:  [120, 130, 140, 150],
    taper: [70,  60,  50,  50 ]
  },

  // Legacy für Backward-Kompatibilität
  LONG_RUN_DURATIONS: [75, 90, 90, 100],

  // Triathlon-Empfehlungs-Volumen pro Typ
  TRIATHLON_VOLUMES: {
    sprint_tri:  { schwimm: 2, rad: 2, lauf: 3, kraft: 2 },
    olympic_tri: { schwimm: 2, rad: 3, lauf: 3, kraft: 2 },
    half_tri:    { schwimm: 2, rad: 3, lauf: 3, kraft: 1 },
    full_tri:    { schwimm: 3, rad: 4, lauf: 4, kraft: 1 }
  },

  // Trainings-Empfehlungen
  RECOMMENDED_LIMITS: {
    MAX_WEEKLY_UNITS: 7,
    MIN_REST_HOURS_LEGS_TO_INTERVAL: 24
  },

  // Standardwerte beim Onboarding
  DEFAULT_VOLUMES: {
    KRAFT: 3,
    LAUF: 2,
    RAD: 1,
    SCHWIMM: 0
  },

  // Plan-Generator Verhalten
  STREAK_LOOKBACK_DAYS: 30,
  PLAN_GEN_DELAY_MS: 1800,
  PLAN_WEEKS: 4,
  MAX_PLAN_WEEKS: 24  // Max. Wochen die JIT generiert werden
};

// === STATE & PERSISTENCE ===

const STORAGE_KEY = 'hybrid-app-state';

const storageAvailable = (() => {
  try {
    const t = '__hybrid_test__';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return true;
  } catch (e) {
    return false;
  }
})();

let state = {
  user: null,
  currentTab: 'home',
  selectedDayIndex: null,
  viewingWeekIndex: 0,        // which week index is shown in dashboard
  onboardingStep: 0,
  onboardingData: {
    sports: [],
    equipment: 'gym',
    location: 'gym',
    weeklyVolume: {
      kraft: CONFIG.DEFAULT_VOLUMES.KRAFT,
      lauf: CONFIG.DEFAULT_VOLUMES.LAUF,
      rad: CONFIG.DEFAULT_VOLUMES.RAD,
      schwimm: CONFIG.DEFAULT_VOLUMES.SCHWIMM
    },
    trainingDays: [0, 1, 2, 3, 4], // Mon–Fri default; Mon=0, Sun=6
    experience: 'intermediate',
    goal: 'recomp',
    daysPerWeek: 5
  },
  todayCheckin: null,
  workoutLogs: {}, // { 'YYYY-MM-DD': { workoutId: { ...completion data } } }
  currentPlan: null // [{weekNumber, startDate, days: {0-6}}, ...]
};

function saveState() {
  if (!storageAvailable) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      user: state.user,
      todayCheckin: state.todayCheckin,
      workoutLogs: state.workoutLogs,
      currentPlan: state.currentPlan
    }));
  } catch (err) { console.error('Save failed:', err); }
}

function loadState() {
  if (!storageAvailable) return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);

    // Migrate old flat plan {0:{day,workouts[]}, …, 6:{…}} → 4-week array
    if (saved.currentPlan && !Array.isArray(saved.currentPlan)) {
      const oldPlan = saved.currentPlan;
      // generatePlan/getMondayOfWeek not yet available here — call after assign
      saved._needsPlanMigration = true;
    }

    Object.assign(state, saved);

    if (state._needsPlanMigration) {
      delete state._needsPlanMigration;
      const oldDays = state.currentPlan; // still the flat object
      const monday = getMondayOfWeek(new Date());
      state.currentPlan = Array.from({ length: CONFIG.PLAN_WEEKS }, (_, w) => {
        const ws = new Date(monday);
        ws.setDate(monday.getDate() + w * 7);
        return {
          weekNumber: w + 1,
          startDate: ws.toISOString().split('T')[0],
          days: w === 0 ? oldDays : generatePlan({ ...(state.user || state.onboardingData), _weekIndex: w })
        };
      });
      saveState();
    }

    // Ensure trainingDays exists on loaded user
    if (state.user && !state.user.trainingDays) state.user.trainingDays = [0, 1, 2, 3, 4];

    state.viewingWeekIndex = findCurrentWeekIndex();
    return true;
  } catch (err) {
    console.warn('State korrupt — starte mit Onboarding:', err);
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    return false;
  }
}

// === TRAINING INTELLIGENCE UTILITIES ===

// Returns weekOffset-adjusted weeks-until-race (0 = race this week, negative = past)
function getWeeksUntilRace(data, weekOffset) {
  const race = data.race;
  if (!race || !race.date) return null;
  const raceDate = new Date(race.date + 'T00:00:00');
  const today = new Date();
  const planWeekStart = new Date(getMondayOfWeek(today));
  planWeekStart.setDate(planWeekStart.getDate() + (weekOffset || 0) * 7);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.ceil((raceDate - planWeekStart) / msPerWeek);
}

// Returns training phase string for given week
function getTrainingPhase(data, weekOffset) {
  const weeks = getWeeksUntilRace(data, weekOffset || 0);
  if (weeks === null) {
    // No race: phase by goal
    const goal = data.goal || 'fitness';
    if (goal === 'race') return 'build';
    if (goal === 'strength') return 'build';
    return 'base';
  }
  if (weeks < 0) return 'post_race';
  if (weeks <= CONFIG.PHASE_THRESHOLDS.TAPER) return 'taper';
  if (weeks <= CONFIG.PHASE_THRESHOLDS.PEAK)  return 'peak';
  if (weeks <= CONFIG.PHASE_THRESHOLDS.BUILD) return 'build';
  return 'base';
}

// Converts h/m/s object to total seconds
function hmsToSeconds(hms) {
  if (!hms) return null;
  return (hms.hours || 0) * 3600 + (hms.minutes || 0) * 60 + (hms.seconds || 0);
}

// Formats seconds-per-km as "M:SS/km"
function formatPace(secPerKm) {
  if (!secPerKm || secPerKm <= 0) return null;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

// Distance in km for a race type (single-sport)
function getRaceDistanceKm(raceType) {
  const map = { '5k': 5, '10k': 10, 'half_marathon': 21.1, 'marathon': 42.2 };
  return map[raceType] || null;
}

// Derives a full set of training paces from user data
function calculatePaces(data) {
  const exp = data.experience || 'intermediate';
  const race = data.race;

  // Baseline easy pace (sec/km)
  let easyPaceSec = CONFIG.DEFAULT_EASY_PACE_SEC[exp] || 330;
  let racePaceSec = null;

  // Try to derive from goalTime → race distance
  if (race && race.goalTime && race.type) {
    const distKm = getRaceDistanceKm(race.type);
    const totalSec = hmsToSeconds(race.goalTime);
    if (distKm && totalSec) {
      racePaceSec = totalSec / distKm;
      easyPaceSec = racePaceSec + CONFIG.PACE_OFFSETS.EASY;
    }
  } else if (race && race.currentPB && race.type) {
    const distKm = getRaceDistanceKm(race.type);
    const totalSec = hmsToSeconds(race.currentPB);
    if (distKm && totalSec) {
      racePaceSec = totalSec / distKm;
      easyPaceSec = racePaceSec + CONFIG.PACE_OFFSETS.EASY;
    }
  }

  // Build full pace table
  const base = racePaceSec || (easyPaceSec - CONFIG.PACE_OFFSETS.EASY);
  return {
    easy:         Math.round(easyPaceSec),
    marathon:     Math.round(base + CONFIG.PACE_OFFSETS.MARATHON),
    halfMarathon: Math.round(base + CONFIG.PACE_OFFSETS.HALF_MARATHON),
    tempo:        Math.round(base + CONFIG.PACE_OFFSETS.TEMPO),
    tenK:         Math.round(base + CONFIG.PACE_OFFSETS.TEN_K),
    fiveK:        Math.round(base + CONFIG.PACE_OFFSETS.FIVE_K),
    interval1k:   Math.round(base + CONFIG.PACE_OFFSETS.INTERVAL_1K),
    interval400:  Math.round(base + CONFIG.PACE_OFFSETS.INTERVAL_400)
  };
}

// Returns the Long Run duration in minutes for current phase + week index within phase
function getLongRunDuration(phase, weekIdx) {
  const table = CONFIG.LONG_RUN_DURATIONS_BY_PHASE[phase] || CONFIG.LONG_RUN_DURATIONS_BY_PHASE.base;
  return table[weekIdx % table.length];
}

// Select lauf workout types for the week based on phase + total runs
function selectLaufTypes(phase, nLauf, isRaceGoal, raceType) {
  const isTri = raceType && raceType.includes('tri');
  switch (phase) {
    case 'taper':
      return (['long_run', 'race_pace', 'easy_run', 'easy_run']).slice(0, nLauf);
    case 'peak':
      if (nLauf === 1) return ['long_run'];
      if (nLauf === 2) return ['long_run', 'race_pace'];
      if (nLauf === 3) return ['long_run', 'race_pace', 'interval_short'];
      return (['long_run', 'race_pace', 'interval_short', 'easy_run']).slice(0, nLauf);
    case 'build':
      if (nLauf === 1) return ['long_run'];
      if (nLauf === 2) return ['long_run', 'tempo_run'];
      if (nLauf === 3) return ['long_run', 'tempo_run', 'interval_long'];
      return (['long_run', 'tempo_run', 'interval_long', 'easy_run']).slice(0, nLauf);
    default: // base
      if (nLauf === 1) return ['long_run'];
      if (nLauf === 2) return ['long_run', 'easy_run'];
      if (nLauf === 3) return isTri ? ['long_run', 'easy_run', 'easy_run'] : ['long_run', 'easy_run', 'fartlek'];
      return (['long_run', 'easy_run', 'easy_run', 'fartlek']).slice(0, nLauf);
  }
}

// Select rad workout types for the week based on phase
function selectRadTypes(phase, nRad) {
  switch (phase) {
    case 'taper':
      return (['recovery_ride', 'z2_endurance', 'z2_endurance']).slice(0, nRad);
    case 'peak':
      if (nRad === 1) return ['z2_endurance'];
      if (nRad === 2) return ['z2_endurance', 'threshold'];
      return (['z2_endurance', 'threshold', 'vo2max']).slice(0, nRad);
    case 'build':
      if (nRad === 1) return ['z2_endurance'];
      if (nRad === 2) return ['z2_endurance', 'sweet_spot'];
      return (['z2_endurance', 'sweet_spot', 'threshold']).slice(0, nRad);
    default: // base
      return (['z2_endurance', 'z2_endurance', 'long_ride']).slice(0, nRad);
  }
}

// === PLAN GENERATOR ===

const SPORT_INFO = {
  kraft: { icon: '💪', label: 'Kraft', color: 'kraft' },
  lauf: { icon: '🏃', label: 'Laufen', color: 'lauf' },
  rad: { icon: '🚴', label: 'Rad', color: 'rad' },
  schwimm: { icon: '🏊', label: 'Schwimmen', color: 'schwimm' },
  mobility: { icon: '🧘', label: 'Mobility', color: 'mobility' },
  rest: { icon: '😴', label: 'Pause', color: 'rest' }
};

const EXERCISE_LIBRARY = {
  push_gym: [
    { name: 'Bankdrücken', sets: 4, reps: '8-10', equipment: 'Langhantel' },
    { name: 'Schrägbankdrücken (KH)', sets: 3, reps: '10-12', equipment: 'Kurzhantel' },
    { name: 'Schulterdrücken', sets: 3, reps: '10-12', equipment: 'Kurzhantel' },
    { name: 'Seitheben', sets: 3, reps: '12-15', equipment: 'Kurzhantel' },
    { name: 'Trizeps-Pushdown', sets: 3, reps: '12', equipment: 'Kabelzug' }
  ],
  pull_gym: [
    { name: 'Klimmzüge', sets: 4, reps: '8-10', equipment: 'Klimmzugstange' },
    { name: 'Kabelrudern', sets: 3, reps: '10-12', equipment: 'Kabelzug' },
    { name: 'Kurzhantel-Rudern', sets: 3, reps: '10', equipment: 'Kurzhantel' },
    { name: 'Bizeps-Curls', sets: 3, reps: '12', equipment: 'Kurzhantel' },
    { name: 'Plank', sets: 3, reps: '45 sek', equipment: '-' }
  ],
  legs_gym: [
    { name: 'Kniebeuge', sets: 4, reps: '8-10', equipment: 'Langhantel' },
    { name: 'Bulgarian Split Squat', sets: 3, reps: '10/Seite', equipment: 'Kurzhantel' },
    { name: 'Romanian Deadlift', sets: 3, reps: '10', equipment: 'Langhantel' },
    { name: 'Hip Thrust', sets: 3, reps: '12', equipment: 'Langhantel' },
    { name: 'Wadenheben (1-Bein)', sets: 3, reps: '15', equipment: '-' }
  ],
  full_gym: [
    { name: 'Kniebeuge', sets: 4, reps: '8', equipment: 'Langhantel' },
    { name: 'Bankdrücken', sets: 4, reps: '8', equipment: 'Langhantel' },
    { name: 'Klimmzüge', sets: 3, reps: '8-10', equipment: 'Klimmzugstange' },
    { name: 'Romanian Deadlift', sets: 3, reps: '10', equipment: 'Langhantel' },
    { name: 'Schulterdrücken', sets: 3, reps: '10', equipment: 'Kurzhantel' },
    { name: 'Plank', sets: 3, reps: '45 sek', equipment: '-' }
  ],
  upper_gym: [
    { name: 'Bankdrücken', sets: 4, reps: '8', equipment: 'Langhantel' },
    { name: 'Klimmzüge', sets: 4, reps: '8-10', equipment: 'Klimmzugstange' },
    { name: 'Schulterdrücken', sets: 3, reps: '10', equipment: 'Kurzhantel' },
    { name: 'Kabelrudern', sets: 3, reps: '12', equipment: 'Kabelzug' },
    { name: 'Bizeps-Curls', sets: 3, reps: '12', equipment: 'Kurzhantel' },
    { name: 'Trizeps-Pushdown', sets: 3, reps: '12', equipment: 'Kabelzug' }
  ],
  push_home: [
    { name: 'Liegestütze', sets: 4, reps: '12-15', equipment: '-' },
    { name: 'Pike Push-ups', sets: 3, reps: '10', equipment: '-' },
    { name: 'Diamond Push-ups', sets: 3, reps: '8-10', equipment: '-' },
    { name: 'Trizeps-Dips (Stuhl)', sets: 3, reps: '12', equipment: 'Stuhl' }
  ],
  pull_home: [
    { name: 'Australian Pull-ups', sets: 4, reps: '10-12', equipment: 'Tisch/Bar' },
    { name: 'Superman', sets: 3, reps: '15', equipment: '-' },
    { name: 'Plank Rows', sets: 3, reps: '10/Seite', equipment: '-' },
    { name: 'Hollow Hold', sets: 3, reps: '30 sek', equipment: '-' }
  ],
  legs_home: [
    { name: 'Pistol Squats', sets: 4, reps: '6-8/Seite', equipment: '-' },
    { name: 'Bulgarian Split Squat', sets: 3, reps: '10/Seite', equipment: '-' },
    { name: 'Glute Bridge (1-Bein)', sets: 3, reps: '12/Seite', equipment: '-' },
    { name: 'Wandsitz', sets: 3, reps: '45 sek', equipment: '-' }
  ],
  full_home: [
    { name: 'Burpees', sets: 4, reps: '10', equipment: '-' },
    { name: 'Pistol Squats', sets: 3, reps: '6/Seite', equipment: '-' },
    { name: 'Liegestütze', sets: 3, reps: '12', equipment: '-' },
    { name: 'Mountain Climbers', sets: 3, reps: '30 sek', equipment: '-' },
    { name: 'Plank', sets: 3, reps: '45 sek', equipment: '-' }
  ]
};

function generatePlan(data) {
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const plan = {};
  dayNames.forEach((d, i) => { plan[i] = { day: d, workouts: [] }; });

  // Allowed training days; Mon=0 … Sun=6
  const tDays = (data.trainingDays && data.trainingDays.length > 0)
    ? [...data.trainingDays].sort((a, b) => a - b)
    : [0, 1, 2, 3, 4, 5, 6];

  const hasSport = s => !data.sports || data.sports.includes(s);
  const nKraft   = hasSport('kraft')  ? (data.weeklyVolume.kraft  || 0) : 0;
  const nLauf    = hasSport('lauf')   ? (data.weeklyVolume.lauf   || 0) : 0;
  const nRad     = hasSport('rad')    ? (data.weeklyVolume.rad    || 0) : 0;
  const nSchwimm = hasSport('schwimm')? (data.weeklyVolume.schwimm || 0) : 0;
  const weekIdx = data._weekIndex || 0;

  // Pick n evenly-spread indices from tDays, honouring exclusions
  function pickSpread(n, exclude = []) {
    const pool = tDays.filter(d => !exclude.includes(d));
    if (!pool.length || n <= 0) return [];
    const result = [];
    const step = pool.length / n;
    for (let i = 0; i < n; i++) {
      const d = pool[Math.min(Math.round(i * step), pool.length - 1)];
      if (!result.includes(d)) result.push(d);
    }
    // Fill any missing slots
    for (const d of pool) {
      if (result.length >= n) break;
      if (!result.includes(d)) result.push(d);
    }
    return result.sort((a, b) => a - b);
  }

  // ── KRAFT ────────────────────────────────────────────────────────────
  const splits = (data.experience === 'beginner' || nKraft <= 2)
    ? ['full', 'full', 'full', 'full', 'full']
    : nKraft === 3 ? ['full', 'upper', 'legs']
    : nKraft === 4 ? ['push', 'pull', 'legs', 'upper']
    : ['push', 'pull', 'legs', 'upper', 'full'];

  const kraftDays = pickSpread(nKraft);
  kraftDays.forEach((dayIdx, i) => {
    const split = splits[i] || 'full';
    const exKey = `${split}_${data.location === 'home' ? 'home' : 'gym'}`;
    const exercises = EXERCISE_LIBRARY[exKey] || EXERCISE_LIBRARY.full_gym;
    plan[dayIdx].workouts.push({
      id: `kraft-${dayIdx}`,
      type: 'kraft',
      title: `Kraft — ${split === 'push' ? 'Push' : split === 'pull' ? 'Pull' : split === 'legs' ? 'Legs' : split === 'upper' ? 'Oberkörper' : 'Ganzkörper'}`,
      duration: CONFIG.WORKOUT_DURATIONS.KRAFT_BASE + (data.experience === 'advanced' ? CONFIG.WORKOUT_DURATIONS.KRAFT_ADVANCED_BONUS : 0),
      time: 'Abend',
      exercises: exercises.map((e, idx) => ({ id: `ex-${dayIdx}-${idx}`, ...e })),
      isLegs: split === 'legs' || split === 'full'
    });
  });

  const legsDays = kraftDays.filter((_, i) => splits[i] === 'legs' || splits[i] === 'full');
  const freeDays = tDays.filter(d => !kraftDays.includes(d));

  // ── LAUF ─────────────────────────────────────────────────────────────
  if (nLauf > 0) {
    const laufTypes = ['long', 'intervall', 'z2', 'tempo'].slice(0, nLauf);
    const longDuration = CONFIG.LONG_RUN_DURATIONS[weekIdx] || CONFIG.WORKOUT_DURATIONS.LAUF_LONG;

    // Long Run: last free training day whose previous training day has no legs
    if (laufTypes.includes('long')) {
      const revFree = [...freeDays].reverse();
      let longDay = revFree.find(d => {
        const prevT = tDays[tDays.indexOf(d) - 1];
        return prevT === undefined || !legsDays.includes(prevT);
      });
      if (longDay === undefined) longDay = revFree[0] ?? tDays[tDays.length - 1];
      const w = createLaufWorkout('long', longDay, data);
      w.duration = longDuration;
      plan[longDay].workouts.push(w);
    }

    // Intervall: free day not directly after a legs day
    if (laufTypes.includes('intervall')) {
      const notAfterLegs = freeDays.filter(d => {
        const prev = d - 1;
        return !legsDays.includes(prev) && !plan[d].workouts.some(w => w.type === 'lauf');
      });
      const day = notAfterLegs[0]
        ?? freeDays.find(d => !plan[d].workouts.some(w => w.type === 'lauf'))
        ?? tDays.find(d => !plan[d].workouts.some(w => w.type === 'lauf'));
      if (day !== undefined) plan[day].workouts.push(createLaufWorkout('intervall', day, data));
    }

    // Z2: free day preferred; smart-pair with non-legs kraft day if no free day left
    if (laufTypes.includes('z2')) {
      const freeForZ2 = freeDays.filter(d => !plan[d].workouts.some(w => w.type === 'lauf'));
      let day = freeForZ2[0];
      if (day === undefined) {
        // Smart-pair: Z2 is low-intensity, safe to add after a non-legs kraft session
        day = kraftDays.find(d => !legsDays.includes(d) && !plan[d].workouts.some(w => w.type === 'lauf'));
      }
      if (day !== undefined) plan[day].workouts.push(createLaufWorkout('z2', day, data));
    }

    // Tempo: next available free day
    if (laufTypes.includes('tempo')) {
      const day = freeDays.find(d => !plan[d].workouts.some(w => w.type === 'lauf'))
        ?? tDays.find(d => !plan[d].workouts.some(w => w.type === 'lauf'));
      if (day !== undefined) plan[day].workouts.push(createLaufWorkout('tempo', day, data));
    }
  }

  // ── RAD ──────────────────────────────────────────────────────────────
  if (nRad > 0) {
    const radTypes = ['z2', 'tempo', 'long'].slice(0, nRad);
    radTypes.forEach(type => {
      const freeForRad = tDays.filter(d => !plan[d].workouts.some(w => w.type === 'rad' || w.type === 'lauf'));
      let day = freeForRad.find(d => !kraftDays.includes(d));
      if (day === undefined) {
        // Smart-pair: Z2/Tempo rad after non-legs kraft
        day = kraftDays.find(d => !legsDays.includes(d) && !plan[d].workouts.some(w => w.type === 'rad'));
      }
      if (day === undefined) day = freeForRad[0] ?? tDays.find(d => !plan[d].workouts.some(w => w.type === 'rad'));
      if (day === undefined) return;
      const isCombined = plan[day].workouts.some(w => w.type === 'kraft');
      plan[day].workouts.push({
        id: `rad-${day}`,
        type: 'rad',
        title: type === 'z2' ? 'Rad — Z2 Grundlage' : type === 'tempo' ? 'Rad — Tempo' : 'Rad — Long',
        duration: type === 'long' ? CONFIG.WORKOUT_DURATIONS.RAD_LONG : CONFIG.WORKOUT_DURATIONS.RAD_Z2,
        time: isCombined ? 'Nach Kraft' : 'Morgen',
        details: type === 'z2' ? 'HF-Zone 2, locker' : type === 'tempo' ? 'Sweet Spot 88-93% FTP' : 'Lockerer Long Ride',
        exercises: []
      });
    });
  }

  // ── SCHWIMM ───────────────────────────────────────────────────────────
  if (nSchwimm > 0) {
    for (let i = 0; i < nSchwimm; i++) {
      const freeForSchwimm = tDays.filter(d => !plan[d].workouts.some(w => w.type === 'schwimm'));
      const day = freeForSchwimm.find(d => !kraftDays.includes(d))
        ?? freeForSchwimm[0]
        ?? tDays[i % tDays.length];
      plan[day].workouts.push({
        id: `schwimm-${day}`,
        type: 'schwimm',
        title: 'Schwimmen — Technik & Ausdauer',
        duration: CONFIG.WORKOUT_DURATIONS.SCHWIMMEN,
        time: 'Morgen',
        details: i === 0 ? '8x100m + Technik' : '2000m Long Swim',
        exercises: []
      });
    }
  }

  return plan;
}

function generate4WeekPlan(data) {
  const monday = getMondayOfWeek(new Date());
  return Array.from({ length: CONFIG.PLAN_WEEKS }, (_, w) => {
    const weekStart = new Date(monday);
    weekStart.setDate(monday.getDate() + w * 7);
    return {
      weekNumber: w + 1,
      startDate: weekStart.toISOString().split('T')[0],
      days: generatePlan({ ...data, _weekIndex: w })
    };
  });
}

function createLaufWorkout(type, dayIdx, data) {
  const workouts = {
    long: {
      title: 'Long Run',
      duration: CONFIG.WORKOUT_DURATIONS.LAUF_LONG,
      details: 'Lockeres Tempo, HF-Zone 2',
      time: 'Morgen'
    },
    intervall: {
      title: 'Intervall — Speed',
      duration: CONFIG.WORKOUT_DURATIONS.LAUF_INTERVAL,
      details: '6×1km @ Renntempo / 90s Pause',
      time: 'Morgen'
    },
    z2: {
      title: 'Z2 — Grundlage',
      duration: CONFIG.WORKOUT_DURATIONS.LAUF_Z2,
      details: 'Locker, Konversationstempo',
      time: 'Morgen'
    },
    tempo: {
      title: 'Tempo — Schwellentempo',
      duration: CONFIG.WORKOUT_DURATIONS.LAUF_TEMPO,
      details: '20-30 Min Tempolauf',
      time: 'Morgen'
    }
  };
  return {
    id: `lauf-${type}-${dayIdx}`,
    type: 'lauf',
    ...workouts[type],
    exercises: []
  };
}

// === ONBOARDING ===

const ONBOARDING_STEPS = [
  'welcome',
  'sports',
  'location',
  'experience',
  'goal',
  'volume',
  'trainingdays',
  'name',
  'generating',
  'complete'
];

function renderOnboarding() {
  const step = ONBOARDING_STEPS[state.onboardingStep];
  const content = document.getElementById('content');
  
  if (step === 'welcome') {
    content.innerHTML = `
      <div class="hero-screen">
        <div class="hero-tag">VERSION 0.1 — PROTOTYP</div>
        <h1 class="hero-title">
          TRAIN<br>
          <span class="accent">SMARTER</span><br>
          NOT HARDER
        </h1>
        <p class="hero-desc">
          Die erste App die Krafttraining, Laufen, Rad und Schwimmen
          gleichwertig kombiniert. Adaptive Pläne. Echte Wissenschaft.
        </p>
        <button class="btn btn-primary" onclick="nextStep()">Los geht's →</button>
      </div>
    `;
    return;
  }
  
  const progress = ((state.onboardingStep) / (ONBOARDING_STEPS.length - 2)) * 100;
  let html = `
    <div class="onboarding">
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
      <div class="step-label">SCHRITT ${state.onboardingStep} VON ${ONBOARDING_STEPS.length - 2}</div>
  `;
  
  if (step === 'sports') {
    const sports = state.onboardingData.sports;
    html += `
      <h2 class="step-title">Welche <span class="accent">Sportarten</span>?</h2>
      <p class="step-desc">Mehrere möglich — du kannst sie später anpassen.</p>
      <div class="choices">
        <div class="choice ${sports.includes('kraft') ? 'selected' : ''}" data-choice-group="sports" data-choice-value="kraft" onclick="toggleSport('kraft')">
          <div class="choice-icon">💪</div>
          <div class="choice-content">
            <div class="choice-title">Krafttraining</div>
            <div class="choice-sub">Muskeln aufbauen, stärker werden</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${sports.includes('lauf') ? 'selected' : ''}" data-choice-group="sports" data-choice-value="lauf" onclick="toggleSport('lauf')">
          <div class="choice-icon">🏃</div>
          <div class="choice-content">
            <div class="choice-title">Laufen</div>
            <div class="choice-sub">5K bis Marathon</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${sports.includes('rad') ? 'selected' : ''}" data-choice-group="sports" data-choice-value="rad" onclick="toggleSport('rad')">
          <div class="choice-icon">🚴</div>
          <div class="choice-content">
            <div class="choice-title">Radfahren</div>
            <div class="choice-sub">Indoor (Zwift) oder Outdoor</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${sports.includes('schwimm') ? 'selected' : ''}" data-choice-group="sports" data-choice-value="schwimm" onclick="toggleSport('schwimm')">
          <div class="choice-icon">🏊</div>
          <div class="choice-content">
            <div class="choice-title">Schwimmen</div>
            <div class="choice-sub">Technik und Ausdauer</div>
          </div>
          <div class="choice-check"></div>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-secondary" onclick="prevStep()">Zurück</button>
        <button class="btn btn-primary" id="onboarding-next-btn" onclick="nextStep()" ${sports.length === 0 ? 'disabled' : ''}>Weiter</button>
      </div>
    </div>
    `;
  }
  
  else if (step === 'location') {
    const loc = state.onboardingData.location;
    html += `
      <h2 class="step-title">Wo trainierst du <span class="accent">Kraft</span>?</h2>
      <p class="step-desc">Davon hängt ab welche Übungen wir dir vorschlagen.</p>
      <div class="choices">
        <div class="choice ${loc === 'gym' ? 'selected' : ''}" data-choice-group="location" data-choice-value="gym" onclick="setLocation('gym')">
          <div class="choice-icon">🏋️</div>
          <div class="choice-content">
            <div class="choice-title">Fitnessstudio</div>
            <div class="choice-sub">Hanteln, Maschinen, Kabelzug</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${loc === 'home' ? 'selected' : ''}" data-choice-group="location" data-choice-value="home" onclick="setLocation('home')">
          <div class="choice-icon">🏠</div>
          <div class="choice-content">
            <div class="choice-title">Zuhause / Bodyweight</div>
            <div class="choice-sub">Kein oder wenig Equipment</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${loc === 'outdoor' ? 'selected' : ''}" data-choice-group="location" data-choice-value="outdoor" onclick="setLocation('outdoor')">
          <div class="choice-icon">🌳</div>
          <div class="choice-content">
            <div class="choice-title">Outdoor / Calisthenics</div>
            <div class="choice-sub">Park, Klimmzugstange, draussen</div>
          </div>
          <div class="choice-check"></div>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-secondary" onclick="prevStep()">Zurück</button>
        <button class="btn btn-primary" onclick="nextStep()">Weiter</button>
      </div>
    </div>
    `;
  }
  
  else if (step === 'experience') {
    const exp = state.onboardingData.experience;
    html += `
      <h2 class="step-title">Dein <span class="accent">Level</span>?</h2>
      <p class="step-desc">Ehrlich sein — wir passen die Intensität an.</p>
      <div class="choices">
        <div class="choice ${exp === 'beginner' ? 'selected' : ''}" data-choice-group="experience" data-choice-value="beginner" onclick="setExperience('beginner')">
          <div class="choice-icon">🌱</div>
          <div class="choice-content">
            <div class="choice-title">Einsteiger</div>
            <div class="choice-sub">Weniger als 6 Monate Training</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${exp === 'intermediate' ? 'selected' : ''}" data-choice-group="experience" data-choice-value="intermediate" onclick="setExperience('intermediate')">
          <div class="choice-icon">⚡</div>
          <div class="choice-content">
            <div class="choice-title">Fortgeschritten</div>
            <div class="choice-sub">6 Monate bis 3 Jahre Training</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${exp === 'advanced' ? 'selected' : ''}" data-choice-group="experience" data-choice-value="advanced" onclick="setExperience('advanced')">
          <div class="choice-icon">🔥</div>
          <div class="choice-content">
            <div class="choice-title">Erfahren</div>
            <div class="choice-sub">3+ Jahre, ggf. Wettkampf-Erfahrung</div>
          </div>
          <div class="choice-check"></div>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-secondary" onclick="prevStep()">Zurück</button>
        <button class="btn btn-primary" onclick="nextStep()">Weiter</button>
      </div>
    </div>
    `;
  }
  
  else if (step === 'goal') {
    const goal = state.onboardingData.goal;
    html += `
      <h2 class="step-title">Dein <span class="accent">Hauptziel</span>?</h2>
      <p class="step-desc">Wir priorisieren dein Programm danach.</p>
      <div class="choices">
        <div class="choice ${goal === 'recomp' ? 'selected' : ''}" data-choice-group="goal" data-choice-value="recomp" onclick="setGoal('recomp')">
          <div class="choice-icon">🎯</div>
          <div class="choice-content">
            <div class="choice-title">Body Recomposition</div>
            <div class="choice-sub">Muskeln aufbauen + Fett verlieren</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${goal === 'race' ? 'selected' : ''}" data-choice-group="goal" data-choice-value="race" onclick="setGoal('race')">
          <div class="choice-icon">🏁</div>
          <div class="choice-content">
            <div class="choice-title">Wettkampf-Vorbereitung</div>
            <div class="choice-sub">Halbmarathon, Triathlon, Hyrox</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${goal === 'strength' ? 'selected' : ''}" data-choice-group="goal" data-choice-value="strength" onclick="setGoal('strength')">
          <div class="choice-icon">💪</div>
          <div class="choice-content">
            <div class="choice-title">Kraft & Muskelaufbau</div>
            <div class="choice-sub">Hauptfokus auf Hypertrophie</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${goal === 'fitness' ? 'selected' : ''}" data-choice-group="goal" data-choice-value="fitness" onclick="setGoal('fitness')">
          <div class="choice-icon">✨</div>
          <div class="choice-content">
            <div class="choice-title">Allgemeine Fitness</div>
            <div class="choice-sub">Stark, fit, gesund — kein Wettkampf</div>
          </div>
          <div class="choice-check"></div>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-secondary" onclick="prevStep()">Zurück</button>
        <button class="btn btn-primary" onclick="nextStep()">Weiter</button>
      </div>
    </div>
    `;
  }
  
  else if (step === 'volume') {
    const vol = state.onboardingData.weeklyVolume;
    const sports = state.onboardingData.sports;
    html += `
      <h2 class="step-title">Wie <span class="accent">oft</span> pro Woche?</h2>
      <p class="step-desc">Wir kümmern uns um die Verteilung — du sagst nur wieviel.</p>
    `;
    
    const sliders = [
      { key: 'kraft', emoji: '💪', label: 'Krafttraining', max: 5 },
      { key: 'lauf', emoji: '🏃', label: 'Laufen', max: 5 },
      { key: 'rad', emoji: '🚴', label: 'Radfahren', max: 4 },
      { key: 'schwimm', emoji: '🏊', label: 'Schwimmen', max: 3 }
    ];
    
    sliders.forEach(s => {
      if (sports.includes(s.key)) {
        html += `
          <div class="slider-container">
            <div class="slider-row">
              <div class="slider-label">
                <span class="slider-emoji">${s.emoji}</span>
                <span>${s.label}</span>
              </div>
              <div class="slider-value">
                <span data-slider-value="${s.key}">${vol[s.key]}</span><span class="slider-value-label">×/Wo</span>
              </div>
            </div>
            <input type="range" min="0" max="${s.max}" value="${vol[s.key]}"
              oninput="updateVolume('${s.key}', this.value)">
          </div>
        `;
      }
    });

    const total = Object.entries(vol).filter(([k]) => sports.includes(k)).reduce((s, [_, v]) => s + parseInt(v), 0);
    const tooMuch = total > CONFIG.RECOMMENDED_LIMITS.MAX_WEEKLY_UNITS;

    html += `
      <div id="volume-total" style="text-align: center; margin: 16px 0; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: ${tooMuch ? 'var(--danger)' : 'var(--text-secondary)'};">
        Total: ${total} Einheiten / Woche ${tooMuch ? `⚠ zu viel — wir empfehlen max. ${CONFIG.RECOMMENDED_LIMITS.MAX_WEEKLY_UNITS}` : ''}
      </div>
      <div class="btn-row">
        <button class="btn btn-secondary" onclick="prevStep()">Zurück</button>
        <button class="btn btn-primary" id="onboarding-next-btn" onclick="nextStep()" ${total === 0 ? 'disabled' : ''}>Weiter</button>
      </div>
    </div>
    `;
  }
  
  else if (step === 'trainingdays') {
    const td = state.onboardingData.trainingDays;
    const vol = state.onboardingData.weeklyVolume;
    const sports = state.onboardingData.sports;
    const totalUnits = Object.entries(vol).filter(([k]) => sports.includes(k)).reduce((s, [_, v]) => s + parseInt(v), 0);
    const dayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const tooFew = td.length < totalUnits;
    html += `
      <h2 class="step-title">Wann trainierst <span class="accent">du</span>?</h2>
      <p class="step-desc">Wähle deine Trainingstage — der Plan wird nur auf diesen Tagen geplant.</p>
      <div class="training-days-grid">
        ${dayLabels.map((label, idx) => `
          <div class="day-pill ${td.includes(idx) ? 'selected' : ''}" onclick="toggleTrainingDay(${idx})">${label}</div>
        `).join('')}
      </div>
      <div id="trainingdays-hint" style="text-align: center; margin: 16px 0; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: ${tooFew ? 'var(--danger)' : 'var(--text-secondary)'};">
        ${td.length} Tage gewählt · ${totalUnits} Einheiten geplant${tooFew ? ' ⚠ zu wenig Tage' : ''}
      </div>
      <div class="btn-row">
        <button class="btn btn-secondary" onclick="prevStep()">Zurück</button>
        <button class="btn btn-primary" id="onboarding-next-btn" onclick="nextStep()" ${td.length === 0 ? 'disabled' : ''}>Weiter</button>
      </div>
    </div>
    `;
  }

  else if (step === 'name') {
    html += `
      <h2 class="step-title">Wie heisst <span class="accent">du</span>?</h2>
      <p class="step-desc">Damit wir dich persönlich begrüssen können.</p>
      <div class="slider-container">
        <input type="text" id="name-input" placeholder="Dein Vorname"
          style="background: var(--bg-deep); border: 1px solid var(--border); border-radius: 10px; padding: 16px; font-family: 'Inter', sans-serif; font-size: 18px; color: var(--text-primary); width: 100%; outline: none;"
          onkeyup="if(event.key==='Enter') nextStep()">
      </div>
      <div class="btn-row">
        <button class="btn btn-secondary" onclick="prevStep()">Zurück</button>
        <button class="btn btn-primary" onclick="completeOnboarding()">Plan erstellen →</button>
      </div>
    </div>
    `;
    setTimeout(() => document.getElementById('name-input')?.focus(), 100);
  }
  
  else if (step === 'generating') {
    html += `
      <div class="loader">
        <div class="spinner"></div>
        <div style="text-align: center;">
          <div class="step-label" style="margin-bottom: 8px;">PERSONALISIERE PLAN</div>
          <div style="font-size: 14px; color: var(--text-secondary);">
            Berechne optimale Verteilung...<br>
            Vermeide Konflikte (Intervall ↔ Legs)...<br>
            Erstelle Übungen für ${state.onboardingData.location === 'gym' ? 'Gym' : state.onboardingData.location === 'home' ? 'Zuhause' : 'Outdoor'}...
          </div>
        </div>
      </div>
    </div>
    `;
    setTimeout(() => {
      state.currentPlan = generate4WeekPlan(state.onboardingData);
      state.user = {
        name: state.onboardingData.name || 'Athlet',
        ...state.onboardingData
      };
      state.viewingWeekIndex = 0;
      saveState();
      state.onboardingStep++;
      renderOnboarding();
    }, CONFIG.PLAN_GEN_DELAY_MS);
  }
  
  else if (step === 'complete') {
    html += `
      <div style="text-align: center; padding: 40px 0;">
        <div style="font-size: 64px; margin-bottom: 24px;">⚡</div>
        <h2 class="step-title" style="text-align: center;">Dein Plan ist <span class="accent">bereit</span></h2>
        <p class="step-desc" style="text-align: center;">
          Optimal verteilt für deine Ziele.<br>
          Adaptiv — passt sich täglich an dich an.
        </p>
        <button class="btn btn-primary" onclick="finishOnboarding()">Plan ansehen →</button>
      </div>
    </div>
    `;
  }
  
  content.innerHTML = html;
}

function nextStep() { state.onboardingStep++; renderOnboarding(); }
function prevStep() { if (state.onboardingStep > 0) { state.onboardingStep--; renderOnboarding(); } }

function toggleSport(sport) {
  const sports = state.onboardingData.sports;
  const idx = sports.indexOf(sport);
  const wasSelected = idx >= 0;
  if (wasSelected) sports.splice(idx, 1);
  else sports.push(sport);
  if (wasSelected) state.onboardingData.weeklyVolume[sport] = 0;
  else if (state.onboardingData.weeklyVolume[sport] === 0) {
    state.onboardingData.weeklyVolume[sport] = sport === 'kraft' ? 3 : sport === 'lauf' ? 2 : 1;
  }
  const el = document.querySelector(`.choice[data-choice-group="sports"][data-choice-value="${sport}"]`);
  if (el) el.classList.toggle('selected', !wasSelected);
  const btn = document.getElementById('onboarding-next-btn');
  if (btn) btn.disabled = sports.length === 0;
}

function setLocation(loc) {
  state.onboardingData.location = loc;
  document.querySelectorAll('.choice[data-choice-group="location"]').forEach(c =>
    c.classList.toggle('selected', c.dataset.choiceValue === loc));
}

function setExperience(exp) {
  state.onboardingData.experience = exp;
  document.querySelectorAll('.choice[data-choice-group="experience"]').forEach(c =>
    c.classList.toggle('selected', c.dataset.choiceValue === exp));
}

function setGoal(goal) {
  state.onboardingData.goal = goal;
  document.querySelectorAll('.choice[data-choice-group="goal"]').forEach(c =>
    c.classList.toggle('selected', c.dataset.choiceValue === goal));
}

function updateVolume(sport, val) {
  state.onboardingData.weeklyVolume[sport] = parseInt(val);
  const display = document.querySelector(`[data-slider-value="${sport}"]`);
  if (display) display.textContent = val;
  const sports = state.onboardingData.sports;
  const vol = state.onboardingData.weeklyVolume;
  const total = Object.entries(vol).filter(([k]) => sports.includes(k)).reduce((s, [_, v]) => s + parseInt(v), 0);
  const tooMuch = total > CONFIG.RECOMMENDED_LIMITS.MAX_WEEKLY_UNITS;
  const totalEl = document.getElementById('volume-total');
  if (totalEl) {
    totalEl.style.color = tooMuch ? 'var(--danger)' : 'var(--text-secondary)';
    totalEl.textContent = `Total: ${total} Einheiten / Woche${tooMuch ? ` ⚠ zu viel — wir empfehlen max. ${CONFIG.RECOMMENDED_LIMITS.MAX_WEEKLY_UNITS}` : ''}`;
  }
  const btn = document.getElementById('onboarding-next-btn');
  if (btn) btn.disabled = total === 0;
}

function toggleTrainingDay(idx) {
  const td = state.onboardingData.trainingDays;
  const pos = td.indexOf(idx);
  if (pos >= 0) td.splice(pos, 1);
  else td.push(idx);
  const el = document.querySelectorAll('.day-pill')[idx];
  if (el) el.classList.toggle('selected', pos < 0);

  const vol = state.onboardingData.weeklyVolume;
  const sports = state.onboardingData.sports;
  const totalUnits = Object.entries(vol).filter(([k]) => sports.includes(k)).reduce((s, [_, v]) => s + parseInt(v), 0);
  const tooFew = td.length < totalUnits;

  const hint = document.getElementById('trainingdays-hint');
  if (hint) {
    hint.style.color = tooFew ? 'var(--danger)' : 'var(--text-secondary)';
    hint.textContent = `${td.length} Tage gewählt · ${totalUnits} Einheiten geplant${tooFew ? ' ⚠ zu wenig Tage' : ''}`;
  }
  const btn = document.getElementById('onboarding-next-btn');
  if (btn) btn.disabled = td.length === 0;
}

function completeOnboarding() {
  const nameInput = document.getElementById('name-input');
  state.onboardingData.name = nameInput?.value || 'Athlet';
  nextStep();
}

function finishOnboarding() {
  document.getElementById('header-section').classList.remove('hidden');
  document.getElementById('bottom-nav').classList.remove('hidden');
  renderHome();
}

// === HOME / DASHBOARD ===

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getDayIndex(date = new Date()) {
  // Mon=0, Sun=6
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function findCurrentWeekIndex() {
  if (!Array.isArray(state.currentPlan) || !state.currentPlan.length) return 0;
  const todayStr = getTodayKey();
  for (let i = 0; i < state.currentPlan.length; i++) {
    const ws = state.currentPlan[i].startDate;
    const we = new Date(ws + 'T00:00:00');
    we.setDate(we.getDate() + 6);
    if (ws <= todayStr && todayStr <= we.toISOString().split('T')[0]) return i;
  }
  // If today is beyond all weeks, return last
  return state.currentPlan.length - 1;
}

function getViewedWeek() {
  if (!Array.isArray(state.currentPlan)) return null;
  return state.currentPlan[state.viewingWeekIndex] || state.currentPlan[0];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Guten Morgen';
  if (h < 18) return 'Hi';
  return 'Guten Abend';
}

function renderHome() {
  state.currentTab = 'home';
  updateNav();

  const week = getViewedWeek();
  if (!week) { document.getElementById('content').innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary);">Kein Plan vorhanden.</div>'; return; }

  const currentWeekIdx = findCurrentWeekIndex();
  const isCurrentWeek = state.viewingWeekIndex === currentWeekIdx;
  const todayIdx = getDayIndex();
  const todayKey = getTodayKey();
  const completedToday = state.workoutLogs[todayKey] || {};

  // Stats for viewed week
  const weekStartDate = week.startDate;
  let totalThisWeek = 0;
  let completedThisWeek = 0;
  Object.entries(week.days).forEach(([idx, d]) => {
    totalThisWeek += d.workouts.length;
    const dayDate = getDateForDayIndex(parseInt(idx), weekStartDate);
    const dk = dayDate.toISOString().split('T')[0];
    const logs = state.workoutLogs[dk] || {};
    completedThisWeek += Object.values(logs).filter(w => w.completed).length;
  });

  const checkinDone = isCurrentWeek && state.todayCheckin && state.todayCheckin.date === todayKey;

  // Week navigation label
  const weekStart = new Date(weekStartDate + 'T00:00:00');
  const weekEnd = new Date(weekStartDate + 'T00:00:00');
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `KW ${week.weekNumber} · ${weekStart.toLocaleDateString('de-CH', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('de-CH', { day: 'numeric', month: 'short' })}`;

  const today = isCurrentWeek ? week.days[todayIdx] : null;
  
  let html = `
    <div class="dashboard-greeting">
      <div class="greeting-tag">${isCurrentWeek ? new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' }) : weekLabel}</div>
      <div class="greeting-text">${isCurrentWeek ? `${getGreeting()}, <span class="accent">${state.user.name}</span>.` : `Woche <span class="accent">${week.weekNumber}</span>`}</div>
    </div>

    <div class="week-nav">
      <button class="week-nav-btn" onclick="navigateWeek(-1)" ${state.viewingWeekIndex === 0 ? 'disabled' : ''}>←</button>
      <div class="week-nav-label">${isCurrentWeek ? 'Diese Woche' : weekLabel}</div>
      <button class="week-nav-btn" onclick="navigateWeek(1)" ${state.viewingWeekIndex >= state.currentPlan.length - 1 ? 'disabled' : ''}>→</button>
    </div>

    <div class="stats-bar">
      <div class="stat">
        <div class="stat-value accent">${completedThisWeek}</div>
        <div class="stat-label">${isCurrentWeek ? 'Diese Woche' : 'Erledigt'}</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalThisWeek}</div>
        <div class="stat-label">Geplant</div>
      </div>
      <div class="stat">
        <div class="stat-value">${getStreak()}</div>
        <div class="stat-label">🔥 Streak</div>
      </div>
    </div>
  `;

  // Check-in (only for current week)
  if (isCurrentWeek) {
    html += `
      <div class="checkin-card" onclick="openCheckin()">
        <div class="checkin-row">
          <div>
            <div class="checkin-label">${checkinDone ? 'CHECK-IN GEMACHT' : 'TÄGLICHER CHECK-IN'}</div>
            <div class="checkin-text">${checkinDone ? `Du fühlst dich ${getMoodLabel(state.todayCheckin.mood)}` : 'Wie fühlst du dich heute?'}</div>
          </div>
          <div class="checkin-arrow">${checkinDone ? '✓' : '→'}</div>
        </div>
        ${checkinDone ? `
          <div class="checkin-status-row">
            <div class="checkin-pill">Energie ${state.todayCheckin.energy}/5</div>
            <div class="checkin-pill">Schlaf ${state.todayCheckin.sleep}/5</div>
            ${state.todayCheckin.soreness > 2 ? '<div class="checkin-pill">⚡ Plan adaptiert</div>' : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  // Today's workouts (only on current week)
  if (isCurrentWeek && today) {
    if (today.workouts.length > 0) {
      html += `<div class="section">
        <div class="section-header"><h3 class="section-title">HEUTE — ${today.day}</h3></div>
        <div class="workout-list">`;
      today.workouts.forEach(w => {
        html += renderWorkoutCard(w, todayKey, completedToday[w.id]?.completed);
      });
      html += `</div></div>`;
    } else {
      html += `<div class="section">
        <div class="section-header"><h3 class="section-title">HEUTE — ${today.day}</h3></div>
        <div class="workout-card rest" style="text-align:center;">
          <div style="padding:20px;">
            <div style="font-size:32px;margin-bottom:8px;">😴</div>
            <div style="font-weight:600;margin-bottom:4px;">Pause-Tag</div>
            <div style="font-size:13px;color:var(--text-secondary);">Aktive Erholung empfohlen — Spaziergang oder Stretching</div>
          </div>
        </div>
      </div>`;
    }
  }

  // Week overview grid
  html += `<div class="section">
    <div class="section-header"><h3 class="section-title">WOCHENPLAN</h3></div>
    <div class="week-grid">`;

  Object.entries(week.days).forEach(([idx, day]) => {
    const dayIdxInt = parseInt(idx);
    const isToday = isCurrentWeek && dayIdxInt === todayIdx;
    const hasWorkout = day.workouts.length > 0;
    const dayDate = getDateForDayIndex(dayIdxInt, weekStartDate);
    const dk = dayDate.toISOString().split('T')[0];
    const dayLogs = state.workoutLogs[dk] || {};
    const allCompleted = hasWorkout && day.workouts.every(w => dayLogs[w.id]?.completed);

    html += `
      <div class="day-cell ${isToday ? 'today' : ''}" onclick="openDay(${idx})">
        <div class="day-name">${day.day}</div>
        <div class="day-num">${dayDate.getDate()}</div>
        <div class="day-dot ${allCompleted ? 'completed' : hasWorkout ? 'has-workout' : ''}"></div>
      </div>
    `;
  });

  html += `</div></div>`;

  // Upcoming (rest of current week, only if viewing current week)
  if (isCurrentWeek) {
    const upcoming = [];
    for (let i = 1; i <= 3; i++) {
      const idx = (todayIdx + i) % 7;
      const day = week.days[idx];
      if (day && day.workouts.length > 0) upcoming.push({ idx, day });
    }
    if (upcoming.length > 0) {
      html += `<div class="section">
        <div class="section-header"><h3 class="section-title">ALS NÄCHSTES</h3></div>
        <div class="workout-list">`;
      upcoming.slice(0, 2).forEach(({ idx, day }) => {
        day.workouts.forEach(w => {
          const dayDate = getDateForDayIndex(idx, weekStartDate);
          const dk = dayDate.toISOString().split('T')[0];
          html += `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted);letter-spacing:0.15em;margin-top:4px;">${day.day.toUpperCase()} · ${dayDate.toLocaleDateString('de-CH',{day:'numeric',month:'short'}).toUpperCase()}</div>`;
          html += renderWorkoutCard(w, dk, false);
        });
      });
      html += `</div></div>`;
    }
  }

  document.getElementById('content').innerHTML = html;
}

function navigateWeek(dir) {
  const next = state.viewingWeekIndex + dir;
  if (next < 0 || next >= state.currentPlan.length) return;
  state.viewingWeekIndex = next;
  renderHome();
}

function getDateForDayIndex(idx, weekStartDate) {
  if (weekStartDate) {
    const d = new Date(weekStartDate + 'T00:00:00');
    d.setDate(d.getDate() + idx);
    return d;
  }
  // Fallback: current calendar week
  const today = new Date();
  const todayIdx = getDayIndex(today);
  const diff = idx - todayIdx;
  const d = new Date(today);
  d.setDate(d.getDate() + diff);
  return d;
}

function getStreak() {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < CONFIG.STREAK_LOOKBACK_DAYS; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const logs = state.workoutLogs[key];
    if (logs && Object.values(logs).some(l => l.completed)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

function renderWorkoutCard(w, dayKey, completed) {
  const info = SPORT_INFO[w.type];
  const completedClass = completed ? 'completed' : '';
  const intensity = w.duration > 70 ? 'High' : w.duration > 40 ? 'Mid' : 'Low';
  
  return `
    <div class="workout-card ${w.type} ${completedClass}" onclick="openWorkout('${w.id}', '${dayKey}')">
      <div class="workout-row">
        <div class="workout-info">
          <div class="workout-meta">
            <span class="workout-type ${w.type}">${info.label.toUpperCase()}</span>
            <span class="workout-time">· ${w.duration} MIN</span>
            ${w.time ? `<span class="workout-time">· ${w.time.toUpperCase()}</span>` : ''}
          </div>
          <div class="workout-title">${w.title}</div>
          <div class="workout-desc">
            ${w.exercises && w.exercises.length > 0 
              ? `<span class="workout-detail-pill">${w.exercises.length} Übungen</span>` 
              : ''}
            ${w.details ? `<span style="opacity: 0.7;">${w.details}</span>` : ''}
          </div>
        </div>
        <div class="workout-action">${completed ? '✓' : '→'}</div>
      </div>
    </div>
  `;
}

function getMoodLabel(mood) {
  const labels = { 1: 'müde 😴', 2: 'okay', 3: 'gut', 4: 'stark', 5: 'top 🔥' };
  return labels[mood] || 'okay';
}

// === CHECK-IN MODAL ===

function openCheckin() {
  const todayKey = getTodayKey();
  const existing = state.todayCheckin && state.todayCheckin.date === todayKey ? state.todayCheckin : null;
  
  showModal(`
    <div class="modal-body">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-muted); letter-spacing: 0.2em; margin-bottom: 8px;">TÄGLICHER CHECK-IN</div>
        <div style="font-size: 18px; color: var(--text-secondary);">Wir passen deinen Plan an wie du dich fühlst.</div>
      </div>
      
      <div class="step-label">ENERGIE-LEVEL</div>
      <div class="mood-grid">
        ${[1,2,3,4,5].map(n => `
          <div class="mood-item ${existing?.energy === n ? 'selected' : ''}" data-energy="${n}">
            <div class="mood-emoji">${['😩','😕','😐','💪','🔥'][n-1]}</div>
            <div class="mood-label">${n}/5</div>
          </div>
        `).join('')}
      </div>
      
      <div class="step-label">SCHLAF-QUALITÄT</div>
      <div class="mood-grid">
        ${[1,2,3,4,5].map(n => `
          <div class="mood-item ${existing?.sleep === n ? 'selected' : ''}" data-sleep="${n}">
            <div class="mood-emoji">${['😴','💤','😌','✨','⭐'][n-1]}</div>
            <div class="mood-label">${n}/5</div>
          </div>
        `).join('')}
      </div>
      
      <div class="step-label">MUSKELKATER</div>
      <div class="mood-grid">
        ${[1,2,3,4,5].map(n => `
          <div class="mood-item ${existing?.soreness === n ? 'selected' : ''}" data-soreness="${n}">
            <div class="mood-emoji">${['👌','🙂','😬','😖','🥵'][n-1]}</div>
            <div class="mood-label">${n}/5</div>
          </div>
        `).join('')}
      </div>
      
      <div class="step-label">GESAMTGEFÜHL</div>
      <div class="mood-grid">
        ${[1,2,3,4,5].map(n => `
          <div class="mood-item ${existing?.mood === n ? 'selected' : ''}" data-mood="${n}">
            <div class="mood-emoji">${['😩','😕','😐','😊','🤩'][n-1]}</div>
            <div class="mood-label">${n}/5</div>
          </div>
        `).join('')}
      </div>
      
      <button class="btn btn-primary" id="save-checkin-btn" onclick="saveCheckin()" style="margin-top: 16px;">
        Check-in speichern
      </button>
    </div>
  `, 'Check-in');
  
  // Event delegation for mood selection
  setTimeout(() => {
    document.querySelectorAll('.mood-item').forEach(item => {
      item.addEventListener('click', function() {
        const parent = this.parentElement;
        parent.querySelectorAll('.mood-item').forEach(i => i.classList.remove('selected'));
        this.classList.add('selected');
      });
    });
  }, 50);
}

function saveCheckin() {
  const get = (attr) => {
    const sel = document.querySelector(`.mood-item.selected[data-${attr}]`);
    return sel ? parseInt(sel.dataset[attr]) : null;
  };
  
  const energy = get('energy');
  const sleep = get('sleep');
  const soreness = get('soreness');
  const mood = get('mood');
  
  if (!energy || !sleep || !soreness || !mood) {
    showToast('Bitte alle Werte angeben');
    return;
  }
  
  state.todayCheckin = {
    date: getTodayKey(),
    energy, sleep, soreness, mood,
    timestamp: Date.now()
  };
  
  saveState();
  closeModal();
  
  // Adaptive feedback
  let msg = 'Check-in gespeichert ✓';
  if (soreness >= 4 || energy <= 2) {
    msg = 'Plan angepasst — heute lockerer';
  } else if (energy >= 4 && soreness <= 2) {
    msg = 'Top-Tag! Voll durchziehen 💪';
  }
  showToast(msg);
  renderHome();
}

// === WORKOUT TRACKING ===

// --- Helpers ---

function findWorkout(workoutId, dayKey) {
  const logEntry = (state.workoutLogs[dayKey] || {})[workoutId];
  if (logEntry && logEntry.isCustom) return logEntry.customMeta;
  let found = null;
  if (Array.isArray(state.currentPlan)) {
    state.currentPlan.forEach(week =>
      Object.values(week.days).forEach(day =>
        day.workouts.forEach(w => { if (w.id === workoutId) found = w; })
      )
    );
  }
  return found;
}

function ensureLog(dayKey, workoutId) {
  if (!state.workoutLogs[dayKey]) state.workoutLogs[dayKey] = {};
  if (!state.workoutLogs[dayKey][workoutId]) {
    state.workoutLogs[dayKey][workoutId] = { sets: {}, completed: false };
  }
  return state.workoutLogs[dayKey][workoutId];
}

// Returns the effective exercise list for this session (snapshot takes priority)
function getEffectiveExercises(workout, log) {
  return log.exercisesSnapshot || workout.exercises || [];
}

// Copy plan exercises into log snapshot so session edits don't touch the plan
function ensureSnapshot(dayKey, workoutId, workout) {
  const log = ensureLog(dayKey, workoutId);
  if (!log.exercisesSnapshot) {
    log.exercisesSnapshot = (workout.exercises || []).map(ex => ({ ...ex }));
    saveState();
  }
  return log;
}

// Infer the split category from workout title for smart exercise filtering
function inferSplitCategory(workout) {
  const title = (workout.title || '').toLowerCase();
  if (title.includes('push')) return 'push';
  if (title.includes('pull')) return 'pull';
  if (title.includes('legs') || title.includes('beine')) return 'legs';
  if (title.includes('upper') || title.includes('oberkörper')) return 'upper';
  return 'full';
}

function getLibraryKey(split, location) {
  const loc = location === 'home' || location === 'outdoor' ? 'home' : 'gym';
  // upper_home doesn't exist — fall back to full_home
  const key = `${split}_${loc}`;
  return EXERCISE_LIBRARY[key] ? key : `full_${loc}`;
}

// --- Main Workout Modal ---

function openWorkout(workoutId, dayKey) {
  const workout = findWorkout(workoutId, dayKey);
  if (!workout) return;

  const log = (state.workoutLogs[dayKey] || {})[workoutId] || { sets: {}, completed: false };
  const info = SPORT_INFO[workout.type] || SPORT_INFO['kraft'];

  let html = `
    <div class="modal-body">
      <div style="margin-bottom: 16px;">
        <div class="workout-meta">
          <span class="workout-type ${workout.type}">${info.label.toUpperCase()}</span>
          <span class="workout-time">· ${workout.duration} MIN</span>
        </div>
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 32px; margin-top: 4px;">${workout.title}</div>
        ${workout.details ? `<div style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">${workout.details}</div>` : ''}
      </div>
  `;

  if (workout.type === 'kraft') {
    const exercises = getEffectiveExercises(workout, log);

    exercises.forEach((ex, exIdx) => {
      const exLog = log.sets[ex.id] || {};
      const numSets = ex.sets;
      let progressCount = 0;
      for (let s = 1; s <= numSets; s++) {
        if (exLog[`set${s}`]?.checked) progressCount++;
      }
      const note = (log.notes || {})[ex.id] || '';

      html += `
        <div class="exercise-card">
          <div class="exercise-header">
            <div style="flex:1; min-width:0;">
              <div class="exercise-name">${ex.name}</div>
              <div class="exercise-meta">${numSets}×${ex.reps}${ex.equipment !== '-' ? ' · ' + ex.equipment : ''}</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <div class="exercise-progress">${progressCount}/${numSets}</div>
              <button class="ex-menu-btn" onclick="openExerciseMenu('${dayKey}','${workoutId}','${ex.id}',${exIdx})" title="Optionen">···</button>
            </div>
          </div>
          ${note ? `<div class="exercise-note-display">${note}</div>` : ''}
          <div class="set-headers">
            <div>SET</div>
            <div>KG</div>
            <div>WDH</div>
            <div>✓</div>
            <div></div>
          </div>
          <div class="set-grid">
      `;

      for (let s = 1; s <= numSets; s++) {
        const setData = exLog[`set${s}`] || {};
        const canRemove = numSets > 1;
        html += `
          <div class="set-row">
            <div class="set-num">${s}</div>
            <input type="number" class="set-input" placeholder="-" value="${setData.kg || ''}"
              oninput="updateSet('${dayKey}','${workoutId}','${ex.id}',${s},'kg',this.value)">
            <input type="text" class="set-input" placeholder="${ex.reps.split('-')[0]}" value="${setData.reps || ''}"
              oninput="updateSet('${dayKey}','${workoutId}','${ex.id}',${s},'reps',this.value)">
            <div class="set-check ${setData.checked ? 'checked' : ''}"
              onclick="toggleSet('${dayKey}','${workoutId}','${ex.id}',${s})">
              ${setData.checked ? '✓' : ''}
            </div>
            <button class="set-remove-btn ${canRemove ? '' : 'disabled'}"
              onclick="${canRemove ? `removeSet('${dayKey}','${workoutId}','${ex.id}',${s})` : ''}"
              title="Satz entfernen">×</button>
          </div>
        `;
      }

      html += `
          </div>
          <button class="add-set-btn" onclick="addSet('${dayKey}','${workoutId}','${ex.id}')">+ Satz</button>
        </div>
      `;
    });

    html += `
      <button class="add-exercise-btn" onclick="openExercisePicker('${dayKey}','${workoutId}')">+ Übung hinzufügen</button>
    `;
  } else {
    // Cardio tracking
    const cardioData = log.cardio || {};
    html += `
      <div class="cardio-tracker">
        <div style="font-size: 60px; margin-bottom: 8px;">${info.icon}</div>
        <div style="color: var(--text-secondary); font-size: 14px;">Trage ein nach dem Workout</div>
        <div class="cardio-grid">
          <div class="cardio-input-group">
            <div class="cardio-input-label">Distanz (km)</div>
            <input type="number" class="cardio-input" step="0.1" placeholder="0.0" value="${cardioData.distance || ''}"
              oninput="updateCardio('${dayKey}','${workoutId}','distance',this.value)">
          </div>
          <div class="cardio-input-group">
            <div class="cardio-input-label">Zeit (min)</div>
            <input type="number" class="cardio-input" placeholder="0" value="${cardioData.time || ''}"
              oninput="updateCardio('${dayKey}','${workoutId}','time',this.value)">
          </div>
          <div class="cardio-input-group">
            <div class="cardio-input-label">Ø HF (bpm)</div>
            <input type="number" class="cardio-input" placeholder="-" value="${cardioData.hr || ''}"
              oninput="updateCardio('${dayKey}','${workoutId}','hr',this.value)">
          </div>
          <div class="cardio-input-group">
            <div class="cardio-input-label">RPE (1-10)</div>
            <input type="number" class="cardio-input" min="1" max="10" placeholder="-" value="${cardioData.rpe || ''}"
              oninput="updateCardio('${dayKey}','${workoutId}','rpe',this.value)">
          </div>
        </div>
      </div>
    `;
  }

  html += `
      <button class="btn ${log.completed ? 'btn-secondary' : 'btn-primary'}" onclick="completeWorkout('${dayKey}','${workoutId}')" style="margin-top: 16px;">
        ${log.completed ? '✓ Abgeschlossen — rückgängig?' : 'Workout abschliessen'}
      </button>
    </div>
  `;

  showModal(html, workout.title);
}

// --- Set Editing ---

function updateSet(dayKey, workoutId, exId, setNum, field, val) {
  const log = ensureLog(dayKey, workoutId);
  if (!log.sets[exId]) log.sets[exId] = {};
  if (!log.sets[exId][`set${setNum}`]) log.sets[exId][`set${setNum}`] = {};
  log.sets[exId][`set${setNum}`][field] = val;
  saveState();
}

function toggleSet(dayKey, workoutId, exId, setNum) {
  const log = ensureLog(dayKey, workoutId);
  if (!log.sets[exId]) log.sets[exId] = {};
  if (!log.sets[exId][`set${setNum}`]) log.sets[exId][`set${setNum}`] = {};
  log.sets[exId][`set${setNum}`].checked = !log.sets[exId][`set${setNum}`].checked;
  saveState();
  openWorkout(workoutId, dayKey);
}

function addSet(dayKey, workoutId, exId) {
  const workout = findWorkout(workoutId, dayKey);
  const log = ensureSnapshot(dayKey, workoutId, workout);
  const ex = log.exercisesSnapshot.find(e => e.id === exId);
  if (ex) { ex.sets++; saveState(); openWorkout(workoutId, dayKey); }
}

function removeSet(dayKey, workoutId, exId, setNum) {
  const workout = findWorkout(workoutId, dayKey);
  const log = ensureSnapshot(dayKey, workoutId, workout);
  const ex = log.exercisesSnapshot.find(e => e.id === exId);
  if (!ex || ex.sets <= 1) return;
  // Shift set data down from the removed set
  const setLog = log.sets[exId] || {};
  for (let s = setNum; s < ex.sets; s++) {
    setLog[`set${s}`] = setLog[`set${s + 1}`] || {};
  }
  delete setLog[`set${ex.sets}`];
  log.sets[exId] = setLog;
  ex.sets--;
  saveState();
  openWorkout(workoutId, dayKey);
}

// --- Exercise Menu ---

function openExerciseMenu(dayKey, workoutId, exId, exIdx) {
  const workout = findWorkout(workoutId, dayKey);
  const log = (state.workoutLogs[dayKey] || {})[workoutId] || { sets: {}, completed: false };
  const exercises = getEffectiveExercises(workout, log);
  const ex = exercises[exIdx];
  if (!ex) return;
  const note = (log.notes || {})[ex.id] || '';

  showModal(`
    <div class="modal-body">
      <div style="font-size: 16px; font-weight: 600; margin-bottom: 20px;">${ex.name}</div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button class="btn btn-secondary" onclick="closeModal(); openExercisePicker('${dayKey}','${workoutId}','${exId}')">
          🔄 Übung austauschen
        </button>
        <button class="btn btn-secondary" onclick="closeModal(); openNoteEditor('${dayKey}','${workoutId}','${exId}')">
          📝 ${note ? 'Notiz bearbeiten' : 'Notiz hinzufügen'}
        </button>
        <button class="btn btn-secondary" style="color: var(--danger); border-color: var(--danger);"
          onclick="closeModal(); removeExercise('${dayKey}','${workoutId}','${exId}')">
          🗑 Übung entfernen
        </button>
      </div>
    </div>
  `, ex.name);
}

function removeExercise(dayKey, workoutId, exId) {
  if (!confirm('Übung aus dieser Session entfernen?')) return;
  const workout = findWorkout(workoutId, dayKey);
  const log = ensureSnapshot(dayKey, workoutId, workout);
  log.exercisesSnapshot = log.exercisesSnapshot.filter(e => e.id !== exId);
  saveState();
  openWorkout(workoutId, dayKey);
}

function openNoteEditor(dayKey, workoutId, exId) {
  const log = (state.workoutLogs[dayKey] || {})[workoutId] || {};
  const existing = (log.notes || {})[exId] || '';
  showModal(`
    <div class="modal-body">
      <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 12px;">Notiz für diese Session</p>
      <textarea id="note-input" style="width:100%; background: var(--bg-deep); border: 1px solid var(--border);
        border-radius: 10px; padding: 14px; font-family: 'Inter', sans-serif; font-size: 15px;
        color: var(--text-primary); outline: none; resize: vertical; min-height: 100px;"
        placeholder="Formhinweis, Gewichts-PR, Anmerkung…">${existing}</textarea>
      <button class="btn btn-primary" onclick="saveNote('${dayKey}','${workoutId}','${exId}')" style="margin-top: 12px;">
        Speichern
      </button>
    </div>
  `, 'Notiz');
  setTimeout(() => document.getElementById('note-input')?.focus(), 50);
}

function saveNote(dayKey, workoutId, exId) {
  const val = document.getElementById('note-input')?.value.trim() || '';
  const log = ensureLog(dayKey, workoutId);
  if (!log.notes) log.notes = {};
  if (val) log.notes[exId] = val;
  else delete log.notes[exId];
  saveState();
  closeModal();
  openWorkout(workoutId, dayKey);
}

// --- Exercise Picker ---

function openExercisePicker(dayKey, workoutId, swapExId) {
  const workout = findWorkout(workoutId, dayKey);
  const location = state.user?.location || 'gym';
  const split = inferSplitCategory(workout);
  const primaryKey = getLibraryKey(split, location);
  const allKeys = Object.keys(EXERCISE_LIBRARY).filter(k => k.endsWith(location === 'gym' ? '_gym' : '_home'));

  let showAll = false;

  function buildPickerHTML(showAllExercises) {
    const keys = showAllExercises ? allKeys : [primaryKey];
    const exercises = [];
    keys.forEach(k => {
      (EXERCISE_LIBRARY[k] || []).forEach(e => {
        if (!exercises.find(x => x.name === e.name)) exercises.push({ ...e, _cat: k });
      });
    });

    let rows = exercises.map(e => `
      <div class="exercise-pick-row" onclick="pickExercise('${dayKey}','${workoutId}','${swapExId || ''}',${JSON.stringify(e).replace(/'/g, '&#39;').replace(/"/g, '&quot;')})">
        <div>
          <div style="font-size: 15px; font-weight: 600;">${e.name}</div>
          <div style="font-size: 12px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">${e.sets}×${e.reps}${e.equipment !== '-' ? ' · ' + e.equipment : ''}</div>
        </div>
        <div style="color: var(--accent); font-size: 20px;">+</div>
      </div>
    `).join('');

    return `
      <div class="modal-body">
        ${!showAllExercises ? `
          <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">
            ${swapExId ? 'Tausche gegen:' : 'Zur Session hinzufügen:'} <strong>${split.toUpperCase()}</strong>-Übungen
          </p>
        ` : `
          <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">Alle Übungen</p>
        `}
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${rows}
        </div>
        ${!showAllExercises ? `
          <button class="btn btn-ghost" onclick="reloadExercisePicker('${dayKey}','${workoutId}','${swapExId || ''}')" style="margin-top: 16px; font-size: 13px;">
            Alle Übungen anzeigen →
          </button>
        ` : ''}
      </div>
    `;
  }

  showModal(buildPickerHTML(false), swapExId ? 'Übung austauschen' : 'Übung hinzufügen');
}

function reloadExercisePicker(dayKey, workoutId, swapExId) {
  // Re-open with all exercises
  const workout = findWorkout(workoutId, dayKey);
  const location = state.user?.location || 'gym';
  const allKeys = Object.keys(EXERCISE_LIBRARY).filter(k => k.endsWith(location === 'gym' ? '_gym' : '_home'));
  const exercises = [];
  allKeys.forEach(k => {
    (EXERCISE_LIBRARY[k] || []).forEach(e => {
      if (!exercises.find(x => x.name === e.name)) exercises.push({ ...e, _cat: k });
    });
  });

  const rows = exercises.map(e => `
    <div class="exercise-pick-row" onclick="pickExercise('${dayKey}','${workoutId}','${swapExId}',${JSON.stringify(e).replace(/'/g, '&#39;').replace(/"/g, '&quot;')})">
      <div>
        <div style="font-size: 15px; font-weight: 600;">${e.name}</div>
        <div style="font-size: 12px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">${e.sets}×${e.reps}${e.equipment !== '-' ? ' · ' + e.equipment : ''}</div>
      </div>
      <div style="color: var(--accent); font-size: 20px;">+</div>
    </div>
  `).join('');

  showModal(`
    <div class="modal-body">
      <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">Alle Übungen</p>
      <div style="display: flex; flex-direction: column; gap: 8px;">${rows}</div>
    </div>
  `, swapExId ? 'Übung austauschen' : 'Übung hinzufügen');
}

function pickExercise(dayKey, workoutId, swapExId, exerciseData) {
  // exerciseData may arrive as string (from onclick attribute) or object
  const ex = typeof exerciseData === 'string' ? JSON.parse(exerciseData) : exerciseData;
  const workout = findWorkout(workoutId, dayKey);
  const log = ensureSnapshot(dayKey, workoutId, workout);
  const newEx = { id: `ex-custom-${Date.now()}`, name: ex.name, sets: ex.sets || 3, reps: ex.reps || '10', equipment: ex.equipment || '-' };

  if (swapExId) {
    const idx = log.exercisesSnapshot.findIndex(e => e.id === swapExId);
    if (idx >= 0) {
      // Clear old log data for the swapped exercise
      if (log.sets) delete log.sets[swapExId];
      log.exercisesSnapshot[idx] = newEx;
    }
  } else {
    log.exercisesSnapshot.push(newEx);
  }

  saveState();
  closeModal();
  openWorkout(workoutId, dayKey);
}

// --- Cardio + Complete ---

function updateCardio(dayKey, workoutId, field, val) {
  const log = ensureLog(dayKey, workoutId);
  if (!log.cardio) log.cardio = {};
  log.cardio[field] = val;
  saveState();
}

function completeWorkout(dayKey, workoutId) {
  const log = ensureLog(dayKey, workoutId);
  log.completed = !log.completed;
  log.completedAt = Date.now();
  saveState();
  closeModal();
  showToast(log.completed ? 'Workout abgeschlossen 🎉' : 'Status zurückgesetzt');
  renderHome();
}

// --- Day Detail ---

function openDay(idx) {
  const week = getViewedWeek();
  const day = week.days[idx];
  const dayDate = getDateForDayIndex(idx, week.startDate);
  const dayKey = dayDate.toISOString().split('T')[0];
  const logs = state.workoutLogs[dayKey] || {};

  let html = `<div class="modal-body">`;
  if (!day || day.workouts.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">😴</div>
        <div style="font-size:18px;font-weight:600;margin-bottom:8px;">Pause-Tag</div>
        <div>Erholung — dein Körper baut Muskeln und Ausdauer am Pause-Tag.</div>
      </div>
    `;
  } else {
    html += `<div class="workout-list">`;
    day.workouts.forEach(w => {
      html += renderWorkoutCard(w, dayKey, logs[w.id]?.completed);
    });
    html += `</div>`;
  }
  html += `</div>`;
  showModal(html, `${day.day} · ${dayDate.toLocaleDateString('de-CH', { day: 'numeric', month: 'long' })}`);
}

// === STATS & PROFILE ===

function renderStats() {
  state.currentTab = 'stats';
  updateNav();
  
  let totalCompleted = 0;
  let byType = { kraft: 0, lauf: 0, rad: 0, schwimm: 0 };
  let totalKgLifted = 0;
  let totalKmCovered = 0;
  let totalMinutes = 0;
  
  Object.entries(state.workoutLogs).forEach(([date, dayLogs]) => {
    Object.entries(dayLogs).forEach(([wid, log]) => {
      if (log.completed) {
        totalCompleted++;
        // Custom workouts store their type in customMeta; plan workouts encode type in id
        const type = log.isCustom ? log.customMeta?.type : wid.split('-')[0];
        if (type && byType[type] !== undefined) byType[type]++;

        // Sum kg from sets
        Object.values(log.sets || {}).forEach(setObj => {
          Object.values(setObj).forEach(set => {
            if (set.checked && set.kg && set.reps) {
              totalKgLifted += parseFloat(set.kg) * parseInt(set.reps);
            }
          });
        });

        // Cardio
        if (log.cardio) {
          if (log.cardio.distance) totalKmCovered += parseFloat(log.cardio.distance);
          if (log.cardio.time) totalMinutes += parseInt(log.cardio.time);
        }
      }
    });
  });
  
  const total = byType.kraft + byType.lauf + byType.rad + byType.schwimm;
  
  let html = `
    <div class="dashboard-greeting">
      <div class="greeting-tag">DEINE STATISTIK</div>
      <div class="greeting-text">Stats &amp; <span class="accent">Progress</span></div>
    </div>
    
    <div class="stat-card-big">
      <div class="stat-card-row">
        <div>
          <div class="stat-card-label">Total Workouts</div>
        </div>
        <div class="stat-card-value">${totalCompleted}</div>
      </div>
      ${total > 0 ? `
      <div class="bar-chart">
        ${Object.entries(byType).filter(([_, v]) => v > 0).map(([type, v]) => {
          const height = (v / total) * 100;
          return `<div class="bar-item">
            <div class="bar ${type}" style="height: ${height}%"></div>
            <div class="bar-label">${SPORT_INFO[type].label}</div>
          </div>`;
        }).join('')}
      </div>
      ` : ''}
    </div>
    
    <div class="stat-card-big">
      <div class="stat-card-row">
        <div class="stat-card-label">🏋️ Total gehoben</div>
        <div class="stat-card-value">${Math.round(totalKgLifted).toLocaleString('de-CH')} <span style="font-size: 18px; color: var(--text-secondary);">kg</span></div>
      </div>
    </div>
    
    <div class="stat-card-big">
      <div class="stat-card-row">
        <div class="stat-card-label">🏃 Distanz Cardio</div>
        <div class="stat-card-value">${totalKmCovered.toFixed(1)} <span style="font-size: 18px; color: var(--text-secondary);">km</span></div>
      </div>
    </div>
    
    <div class="stat-card-big">
      <div class="stat-card-row">
        <div class="stat-card-label">⏱ Trainingszeit</div>
        <div class="stat-card-value">${Math.floor(totalMinutes / 60)}<span style="font-size: 18px; color: var(--text-secondary);">h</span> ${totalMinutes % 60}<span style="font-size: 18px; color: var(--text-secondary);">m</span></div>
      </div>
    </div>
    
    <div class="stat-card-big">
      <div class="stat-card-row">
        <div class="stat-card-label">🔥 Aktuelle Streak</div>
        <div class="stat-card-value">${getStreak()} <span style="font-size: 18px; color: var(--text-secondary);">Tage</span></div>
      </div>
    </div>
    
    ${totalCompleted === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div style="font-size: 16px; margin-bottom: 8px;">Noch keine Daten</div>
        <div style="font-size: 13px;">Schliesse dein erstes Workout ab um Statistiken zu sehen.</div>
      </div>
    ` : ''}
  `;
  
  document.getElementById('content').innerHTML = html;
}

// --- Profile ---

function renderProfile() {
  state.currentTab = 'profile';
  updateNav();

  const u = state.user;
  const sportLabels = u.sports.map(s => `${SPORT_INFO[s].icon} ${SPORT_INFO[s].label}`).join(' · ');
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const trainingDayLabels = (u.trainingDays || []).sort((a,b)=>a-b).map(d => dayNames[d]).join(', ');

  function editBtn(fn) {
    return `<button class="profile-edit-btn" onclick="${fn}">✎</button>`;
  }

  let html = `
    <div class="dashboard-greeting">
      <div class="greeting-tag">DEIN PROFIL</div>
      <div class="greeting-text">${u.name}</div>
    </div>

    <div class="stat-card-big">
      <div class="profile-card-header">
        <div class="stat-card-label">SPORTARTEN</div>
        ${editBtn('editSports()')}
      </div>
      <div style="font-size:16px;margin-top:8px;">${sportLabels}</div>
    </div>

    <div class="stat-card-big">
      <div class="profile-card-header">
        <div class="stat-card-label">WÖCHENTLICHES VOLUMEN</div>
        ${editBtn('editVolume()')}
      </div>
      ${Object.entries(u.weeklyVolume).filter(([_, v]) => v > 0).map(([k, v]) => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;">
          <span>${SPORT_INFO[k].icon} ${SPORT_INFO[k].label}</span>
          <span style="font-family:'JetBrains Mono',monospace;color:var(--accent);">${v}× / Wo</span>
        </div>
      `).join('')}
    </div>

    <div class="stat-card-big">
      <div class="profile-card-header">
        <div class="stat-card-label">TRAININGSTAGE</div>
        ${editBtn('editTrainingDays()')}
      </div>
      <div style="font-size:15px;margin-top:8px;">${trainingDayLabels || '—'}</div>
    </div>

    <div class="stat-card-big">
      <div class="profile-card-header">
        <div class="stat-card-label">ZIEL</div>
        ${editBtn('editGoal()')}
      </div>
      <div style="font-size:16px;margin-top:8px;">${
        u.goal === 'recomp' ? '🎯 Body Recomposition' :
        u.goal === 'race' ? '🏁 Wettkampf-Vorbereitung' :
        u.goal === 'strength' ? '💪 Kraft & Muskelaufbau' :
        '✨ Allgemeine Fitness'
      }</div>
    </div>

    <div class="stat-card-big">
      <div class="profile-card-header">
        <div class="stat-card-label">LEVEL</div>
        ${editBtn('editExperience()')}
      </div>
      <div style="font-size:16px;margin-top:8px;">${
        u.experience === 'beginner' ? '🌱 Einsteiger' :
        u.experience === 'intermediate' ? '⚡ Fortgeschritten' :
        '🔥 Erfahren'
      }</div>
    </div>

    <div class="stat-card-big">
      <div class="profile-card-header">
        <div class="stat-card-label">TRAININGSORT</div>
        ${editBtn('editLocation()')}
      </div>
      <div style="font-size:16px;margin-top:8px;">${
        u.location === 'gym' ? '🏋️ Fitnessstudio' :
        u.location === 'home' ? '🏠 Zuhause' :
        '🌳 Outdoor'
      }</div>
    </div>

    <button class="btn btn-secondary" onclick="openRetroLogger()" style="margin-top:16px;">
      📅 Workout nachtragen
    </button>
    <button class="btn btn-secondary" onclick="regeneratePlan()" style="margin-top:8px;">
      🔄 Plan neu generieren
    </button>
    <button class="btn btn-ghost" onclick="resetApp()" style="margin-top:8px;color:var(--danger);">
      Alles zurücksetzen
    </button>

    <div style="text-align:center;margin-top:32px;padding:24px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-muted);letter-spacing:0.2em;">HYBRID · PROTOTYP v0.1</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:8px;">Ein Konzept-Test der Hybrid-Training-App-Idee</div>
    </div>
  `;

  document.getElementById('content').innerHTML = html;
}

// --- Profile Edit Functions ---

function _saveProfileAndRegenerate(changes, msg) {
  Object.assign(state.user, changes);
  state.currentPlan = generate4WeekPlan(state.user);
  state.viewingWeekIndex = findCurrentWeekIndex();
  saveState();
  closeModal();
  showToast(msg || 'Gespeichert — Plan angepasst ✨');
  renderProfile();
}

function editSports() {
  const cur = [...(state.user.sports || [])];
  showModal(`
    <div class="modal-body">
      <p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px;">Sportarten auswählen (mind. eine)</p>
      <div class="choices">
        ${[['kraft','💪','Krafttraining','Muskeln, Kraft'],['lauf','🏃','Laufen','5K bis Marathon'],['rad','🚴','Radfahren','Indoor oder Outdoor'],['schwimm','🏊','Schwimmen','Technik und Ausdauer']].map(([k,icon,title,sub]) => `
          <div class="choice ${cur.includes(k)?'selected':''}" id="esport-${k}" onclick="(function(){const a=document.getElementById('esport-${k}');a.classList.toggle('selected');})()">
            <div class="choice-icon">${icon}</div>
            <div class="choice-content"><div class="choice-title">${title}</div><div class="choice-sub">${sub}</div></div>
            <div class="choice-check"></div>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-primary" style="margin-top:16px;" onclick="
        const sports=['kraft','lauf','rad','schwimm'].filter(k=>document.getElementById('esport-'+k)?.classList.contains('selected'));
        if(!sports.length){showToast('Mind. eine Sportart wählen');return;}
        const vol={...state.user.weeklyVolume};
        ['kraft','lauf','rad','schwimm'].forEach(k=>{if(!sports.includes(k))vol[k]=0;else if(!vol[k])vol[k]=k==='kraft'?3:k==='lauf'?2:1;});
        _saveProfileAndRegenerate({sports,weeklyVolume:vol},'Sportarten gespeichert ✨');
      ">Speichern</button>
    </div>
  `, 'Sportarten');
}

function editVolume() {
  const u = state.user;
  const vol = { ...u.weeklyVolume };
  const sliders = [
    { key: 'kraft', emoji: '💪', label: 'Krafttraining', max: 5 },
    { key: 'lauf',  emoji: '🏃', label: 'Laufen', max: 5 },
    { key: 'rad',   emoji: '🚴', label: 'Radfahren', max: 4 },
    { key: 'schwimm', emoji: '🏊', label: 'Schwimmen', max: 3 }
  ];
  let sliderHTML = sliders.filter(s => u.sports.includes(s.key)).map(s => `
    <div class="slider-container">
      <div class="slider-row">
        <div class="slider-label"><span class="slider-emoji">${s.emoji}</span><span>${s.label}</span></div>
        <div class="slider-value"><span id="evol-${s.key}">${vol[s.key]}</span><span class="slider-value-label">×/Wo</span></div>
      </div>
      <input type="range" min="0" max="${s.max}" value="${vol[s.key]}" oninput="
        document.getElementById('evol-${s.key}').textContent=this.value;
        _updateEvolTotal();
      ">
    </div>
  `).join('');
  showModal(`
    <div class="modal-body">
      ${sliderHTML}
      <div id="evol-total" style="text-align:center;margin:16px 0;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text-secondary);"></div>
      <button class="btn btn-primary" onclick="
        const newVol={...state.user.weeklyVolume};
        ['kraft','lauf','rad','schwimm'].forEach(k=>{const el=document.getElementById('evol-'+k);if(el)newVol[k]=parseInt(el.textContent)||0;});
        _saveProfileAndRegenerate({weeklyVolume:newVol},'Volumen gespeichert ✨');
      ">Speichern</button>
    </div>
  `, 'Trainingsvolumen');
  setTimeout(_updateEvolTotal, 50);
}

function _updateEvolTotal() {
  const u = state.user;
  let total = 0;
  u.sports.forEach(k => {
    const el = document.getElementById('evol-' + k);
    if (el) total += parseInt(el.textContent) || 0;
  });
  const el = document.getElementById('evol-total');
  if (el) el.textContent = `Total: ${total} Einheiten / Woche`;
}

function editTrainingDays() {
  const cur = [...(state.user.trainingDays || [0,1,2,3,4])];
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  showModal(`
    <div class="modal-body">
      <p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px;">An welchen Tagen trainierst du?</p>
      <div class="training-days-grid" id="etd-grid">
        ${dayNames.map((label, idx) => `
          <div class="day-pill ${cur.includes(idx)?'selected':''}" id="etd-${idx}" onclick="document.getElementById('etd-${idx}').classList.toggle('selected')">${label}</div>
        `).join('')}
      </div>
      <button class="btn btn-primary" style="margin-top:20px;" onclick="
        const sel=[0,1,2,3,4,5,6].filter(i=>document.getElementById('etd-'+i)?.classList.contains('selected'));
        if(!sel.length){showToast('Mind. 1 Tag wählen');return;}
        _saveProfileAndRegenerate({trainingDays:sel},'Trainingstage gespeichert ✨');
      ">Speichern</button>
    </div>
  `, 'Trainingstage');
}

function editGoal() {
  const cur = state.user.goal;
  const opts = [['recomp','🎯','Body Recomposition','Muskeln aufbauen + Fett verlieren'],['race','🏁','Wettkampf','Halbmarathon, Triathlon, Hyrox'],['strength','💪','Kraft & Muskelaufbau','Hauptfokus auf Hypertrophie'],['fitness','✨','Allgemeine Fitness','Stark, fit, gesund']];
  showModal(`
    <div class="modal-body">
      <div class="choices">
        ${opts.map(([k,icon,title,sub]) => `
          <div class="choice ${cur===k?'selected':''}" onclick="
            document.querySelectorAll('#goal-modal .choice').forEach(c=>c.classList.remove('selected'));
            this.classList.add('selected');
          ">
            <div class="choice-icon">${icon}</div>
            <div class="choice-content"><div class="choice-title">${title}</div><div class="choice-sub">${sub}</div></div>
            <div class="choice-check"></div>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-primary" style="margin-top:16px;" onclick="
        const sel=document.querySelector('#modal-overlay .choice.selected');
        if(!sel)return;
        const g=['recomp','race','strength','fitness'][[...document.querySelectorAll('#modal-overlay .choice')].indexOf(sel)];
        _saveProfileAndRegenerate({goal:g},'Ziel gespeichert ✨');
      ">Speichern</button>
    </div>
  `, 'Ziel');
}

function editExperience() {
  const cur = state.user.experience;
  const opts = [['beginner','🌱','Einsteiger','< 6 Monate Training'],['intermediate','⚡','Fortgeschritten','6 Monate – 3 Jahre'],['advanced','🔥','Erfahren','3+ Jahre / Wettkampf']];
  showModal(`
    <div class="modal-body">
      <div class="choices">
        ${opts.map(([k,icon,title,sub]) => `
          <div class="choice ${cur===k?'selected':''}" onclick="
            document.querySelectorAll('#modal-overlay .choice').forEach(c=>c.classList.remove('selected'));
            this.classList.add('selected');
          ">
            <div class="choice-icon">${icon}</div>
            <div class="choice-content"><div class="choice-title">${title}</div><div class="choice-sub">${sub}</div></div>
            <div class="choice-check"></div>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-primary" style="margin-top:16px;" onclick="
        const sel=document.querySelector('#modal-overlay .choice.selected');
        if(!sel)return;
        const e=['beginner','intermediate','advanced'][[...document.querySelectorAll('#modal-overlay .choice')].indexOf(sel)];
        _saveProfileAndRegenerate({experience:e},'Level gespeichert ✨');
      ">Speichern</button>
    </div>
  `, 'Level');
}

function editLocation() {
  const cur = state.user.location;
  const opts = [['gym','🏋️','Fitnessstudio','Hanteln, Maschinen, Kabelzug'],['home','🏠','Zuhause / Bodyweight','Kein oder wenig Equipment'],['outdoor','🌳','Outdoor / Calisthenics','Park, Klimmzugstange']];
  showModal(`
    <div class="modal-body">
      <div class="choices">
        ${opts.map(([k,icon,title,sub]) => `
          <div class="choice ${cur===k?'selected':''}" onclick="
            document.querySelectorAll('#modal-overlay .choice').forEach(c=>c.classList.remove('selected'));
            this.classList.add('selected');
          ">
            <div class="choice-icon">${icon}</div>
            <div class="choice-content"><div class="choice-title">${title}</div><div class="choice-sub">${sub}</div></div>
            <div class="choice-check"></div>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-primary" style="margin-top:16px;" onclick="
        const sel=document.querySelector('#modal-overlay .choice.selected');
        if(!sel)return;
        const l=['gym','home','outdoor'][[...document.querySelectorAll('#modal-overlay .choice')].indexOf(sel)];
        _saveProfileAndRegenerate({location:l},'Trainingsort gespeichert ✨');
      ">Speichern</button>
    </div>
  `, 'Trainingsort');
}

function regeneratePlan() {
  if (confirm('Plan neu generieren? Deine bestehenden Workout-Logs bleiben erhalten.')) {
    state.currentPlan = generate4WeekPlan(state.user);
    state.viewingWeekIndex = findCurrentWeekIndex();
    saveState();
    showToast('Plan neu generiert ✨');
    switchTab('home');
  }
}

function resetApp() {
  if (confirm('Wirklich alles zurücksetzen? Alle Daten gehen verloren.')) {
    try { if (storageAvailable) localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    location.reload();
  }
}

// --- Retro Logger ---

function openRetroLogger() {
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() - 30);

  const todayStr = today.toISOString().split('T')[0];
  const minStr = minDate.toISOString().split('T')[0];

  showModal(`
    <div class="modal-body">
      <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 20px;">
        Wähle ein vergangenes Datum um ein Workout nachzutragen.
      </p>
      <div style="margin-bottom: 20px;">
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-muted); letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 8px;">Datum</div>
        <input type="date" id="retro-date" max="${todayStr}" min="${minStr}" value="${todayStr}"
          style="width: 100%; background: var(--bg-deep); border: 1px solid var(--border); border-radius: 10px;
          padding: 14px 16px; font-family: 'JetBrains Mono', monospace; font-size: 16px;
          color: var(--text-primary); outline: none;"
          onchange="loadRetroWorkouts(this.value)">
      </div>
      <div id="retro-workout-list"></div>
    </div>
  `, 'Workout nachtragen');

  setTimeout(() => loadRetroWorkouts(todayStr), 50);
}

function loadRetroWorkouts(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  const dayIdx = getDayIndex(date);
  // Find the week containing this date
  let planDay = null;
  if (Array.isArray(state.currentPlan)) {
    const week = state.currentPlan.find(w => {
      const we = new Date(w.startDate + 'T00:00:00');
      we.setDate(we.getDate() + 6);
      return w.startDate <= dateStr && dateStr <= we.toISOString().split('T')[0];
    });
    if (week) planDay = week.days[dayIdx];
  }
  const existingLogs = state.workoutLogs[dateStr] || {};

  const container = document.getElementById('retro-workout-list');
  if (!container) return;

  let html = `<div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-muted); letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 12px;">
    ${date.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })}
  </div>`;

  const plannedWorkouts = planDay ? planDay.workouts : [];

  if (plannedWorkouts.length > 0) {
    html += `<div style="margin-bottom: 8px; font-size: 13px; color: var(--text-secondary);">Geplante Workouts:</div>`;
    plannedWorkouts.forEach(w => {
      const done = existingLogs[w.id]?.completed;
      const info = SPORT_INFO[w.type];
      html += `
        <div class="exercise-pick-row" onclick="closeModal(); openWorkout('${w.id}', '${dateStr}')">
          <div>
            <div style="font-size: 15px; font-weight: 600;">${w.title}</div>
            <div style="font-size: 12px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">
              ${info.label.toUpperCase()} · ${w.duration} MIN ${done ? '· ✓ Bereits eingetragen' : ''}
            </div>
          </div>
          <div style="color: var(--accent); font-size: 20px;">${done ? '✓' : '→'}</div>
        </div>
      `;
    });
  } else {
    html += `<div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 12px;">Pause-Tag — kein Plan für diesen Tag.</div>`;
  }

  html += `
    <div style="border-top: 1px solid var(--border); margin: 16px 0;"></div>
    <div style="margin-bottom: 8px; font-size: 13px; color: var(--text-secondary);">Oder eigenes Workout erstellen:</div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
      ${[['kraft','💪','Kraft'],['lauf','🏃','Laufen'],['rad','🚴','Rad'],['schwimm','🏊','Schwimmen']].map(([type, icon, label]) => `
        <button class="btn btn-secondary" style="font-size: 14px;" onclick="createCustomWorkout('${dateStr}','${type}')">
          ${icon} ${label}
        </button>
      `).join('')}
    </div>
  `;

  container.innerHTML = html;
}

function createCustomWorkout(dateStr, type) {
  const id = `__custom_${type}_${dateStr}_${Date.now()}`;
  const info = SPORT_INFO[type];
  const isKraft = type === 'kraft';
  const location = state.user?.location || 'gym';
  const libKey = getLibraryKey('full', location);
  const defaultExercises = isKraft ? (EXERCISE_LIBRARY[libKey] || []).map((e, i) => ({ ...e, id: `ex-custom-${i}` })) : [];

  const customMeta = {
    id,
    type,
    title: `Custom — ${info.label}`,
    duration: CONFIG.WORKOUT_DURATIONS[type === 'kraft' ? 'KRAFT_BASE' : type === 'lauf' ? 'LAUF_Z2' : type === 'rad' ? 'RAD_Z2' : 'SCHWIMMEN'],
    exercises: defaultExercises,
    details: ''
  };

  if (!state.workoutLogs[dateStr]) state.workoutLogs[dateStr] = {};
  state.workoutLogs[dateStr][id] = {
    isCustom: true,
    customMeta,
    sets: {},
    completed: false
  };
  saveState();
  closeModal();
  openWorkout(id, dateStr);
}

// --- Nav / Tabs ---

function switchTab(tab) {
  if (tab === 'home') renderHome();
  else if (tab === 'stats') renderStats();
  else if (tab === 'profile') renderProfile();
}

function updateNav() {
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.tab === state.currentTab);
  });
}

// === MODAL HELPERS ===

function showModal(content, title = '') {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div class="modal-title">${title}</div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      ${content}
    </div>
  `;
  document.body.appendChild(overlay);
}

function closeModal() {
  document.getElementById('modal-overlay')?.remove();
}

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function showSettings() {
  showModal(`
    <div class="modal-body">
      <div style="text-align: center; padding: 20px;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚙</div>
        <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 24px;">
          Im Prototyp noch nicht implementiert.<br>
          Aber so sieht Settings später aus.
        </div>
      </div>
    </div>
  `, 'Einstellungen');
}

// === INIT ===

(function init() {
  const loaded = loadState();
  if (loaded && state.user && state.currentPlan) {
    state.viewingWeekIndex = findCurrentWeekIndex();
    document.getElementById('header-section').classList.remove('hidden');
    document.getElementById('bottom-nav').classList.remove('hidden');
    renderHome();
  } else {
    state.onboardingStep = 0;
    renderOnboarding();
  }
  if (!storageAvailable) {
    setTimeout(() => showToast('⚠ Speicher nicht verfügbar (privater Modus?) — Daten gehen beim Schliessen verloren'), 200);
  }
})();

