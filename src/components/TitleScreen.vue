<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { soundManager } from '../audio/SoundManager';
import type { PlayerLoadout } from '../types';
import { MAIN_WEAPONS, SUB_WEAPONS, TOOLS, SPECIALTIES } from '../types';

defineProps<{
  loadout?: PlayerLoadout;
}>();

const emit = defineEmits<{
  (e: 'start-game'): void;
  (e: 'open-loadout'): void;
}>();

const isMuted = ref(false);
const showHelp = ref(false);
const flagCanvas = ref<HTMLCanvasElement | null>(null);
let animId: number | null = null;

const onGoClicked = () => {
  soundManager.playClick();
  soundManager.startPatrioticTheme();
  emit('start-game');
};

const onLoadoutClicked = () => {
  soundManager.playClick();
  emit('open-loadout');
};

const toggleAudio = () => {
  isMuted.value = soundManager.toggleMute();
};

// Canvas animation for the 1777 Flag fluttering behind the title
const initFlagAnimation = () => {
  const canvas = flagCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let time = 0;

  const render = () => {
    time += 0.045;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const stripeCount = 13;
    const stripeH = h / stripeCount;
    const cantonW = w * 0.42;
    const cantonH = stripeH * 7;

    // Draw 13 wavy stripes
    for (let s = 0; s < stripeCount; s++) {
      ctx.fillStyle = s % 2 === 0 ? '#B22234' : '#FFFFFF';
      ctx.beginPath();
      
      const yBase = s * stripeH;
      ctx.moveTo(0, yBase + Math.sin(time + 0) * 8);

      for (let x = 0; x <= w; x += 15) {
        // Wave displacement
        const wave = Math.sin(time * 2.2 + x * 0.015) * (8 + (x / w) * 14);
        ctx.lineTo(x, yBase + wave);
      }

      for (let x = w; x >= 0; x -= 15) {
        const wave = Math.sin(time * 2.2 + x * 0.015) * (8 + (x / w) * 14);
        ctx.lineTo(x, yBase + stripeH + wave);
      }

      ctx.closePath();
      ctx.fill();
    }

    // Draw Blue Canton over the first 7 stripes
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, Math.sin(time) * 8);
    for (let x = 0; x <= cantonW; x += 15) {
      const wave = Math.sin(time * 2.2 + x * 0.015) * (8 + (x / w) * 14);
      ctx.lineTo(x, wave);
    }
    for (let x = cantonW; x >= 0; x -= 15) {
      const wave = Math.sin(time * 2.2 + x * 0.015) * (8 + (x / w) * 14);
      ctx.lineTo(x, cantonH + wave);
    }
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = '#1D2A44';
    ctx.fillRect(0, -20, cantonW + 10, cantonH + 40);

    // Draw 13 Stars in a Circle (1777 Betsy Ross Flag)
    const cx = cantonW / 2;
    const cy = cantonH / 2;
    const radius = cantonH * 0.34;
    ctx.fillStyle = '#FFFFFF';

    for (let i = 0; i < 13; i++) {
      const angle = (i / 13) * Math.PI * 2 - Math.PI / 2;
      const sx = cx + Math.cos(angle) * radius;
      const sy = cy + Math.sin(angle) * radius;
      const waveOffset = Math.sin(time * 2.2 + sx * 0.015) * (8 + (sx / w) * 14);

      drawStar(ctx, sx, sy + waveOffset, 5, 8.5, 4.0);
    }
    ctx.restore();

    // Lighting gradient overlay (folds & fabric sheen)
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    for (let x = 0; x <= 1; x += 0.2) {
      const light = 0.5 + 0.5 * Math.sin(time * 2.2 + x * 6);
      gradient.addColorStop(x, `rgba(255, 255, 255, ${light * 0.15})`);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Dark shadow on left edge (flagpole shadow)
    const edgeShadow = ctx.createLinearGradient(0, 0, 40, 0);
    edgeShadow.addColorStop(0, 'rgba(0,0,0,0.5)');
    edgeShadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = edgeShadow;
    ctx.fillRect(0, 0, 40, h);

    animId = requestAnimationFrame(render);
  };

  render();
};

const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
};

onMounted(() => {
  initFlagAnimation();
});

onUnmounted(() => {
  if (animId !== null) {
    cancelAnimationFrame(animId);
  }
});
</script>

<template>
  <div class="title-screen-wrapper">
    <!-- Atmospheric Colonial Background -->
    <div class="vintage-overlay"></div>
    <div class="vignette-effect"></div>

    <!-- Audio & Controls Header -->
    <header class="top-nav">
      <div class="lore-tag">
        <span class="star-icon">★</span>
        <span>THE SPIRIT OF LIBERTY</span>
        <span class="star-icon">★</span>
      </div>
      <div class="nav-actions">
        <button class="nav-btn" @click="showHelp = !showHelp" title="Game Instructions">
          <span>📜 INSTRUCTIONS</span>
        </button>
        <button class="nav-btn" @click="toggleAudio" title="Toggle Fife & Drum Audio">
          <span>{{ isMuted ? '🔇 SOUND OFF' : '🎵 SOUND ON' }}</span>
        </button>
      </div>
    </header>

    <!-- Main Title & Flag Stage -->
    <main class="center-stage">
      <!-- 1777 Flag positioned behind the Title -->
      <div class="flag-container">
        <canvas ref="flagCanvas" width="760" height="420" class="flag-canvas"></canvas>
        <div class="flagpole-visual"></div>
        <div class="flag-gold-fringe"></div>
      </div>

      <!-- Title "1776" waving like a flag -->
      <div class="waving-title-container">
        <h1 class="waving-title font-cinzel-dec">
          <span class="char-wave" style="--delay: 0s;">1</span>
          <span class="char-wave" style="--delay: 0.15s;">7</span>
          <span class="char-wave" style="--delay: 0.3s;">7</span>
          <span class="char-wave" style="--delay: 0.45s;">6</span>
        </h1>
        <div class="subtitle-banner font-cinzel">
          <span class="sub-text">PROCLAIM LIBERTY THROUGHOUT ALL THE LAND</span>
        </div>
      </div>

      <!-- Below Title: GO Button surrounded by Wide Oval with American Flag Pattern -->
      <div class="go-button-section">
        <div class="flag-oval-frame" @click="onGoClicked">
          <!-- Flag Pattern inside the Wide Oval -->
          <div class="oval-flag-pattern">
            <!-- 13 Stripes in Oval -->
            <div class="oval-stripes">
              <div v-for="i in 13" :key="i" class="oval-stripe" :class="i % 2 === 1 ? 'red' : 'white'"></div>
            </div>
            <!-- Blue Canton with Constellation of Stars -->
            <div class="oval-canton">
              <div class="canton-stars-field">
                <span
                  v-for="s in 18"
                  :key="`c_${s}`"
                  class="canton-star-point"
                  :style="{ animationDelay: `${(s * 0.15)}s` }"
                >★</span>
              </div>
            </div>

            <!-- Surrounding 13-Star Betsy Ross Halo Ring explicitly orbiting around the GO button -->
            <div class="star-halo-ring">
              <span
                v-for="s in 13"
                :key="`h_${s}`"
                class="halo-star"
                :style="{
                  left: `${50 + 44 * Math.cos(((s - 1) / 13) * 2 * Math.PI)}%`,
                  top: `${50 + 40 * Math.sin(((s - 1) / 13) * 2 * Math.PI)}%`,
                  animationDelay: `${s * 0.18}s`
                }"
              >★</span>
            </div>

            <!-- Left & Right Flanking Stars -->
            <div class="oval-side-stars left-stars">
              <span v-for="i in 3" :key="`sl_${i}`" class="side-star">★</span>
            </div>
            <div class="oval-side-stars right-stars">
              <span v-for="i in 3" :key="`sr_${i}`" class="side-star">★</span>
            </div>
          </div>

          <!-- Gilded Ornamental Frame Trim -->
          <div class="oval-gold-rim"></div>
          <div class="oval-inner-glow"></div>

          <!-- GO Action Button in Center -->
          <button class="go-action-btn font-cinzel-dec" @click.stop="onGoClicked">
            <span class="go-text">GO</span>
          </button>
        </div>

        <!-- Loadout Button Below the GO button -->
        <div class="loadout-trigger-box">
          <button class="loadout-btn parchment-border font-cinzel" @click="onLoadoutClicked">
            <span class="loadout-icon">⚔️</span>
            <span class="loadout-title">ARMORY & LOADOUT</span>
            <span class="loadout-badge font-fell">CUSTOMIZE WEAPONS & SPECIALTY</span>
          </button>

          <!-- Active Loadout Tag summary -->
          <div v-if="loadout" class="active-loadout-preview font-cinzel">
            <span class="preview-item">Main: <strong>{{ MAIN_WEAPONS[loadout.mainWeapon].name }}</strong></span>
            <span class="preview-item">Sub: <strong>{{ SUB_WEAPONS[loadout.subWeapon].name }}</strong></span>
            <span class="preview-item">Tools: <strong>{{ loadout.tools && loadout.tools.length > 0 ? loadout.tools.map(t => TOOLS[t].name).join(', ') : TOOLS[loadout.tool].name }}</strong></span>
            <span class="preview-item specialty-pill">Specialty: <strong>{{ SPECIALTIES[loadout.specialty].name }}</strong></span>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer with 1776 Historical Metadata -->
    <footer class="bottom-footer font-fell">
      <div>JULY 4, 1776 • CONTINENTAL ARMY EXPEDITION • MOUNTAINS REACHING +100FT</div>
    </footer>

    <!-- Instructions Modal -->
    <div v-if="showHelp" class="modal-backdrop" @click="showHelp = false">
      <div class="parchment-modal parchment-border font-fell" @click.stop>
        <h2 class="modal-title font-cinzel">CONGRESSIONAL ORDERS</h2>
        <div class="modal-content">
          <p><strong>Welcome, Continental Explorer.</strong></p>
          <ul>
            <li><strong>Spawn:</strong> You start at <em>y = 20</em> in the Continental Army Encampment.</li>
            <li><strong>Terrain:</strong> Explore towering mountains up to <em>y = 120</em> (+100ft above baseline) and deep river valleys down to <em>y = -5</em>.</li>
            <li><strong>Controls:</strong>
              <ul>
                <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> - Move through the terrain</li>
                <li><kbd>Mouse</kbd> - Look around (First Person Pointer Lock)</li>
                <li><kbd>Space</kbd> - Jump over rocks and ridges</li>
                <li><kbd>Shift</kbd> - Sprint across valleys</li>
                <li><kbd>Left Click</kbd> - Fire Flintlock Musket</li>
                <li><kbd>ESC</kbd> - Release cursor / Pause menu</li>
              </ul>
            </li>
            <li><strong>Objective:</strong> Ascend to Independence Summit to salute the Grand 1777 Standard!</li>
          </ul>
        </div>
        <button class="close-modal-btn font-cinzel" @click="showHelp = false">DISMISS ORDERS</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.title-screen-wrapper {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  background: radial-gradient(circle at center, #1b263b 0%, #0d1b2a 60%, #050a12 100%);
  overflow: hidden;
  color: var(--color-parchment);
}

.vintage-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, 0.6) 100%);
  pointer-events: none;
  z-index: 1;
}

.vignette-effect {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 140px rgba(0, 0, 0, 0.85);
  pointer-events: none;
  z-index: 1;
}

/* Top Navigation */
.top-nav {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 1200px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
}

.lore-tag {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Cinzel', serif;
  font-size: 0.9rem;
  letter-spacing: 3px;
  color: var(--color-patriot-gold);
  text-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
}

.star-icon {
  color: var(--color-patriot-gold);
  font-size: 1.1rem;
}

.nav-actions {
  display: flex;
  gap: 15px;
}

.nav-btn {
  background: rgba(13, 27, 42, 0.75);
  border: 1px solid var(--color-antique-gold);
  color: var(--color-parchment);
  padding: 8px 16px;
  border-radius: 4px;
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  letter-spacing: 1.5px;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
}

.nav-btn:hover {
  background: var(--color-antique-gold);
  color: #0d1b2a;
  box-shadow: 0 0 15px rgba(212, 175, 55, 0.5);
  transform: translateY(-2px);
}

/* Center Stage */
.center-stage {
  position: relative;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 900px;
  margin-top: -10px;
}

/* 1777 Flag behind Title */
.flag-container {
  position: absolute;
  top: -45px;
  left: 50%;
  transform: translateX(-50%);
  width: 760px;
  max-width: 92vw;
  height: 420px;
  z-index: 2;
  filter: drop-shadow(0 20px 30px rgba(0, 0, 0, 0.8));
  pointer-events: none;
}

.flag-canvas {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  transform: perspective(800px) rotateX(4deg);
}

.flagpole-visual {
  position: absolute;
  left: -12px;
  top: -20px;
  width: 12px;
  height: 460px;
  background: linear-gradient(to right, #4a3525, #8b6508, #d4af37, #4a3525);
  border-radius: 6px;
  box-shadow: -4px 0 10px rgba(0, 0, 0, 0.6);
}

.flagpole-visual::before {
  content: '';
  position: absolute;
  top: -16px;
  left: -8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff1b0, #d4af37, #8b6508);
  box-shadow: 0 0 15px rgba(212, 175, 55, 0.8);
}

/* Waving Title "1776" */
.waving-title-container {
  position: relative;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 15px;
  margin-bottom: 30px;
}

.waving-title {
  display: flex;
  font-size: 8.5rem;
  font-weight: 900;
  letter-spacing: 12px;
  color: #fff9e6;
  text-shadow: 
    0 2px 0 #d4af37,
    0 4px 0 #b38f2a,
    0 6px 0 #8b6b1b,
    0 10px 25px rgba(0, 0, 0, 0.9),
    0 0 40px rgba(212, 175, 55, 0.7);
  animation: flagWaveVertical 4.5s ease-in-out infinite alternate;
}

.char-wave {
  display: inline-block;
  animation: charRipple 3s ease-in-out infinite alternate;
  animation-delay: var(--delay);
  transform-origin: bottom center;
}

@keyframes charRipple {
  0% {
    transform: translateY(0px) rotate(0deg) scale(1);
    color: #ffffff;
  }
  50% {
    transform: translateY(-16px) rotate(2deg) scale(1.04);
    color: #fff2c2;
    text-shadow: 
      0 0 20px rgba(212, 175, 55, 0.9),
      0 12px 30px rgba(0, 0, 0, 0.9);
  }
  100% {
    transform: translateY(8px) rotate(-2deg) scale(0.98);
    color: #ffe699;
  }
}

.subtitle-banner {
  background: rgba(13, 27, 42, 0.9);
  border: 1px solid var(--color-patriot-gold);
  padding: 6px 24px;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8), 0 0 15px rgba(212, 175, 55, 0.3);
  margin-top: -15px;
}

.sub-text {
  font-size: 0.9rem;
  letter-spacing: 4px;
  color: var(--color-parchment);
  font-weight: 700;
}

/* Wide Oval GO Button Section */
.go-button-section {
  position: relative;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 15px;
}

/* Wide Oval containing American Flag patterns */
.flag-oval-frame {
  position: relative;
  width: 440px;
  height: 190px;
  max-width: 90vw;
  border-radius: 50% / 50%;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 
    0 15px 40px rgba(0, 0, 0, 0.9),
    0 0 35px rgba(212, 175, 55, 0.6),
    inset 0 0 25px rgba(0, 0, 0, 0.6);
  transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  animation: pulseGlow 4s ease-in-out infinite;
}

.flag-oval-frame:hover {
  transform: scale(1.06);
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.95),
    0 0 60px rgba(212, 175, 55, 0.9),
    inset 0 0 30px rgba(212, 175, 55, 0.8);
}

.flag-oval-frame:active {
  transform: scale(0.98);
}

/* Pattern inside the oval */
.oval-flag-pattern {
  position: absolute;
  inset: 0;
  display: flex;
  z-index: 1;
}

.oval-stripes {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
}

.oval-stripe {
  flex: 1;
  width: 100%;
}

.oval-stripe.red {
  background: #B22234;
}

.oval-stripe.white {
  background: #F4F3EE;
}

.oval-canton {
  position: absolute;
  top: 0;
  left: 0;
  width: 50%;
  height: 58%;
  background: #14223d;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  padding: 6px 10px;
}

.canton-stars-field {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-around;
  align-items: center;
  gap: 4px 8px;
  width: 100%;
  height: 100%;
}

.canton-star-point {
  font-size: 11px;
  color: #ffffff;
  filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.9));
  animation: starShimmer 2.5s ease-in-out infinite alternate;
}

/* 13-Star Betsy Ross Halo Ring explicitly orbiting around the GO button */
.star-halo-ring {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
}

.halo-star {
  position: absolute;
  font-size: 15px;
  color: #ffd700;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 0 6px rgba(255, 215, 0, 1.0)) drop-shadow(0 0 12px rgba(255, 215, 0, 0.6));
  animation: starHaloPulse 2.8s ease-in-out infinite alternate;
}

@keyframes starHaloPulse {
  0% { transform: translate(-50%, -50%) scale(0.85); filter: drop-shadow(0 0 4px rgba(255, 215, 0, 0.7)); }
  100% { transform: translate(-50%, -50%) scale(1.22); filter: drop-shadow(0 0 8px rgba(255, 235, 100, 1.0)) drop-shadow(0 0 16px rgba(255, 215, 0, 0.9)); }
}

/* Side Star Flanks (Left and Right of Oval) */
.oval-side-stars {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 3;
  pointer-events: none;
}

.oval-side-stars.left-stars {
  left: 20px;
}

.oval-side-stars.right-stars {
  right: 20px;
}

.side-star {
  font-size: 14px;
  color: #fff1b0;
  filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.85));
  animation: starShimmer 3s ease-in-out infinite alternate;
}

/* Gold Rim & Gloss */
.oval-gold-rim {
  position: absolute;
  inset: 0;
  border-radius: 50% / 50%;
  border: 7px solid var(--color-patriot-gold);
  box-shadow: 
    inset 0 0 15px rgba(0, 0, 0, 0.7),
    0 0 15px rgba(212, 175, 55, 0.8);
  pointer-events: none;
  z-index: 3;
}

.oval-inner-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.65) 80%);
  pointer-events: none;
  z-index: 2;
}

/* GO Button centered inside the oval */
.go-action-btn {
  position: relative;
  z-index: 4;
  background: radial-gradient(circle at center, #d4af37 0%, #a67c1e 65%, #664c0f 100%);
  border: 3px solid #fff5cc;
  padding: 16px 52px;
  border-radius: 40px;
  color: #0d1b2a;
  cursor: pointer;
  box-shadow: 
    0 8px 25px rgba(0, 0, 0, 0.8),
    0 0 25px rgba(255, 245, 204, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 0.25s ease;
}

.go-action-btn:hover {
  background: radial-gradient(circle at center, #fff1b0 0%, #d4af37 65%, #8b6508 100%);
  box-shadow: 
    0 10px 35px rgba(0, 0, 0, 0.9),
    0 0 40px rgba(255, 255, 255, 0.9);
}

.go-text {
  font-size: 3.2rem;
  font-weight: 900;
  letter-spacing: 8px;
  line-height: 1;
  color: #0b0f19;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.6);
  margin-right: -8px; /* Offset the trailing letter-spacing to ensure absolute visual centering */
}

/* Loadout Button Below GO */
.loadout-trigger-box {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.loadout-btn {
  background: radial-gradient(circle at center, #1b263b 0%, #0d1b2a 100%);
  color: var(--color-parchment);
  padding: 10px 24px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.7);
}

.loadout-btn:hover {
  background: radial-gradient(circle at center, #2c3e50 0%, #1a252f 100%);
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 8px 25px rgba(212, 175, 55, 0.4);
  border-color: #fff1b0;
}

.loadout-icon {
  font-size: 1.3rem;
}

.loadout-title {
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 2px;
  color: #fff9e6;
  text-shadow: 0 0 8px rgba(212, 175, 55, 0.6);
}

.loadout-badge {
  background: rgba(212, 175, 55, 0.15);
  border: 1px solid var(--color-patriot-gold);
  color: var(--color-patriot-gold);
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 1px;
}

.active-loadout-preview {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  font-size: 0.75rem;
  letter-spacing: 1px;
  background: rgba(13, 27, 42, 0.7);
  padding: 5px 14px;
  border-radius: 20px;
  border: 1px solid rgba(212, 175, 55, 0.25);
}

.preview-item {
  color: #c5a059;
}

.preview-item strong {
  color: #ffffff;
}

.specialty-pill {
  color: #ffda79 !important;
}

/* Footer */
.bottom-footer {
  position: relative;
  z-index: 10;
  padding: 16px;
  font-size: 0.9rem;
  letter-spacing: 2px;
  color: var(--color-antique-gold);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
  text-align: center;
}

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.parchment-modal {
  background: #f5e6c8;
  color: #2b1d06;
  padding: 35px 40px;
  border-radius: 8px;
  max-width: 580px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9);
  animation: modalPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes modalPop {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.modal-title {
  text-align: center;
  font-size: 1.6rem;
  letter-spacing: 3px;
  border-bottom: 2px solid #c5a059;
  padding-bottom: 12px;
  margin-bottom: 20px;
  color: #1b263b;
}

.modal-content {
  font-size: 1.05rem;
  line-height: 1.6;
}

.modal-content ul {
  margin: 12px 0 16px 20px;
}

.modal-content kbd {
  background: #2b1d06;
  color: #f5e6c8;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.85rem;
  margin: 0 2px;
}

.close-modal-btn {
  width: 100%;
  margin-top: 20px;
  padding: 12px;
  background: #1b263b;
  color: #f5e6c8;
  border: 1px solid #c5a059;
  border-radius: 4px;
  font-size: 1rem;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-modal-btn:hover {
  background: #0d1b2a;
  color: #d4af37;
}

@media (max-width: 768px) {
  .waving-title {
    font-size: 5rem;
    letter-spacing: 6px;
  }
  .flag-oval-frame {
    width: 320px;
    height: 150px;
  }
  .go-text {
    font-size: 2.2rem;
  }
  .flag-container {
    width: 90vw;
    height: 300px;
  }
}
</style>
