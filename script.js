// ===== SETTINGS =====
const rows = 5;
const cols = 4;

// ===== COLORS =====
const colorMap = {
  red: "radial-gradient(circle at 30% 30%, #ff7e7e, #ff3e3e 70%, #a30000)",
  blue: "radial-gradient(circle at 30% 30%, #82ccdd, #0a3d62 70%, #062c43)",
  green: "radial-gradient(circle at 30% 30%, #a2ffaf, #27ae60 70%, #145a32)",
  purple: "radial-gradient(circle at 30% 30%, #d982ff, #8e44ad 70%, #4a235a)",
  gold: "radial-gradient(circle at 30% 30%, #ffeaa7, #f1c40f 70%, #967117)"
};
const colors = Object.keys(colorMap);

// ===== GAME STATE =====
let score = 0;
let timeLeft = 180;
let timerInterval;
let comboMultiplier = 1;

let vocab = [];
let fullVocab = [];
let gemBoard = [];
let selectedGem = null;
let selectedCard = null;
let recyclePool = [];

// ===== DOM =====
const gemGrid = document.getElementById("gemGrid");
const cardGrid = document.getElementById("cardGrid");
const scoreDisplay = document.getElementById("score");
const timerDisplay = document.getElementById("timer");

// ===== AUDIO =====
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, duration, type = "sine") {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

const playChime = () => playTone(600, 0.25);
const playBuzz = () => playTone(150, 0.3, "square");
const playExplosion = () => playTone(90, 0.2);

// ===== LOAD VOCAB FROM URL =====
function loadVocabFromStorage() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("list");

  if (!raw) {
    alert("No vocabulary list specified.");
    return false;
  }

  const listName = decodeURIComponent(raw);
  const saved = localStorage.getItem("vocab_" + listName);

  if (!saved) {
    alert("Vocabulary list not found.");
    return false;
  }

  vocab = [];
  let id = 1;

  saved.split("\n").forEach(line => {
    const parts = line.split(",");
    if (parts.length >= 2) {
      vocab.push({
        id: id++,
        word: parts[0].trim(),
        definition: parts[1].trim()
      });
    }
  });

  fullVocab = vocab.slice(0, 20);
  return true;
}

// ===== CORE =====
function updateScore(val) {
  score += val;
  scoreDisplay.textContent = score;
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      alert("Time's up! Final score: " + score);
    }
  }, 1000);
}

// ===== POSITION =====
function positionGem(g) {
  const xOffset = 105;
  const yOffset = 85;
  g.element.style.left = g.col * xOffset + "px";
  g.element.style.top = g.row * yOffset + "px";
}

function createGemElement(g) {
  const d = document.createElement("div");
  d.className = "cell gem";
  d.style.background = colorMap[g.color];
  d.dataset.color = g.color;

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = g.word;
  d.appendChild(label);

  d.onclick = () => selectGem(g);
  return d;
}

// ===== BUILD =====
function buildBoard() {
  gemBoard = [];
  gemGrid.innerHTML = "";

  const items = [...fullVocab].sort(() => Math.random() - 0.5);
  let i = 0;

  for (let r = 0; r < rows; r++) {
    let row = [];
    gemBoard.push(row);

    for (let c = 0; c < cols; c++) {
      let item = items[i++];
      let color = colors[Math.floor(Math.random() * colors.length)];

      let g = { ...item, color, row: r, col: c };
      g.element = createGemElement(g);
      positionGem(g);

      gemGrid.appendChild(g.element);
      row.push(g);
    }
  }
}

function buildCards() {
  cardGrid.innerHTML = "";

  [...fullVocab].sort(() => Math.random() - 0.5).forEach(item => {
    let d = document.createElement("div");
    d.className = "cell card";
    d.textContent = item.definition;
    d.dataset.id = item.id;
    d.onclick = () => selectCard(d);
    cardGrid.appendChild(d);
  });
}

// ===== INTERACTION =====
function selectGem(g) {
  if (selectedGem) selectedGem.element.classList.remove("selected");
  selectedGem = g;
  g.element.classList.add("selected");
  tryMatch();
}

function selectCard(card) {
  if (selectedCard) selectedCard.classList.remove("selected");
  selectedCard = card;
  card.classList.add("selected");
  tryMatch();
}

// ===== MATCH =====
function tryMatch() {
  if (!selectedGem || !selectedCard) return;

  if (selectedGem.id === Number(selectedCard.dataset.id)) {
    playChime();
    updateScore(10);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (gemBoard[r][c] && gemBoard[r][c].id === selectedGem.id) {
          gemBoard[r][c].element.remove();
          gemBoard[r][c] = null;
        }
      }
    }

    document.querySelectorAll(".card").forEach(card => {
      if (Number(card.dataset.id) === selectedGem.id) card.remove();
    });

    resolveBoard();
  } else {
    playBuzz();
    updateScore(-2);
  }

  if (selectedGem) selectedGem.element.classList.remove("selected");
  if (selectedCard) selectedCard.classList.remove("selected");

  selectedGem = null;
  selectedCard = null;
}

// ===== COMBO TEXT =====
function showComboText(mult) {
  const text = document.createElement("div");
  text.className = "combo-text";

  text.textContent = mult < 2 ? "COMBO CLEAR!" : "x" + mult + " COMBO!";

  text.style.left = "50%";
  text.style.top = "40%";
  text.style.transform = "translate(-50%, -50%)";

  gemGrid.appendChild(text);

  setTimeout(() => text.remove(), 800);
}

// ===== MATCH FINDING =====
function findMatches() {
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const matches = [];

  function getNeighbors(r, c) {
    return [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1]
    ];
  }

  function floodFill(r, c) {
    const color = gemBoard[r][c].color;
    const stack = [[r, c]];
    const cluster = [];

    visited[r][c] = true;

    while (stack.length > 0) {
      const current = stack.pop();
      const cr = current[0];
      const cc = current[1];

      cluster.push(gemBoard[cr][cc]);

      const neighbors = getNeighbors(cr, cc);

      neighbors.forEach(n => {
        const nr = n[0];
        const nc = n[1];

        if (
          nr >= 0 && nr < rows &&
          nc >= 0 && nc < cols &&
          !visited[nr][nc] &&
          gemBoard[nr][nc] &&
          gemBoard[nr][nc].color === color
        ) {
          visited[nr][nc] = true;
          stack.push([nr, nc]);
        }
      });
    }

    return cluster;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (gemBoard[r][c] && !visited[r][c]) {
        const cluster = floodFill(r, c);
        if (cluster.length >= 3) {
          cluster.forEach(g => matches.push(g));
        }
      }
    }
  }

  return matches;
}

// ===== CLEAR MATCHES =====
function clearMatches(matches) {
  if (matches.length === 0) return;

  playExplosion();
  updateScore(20 * comboMultiplier);
  showComboText(comboMultiplier);

  comboMultiplier++;

  matches.forEach(g => {
    recyclePool.push({
      id: g.id,
      word: g.word,
      definition: g.definition
    });

    g.element.classList.add("fade-out");

    // Matches fade out and stay in place for 500ms
    setTimeout(() => {
      if (g.element) g.element.remove();
    }, 500);

    gemBoard[g.row][g.col] = null;
  });
}

// ===== GRAVITY =====
function applyGravity() {
  for (let c = 0; c < cols; c++) {
    let stack = [];

    for (let r = rows - 1; r >= 0; r--) {
      if (gemBoard[r][c]) {
        stack.push(gemBoard[r][c]);
      }
    }

    for (let r = rows - 1; r >= 0; r--) {
      let g = stack.shift() || null;
      gemBoard[r][c] = g;

      if (g) {
        g.row = r;
        positionGem(g);
      }
    }
  }
}

// ===== REFILL =====
function refillFromRecycle() {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!gemBoard[r][c] && recyclePool.length) {
        let item = recyclePool.shift();
        let color = colors[Math.floor(Math.random() * colors.length)];

        let g = {
          ...item,
          color: color,
          row: r,
          col: c
        };

        g.element = createGemElement(g);
        gemBoard[r][c] = g;
        gemGrid.appendChild(g.element);
        positionGem(g);
      }
    }
  }
}

// ===== RESOLVE LOOP =====
function resolveBoard() {
  comboMultiplier = 1;

  function step() {
    // 1. Pause 500ms so the user can see the "Match" or "Combo" before things drop
    setTimeout(() => {
      applyGravity();
      refillFromRecycle();
      
      // 2. We wait 1200ms (1.2s) for the gems to finish their slow fall 
      // before checking for new matches (combos)
      setTimeout(() => {
        let matches = findMatches();
        if (matches.length > 0) {
          clearMatches(matches);
          // Wait another second before repeating if there's a combo
          setTimeout(step, 1000); 
        }
      }, 1200); 
    }, 500); 
  }

  step();
}

// ===== INIT =====
if (loadVocabFromStorage()) {
  buildBoard();
  buildCards();
  startTimer();
}
