// ============================================================
// STATE & PERSISTENCE
// ============================================================

let state = {
  user: null,
  currentTab: 'home',
  selectedDayIndex: null,
  onboardingStep: 0,
  onboardingData: {
    sports: [],
    equipment: 'gym',
    location: 'gym',
    weeklyVolume: { kraft: 3, lauf: 2, rad: 1, schwimm: 0 },
    experience: 'intermediate',
    goal: 'recomp',
    daysPerWeek: 5
  },
  todayCheckin: null,
  workoutLogs: {}, // { 'YYYY-MM-DD': { workoutId: { ...completion data } } }
  currentPlan: null
};

async function saveState() {
  try {
    await window.storage.set('app-state', JSON.stringify({
      user: state.user,
      todayCheckin: state.todayCheckin,
      workoutLogs: state.workoutLogs,
      currentPlan: state.currentPlan
    }));
  } catch (err) { console.error('Save failed:', err); }
}

async function loadState() {
  try {
    const result = await window.storage.get('app-state');
    if (result && result.value) {
      const saved = JSON.parse(result.value);
      Object.assign(state, saved);
      return true;
    }
  } catch (err) {
    // Key doesn't exist yet - normal for first run
  }
  return false;
}

// ============================================================
// PLAN GENERATOR
// ============================================================

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
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const plan = {};
  
  const totalKraft = data.weeklyVolume.kraft;
  const totalLauf = data.weeklyVolume.lauf;
  const totalRad = data.weeklyVolume.rad;
  const totalSchwimm = data.weeklyVolume.schwimm;
  
  // Initialize all days as rest
  days.forEach((d, i) => {
    plan[i] = { day: d, workouts: [] };
  });
  
  // Strategy: Distribute workouts intelligently
  // Rule 1: Don't put intervals after legs (24h gap)
  // Rule 2: Long run gets a pre-day with no legs
  // Rule 3: Rest days are placed strategically
  
  let kraftCount = totalKraft;
  let laufCount = totalLauf;
  let radCount = totalRad;
  let schwimmCount = totalSchwimm;
  
  // KRAFT-Verteilung
  const kraftDays = [];
  if (kraftCount === 1) kraftDays.push(1); // Tue
  else if (kraftCount === 2) kraftDays.push(1, 4); // Tue, Fri
  else if (kraftCount === 3) {
    if (totalLauf >= 2) {
      kraftDays.push(0, 2, 6); // Mo, Mi, So - Long Run Sa, Legs So
    } else {
      kraftDays.push(0, 2, 4); // Mo, Mi, Fr
    }
  } else if (kraftCount === 4) kraftDays.push(0, 2, 4, 6);
  else if (kraftCount >= 5) kraftDays.push(0, 1, 3, 4, 6);
  
  // Generate Kraft workouts
  const splits = data.experience === 'beginner' || kraftCount <= 2 
    ? ['full', 'full', 'full', 'full', 'full']
    : kraftCount === 3
      ? ['full', 'upper', 'legs']
      : kraftCount === 4
        ? ['push', 'pull', 'legs', 'upper']
        : ['push', 'pull', 'legs', 'upper', 'full'];
  
  kraftDays.forEach((dayIdx, i) => {
    const split = splits[i] || 'full';
    const exerciseKey = `${split}_${data.location === 'home' ? 'home' : 'gym'}`;
    const exercises = EXERCISE_LIBRARY[exerciseKey] || EXERCISE_LIBRARY.full_gym;
    
    plan[dayIdx].workouts.push({
      id: `kraft-${dayIdx}`,
      type: 'kraft',
      title: `Kraft — ${split === 'push' ? 'Push' : split === 'pull' ? 'Pull' : split === 'legs' ? 'Legs' : split === 'upper' ? 'Oberkörper' : 'Ganzkörper'}`,
      duration: 45 + (data.experience === 'advanced' ? 15 : 0),
      time: 'Abend',
      exercises: exercises.map((e, idx) => ({
        id: `ex-${dayIdx}-${idx}`,
        ...e
      })),
      isLegs: split === 'legs' || split === 'full'
    });
  });
  
  // LAUF-Verteilung — wichtig: kein Intervall nach Legs
  if (laufCount > 0) {
    const laufTypes = [];
    if (laufCount >= 1) laufTypes.push('long');
    if (laufCount >= 2) laufTypes.push('intervall');
    if (laufCount >= 3) laufTypes.push('z2');
    if (laufCount >= 4) laufTypes.push('tempo');
    
    // Find day for long run (Saturday preferred, day after rest if possible)
    if (laufTypes.includes('long')) {
      const longDay = laufCount >= 3 || !kraftDays.includes(5) ? 5 : 6; // Sat or Sun
      plan[longDay].workouts.push(createLaufWorkout('long', longDay, data));
    }
    
    if (laufTypes.includes('intervall')) {
      // Find day NOT after legs
      let day = 1; // Tue default
      const legsDays = kraftDays.filter((_, i) => splits[i] === 'legs' || splits[i] === 'full');
      // Try Wed if Tue is legs day
      if (kraftDays.includes(1) && (splits[kraftDays.indexOf(1)] === 'legs' || splits[kraftDays.indexOf(1)] === 'full')) {
        day = 3; // Thu instead
      }
      // Avoid placing on a leg day
      while (legsDays.some(d => Math.abs(d - day) === 1 && d < day)) {
        day++;
      }
      if (day > 5) day = 3;
      plan[day].workouts.push(createLaufWorkout('intervall', day, data));
    }
    
    if (laufTypes.includes('z2')) {
      const day = 3; // Thu
      if (!plan[day].workouts.length) {
        plan[day].workouts.push(createLaufWorkout('z2', day, data));
      }
    }
    
    if (laufTypes.includes('tempo')) {
      const day = 4; // Fri
      if (!plan[day].workouts.find(w => w.type === 'lauf')) {
        plan[day].workouts.push(createLaufWorkout('tempo', day, data));
      }
    }
  }
  
  // RAD-Verteilung
  if (radCount > 0) {
    const radDays = [];
    if (radCount === 1) radDays.push(3); // Thu
    else if (radCount === 2) radDays.push(2, 5);
    else radDays.push(1, 3, 5);
    
    radDays.forEach((dayIdx, i) => {
      // If kraft is also on this day, mark as combined
      const isCombined = plan[dayIdx].workouts.some(w => w.type === 'kraft');
      plan[dayIdx].workouts.push({
        id: `rad-${dayIdx}`,
        type: 'rad',
        title: i === 0 ? 'Rad — Z2 Grundlage' : i === 1 ? 'Rad — Tempo' : 'Rad — Long',
        duration: i === 2 ? 90 : 60,
        time: isCombined ? 'Nach Kraft' : 'Morgen',
        details: i === 0 ? 'HF-Zone 2, locker' : i === 1 ? 'Sweet Spot 88-93% FTP' : 'Lockerer Long Ride',
        exercises: []
      });
    });
  }
  
  // SCHWIMM-Verteilung
  if (schwimmCount > 0) {
    const schwimmDays = schwimmCount === 1 ? [2] : [2, 5];
    schwimmDays.forEach((dayIdx, i) => {
      plan[dayIdx].workouts.push({
        id: `schwimm-${dayIdx}`,
        type: 'schwimm',
        title: 'Schwimmen — Technik & Ausdauer',
        duration: 45,
        time: 'Morgen',
        details: i === 0 ? '8x100m + Technik' : '2000m Long Swim',
        exercises: []
      });
    });
  }
  
  return plan;
}

function createLaufWorkout(type, dayIdx, data) {
  const workouts = {
    long: {
      title: 'Long Run',
      duration: 90,
      details: 'Lockeres Tempo, HF-Zone 2',
      time: 'Morgen'
    },
    intervall: {
      title: 'Intervall — Speed',
      duration: 60,
      details: '6×1km @ Renntempo / 90s Pause',
      time: 'Morgen'
    },
    z2: {
      title: 'Z2 — Grundlage',
      duration: 45,
      details: 'Locker, Konversationstempo',
      time: 'Morgen'
    },
    tempo: {
      title: 'Tempo — Schwellentempo',
      duration: 50,
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

// ============================================================
// ONBOARDING
// ============================================================

const ONBOARDING_STEPS = [
  'welcome',
  'sports',
  'location',
  'experience',
  'goal',
  'volume',
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
        <div class="choice ${sports.includes('kraft') ? 'selected' : ''}" onclick="toggleSport('kraft')">
          <div class="choice-icon">💪</div>
          <div class="choice-content">
            <div class="choice-title">Krafttraining</div>
            <div class="choice-sub">Muskeln aufbauen, stärker werden</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${sports.includes('lauf') ? 'selected' : ''}" onclick="toggleSport('lauf')">
          <div class="choice-icon">🏃</div>
          <div class="choice-content">
            <div class="choice-title">Laufen</div>
            <div class="choice-sub">5K bis Marathon</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${sports.includes('rad') ? 'selected' : ''}" onclick="toggleSport('rad')">
          <div class="choice-icon">🚴</div>
          <div class="choice-content">
            <div class="choice-title">Radfahren</div>
            <div class="choice-sub">Indoor (Zwift) oder Outdoor</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${sports.includes('schwimm') ? 'selected' : ''}" onclick="toggleSport('schwimm')">
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
        <button class="btn btn-primary" onclick="nextStep()" ${sports.length === 0 ? 'disabled' : ''}>Weiter</button>
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
        <div class="choice ${loc === 'gym' ? 'selected' : ''}" onclick="setLocation('gym')">
          <div class="choice-icon">🏋️</div>
          <div class="choice-content">
            <div class="choice-title">Fitnessstudio</div>
            <div class="choice-sub">Hanteln, Maschinen, Kabelzug</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${loc === 'home' ? 'selected' : ''}" onclick="setLocation('home')">
          <div class="choice-icon">🏠</div>
          <div class="choice-content">
            <div class="choice-title">Zuhause / Bodyweight</div>
            <div class="choice-sub">Kein oder wenig Equipment</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${loc === 'outdoor' ? 'selected' : ''}" onclick="setLocation('outdoor')">
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
        <div class="choice ${exp === 'beginner' ? 'selected' : ''}" onclick="setExperience('beginner')">
          <div class="choice-icon">🌱</div>
          <div class="choice-content">
            <div class="choice-title">Einsteiger</div>
            <div class="choice-sub">Weniger als 6 Monate Training</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${exp === 'intermediate' ? 'selected' : ''}" onclick="setExperience('intermediate')">
          <div class="choice-icon">⚡</div>
          <div class="choice-content">
            <div class="choice-title">Fortgeschritten</div>
            <div class="choice-sub">6 Monate bis 3 Jahre Training</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${exp === 'advanced' ? 'selected' : ''}" onclick="setExperience('advanced')">
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
        <div class="choice ${goal === 'recomp' ? 'selected' : ''}" onclick="setGoal('recomp')">
          <div class="choice-icon">🎯</div>
          <div class="choice-content">
            <div class="choice-title">Body Recomposition</div>
            <div class="choice-sub">Muskeln aufbauen + Fett verlieren</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${goal === 'race' ? 'selected' : ''}" onclick="setGoal('race')">
          <div class="choice-icon">🏁</div>
          <div class="choice-content">
            <div class="choice-title">Wettkampf-Vorbereitung</div>
            <div class="choice-sub">Halbmarathon, Triathlon, Hyrox</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${goal === 'strength' ? 'selected' : ''}" onclick="setGoal('strength')">
          <div class="choice-icon">💪</div>
          <div class="choice-content">
            <div class="choice-title">Kraft & Muskelaufbau</div>
            <div class="choice-sub">Hauptfokus auf Hypertrophie</div>
          </div>
          <div class="choice-check"></div>
        </div>
        <div class="choice ${goal === 'fitness' ? 'selected' : ''}" onclick="setGoal('fitness')">
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
                ${vol[s.key]}<span class="slider-value-label">×/Wo</span>
              </div>
            </div>
            <input type="range" min="0" max="${s.max}" value="${vol[s.key]}" 
              oninput="updateVolume('${s.key}', this.value)">
          </div>
        `;
      }
    });
    
    const total = Object.entries(vol).filter(([k]) => sports.includes(k)).reduce((s, [_, v]) => s + parseInt(v), 0);
    const tooMuch = total > 7;
    
    html += `
      <div style="text-align: center; margin: 16px 0; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: ${tooMuch ? 'var(--danger)' : 'var(--text-secondary)'};">
        Total: ${total} Einheiten / Woche ${tooMuch ? '⚠ zu viel — wir empfehlen max. 7' : ''}
      </div>
      <div class="btn-row">
        <button class="btn btn-secondary" onclick="prevStep()">Zurück</button>
        <button class="btn btn-primary" onclick="nextStep()" ${total === 0 ? 'disabled' : ''}>Weiter</button>
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
      state.currentPlan = generatePlan(state.onboardingData);
      state.user = {
        name: state.onboardingData.name || 'Athlet',
        ...state.onboardingData
      };
      saveState();
      state.onboardingStep++;
      renderOnboarding();
    }, 1800);
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
  if (idx >= 0) sports.splice(idx, 1);
  else sports.push(sport);
  // Set volume to 0 for unselected
  if (idx >= 0) state.onboardingData.weeklyVolume[sport] = 0;
  else if (state.onboardingData.weeklyVolume[sport] === 0) {
    state.onboardingData.weeklyVolume[sport] = sport === 'kraft' ? 3 : sport === 'lauf' ? 2 : 1;
  }
  renderOnboarding();
}

function setLocation(loc) { state.onboardingData.location = loc; renderOnboarding(); }
function setExperience(exp) { state.onboardingData.experience = exp; renderOnboarding(); }
function setGoal(goal) { state.onboardingData.goal = goal; renderOnboarding(); }

function updateVolume(sport, val) {
  state.onboardingData.weeklyVolume[sport] = parseInt(val);
  renderOnboarding();
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

// ============================================================
// HOME / DASHBOARD
// ============================================================

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getDayIndex(date = new Date()) {
  // Mon=0, Sun=6
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
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
  
  const todayIdx = getDayIndex();
  const today = state.currentPlan[todayIdx];
  const todayKey = getTodayKey();
  const completedToday = (state.workoutLogs[todayKey] || {});
  
  let totalThisWeek = 0;
  let completedThisWeek = 0;
  Object.values(state.currentPlan).forEach(d => {
    totalThisWeek += d.workouts.length;
  });
  Object.values(state.workoutLogs).forEach(dayLogs => {
    completedThisWeek += Object.values(dayLogs).filter(w => w.completed).length;
  });
  
  const checkinDone = state.todayCheckin && state.todayCheckin.date === todayKey;
  
  let html = `
    <div class="dashboard-greeting">
      <div class="greeting-tag">${new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      <div class="greeting-text">${getGreeting()}, <span class="accent">${state.user.name}</span>.</div>
    </div>
    
    <div class="stats-bar">
      <div class="stat">
        <div class="stat-value accent">${completedThisWeek}</div>
        <div class="stat-label">Diese Woche</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalThisWeek}</div>
        <div class="stat-label">Total geplant</div>
      </div>
      <div class="stat">
        <div class="stat-value">${getStreak()}</div>
        <div class="stat-label">🔥 Streak</div>
      </div>
    </div>
    
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
  
  // Today's workouts
  if (today.workouts.length > 0) {
    html += `<div class="section">
      <div class="section-header">
        <h3 class="section-title">HEUTE — ${today.day}</h3>
      </div>
      <div class="workout-list">`;
    today.workouts.forEach(w => {
      html += renderWorkoutCard(w, todayKey, completedToday[w.id]?.completed);
    });
    html += `</div></div>`;
  } else {
    html += `<div class="section">
      <div class="section-header">
        <h3 class="section-title">HEUTE — ${today.day}</h3>
      </div>
      <div class="workout-card rest" style="text-align: center;">
        <div style="padding: 20px;">
          <div style="font-size: 32px; margin-bottom: 8px;">😴</div>
          <div style="font-weight: 600; margin-bottom: 4px;">Pause-Tag</div>
          <div style="font-size: 13px; color: var(--text-secondary);">Aktive Erholung empfohlen — Spaziergang oder Stretching</div>
        </div>
      </div>
    </div>`;
  }
  
  // Week overview
  html += `<div class="section">
    <div class="section-header">
      <h3 class="section-title">WOCHE</h3>
    </div>
    <div class="week-grid">`;
  
  Object.entries(state.currentPlan).forEach(([idx, day]) => {
    const isToday = parseInt(idx) === todayIdx;
    const hasWorkout = day.workouts.length > 0;
    const dayDate = getDateForDayIndex(parseInt(idx));
    const dayKey = dayDate.toISOString().split('T')[0];
    const dayLogs = state.workoutLogs[dayKey] || {};
    const allCompleted = hasWorkout && day.workouts.every(w => dayLogs[w.id]?.completed);
    
    html += `
      <div class="day-cell ${isToday ? 'today' : ''}" onclick="openDay(${idx})">
        <div class="day-name">${day.day}</div>
        <div class="day-num">${dayDate.getDate()}</div>
        <div class="day-dot ${allCompleted ? 'completed' : hasWorkout ? 'has-workout' : ''}"></div>
      </div>
    `;
  });
  
  html += `</div>
  </div>`;
  
  // Upcoming
  const upcoming = [];
  for (let i = 1; i <= 3; i++) {
    const idx = (todayIdx + i) % 7;
    const day = state.currentPlan[idx];
    if (day.workouts.length > 0) {
      upcoming.push({ idx, day });
    }
  }
  
  if (upcoming.length > 0) {
    html += `<div class="section">
      <div class="section-header">
        <h3 class="section-title">ALS NÄCHSTES</h3>
      </div>
      <div class="workout-list">`;
    upcoming.slice(0, 2).forEach(({ idx, day }) => {
      day.workouts.forEach(w => {
        const dayDate = getDateForDayIndex(idx);
        const dayKey = dayDate.toISOString().split('T')[0];
        html += `<div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-muted); letter-spacing: 0.15em; margin-top: 4px;">${day.day.toUpperCase()} · ${dayDate.toLocaleDateString('de-CH', { day: 'numeric', month: 'short' }).toUpperCase()}</div>`;
        html += renderWorkoutCard(w, dayKey, false);
      });
    });
    html += `</div></div>`;
  }
  
  document.getElementById('content').innerHTML = html;
}

function getDateForDayIndex(idx) {
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
  for (let i = 0; i < 30; i++) {
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

// ============================================================
// CHECK-IN MODAL
// ============================================================

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

// ============================================================
// WORKOUT TRACKING MODAL
// ============================================================

function openWorkout(workoutId, dayKey) {
  // Find workout
  let workout = null;
  Object.values(state.currentPlan).forEach(day => {
    day.workouts.forEach(w => {
      if (w.id === workoutId) workout = w;
    });
  });
  if (!workout) return;
  
  const log = (state.workoutLogs[dayKey] || {})[workoutId] || { sets: {}, completed: false };
  const info = SPORT_INFO[workout.type];
  
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
  
  if (workout.type === 'kraft' && workout.exercises) {
    workout.exercises.forEach((ex, exIdx) => {
      const exLog = log.sets[ex.id] || {};
      let progressCount = 0;
      for (let s = 1; s <= ex.sets; s++) {
        if (exLog[`set${s}`]?.checked) progressCount++;
      }
      
      html += `
        <div class="exercise-card">
          <div class="exercise-header">
            <div>
              <div class="exercise-name">${ex.name}</div>
              <div class="exercise-meta">${ex.sets}×${ex.reps}${ex.equipment !== '-' ? ' · ' + ex.equipment : ''}</div>
            </div>
            <div class="exercise-progress">${progressCount}/${ex.sets}</div>
          </div>
          <div class="set-headers">
            <div>SET</div>
            <div>KG</div>
            <div>WDH</div>
            <div>✓</div>
          </div>
          <div class="set-grid">
      `;
      
      for (let s = 1; s <= ex.sets; s++) {
        const setData = exLog[`set${s}`] || {};
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
          </div>
        `;
      }
      
      html += `</div></div>`;
    });
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
  
  // Complete button
  html += `
      <button class="btn btn-primary" onclick="completeWorkout('${dayKey}','${workoutId}')" style="margin-top: 16px;">
        ${log.completed ? '✓ Workout abgeschlossen' : 'Workout abschliessen'}
      </button>
    </div>
  `;
  
  showModal(html, workout.title);
}

function ensureLog(dayKey, workoutId) {
  if (!state.workoutLogs[dayKey]) state.workoutLogs[dayKey] = {};
  if (!state.workoutLogs[dayKey][workoutId]) {
    state.workoutLogs[dayKey][workoutId] = { sets: {}, completed: false };
  }
  return state.workoutLogs[dayKey][workoutId];
}

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
  openWorkout(workoutId, dayKey); // rerender
}

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

// ============================================================
// DAY DETAIL
// ============================================================

function openDay(idx) {
  const day = state.currentPlan[idx];
  const dayDate = getDateForDayIndex(idx);
  const dayKey = dayDate.toISOString().split('T')[0];
  const logs = state.workoutLogs[dayKey] || {};
  
  let html = `<div class="modal-body">`;
  
  if (day.workouts.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">😴</div>
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Pause-Tag</div>
        <div>Heute Erholung — dein Körper baut Muskeln und Ausdauer am Pause-Tag.</div>
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

// ============================================================
// STATS PAGE
// ============================================================

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
        // Extract type from workout id (e.g., 'kraft-0', 'lauf-long-2')
        const type = wid.split('-')[0];
        if (byType[type] !== undefined) byType[type]++;
        
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
            <div class="bar-label">${SPORT_INFO[type].label.substr(0, 4)}</div>
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

// ============================================================
// PROFILE PAGE
// ============================================================

function renderProfile() {
  state.currentTab = 'profile';
  updateNav();
  
  const u = state.user;
  const sportLabels = u.sports.map(s => `${SPORT_INFO[s].icon} ${SPORT_INFO[s].label}`).join(' · ');
  
  let html = `
    <div class="dashboard-greeting">
      <div class="greeting-tag">DEIN PROFIL</div>
      <div class="greeting-text">${u.name}</div>
    </div>
    
    <div class="stat-card-big">
      <div class="stat-card-label" style="margin-bottom: 12px;">SPORTARTEN</div>
      <div style="font-size: 16px;">${sportLabels}</div>
    </div>
    
    <div class="stat-card-big">
      <div class="stat-card-label" style="margin-bottom: 12px;">ZIEL</div>
      <div style="font-size: 16px;">${
        u.goal === 'recomp' ? '🎯 Body Recomposition' :
        u.goal === 'race' ? '🏁 Wettkampf-Vorbereitung' :
        u.goal === 'strength' ? '💪 Kraft & Muskelaufbau' :
        '✨ Allgemeine Fitness'
      }</div>
    </div>
    
    <div class="stat-card-big">
      <div class="stat-card-label" style="margin-bottom: 12px;">LEVEL</div>
      <div style="font-size: 16px;">${
        u.experience === 'beginner' ? '🌱 Einsteiger' :
        u.experience === 'intermediate' ? '⚡ Fortgeschritten' :
        '🔥 Erfahren'
      }</div>
    </div>
    
    <div class="stat-card-big">
      <div class="stat-card-label" style="margin-bottom: 12px;">TRAININGSORT</div>
      <div style="font-size: 16px;">${
        u.location === 'gym' ? '🏋️ Fitnessstudio' :
        u.location === 'home' ? '🏠 Zuhause' :
        '🌳 Outdoor'
      }</div>
    </div>
    
    <div class="stat-card-big">
      <div class="stat-card-label" style="margin-bottom: 12px;">WÖCHENTLICHES VOLUMEN</div>
      ${Object.entries(u.weeklyVolume).filter(([_, v]) => v > 0).map(([k, v]) => `
        <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px;">
          <span>${SPORT_INFO[k].icon} ${SPORT_INFO[k].label}</span>
          <span style="font-family: 'JetBrains Mono', monospace; color: var(--accent);">${v}× / Wo</span>
        </div>
      `).join('')}
    </div>
    
    <button class="btn btn-secondary" onclick="regeneratePlan()" style="margin-top: 16px;">
      🔄 Plan neu generieren
    </button>
    <button class="btn btn-ghost" onclick="resetApp()" style="margin-top: 8px; color: var(--danger);">
      Alles zurücksetzen
    </button>
    
    <div style="text-align: center; margin-top: 32px; padding: 24px;">
      <div style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-muted); letter-spacing: 0.2em;">HYBRID · PROTOTYP v0.1</div>
      <div style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">Ein Konzept-Test der Hybrid-Training-App-Idee</div>
    </div>
  `;
  
  document.getElementById('content').innerHTML = html;
}

function regeneratePlan() {
  if (confirm('Plan neu generieren? Deine bestehenden Workout-Logs bleiben erhalten.')) {
    state.currentPlan = generatePlan(state.user);
    saveState();
    showToast('Plan neu generiert ✨');
    switchTab('home');
  }
}

async function resetApp() {
  if (confirm('Wirklich alles zurücksetzen? Alle Daten gehen verloren.')) {
    try {
      await window.storage.delete('app-state');
    } catch (e) {}
    location.reload();
  }
}

// ============================================================
// NAV / TABS
// ============================================================

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

// ============================================================
// MODAL HELPERS
// ============================================================

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

// ============================================================
// INIT
// ============================================================

(async function init() {
  const loaded = await loadState();
  if (loaded && state.user && state.currentPlan) {
    document.getElementById('header-section').classList.remove('hidden');
    document.getElementById('bottom-nav').classList.remove('hidden');
    renderHome();
  } else {
    state.onboardingStep = 0;
    renderOnboarding();
  }
})();

