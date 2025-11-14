// script.js - Fully functional stopwatch with lap support
(() => {
  // DOM elements
  const timerEl = document.getElementById('timer');
  const startPauseBtn = document.getElementById('startPauseBtn');
  const lapBtn = document.getElementById('lapBtn');
  const resetBtn = document.getElementById('resetBtn');
  const lapsList = document.getElementById('lapsList');
  const clearLapsBtn = document.getElementById('clearLapsBtn');
  const exportLapsBtn = document.getElementById('exportLapsBtn');

  // State
  let running = false;
  let rafId = null;
  let startTime = 0;            // performance.now() when started
  let elapsedBeforeStart = 0;   // ms accumulated from prior runs
  let laps = [];                // array of {timeMs, deltaMs}
  
  // Format milliseconds into HH:MM:SS.CS (centiseconds)
  function formatTime(ms){
    const totalCentis = Math.floor(ms / 10); // centiseconds (hundredths)
    const centis = totalCentis % 100;
    const totalSeconds = Math.floor(totalCentis / 100);
    const secs = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const mins = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    const pad = (n, d=2)=> String(n).padStart(d,'0');
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}.${pad(centis)}`;
  }

  // Compute current elapsed ms
  function getElapsedMs(){
    if (!running) return elapsedBeforeStart;
    return (performance.now() - startTime) + elapsedBeforeStart;
  }

  // UI update loop
  function update(){
    const ms = getElapsedMs();
    timerEl.textContent = formatTime(ms);
    rafId = requestAnimationFrame(update);
  }

  // Start the stopwatch
  function start(){
    if (running) return;
    startTime = performance.now();
    running = true;
    startPauseBtn.textContent = 'Pause';
    startPauseBtn.setAttribute('aria-pressed','true');
    lapBtn.disabled = false;
    resetBtn.disabled = false;
    clearLapsBtn.disabled = laps.length === 0 ? true : false;
    exportLapsBtn.disabled = laps.length === 0 ? true : false;
    rafId = requestAnimationFrame(update);
  }

  // Pause the stopwatch
  function pause(){
    if (!running) return;
    // accumulate elapsed
    elapsedBeforeStart = getElapsedMs();
    running = false;
    startPauseBtn.textContent = 'Start';
    startPauseBtn.setAttribute('aria-pressed','false');
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  // Reset to zero and clear times (keeps laps? We'll clear laps too)
  function reset(){
    pause();
    elapsedBeforeStart = 0;
    timerEl.textContent = formatTime(0);
    laps = [];
    renderLaps();
    lapBtn.disabled = true;
    resetBtn.disabled = true;
    clearLapsBtn.disabled = true;
    exportLapsBtn.disabled = true;
  }

  // Record a lap
  function lap(){
    const current = getElapsedMs();
    const previousTime = laps.length ? laps[laps.length - 1].timeMs : 0;
    const delta = current - previousTime;
    const entry = {
      timeMs: current,
      deltaMs: delta,
      idx: laps.length + 1,
      iso: new Date().toISOString()
    };
    laps.push(entry);
    renderLaps();
    clearLapsBtn.disabled = false;
    exportLapsBtn.disabled = false;
  }

  // Render laps list
  function renderLaps(){
    lapsList.innerHTML = '';
    if (laps.length === 0){
      const li = document.createElement('li');
      li.className = 'lap-item';
      li.innerHTML = `<div class="lap-index" style="color:var(--muted)">No laps yet</div>`;
      lapsList.appendChild(li);
      return;
    }

    // compute fastest and slowest lap (by delta)
    const deltas = laps.map(l => l.deltaMs);
    const minDelta = Math.min(...deltas);
    const maxDelta = Math.max(...deltas);

    // show newest first (typical stopwatch behavior)
    for (let i = laps.length - 1; i >= 0; i--){
      const lap = laps[i];
      const li = document.createElement('li');
      li.className = 'lap-item';
      // tag fastest/slowest
      let badge = '';
      if (lap.deltaMs === minDelta && laps.length > 1){
        badge = `<span style="color:var(--accent);font-weight:700;margin-left:8px">Fastest</span>`;
      } else if (lap.deltaMs === maxDelta && laps.length > 1){
        badge = `<span style="color:var(--danger);font-weight:700;margin-left:8px">Slowest</span>`;
      }
      li.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
          <div class="lap-index">#${lap.idx}</div>
          <div>
            <div class="lap-time">${formatTime(lap.timeMs)}</div>
            <div class="lap-diff">+ ${formatTime(lap.deltaMs)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${badge}
          <button class="btn small" data-delete-index="${lap.idx}" title="Delete lap">Delete</button>
        </div>
      `;
      lapsList.appendChild(li);
    }
    // attach delete listeners
    Array.from(lapsList.querySelectorAll('button[data-delete-index]')).forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(btn.getAttribute('data-delete-index'));
        // remove lap with that idx (idx corresponds to original numbering)
        laps = laps.filter(l => l.idx !== idx);
        // reindex
        laps = laps.map((l, i) => ({...l, idx: i + 1}));
        renderLaps();
        if (laps.length === 0){
          clearLapsBtn.disabled = true;
          exportLapsBtn.disabled = true;
        }
      });
    });
  }

  // Clear all laps
  function clearLaps(){
    laps = [];
    renderLaps();
    clearLapsBtn.disabled = true;
    exportLapsBtn.disabled = true;
  }

  // Export laps as CSV and prompt download
  function exportLaps(){
    if (laps.length === 0) return;
    const headers = ['LapIndex','Time (ms)','Time (HH:MM:SS.CS)','Delta (ms)','Delta (HH:MM:SS.CS)','ISO'];
    const rows = laps.map(l => [
      l.idx,
      Math.round(l.timeMs),
      formatTime(l.timeMs),
      Math.round(l.deltaMs),
      formatTime(l.deltaMs),
      l.iso
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stopwatch_laps_${new Date().toISOString().replace(/[:.]/g,'-')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Keyboard support
  function handleKey(e){
    // Space toggles start/pause, L for lap, R for reset
    if (e.code === 'Space'){
      e.preventDefault();
      startPauseToggle();
    } else if (e.key.toLowerCase() === 'l'){
      if (!lapBtn.disabled) lap();
    } else if (e.key.toLowerCase() === 'r'){
      reset();
    }
  }

  // Toggle start/pause
  function startPauseToggle(){
    if (running) pause();
    else start();
  }

  // Attach event listeners
  startPauseBtn.addEventListener('click', startPauseToggle);
  lapBtn.addEventListener('click', lap);
  resetBtn.addEventListener('click', reset);
  clearLapsBtn.addEventListener('click', clearLaps);
  exportLapsBtn.addEventListener('click', exportLaps);
  document.addEventListener('keydown', handleKey);

  // init
  reset();
  // render empty laps state
  renderLaps();

  // expose for debugging (optional)
  window.__stopwatch = {
    start, pause, reset, lap, getElapsedMs, formatTime, getState: () => ({ running, elapsedBeforeStart, laps })
  };
})();
