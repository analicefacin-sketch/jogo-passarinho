
"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const speedEl = document.getElementById("speed");
const bestEl = document.getElementById("best");

const overlay = document.getElementById("overlay");
const menu = document.getElementById("menu");
const gameOver = document.getElementById("gameOver");

let W = innerWidth;
let H = innerHeight;
let dpr = 1;

let state = "menu";
let score = 0;
let best = 0;
let elapsed = 0;
let lastTime = 0;
let spawnTimer = 0;
let shake = 0;

let pipes = [];
let particles = [];
let stars = [];

const bird = {
    x: 100,
    y: 250,
    vy: 0,
    radius: 14,
    rotation: 0
};

// ======================================
// RECORDE
// ======================================

try {
    best = Number(localStorage.getItem("flappyExtremoBest")) || 0;
} catch (e) {
    best = 0;
}

bestEl.textContent = best;

// ======================================
// TELA
// ======================================

function resize() {
    W = innerWidth;
    H = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    bird.x = Math.max(35, Math.min(W * 0.22, 120));
    bird.y = Math.min(bird.y, H - 30);

    stars = Array.from(
        { length: Math.floor(W * H / 8000) },
        () => ({
            x: Math.random() * W,
            y: Math.random() * H,
            size: Math.random() * 2 + 0.5,
            alpha: Math.random() * 0.6 + 0.2,
            speed: Math.random() * 0.5 + 0.1
        })
    );
}

addEventListener("resize", resize);

// ======================================
// TELA CHEIA
// ======================================

function fullscreen() {
    if (!document.fullscreenElement) {
        const promise = document.documentElement.requestFullscreen?.();
        if (promise?.catch) promise.catch(() => {});
    }
}

// ======================================
// DIFICULDADE
// ======================================

function difficulty() {
    return {
        speed: Math.min(900, 230 + score * 22),
        gap: Math.max(76, Math.min(190, H * 0.30) - score * 1.5),
        interval: Math.max(0.58, 1.35 - score * 0.018)
    };
}

function updateHUD() {
    const d = difficulty();

    scoreEl.textContent = score;
    levelEl.textContent = Math.floor(score / 3) + 1;
    speedEl.textContent =
        "VELOCIDADE " + (d.speed / 230).toFixed(1) + "x";
}

// ======================================
// INÍCIO E REINÍCIO
// ======================================

function startGame() {
    fullscreen();

    score = 0;
    elapsed = 0;
    spawnTimer = 0;
    shake = 0;

    pipes = [];
    particles = [];

    bird.y = H * 0.45;
    bird.vy = 0;
    bird.rotation = 0;

    state = "playing";

    menu.classList.add("hidden");
    gameOver.classList.add("hidden");
    overlay.style.pointerEvents = "none";

    updateHUD();
    flap();
}

function endGame() {
    if (state !== "playing") return;

    state = "over";
    shake = 14;

    burst(bird.x, bird.y, 35);

    if (score > best) {
        best = score;

        try {
            localStorage.setItem("flappyExtremoBest", String(best));
        } catch (e) {}
    }

    bestEl.textContent = best;
    document.getElementById("finalScore").textContent =
        "Pontuação: " + score;
    document.getElementById("finalBest").textContent =
        "Recorde: " + best;

    gameOver.classList.remove("hidden");
    overlay.style.pointerEvents = "auto";
}

function flap() {
    if (state !== "playing") return;

    bird.vy = -Math.max(330, H * 0.53);
    burst(bird.x - 10, bird.y + 5, 4);
}

// ======================================
// CANOS MÓVEIS
// ======================================

function spawnPipe() {
    const d = difficulty();
    const gap = d.gap;
    const margin = Math.min(65, H * 0.12);

    const minY = margin + gap / 2;
    const maxY = Math.max(minY, H - margin - gap / 2);

    pipes.push({
        x: W + 30,
        width: Math.max(48, Math.min(75, W * 0.075)),
        y: minY + Math.random() * (maxY - minY),
        baseY: minY + Math.random() * (maxY - minY),
        gap,
        amplitude: Math.min(H * 0.18, 45 + score * 1.3),
        frequency: 1.3 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
        passed: false,
        hue: 145 + Math.random() * 65
    });
}

function updatePipes(dt) {
    const d = difficulty();

    spawnTimer += dt;

    if (spawnTimer >= d.interval) {
        spawnTimer = 0;
        spawnPipe();
    }

    for (const p of pipes) {
        p.x -= d.speed * dt;

        p.y = p.baseY +
            Math.sin(elapsed * p.frequency + p.phase) * p.amplitude;

        const half = p.gap / 2;
        p.y = Math.max(
            half + 5,
            Math.min(H - half - 5, p.y)
        );

        if (!p.passed && p.x + p.width < bird.x) {
            p.passed = true;
            score++;

            burst(bird.x, bird.y, 12);
            updateHUD();
        }
    }

    pipes = pipes.filter(p => p.x + p.width > -20);
}

// ======================================
// FÍSICA E COLISÕES
// ======================================

function updateBird(dt) {
    bird.vy += H * 1.65 * dt;
    bird.y += bird.vy * dt;

    bird.rotation = Math.max(
        -0.5,
        Math.min(1.1, bird.vy / 650)
    );

    if (
        bird.y - bird.radius < 0 ||
        bird.y + bird.radius > H
    ) {
        endGame();
        return;
    }

    for (const p of pipes) {
        const overlapsX =
            bird.x + bird.radius > p.x &&
            bird.x - bird.radius < p.x + p.width;

        if (!overlapsX) continue;

        const top = p.y - p.gap / 2;
        const bottom = p.y + p.gap / 2;

        if (
            bird.y - bird.radius < top ||
            bird.y + bird.radius > bottom
        ) {
            endGame();
            return;
        }
    }
}

// ======================================
// PARTÍCULAS
// ======================================

function burst(x, y, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 190 + 40;

        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.7,
            size: Math.random() * 4 + 2,
            hue: Math.random() * 360
        });
    }
}

function updateParticles(dt) {
    for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 100 * dt;
        p.life -= dt;
    }

    particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / 0.7);
        ctx.fillStyle = `hsl(${p.hue}, 100%, 65%)`;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

// ======================================
// FUNDO NEON
// ======================================

function drawBackground(dt) {
    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, "#080b20");
    gradient.addColorStop(0.5, "#17103b");
    gradient.addColorStop(1, "#071d38");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(
        W * 0.5, H * 0.5, 10,
        W * 0.5, H * 0.5, Math.max(W, H) * 0.7
    );

    glow.addColorStop(0, "#008cff18");
    glow.addColorStop(1, "#00000000");

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
        if (state === "playing") {
            s.x -= s.speed * 60 * dt *
                (1 + score * 0.1);

            if (s.x < 0) {
                s.x = W;
                s.y = Math.random() * H;
            }
        }

        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = "#baf8ff";
        ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    ctx.globalAlpha = 1;

    ctx.strokeStyle = "#00dcff0c";
    ctx.lineWidth = 1;

    for (let x = 0; x < W; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
    }

    for (let y = 0; y < H; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
    }
}

// ======================================
// DESENHAR CANOS
// ======================================

function drawPipe(p) {
    const topHeight = p.y - p.gap / 2;
    const bottomY = p.y + p.gap / 2;
    const w = p.width;
    const cap = Math.min(13, w * 0.2);

    const gradient = ctx.createLinearGradient(p.x, 0, p.x + w, 0);
    gradient.addColorStop(0, "#07543f");
    gradient.addColorStop(0.25, "#00ff9d");
    gradient.addColorStop(0.6, "#00b87a");
    gradient.addColorStop(1, "#064b44");

    ctx.shadowColor = "#00ff9d";
    ctx.shadowBlur = 14;
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "#6affcf";
    ctx.lineWidth = 2;

    // Cano superior
    ctx.fillRect(p.x + cap / 2, 0, w - cap, topHeight);
    ctx.strokeRect(p.x + cap / 2, -1, w - cap, topHeight + 1);

    ctx.fillRect(p.x, topHeight - 16, w, 16);
    ctx.strokeRect(p.x, topHeight - 16, w, 16);

    // Cano inferior
    ctx.fillRect(p.x + cap / 2, bottomY, w - cap, H - bottomY);
    ctx.strokeRect(p.x + cap / 2, bottomY, w - cap, H - bottomY);

    ctx.fillRect(p.x, bottomY, w, 16);
    ctx.strokeRect(p.x, bottomY, w, 16);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff80";
    ctx.lineWidth = 2;

    for (let i = 12; i < w - 5; i += 18) {
        ctx.beginPath();

        if (topHeight > 30) {
            ctx.moveTo(p.x + i, 8);
            ctx.lineTo(p.x + i, Math.max(9, topHeight - 20));
        }

        if (H - bottomY > 30) {
            ctx.moveTo(p.x + i, bottomY + 22);
            ctx.lineTo(p.x + i, H - 8);
        }

        ctx.stroke();
    }
}

// ======================================
// PASSARINHO PISCANDO
// ======================================

function drawBird() {
    const hue = (elapsed * 550) % 360;
    const flash = Math.sin(elapsed * 34) > 0;
    const color = `hsl(${hue}, 100%, ${flash ? 70 : 48}%)`;

    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);

    ctx.shadowColor = color;
    ctx.shadowBlur = 24;

    ctx.fillStyle = color;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.ellipse(0, 0, bird.radius + 2, bird.radius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Asa animada
    const wingY = Math.sin(elapsed * 24) * 5;

    ctx.fillStyle = flash ? "#ffffff" : "#ffb8ff";
    ctx.beginPath();
    ctx.ellipse(-5, 3 + wingY, 8, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Olho
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";

    ctx.beginPath();
    ctx.arc(7, -5, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#10142b";
    ctx.beginPath();
    ctx.arc(9, -5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Bico
    ctx.fillStyle = "#ffb52e";
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(23, 3);
    ctx.lineTo(12, 7);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

// ======================================
// ATUALIZAÇÃO E DESENHO
// ======================================

function update(dt) {
    if (state === "playing") {
        elapsed += dt;
        updateBird(dt);

        if (state === "playing") {
            updatePipes(dt);
        }
    }

    updateParticles(dt);
    shake = Math.max(0, shake - 35 * dt);
}

function draw(dt) {
    ctx.save();

    if (shake > 0) {
        ctx.translate(
            (Math.random() - 0.5) * shake,
            (Math.random() - 0.5) * shake
        );
    }

    drawBackground(dt);

    for (const p of pipes) {
        drawPipe(p);
    }

    if (state !== "over") {
        drawBird();
    }

    drawParticles();
    ctx.restore();
}

function loop(timestamp) {
    const dt = lastTime
        ? Math.min((timestamp - lastTime) / 1000, 0.033)
        : 0;

    lastTime = timestamp;

    update(dt);
    draw(dt);

    requestAnimationFrame(loop);
}

// ======================================
// CONTROLES
// ======================================

function action() {
    if (state === "playing") {
        flap();
    } else if (state === "menu" || state === "over") {
        startGame();
    }
}

document.addEventListener("keydown", e => {
    if (
        e.code === "Space" ||
        e.code === "ArrowUp" ||
        e.code === "KeyW"
    ) {
        e.preventDefault();

        if (!e.repeat) action();
    }
});

canvas.addEventListener("pointerdown", e => {
    e.preventDefault();
    action();
});

document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("restartBtn").addEventListener("click", startGame);

// ======================================
// INICIALIZAÇÃO
// ======================================

resize();
updateHUD();
requestAnimationFrame(loop);
