// =====================================================
// SETTINGS & STATE
// =====================================================
const rows = 5;
const cols = 4;
const colorMap = {
    red: "radial-gradient(circle at 30% 30%, #ff7e7e, #ff3e3e 70%, #a30000)",
    blue: "radial-gradient(circle at 30% 30%, #82ccdd, #0a3d62 70%, #062c43)",
    green: "radial-gradient(circle at 30% 30%, #a2ffaf, #27ae60 70%, #145a32)",
    purple: "radial-gradient(circle at 30% 30%, #d982ff, #8e44ad 70%, #4a235a)",
    gold: "radial-gradient(circle at 30% 30%, #ffeaa7, #f1c40f 70%, #967117)"
};
const colors = Object.keys(colorMap);

let score = 0;
let timeLeft = 180;
let timerInterval;
let comboMultiplier = 1;
let vocab = [], fullVocab = [], gemBoard = [], recyclePool = [];
let selectedGem = null, selectedCard = null;

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

// =====================================================
// CORE ENGINE
// =====================================================

function loadVocabFromStorage() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("list");
    if (!raw) return false;
    const saved = localStorage.getItem("vocab_" + decodeURIComponent(raw));
    if (!saved) return false;

    vocab = saved.split("\n").map((line, i) => {
        const parts = line.split(",");
        return { id: i + 1, word: parts[0]?.trim(), definition: parts[1]?.trim() };
    }).filter(v => v.word && v.definition);
    
    fullVocab = vocab.slice(0, 20);
    return true;
}

function positionGem(g) {
    g.element.style.left = (g.col * 105) + "px";
    g.element.style.top = (g.row * 85) + "px";
}

function createGemElement(g) {
    const d = document.createElement("div");
    d.className = "cell gem";
    d.style.background = colorMap[g.color];
    d.innerHTML = `<span class="label">${g.word}</span>`;
    d.onclick = () => {
        if (selectedGem) selectedGem.element.classList.remove("selected");
        selectedGem = g;
        g.element.classList.add("selected");
        tryMatch();
    };
    return d;
}

function buildBoard() {
    gemGrid.innerHTML = "";
    const items = [...fullVocab].sort(() => Math.random() - 0.5);
    let i = 0;
    for (let r = 0; r < rows; r++) {
        gemBoard[r] = [];
        for (let c = 0; c < cols; c++) {
            let item = items[i++] || items[0]; 
            let g = { ...item, color: colors[Math.floor(Math.random() * colors.length)], row: r, col: c };
            g.element = createGemElement(g);
            positionGem(g);
            gemGrid.appendChild(g.element);
            gemBoard[r][c] = g;
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
        d.onclick = () => {
            if (selectedCard) selectedCard.classList.remove("selected");
            selectedCard = d;
            d.classList.add("selected");
            tryMatch();
        };
        cardGrid.appendChild(d);
    });
}

function tryMatch() {
    if (!selectedGem || !selectedCard) return;
    if (selectedGem.id === Number(selectedCard.dataset.id)) {
        playChime();
        score += 10;
        scoreDisplay.textContent = score;
        
        // Remove from board
        const matchId = selectedGem.id;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (gemBoard[r][c]?.id === matchId) {
                    gemBoard[r][c].element.remove();
                    gemBoard[r][c] = null;
                }
            }
        }
        selectedCard.remove();
        resolveBoard();
    } else {
        playBuzz();
    }
    selectedGem.element.classList.remove("selected");
    selectedCard.classList.remove("selected");
    selectedGem = null; selectedCard = null;
}

// =====================================================
// MATCH-3 LOGIC & GRAVITY
// =====================================================

function findMatches() {
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const matches = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (gemBoard[r][c] && !visited[r][c]) {
                let cluster = floodFill(r, c, gemBoard[r][c].color, visited);
                if (cluster.length >= 3) matches.push(...cluster);
            }
        }
    }
    return matches;
}

function floodFill(r, c, color, visited) {
    const stack = [[r, c]], cluster = [];
    visited[r][c] = true;
    while (stack.length) {
        const [x, y] = stack.pop();
        cluster.push(gemBoard[x][y]);
        [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].forEach(([nx, ny]) => {
            if (nx>=0 && nx<rows && ny>=0 && ny<cols && !visited[nx][ny] && gemBoard[nx][ny]?.color === color) {
                visited[nx][ny] = true;
                stack.push([nx, ny]);
            }
        });
    }
    return cluster;
}

function applyGravity() {
    for (let c = 0; c < cols; c++) {
        let stack = [];
        for (let r = rows - 1; r >= 0; r--) if (gemBoard[r][c]) stack.push(gemBoard[r][c]);
        for (let r = rows - 1; r >= 0; r--) {
            let g = stack.shift() || null;
            gemBoard[r][c] = g;
            if (g) { g.row = r; positionGem(g); }
        }
    }
}

function resolveBoard() {
    comboMultiplier = 1;
    function step() {
        applyGravity();
        // Refill
        for (let r=0; r<rows; r++) {
            for (let c=0; c<cols; c++) {
                if (!gemBoard[r][c] && recyclePool.length) {
                    let item = recyclePool.shift();
                    let g = { ...item, color: colors[Math.floor(Math.random()*colors.length)], row: r, col: c };
                    g.element = createGemElement(g);
                    gemBoard[r][c] = g;
                    gemGrid.appendChild(g.element);
                    positionGem(g);
                }
            }
        }
        
        setTimeout(() => {
            const matches = findMatches();
            if (matches.length) {
                playExplosion();
                score += (20 * comboMultiplier);
                scoreDisplay.textContent = score;
                showComboText(comboMultiplier);
                comboMultiplier++;
                matches.forEach(g => {
                    recyclePool.push({ id: g.id, word: g.word, definition: g.definition });
                    g.element.classList.add("fade-out");
                    setTimeout(() => g.element.remove(), 500);
                    gemBoard[g.row][g.col] = null;
                });
                setTimeout(step, 600);
            }
        }, 300);
    }
    step();
}

function showComboText(mult) {
    const text = document.createElement("div");
    text.className = "combo-text";
    text.textContent = mult < 2 ? "COMBO CLEAR!" : `x${mult} COMBO!`;
    gemGrid.appendChild(text);
    setTimeout(() => text.remove(), 800);
}

// Start
if (loadVocabFromStorage()) {
    buildBoard();
    buildCards();
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        if (timeLeft <= 0) { clearInterval(timerInterval); alert("Game Over! Score: " + score); }
    }, 1000);
}
💡 Suggested CSS (Since you mentioned CSS troubleshooting)
Make sure your CSS includes these properties for the board to look right, specifically for the absolute positioning of the gems:

CSS
#gemGrid {
  position: relative; /* Essential for g.element.style.left/top to work */
  width: 420px;
  height: 425px;
  overflow: hidden;
}

.gem {
  position: absolute;
  transition: all 0.3s ease-in-out; /* Makes gravity look smooth */
  width: 100px;
  height: 80px;
  border-radius: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  cursor: pointer;
}

.gem.selected {
  outline: 4px solid white;
  transform: scale(1.05);
  z-index: 10;
}

.fade-out {
  opacity: 0;
  transform: scale(0.5);
}
