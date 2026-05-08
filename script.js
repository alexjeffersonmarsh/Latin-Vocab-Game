
// ===== SETTINGS =====
const rows = 5;
const cols = 4;

// Mapping colors to the 3D radial gradients from our CSS
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
const vocabInput = document.getElementById("vocabInput");
const setupScreen = document.getElementById("setupScreen");
const gameScreen = document.getElementById("gameScreen");

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

function isBoardEmpty() {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (gemBoard[r][c]) {
        return false;
      }
    }
  }
  return true;
}
//====== DEFINE ENDGAME =====

function endGame() {
  // ✅ stop the timer
  clearInterval(timerInterval);

  // ✅ speed bonus: 5 points per second remaining
  const speedBonus = timeLeft * 5;

  score += speedBonus;
  scoreDisplay.textContent = score;

  alert(
    "All matches cleared!\n\n" +
    "Speed bonus: +" + speedBonus + "\n" +
    "Final score: " + score
  );
}

// ===== CORE LOGIC =====
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

// ===== LOAD VOCAB =====
function loadVocab() {
  vocab = [];
  let id = 1;

  vocabInput.value.split("\n").forEach(line => {
    const parts = line.includes("\t") ? line.split("\t") : line.split(",");
    if (parts.length >= 2) {
      vocab.push({
        id: id++,
        word: parts[0].trim(),
        definition: parts[1].trim()
      });
    }
  });

  if (vocab.length < 20) {
    alert("Need at least 20 vocab items.");
    return;
  }

  fullVocab = vocab.slice(0, 20);
  recyclePool = [];
  score = 0;
  timeLeft = 180;
  comboMultiplier = 1;
  updateScore(0);

  buildBoard();
  buildCards();
  startTimer();

  // ✅ hide setup, show game
  setupScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
}

// ===== JEWEL CREATION & POSITION =====
function positionGem(g) {
  const xOffset = 105; // ✅ prevents horizontal overlap
  const yOffset = 85;  // ✅ prevents vertical overlap

  g.element.style.left = (g.col * xOffset) + "px";
  g.element.style.top = (g.row * yOffset) + "px";
}

function createGemElement(g) {
  const d = document.createElement("div");
  d.className = "cell gem";
  d.style.background = colorMap[g.color];

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = g.word;
  d.appendChild(label);
  d.onclick = () => selectGem(g);
  return d;
}

// ===== SAFE MATCH CHECK =====
function createsMatch(r, c, color) {
  if (!gemBoard[r]) return false;

  if (
    c >= 2 &&
    gemBoard[r][c - 1] &&
    gemBoard[r][c - 2] &&
    gemBoard[r][c - 1].color === color &&
    gemBoard[r][c - 2].color === color
  ) return true;

  if (
    r <= rows - 3 &&
    gemBoard[r + 1] &&
    gemBoard[r + 2] &&
    gemBoard[r + 1][c] &&
    gemBoard[r + 2][c] &&
    gemBoard[r + 1][c].color === color &&
    gemBoard[r + 2][c].color === color
  ) return true;

  return false;
}

// ===== BUILD BOARD =====
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
      let color;
      let attempts = 0;

      do {
        color = colors[Math.floor(Math.random() * colors.length)];
        attempts++;
      } while (createsMatch(r, c, color) && attempts < 10);

      let g = { ...item, color, row: r, col: c };
      g.element = createGemElement(g);
      positionGem(g);
      gemGrid.appendChild(g.element);
      row.push(g);
    }
  }
}

// ===== BUILD CARDS =====
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

// ===== MATCH LOGIC =====
function tryMatch() {
  if (!selectedGem || !selectedCard) return;

  // ✅ FIX: convert dataset.id to number
  if (selectedGem.id === Number(selectedCard.dataset.id)) {
    playChime();
    updateScore(10);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let g = gemBoard[r][c];
        if (g && g.id === selectedGem.id) {
          g.element.remove();
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

  selectedGem?.element.classList.remove("selected");
  selectedCard?.classList.remove("selected");
  selectedGem = null;
  selectedCard = null;
}

// ===== COMBO TEXT =====

function showComboText(mult) {
  const text = document.createElement("div");
  text.className = "combo-text";

  // Message logic
  if (mult < 2) {
    text.textContent = "COMBO CLEAR!";
  } else {
    text.textContent = `x${mult} COMBO!`;
  }

  // Center on board
  text.style.left = "50%";
  text.style.top = "40%";
  text.style.transform = "translate(-50%, -50%)";

  gemGrid.appendChild(text);

  setTimeout(() => {
    text.remove();
  }, 800);
}

// ===== FIND MATCHES =====

function findMatches() {
  const visited = Array.from({ length: rows }, () =>
    Array(cols).fill(false)
  );

  const matches = [];

  function getNeighbors(r, c) {
    return [
      [r - 1, c], // up
      [r + 1, c], // down
      [r, c - 1], // left
      [r, c + 1]  // right
    ];
  }

  function floodFill(startR, startC) {
    const color = gemBoard[startR][startC].color;
    const stack = [[startR, startC]];
    const cluster = [];

    visited[startR][startC] = true;

    while (stack.length > 0) {
      const [r, c] = stack.pop();
      cluster.push(gemBoard[r][c]);

      for (const [nr, nc] of getNeighbors(r, c)) {
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
      }
    }

    return cluster;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (gemBoard[r][c] && !visited[r][c]) {
        const cluster = floodFill(r, c);
        if (cluster.length >= 3) {
          matches.push(...cluster);
        }
      }
    }
  }

  return matches;
}


// ===== CLEAR MATCHES (COMBOS) =====

function clearMatches(matches) {
  if (!matches.length) return;

  // ✅ bonus for combo
  playExplosion();
  updateScore(20 * comboMultiplier);
  showComboText(comboMultiplier);
  comboMultiplier++;

  matches.forEach(g => {
    if (g && gemBoard[g.row][g.col]) {

      // ✅ recycle SAME vocab word
      recyclePool.push({
        id: g.id,
        word: g.word,
        definition: g.definition
      });

      // ✅ visual fade
      g.element.classList.add("fade-out");

      // ✅ remove AFTER fade
      setTimeout(() => {
        if (g.element) g.element.remove();
      }, 500);

      gemBoard[g.row][g.col] = null;
    }
  });
}


// ===== GRAVITY =====
function applyGravity() {
  for (let c = 0; c < cols; c++) {
    let stack = [];
    for (let r = rows - 1; r >= 0; r--) {
      if (gemBoard[r][c]) stack.push(gemBoard[r][c]);
    }
    for (let r = rows - 1; r >= 0; r--) {
      let g = stack.shift() || null;
      gemBoard[r][c] = g;
      if (g) { g.row = r; positionGem(g); }
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
        let g = { ...item, color, row: r, col: c };
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
    applyGravity();
    refillFromRecycle();
    applyGravity(); // ensure respawns fall immediately

    setTimeout(() => {
      let matches = findMatches();

      if (matches.length) {
        clearMatches(matches);

        // slow combo cascades
        setTimeout(step, 1000);
      } else {
        // ✅ no more combos — check for game end
        if (isBoardEmpty()) {
          endGame();
        }
      }
    }, 100); // fast gravity settle
  }

  step();
}


// ===== INIT =====
// Game starts when teacher clicks "Start Game"
