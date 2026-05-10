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
let isProcessing = false; // Prevents clicks during animations

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

// ===== LOAD VOCAB =====
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

// ===== CORE UI =====
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
      isProcessing = true;
      alert("Time's up! Final score: " + score);
    }
  }, 1000);
}

// ===== POSITIONING =====
function positionGem(g) {
  const xOffset = 147; 
  const yOffset = 119; 
  g.element.style.left = (g.col * xOffset) + "px";
  g.element.style.top = (g.row * yOffset) + "px";
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

// ===== BOARD BUILDING =====
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
  if (isProcessing) return;
  if (selectedGem) selectedGem.element.classList.remove("selected");
  selectedGem = g;
  g.element.classList.add("selected");
  tryMatch();
}

function selectCard(card) {
  if (isProcessing) return;
  if (selectedCard) selectedCard.classList.remove("selected");
  selectedCard = card;
  card.classList.add("selected");
  tryMatch();
}

function tryMatch() {
  if (!selectedGem || !selectedCard) return;

  if (selectedGem.id === Number(selectedCard.dataset.id)) {
    playChime();
    updateScore(10);

    // Remove from board
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (gemBoard[r][c] && gemBoard[r][c].id === selectedGem.id) {
          gemBoard[r][c].element.remove();
          gemBoard[r][c] = null;
        }
      }
    }

    selectedCard.remove();

    // Check Win Condition
    const remainingCards = document.querySelectorAll(".card").length;
    if (remainingCards === 0) {
      handleWin();
    } else {
      resolveBoard();
    }
  } else {
    playBuzz();
    updateScore(-2);
  }

  if (selectedGem) selectedGem.element.classList.remove("selected");
  if (selectedCard) selectedCard.classList.remove("selected");
  selectedGem = null;
  selectedCard = null;
}

// ===== WIN HANDLING =====
function handleWin() {
  clearInterval(timerInterval);
  isProcessing = true; 

  const timeBonus = timeLeft * 5;
  const finalScore = score + timeBonus;

  setTimeout(() => {
    alert(`CLEARED!\nTime Remaining: ${timeLeft}s\nTime Bonus: +${timeBonus}\nFinal Score: ${finalScore}`);
    updateScore(timeBonus);
  }, 600);
}

// ===== COMBO LOGIC =====
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

function findMatches() {
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const matches = [];

  function floodFill(r, c) {
    const color = gemBoard[r][c].color;
    const stack = [[r, c]];
    const cluster = [];
    visited[r][c] = true;

    while (stack.length > 0) {
      const [cr, cc] = stack.pop();
      cluster.push(gemBoard[cr][cc]);
      const neighbors = [[cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]];

      neighbors.forEach(([nr, nc]) => {
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
            !visited[nr][nc] && gemBoard[nr][nc] &&
            gemBoard[nr][nc].color === color) {
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
        if (cluster.length >= 3) cluster.forEach(g => matches.push(g));
      }
    }
  }
  return matches;
}

function clearMatches(matches) {
  if (matches.length === 0) return;
  playExplosion();
  updateScore(20 * comboMultiplier);
  showComboText(comboMultiplier);
  comboMultiplier++;

  matches.forEach(g => {
    recyclePool.push({ id: g.id, word: g.word, definition: g.definition });
    g.element.classList.add("fade-out");
    setTimeout(() => { if (g.element) g.element.remove(); }, 500);
    gemBoard[g.row][g.col] = null;
  });
}

// ===== GRAVITY & REFILL =====
function applyGravity() {
  for (let c = 0; c < cols; c++) {
    let stack = [];
    for (let r = rows - 1; r >= 0; r--) {
      if (gemBoard[r][c]) stack.push(gemBoard[r][c]);
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

function refillFromRecycle() {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!gemBoard[r][c] && recyclePool.length) {
        let item = recyclePool.shift();
        let color = colors[Math.floor(Math.random() * colors.length)];
        let g = { ...item, color: color, row: r, col: c };

        g.element = createGemElement(g);
        
        // 1. DISABLE transitions immediately so it doesn't "slide" to the spawn point
        g.element.style.transition = "none";
        
        // 2. Set spawn position
        g.element.style.left = (c * 147) + "px";
        g.element.style.top = "-150px"; 
        
        gemGrid.appendChild(g.element);
        gemBoard[r][c] = g;

        // 3. FORCE a layout flush
        void g.element.offsetWidth;

        // 4. RE-ENABLE transitions and move to final slot
        // We use a tiny timeout to ensure the "none" transition was respected
        setTimeout(() => {
          if (g.element) {
            g.element.style.transition = ""; // Reverts to CSS file settings
            positionGem(g);
          }
        }, 10);
      }
    }
  }
}

// ===== RESOLVE LOOP =====
function resolveBoard() {
  isProcessing = true; // Lock user input
  comboMultiplier = 1;

  function step() {
    // 1. First, let the "Match Clear" (fade-out) animation finish
    setTimeout(() => {
      
      // 2. Move existing gems down and spawn new ones from the top
      applyGravity(); 
      refillFromRecycle();

      /* 
         3. WAIT FOR GRAVITY: 
         Your CSS transition is 0.4s (400ms).
         We wait 500ms to be safe, ensuring the jewels are physically 
         settled in their new slots before we scan for combos.
      */
      setTimeout(() => {
        let matches = findMatches();
        
        if (matches.length > 0) {
          // If we found a combo, clear it and increment the multiplier
          clearMatches(matches);
          
          // 4. RECURSION: Run the step again to check for chain reactions
          // We wait 600ms to let the "Explosion/Fade" finish before the next drop
          setTimeout(step, 600); 
        } else {
          // 5. FINISHED: No more matches found, unlock the game for the player
          isProcessing = false;
        }
      }, 500); // This delay syncs with your 0.4s CSS transition
      
    }, 400); // Delay to let the previous match disappear
  }

  step();
}

// ===== INIT =====
if (loadVocabFromStorage()) {
  buildBoard();
  buildCards();
  startTimer();
}
