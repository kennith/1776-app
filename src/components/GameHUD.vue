<script setup lang="ts">
import { ref, computed } from 'vue';
import type { PlayerState, Landmark, PlayerLoadout, BuildingId } from '../types';
import { MAIN_WEAPONS, SUB_WEAPONS, TOOLS, SPECIALTIES, BUILDING_BLUEPRINTS } from '../types';
import { soundManager } from '../audio/SoundManager';

const props = defineProps<{
  playerState: PlayerState;
  isLocked: boolean;
  isPaused?: boolean;
  isBackpackOpen?: boolean;
  isMapOpen?: boolean;
  mapDataUrl?: string;
  harvestToast?: { text: string; id: number } | null;
  landmarks: Landmark[];
  loadout: PlayerLoadout;
}>();

const emit = defineEmits<{
  (e: 'request-lock'): void;
  (e: 'toggle-backpack'): void;
  (e: 'close-backpack'): void;
  (e: 'toggle-map'): void;
  (e: 'close-map'): void;
  (e: 'toggle-building-mode'): void;
  (e: 'select-building', building: BuildingId): void;
  (e: 'return-to-title'): void;
  (e: 'teleport', x: number, z: number): void;
  (e: 'respawn'): void;
  (e: 'shoot'): void;
  (e: 'switch-slot', slot: 'main' | 'sub' | 'tool', toolIndex?: number): void;
}>();

const isMuted = ref(false);
const showMiniMap = ref(true);

const toggleMiniMap = () => {
  showMiniMap.value = !showMiniMap.value;
};

const toggleAudio = () => {
  isMuted.value = soundManager.toggleMute();
};

const cardinalDirection = computed(() => {
  const h = props.playerState.heading;
  if (h >= 337.5 || h < 22.5) return 'N';
  if (h >= 22.5 && h < 67.5) return 'NE';
  if (h >= 67.5 && h < 112.5) return 'E';
  if (h >= 112.5 && h < 157.5) return 'SE';
  if (h >= 157.5 && h < 202.5) return 'S';
  if (h >= 202.5 && h < 247.5) return 'SW';
  if (h >= 247.5 && h < 292.5) return 'W';
  return 'NW';
});
</script>

<template>
  <div class="hud-overlay">
    <!-- Underwater Visual Atmosphere & Blue Vignette Overlay -->
    <div v-if="playerState.isUnderwater" class="underwater-screen-fx">
      <div class="water-caustics"></div>
      <div class="water-vignette"></div>
      <div class="water-bubbles-fx">
        <span class="bubble b1">🫧</span>
        <span class="bubble b2">🫧</span>
        <span class="bubble b3">🫧</span>
      </div>
    </div>

    <!-- Floating Wood Harvest Toast Notification -->
    <transition name="toast-pop">
      <div v-if="harvestToast" class="harvest-toast font-cinzel">
        <span class="toast-icon">🪵</span>
        <span class="toast-text">{{ harvestToast.text }}</span>
      </div>
    </transition>

    <!-- Full-Screen Tactical Survey Map Modal (Press Q) -->
    <div v-if="isMapOpen" class="map-modal-backdrop" @click="emit('close-map')">
      <div class="map-modal-card parchment-border font-fell" @click.stop>
        <div class="map-modal-header">
          <div class="map-modal-title font-cinzel">
            <span class="map-title-icon">🗺️</span>
            <div>
              <h2>1776 CONTINENTAL ARMY SURVEY MAP</h2>
              <span class="map-title-sub font-fell">2000x2000 Yards Cartographer's Chart • Atlantic Coastline (Press <strong>Q</strong> to close)</span>
            </div>
          </div>
          <button class="map-close-btn font-cinzel" @click="emit('close-map')" title="Close Map (Q)">✕</button>
        </div>

        <div class="map-layout-body">
          <!-- Actual Topographic Terrain Survey Canvas Map -->
          <div class="main-map-viewport parchment-border">
            <div class="map-terrain-layer" :style="{ backgroundImage: `url(${mapDataUrl})` }">
              <!-- Grid lines -->
              <div class="map-grid-overlay">
                <div class="grid-line v-1"></div>
                <div class="grid-line v-2"></div>
                <div class="grid-line v-3"></div>
                <div class="grid-line h-1"></div>
                <div class="grid-line h-2"></div>
                <div class="grid-line h-3"></div>
              </div>

              <!-- Cardinal Labels -->
              <span class="cardinal-marker map-n font-cinzel">NORTH (ATLANTIC SEA)</span>
              <span class="cardinal-marker map-s font-cinzel">SOUTH</span>
              <span class="cardinal-marker map-e font-cinzel">EAST</span>
              <span class="cardinal-marker map-w font-cinzel">WEST</span>

              <!-- Player Position Pin & Field-of-View Cone -->
              <div
                class="map-player-pin"
                :style="{
                  left: `${((playerState.x + 1000) / 2000) * 100}%`,
                  top: `${((playerState.z + 1000) / 2000) * 100}%`
                }"
              >
                <div class="player-heading-cone" :style="{ transform: `rotate(${playerState.heading}deg)` }">
                  <div class="fov-cone"></div>
                  <div class="fov-arrow">▲</div>
                </div>
                <div class="player-dot-center"></div>
                <div class="player-tag font-cinzel">YOU</div>
              </div>
            </div>
          </div>

          <!-- Map Sidebar: Topographic Key & Legend -->
          <div class="map-sidebar font-cinzel">
            <div class="sidebar-box parchment-border">
              <h3 class="sidebar-heading">TERRAIN ELEVATIONS</h3>
              <div class="elevation-legend">
                <div class="legend-row">
                  <span class="legend-color ocean"></span>
                  <span class="legend-text">Atlantic Ocean (Endless Sea)</span>
                </div>
                <div class="legend-row">
                  <span class="legend-color sand"></span>
                  <span class="legend-text">Shoreline Coast Beaches</span>
                </div>
                <div class="legend-row">
                  <span class="legend-color plains"></span>
                  <span class="legend-text">Lowland Plains & Grassland</span>
                </div>
                <div class="legend-row">
                  <span class="legend-color forest"></span>
                  <span class="legend-text">Pine & Oak Woodlands</span>
                </div>
                <div class="legend-row">
                  <span class="legend-color mountain"></span>
                  <span class="legend-text">Highland Mountain Crags</span>
                </div>
                <div class="legend-row">
                  <span class="legend-color peak"></span>
                  <span class="legend-text">Independence Peak (120 ft)</span>
                </div>
              </div>
            </div>

            <div class="sidebar-box parchment-border">
              <h3 class="sidebar-heading">EXPEDITION INTEL</h3>
              <div class="intel-details font-fell">
                <div>• Map Scope: <strong>2000 × 2000 Yards</strong></div>
                <div>• Current Heading: <strong>{{ playerState.heading }}° ({{ cardinalDirection }})</strong></div>
                <div>• Movement: <strong class="active-badge">ACTIVE [W A S D / SPACE]</strong></div>
                <div>• Condition: <strong>{{ playerState.isUnderwater ? 'SUBMERGED (5s O2)' : playerState.isSwimming ? 'SWIMMING' : 'TERRESTRIAL' }}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Continental Army Backpack & Provisions Modal (Press E) -->
    <div v-if="isBackpackOpen" class="backpack-modal-backdrop" @click="emit('close-backpack')">
      <div class="backpack-modal-card parchment-border font-fell" @click.stop>
        <div class="backpack-header">
          <div class="backpack-title font-cinzel">
            <span class="bag-icon">🎒</span>
            <h2>CONTINENTAL ARMY RUCKSACK & PROVISIONS</h2>
          </div>
          <button class="backpack-close-btn" @click="emit('close-backpack')" title="Close (E)">✕</button>
        </div>
        <p class="backpack-sub font-fell">Frontier expedition inventory & harvested timber resources. (Press <strong>E</strong> to close • Movement Active)</p>

        <!-- Inventory Resource Grid (Wood Timber & Quarry Stone) -->
        <div class="inventory-grid font-cinzel">
          <div class="inv-item wood-item hero-wood-card">
            <div class="inv-item-icon">🪵</div>
            <div class="inv-item-info">
              <div class="inv-item-name font-cinzel">Pine & Oak Timber</div>
              <div class="inv-item-desc font-fell">Harvested from woodland trees using the Axe (9–14 timber per felled tree).</div>
              <div class="inv-item-stats font-cinzel">
                <span>AXE POWER: <strong>15 DMG</strong></span>
                <span>CHOP: <strong>3 SWINGS / TREE</strong></span>
              </div>
            </div>
            <div class="inv-item-count hero-count">
              <span class="count-num">{{ playerState.inventory?.wood ?? 0 }}</span>
              <span class="count-unit">UNITS</span>
            </div>
          </div>

          <div class="inv-item stone-item hero-wood-card">
            <div class="inv-item-icon">🪨</div>
            <div class="inv-item-info">
              <div class="inv-item-name font-cinzel">Quarry Granite Stone</div>
              <div class="inv-item-desc font-fell">Mined from mountain boulders and shoreline rocks using the Frontier Pickaxe (6–12 stone per boulder).</div>
              <div class="inv-item-stats font-cinzel">
                <span>PICK POWER: <strong>10 DMG</strong></span>
                <span>BREAK: <strong>5 HITS / ROCK</strong></span>
              </div>
            </div>
            <div class="inv-item-count hero-count">
              <span class="count-num">{{ playerState.inventory?.stone ?? 0 }}</span>
              <span class="count-unit">UNITS</span>
            </div>
          </div>
        </div>

        <!-- Frontier Military Building Blueprints Section in Rucksack -->
        <div class="backpack-blueprints-section font-cinzel">
          <div class="bp-sec-header">
            <span class="bp-sec-title">🏛️ FRONTIER MILITARY BLUEPRINTS (TIMBER & STONE CONSTRUCTION)</span>
            <button class="enter-build-btn font-cinzel" @click="emit('toggle-building-mode')">🔨 [B] ENTER BUILD MODE</button>
          </div>
          <div class="backpack-bp-list">
            <div
              v-for="bp in Object.values(BUILDING_BLUEPRINTS)"
              :key="bp.id"
              class="backpack-bp-card"
              :class="{ 'can-build': (playerState.inventory?.wood ?? 0) >= bp.woodCost && (playerState.inventory?.stone ?? 0) >= bp.stoneCost }"
              @click="emit('select-building', bp.id as BuildingId)"
            >
              <span class="bbp-icon">{{ bp.icon }}</span>
              <div class="bbp-info">
                <div class="bbp-name">{{ bp.name }}</div>
                <div class="bbp-desc font-fell">{{ bp.description }}</div>
              </div>
              <div class="bbp-badges-row font-cinzel">
                <span class="bbp-cost-badge" :class="{ ok: (playerState.inventory?.wood ?? 0) >= bp.woodCost && (playerState.inventory?.stone ?? 0) >= bp.stoneCost }">
                  🪵 {{ bp.woodCost }} <template v-if="bp.stoneCost > 0">• 🪨 {{ bp.stoneCost }}</template>
                </span>
                <span class="bbp-time-badge">
                  ⏱️ {{ bp.buildTime }}s
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Active Loadout Summary inside Backpack -->
        <div class="backpack-loadout-strip font-cinzel">
          <div class="equipped-slot">
            <span class="slot-tag">MAIN</span>
            <strong>{{ MAIN_WEAPONS[loadout.mainWeapon].name }}</strong>
          </div>
          <div class="equipped-slot">
            <span class="slot-tag">SUB</span>
            <strong>{{ SUB_WEAPONS[loadout.subWeapon].name }}</strong>
          </div>
          <div class="equipped-slot">
            <span class="slot-tag">TOOL</span>
            <strong>{{ TOOLS[loadout.tool].name }}</strong>
          </div>
          <div class="equipped-slot">
            <span class="slot-tag">CLASS</span>
            <strong>{{ SPECIALTIES[loadout.specialty].name }}</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- Expedition Casualty / Death Screen (When Health = 0) -->
    <div v-if="playerState.isDead" class="death-modal-backdrop">
      <div class="death-modal-card parchment-border font-fell">
        <div class="death-icon-header">⚔️</div>
        <h1 class="death-title font-cinzel">EXPEDITION CASUALTY</h1>
        <div class="death-cause-banner font-cinzel">
          {{ playerState.causeOfDeath || 'Perished in the 1776 Wilderness' }}
        </div>
        <p class="death-quote font-fell">
          "These are the times that try men's souls. The summer soldier and the sunshine patriot will, in this crisis, shrink from the service of their country..."
        </p>

        <!-- Expedition Debrief Stats -->
        <div class="death-stats-grid font-cinzel">
          <div class="death-stat-box">
            <span class="dstat-val">🪵 {{ playerState.inventory?.wood ?? 0 }} • 🪨 {{ playerState.inventory?.stone ?? 0 }}</span>
            <span class="dstat-lbl">RESOURCES HARVESTED</span>
          </div>
          <div class="death-stat-box">
            <span class="dstat-val">{{ SPECIALTIES[loadout.specialty].name }}</span>
            <span class="dstat-lbl">REGIMENT ROLE</span>
          </div>
          <div class="death-stat-box">
            <span class="dstat-val">X: {{ playerState.x }}, Z: {{ playerState.z }}</span>
            <span class="dstat-lbl">LAST POSITION</span>
          </div>
        </div>

        <!-- Respawn & Navigation Actions -->
        <div class="death-actions-row font-cinzel">
          <button class="death-btn respawn-btn" @click="emit('respawn')">
            🔄 RESPAWN AT EXPEDITION ORIGIN
          </button>
          <button class="death-btn title-btn" @click="emit('return-to-title')">
            🏛️ RETURN TO TITLE
          </button>
        </div>
      </div>
    </div>

    <!-- Pause / Escape Screen (Only when paused, alive, and backpack/map closed) -->
    <div v-if="isPaused && !isBackpackOpen && !isMapOpen && !playerState.isDead" class="lock-prompt-backdrop" @click="emit('request-lock')">
      <div class="lock-prompt-card parchment-border font-fell" @click.stop>
        <h2 class="font-cinzel prompt-title">1776 EXPEDITION PAUSED</h2>
        <div class="prompt-keys">
          <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</div>
          <div><kbd>SHIFT</kbd> Sprint</div>
          <div><kbd>CTRL</kbd> / <kbd>C</kbd> Crouch</div>
          <div><kbd>W</kbd> / <kbd>S</kbd> Climb Ladders</div>
          <div><kbd>Z</kbd> 1st / 3rd Person View</div>
          <div><kbd>SPACE</kbd> Jump / Vault</div>
          <div><kbd>E</kbd> Backpack</div>
          <div><kbd>Q</kbd> Map</div>
          <div><kbd>B</kbd> Build Mode</div>
          <div><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd><kbd>5</kbd> Weapons & Tools</div>
          <div><kbd>CLICK</kbd> Attack / Chop / Build</div>
          <div><kbd>ESC</kbd> Pause / Menu / Cancel</div>
        </div>
        <div class="loadout-summary-pill font-cinzel">
          Specialty: <strong>{{ SPECIALTIES[loadout.specialty].name }}</strong> ({{ SPECIALTIES[loadout.specialty].tagline }})
        </div>

        <!-- Menu Navigation Actions -->
        <div class="prompt-actions-row font-cinzel">
          <button class="prompt-btn resume-btn" @click="emit('request-lock')">
            ▶ RESUME GAME
          </button>
          <button class="prompt-btn title-menu-btn" @click="emit('return-to-title')">
            🏛️ RETURN TO TITLE
          </button>
        </div>
      </div>
    </div>

    <!-- Active In-Game HUD (when playing) -->
    <div class="active-hud-container" :class="{ 'pointer-events-none': isLocked && !isBackpackOpen && !isMapOpen }">
      <!-- Top Left: Clean Compass Widget -->
      <div class="top-left-panel pointer-events-auto">
        <div class="compass-widget parchment-border">
          <div class="compass-dial" :style="{ transform: `rotate(${-playerState.heading}deg)` }">
            <span class="compass-pt north">N</span>
            <span class="compass-pt east">E</span>
            <span class="compass-pt south">S</span>
            <span class="compass-pt west">W</span>
            <div class="needle"></div>
          </div>
          <div class="compass-info font-cinzel">
            <span class="heading-deg">{{ playerState.heading }}°</span>
            <span class="cardinal">{{ cardinalDirection }}</span>
          </div>
        </div>
      </div>

      <!-- Top Right: Navigation, Rucksack, Full Map & Mini-Map -->
      <div class="top-right-panel pointer-events-auto">
        <div class="quick-nav-bar parchment-border font-cinzel">
          <button class="action-btn backpack-hud-btn" @click="emit('toggle-backpack')" title="Open Backpack (E)">
            🎒 RUCKSACK [E]
          </button>
          <button class="action-btn map-hud-btn" @click="emit('toggle-map')" title="Open Full Map (Q)">
            🗺️ MAP [Q]
          </button>
          <button class="action-btn icon-btn" @click="toggleAudio" title="Toggle Sound">
            {{ isMuted ? '🔇' : '🎵' }}
          </button>
          <button class="action-btn icon-btn" @click="toggleMiniMap" title="Toggle Mini-Map">
            {{ showMiniMap ? '🧭 ON' : '🧭 OFF' }}
          </button>
          <button class="action-btn title-btn" @click="emit('return-to-title')">
            🏳️ TITLE
          </button>
        </div>

        <!-- Mini-Map Radar (Renders the Actual Topographic Terrain) -->
        <div v-if="showMiniMap" class="mini-map-box parchment-border" @click="emit('toggle-map')" title="Click or Press Q for Full Screen Map">
          <div class="radar-circle" :style="{ backgroundImage: `url(${mapDataUrl})` }">
            <div class="radar-crosshair-v"></div>
            <div class="radar-crosshair-h"></div>
            <!-- Player Location Pin on Mini-Map -->
            <div
              class="player-blip"
              :style="{
                left: `${((playerState.x + 1000) / 2000) * 100}%`,
                top: `${((playerState.z + 1000) / 2000) * 100}%`,
                transform: `translate(-50%, -50%) rotate(${playerState.heading}deg)`
              }"
            >
              ▲
            </div>
          </div>
          <div class="map-label font-cinzel">2000x2000 CHART [Q]</div>
        </div>
      </div>

      <!-- Center Crosshair & Reticle -->
      <div v-if="isLocked && !isMapOpen && !isBackpackOpen" class="center-crosshair">
        <div class="reticle-dot" :class="{ 'reloading-dot': playerState.isReloading }"></div>
        <div class="reticle-line top"></div>
        <div class="reticle-line bottom"></div>
        <div class="reticle-line left"></div>
        <div class="reticle-line right"></div>

        <!-- Reloading Gauge -->
        <div v-if="playerState.isReloading" class="hud-reload-gauge font-cinzel">
          <div class="reload-spinner"></div>
          <div class="reload-label">
            <span>RELOADING...</span>
            <span class="reload-seconds">
              {{ ((1 - playerState.reloadProgress) * playerState.reloadTimeTotal).toFixed(1) }}s
            </span>
          </div>
          <div class="reload-bar-track">
            <div class="reload-bar-fill" :style="{ width: `${playerState.reloadProgress * 100}%` }"></div>
          </div>
        </div>
      </div>

      <!-- 1776 Frontier Building & Construction Dock (When in Build Mode) -->
      <transition name="build-dock-slide">
        <div v-if="playerState.isBuildingMode && !isPaused" class="building-mode-dock parchment-border font-cinzel pointer-events-auto">
          <div class="build-dock-header">
            <div class="build-title-row">
              <span class="build-title-badge">🔨 1776 FRONTIER CONSTRUCTION MODE</span>
              <span class="build-wood-inventory">🪵 <strong>{{ playerState.inventory?.wood ?? 0 }}</strong> WOOD • 🪨 <strong>{{ playerState.inventory?.stone ?? 0 }}</strong> STONE</span>
            </div>
            <div class="build-help-hints font-fell">
              <span><strong>[X]</strong> Begin Construction ({{ BUILDING_BLUEPRINTS[playerState.selectedBuilding]?.buildTime ?? 2.5 }}s)</span> • 
              <span><strong>[R]</strong> Rotate 45°</span> • 
              <span><strong>[1-8 / Scroll]</strong> Select Blueprint</span> • 
              <button class="exit-build-btn font-cinzel" @click="emit('toggle-building-mode')">✕ [ESC / B] EXIT</button>
            </div>
          </div>

          <div class="blueprints-grid">
            <div
              v-for="(bp, index) in Object.values(BUILDING_BLUEPRINTS)"
              :key="bp.id"
              class="blueprint-card"
              :class="{
                'selected-bp': playerState.selectedBuilding === bp.id,
                'can-afford': (playerState.inventory?.wood ?? 0) >= bp.woodCost && (playerState.inventory?.stone ?? 0) >= bp.stoneCost,
                'cannot-afford': (playerState.inventory?.wood ?? 0) < bp.woodCost || (playerState.inventory?.stone ?? 0) < bp.stoneCost
              }"
              @click="emit('select-building', bp.id as BuildingId)"
            >
              <div class="bp-key-badge font-cinzel">[{{ index + 1 }}]</div>
              <div class="bp-icon">{{ bp.icon }}</div>
              <div class="bp-details">
                <span class="bp-name font-cinzel">{{ bp.name }}</span>
                <div class="bp-meta-row font-cinzel">
                  <span
                    class="bp-cost"
                    :class="{
                      'cost-ok': (playerState.inventory?.wood ?? 0) >= bp.woodCost && (playerState.inventory?.stone ?? 0) >= bp.stoneCost,
                      'cost-err': (playerState.inventory?.wood ?? 0) < bp.woodCost || (playerState.inventory?.stone ?? 0) < bp.stoneCost
                    }"
                  >
                    🪵 {{ bp.woodCost }} <template v-if="bp.stoneCost > 0">• 🪨 {{ bp.stoneCost }}</template>
                  </span>
                  <span class="bp-time-tag">⏱️ {{ bp.buildTime }}s</span>
                </div>
                <span class="bp-desc font-fell">{{ bp.description }}</span>
              </div>
              <div v-if="playerState.selectedBuilding === bp.id" class="bp-active-tag font-cinzel">✓ ACTIVE</div>
            </div>
          </div>
        </div>
      </transition>

      <!-- 1776 Frontier Construction Progress Channeling Bar -->
      <transition name="build-dock-slide">
        <div v-if="playerState.isConstructing && !isPaused" class="construction-channel-bar parchment-border font-cinzel pointer-events-none">
          <div class="channel-header">
            <span class="channel-icon">🔨</span>
            <span class="channel-title">CONSTRUCTING {{ playerState.constructingBuildingName.toUpperCase() }}</span>
            <span class="channel-timer font-fell">{{ (playerState.constructionProgress * 100).toFixed(0) }}% ({{ playerState.constructionRemaining.toFixed(1) }}s)</span>
          </div>
          <div class="channel-progress-outer">
            <div
              class="channel-progress-fill"
              :style="{ width: `${playerState.constructionProgress * 100}%` }"
            ></div>
          </div>
          <div class="channel-hint font-fell">Carpentry in progress • Stay within 10 paces • [Esc] Cancel</div>
        </div>
      </transition>

      <!-- Bottom Center: Health & 3-Slot Weapon Hotbar -->
      <div class="bottom-center-panel pointer-events-auto">
        <!-- Health Bar Row -->
        <div class="status-bars-container font-cinzel">
          <div class="health-bar-container parchment-border">
            <div class="bar-header">
              <span class="bar-title">HEALTH</span>
              <span class="bar-num">{{ playerState.health }} / {{ playerState.maxHealth }}</span>
            </div>
            <div class="bar-outer">
              <div
                class="bar-fill health-fill"
                :style="{ width: `${(playerState.health / playerState.maxHealth) * 100}%` }"
                :class="{ 'health-low': playerState.health < 35 }"
              ></div>
            </div>
          </div>

          <!-- Stamina / Sprint Energy Bar -->
          <div class="stamina-bar-container parchment-border">
            <div class="bar-header">
              <span class="bar-title">⚡ ENERGY</span>
              <span class="bar-num" :class="{ 'stamina-exhausted': playerState.isExhausted }">
                {{ playerState.isExhausted ? 'EXHAUSTED' : `${playerState.stamina}%` }}
              </span>
            </div>
            <div class="bar-outer">
              <div
                class="bar-fill stamina-fill"
                :style="{ width: `${(playerState.stamina / playerState.maxStamina) * 100}%` }"
                :class="{ 'stamina-depleted': playerState.isExhausted || playerState.stamina < 20 }"
              ></div>
            </div>
          </div>

          <!-- Oxygen / Breath 5-Second Gauge -->
          <div v-if="playerState.isUnderwater || playerState.breath < 4.95" class="breath-bar-container parchment-border">
            <div class="bar-header">
              <span class="bar-title">🫧 OXYGEN</span>
              <span class="bar-num" :class="{ 'breath-critical': playerState.breath < 1.8 }">
                {{ Math.max(0, playerState.breath).toFixed(1) }}s / 5.0s
              </span>
            </div>
            <div class="bar-outer">
              <div
                class="bar-fill breath-fill"
                :style="{ width: `${(playerState.breath / playerState.maxBreath) * 100}%` }"
                :class="{ 'breath-low': playerState.breath < 1.8 }"
              ></div>
            </div>
          </div>

          <!-- Swimming & Diving Status Badge -->
          <div v-if="playerState.isSwimming" class="swimming-badge parchment-border font-cinzel">
            <span class="swim-icon">{{ playerState.isUnderwater ? '🫧' : '🏊' }}</span>
            <div class="swim-info-col">
              <span class="swim-text">{{ playerState.isUnderwater ? 'DIVING' : 'SWIMMING' }}</span>
              <span class="swim-sub font-fell">[Space] Surface • [Ctrl] Sink</span>
            </div>
          </div>

          <!-- Land Crouching Status Badge -->
          <div v-if="playerState.isCrouching" class="crouch-badge parchment-border font-cinzel">
            <span class="crouch-text">CROUCHED</span>
          </div>

          <!-- Ladder Climbing Status Badge -->
          <div v-if="playerState.isClimbing" class="climbing-badge parchment-border font-cinzel">
            <span class="climb-icon">🪜</span>
            <div class="climb-info-col">
              <span class="climb-text">CLIMBING LADDER</span>
              <span class="climb-sub font-fell">[W / Space] Climb Up • [S / Ctrl] Down</span>
            </div>
          </div>

          <div class="specialty-indicator parchment-border">
            <span class="spec-icon">{{ SPECIALTIES[loadout.specialty].icon }}</span>
            <div class="spec-text">
              <span class="spec-name">{{ SPECIALTIES[loadout.specialty].name }}</span>
              <span class="spec-tag">{{ SPECIALTIES[loadout.specialty].tagline }}</span>
            </div>
          </div>
        </div>

        <!-- Weapon & Tool Hotbar ([1], [2], [3], [B]) -->
        <div class="weapon-hotbar parchment-border font-cinzel">
          <div
            class="hotbar-slot"
            :class="{
              active: playerState.activeSlot === 'main' && !playerState.isBuildingMode,
              'slot-reloading': playerState.slotReloads?.main?.isReloading
            }"
            @click="emit('switch-slot', 'main')"
          >
            <div class="slot-num">1</div>
            <div class="slot-icon">{{ MAIN_WEAPONS[loadout.mainWeapon].icon }}</div>
            <div class="slot-info">
              <span class="slot-name">{{ MAIN_WEAPONS[loadout.mainWeapon].name }}</span>
              <span class="slot-cat">
                MAIN • {{ MAIN_WEAPONS[loadout.mainWeapon].reloadTime > 0 ? `${MAIN_WEAPONS[loadout.mainWeapon].reloadTime}s Reload` : 'Melee' }}
              </span>
            </div>
            <div v-if="playerState.slotReloads?.main?.isReloading" class="slot-reload-overlay">
              <div class="slot-reload-fill" :style="{ width: `${playerState.slotReloads.main.progress * 100}%` }"></div>
            </div>
          </div>

          <div
            class="hotbar-slot"
            :class="{
              active: playerState.activeSlot === 'sub' && !playerState.isBuildingMode,
              'slot-reloading': playerState.slotReloads?.sub?.isReloading
            }"
            @click="emit('switch-slot', 'sub')"
          >
            <div class="slot-num">2</div>
            <div class="slot-icon">{{ SUB_WEAPONS[loadout.subWeapon].icon }}</div>
            <div class="slot-info">
              <span class="slot-name">{{ SUB_WEAPONS[loadout.subWeapon].name }}</span>
              <span class="slot-cat">
                SUB • {{ SUB_WEAPONS[loadout.subWeapon].reloadTime > 0 ? `${SUB_WEAPONS[loadout.subWeapon].reloadTime}s Reload` : 'Melee' }}
              </span>
            </div>
            <div v-if="playerState.slotReloads?.sub?.isReloading" class="slot-reload-overlay">
              <div class="slot-reload-fill" :style="{ width: `${playerState.slotReloads.sub.progress * 100}%` }"></div>
            </div>
          </div>

          <!-- Dynamic Tool Slots ([3], [4], [5]) -->
          <div
            v-for="(tId, tIdx) in (playerState.equippedTools && playerState.equippedTools.length > 0 ? playerState.equippedTools : [loadout.tool || 'axe'])"
            :key="`${tId}_${tIdx}`"
            class="hotbar-slot"
            :class="{
              active: playerState.activeSlot === 'tool' && playerState.selectedToolIndex === tIdx && !playerState.isBuildingMode,
              'slot-reloading': playerState.slotReloads?.tool?.isReloading && playerState.selectedToolIndex === tIdx
            }"
            @click="emit('switch-slot', 'tool', tIdx)"
            :title="`Press ${tIdx + 3} to equip ${TOOLS[tId]?.name || 'Tool'}`"
          >
            <div class="slot-num">{{ tIdx + 3 }}</div>
            <div class="slot-icon">{{ TOOLS[tId]?.icon || '🪓' }}</div>
            <div class="slot-info">
              <span class="slot-name">{{ TOOLS[tId]?.name || 'Tool' }}</span>
              <span class="slot-cat">
                TOOL • {{ tId === 'med_kit' ? 'Heals 20 HP' : tId === 'shovel' ? 'Digs 3ft / 5 DMG' : tId === 'pickaxe' ? '10 DMG (5-Hit Stone)' : '15 DMG (3-Hit)' }}
              </span>
            </div>
            <div v-if="playerState.slotReloads?.tool?.isReloading && playerState.selectedToolIndex === tIdx" class="slot-reload-overlay">
              <div class="slot-reload-fill" :style="{ width: `${playerState.slotReloads.tool.progress * 100}%` }"></div>
            </div>
          </div>

          <!-- Build Mode Quick Hotbar Button -->
          <div
            class="hotbar-slot build-hotbar-slot"
            :class="{ active: playerState.isBuildingMode }"
            @click="emit('toggle-building-mode')"
          >
            <div class="slot-num">B</div>
            <div class="slot-icon">🔨</div>
            <div class="slot-info">
              <span class="slot-name">BUILD</span>
              <span class="slot-cat">🪵 {{ playerState.inventory?.wood ?? 0 }} • 🪨 {{ playerState.inventory?.stone ?? 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hud-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 20;
}

.pointer-events-none {
  pointer-events: none;
}

.pointer-events-auto {
  pointer-events: auto;
}

/* Floating Harvest Toast Notification */
.harvest-toast {
  position: absolute;
  top: 14%;
  left: 50%;
  transform: translateX(-50%);
  background: radial-gradient(circle at center, #2b1d0c 0%, #150d05 100%);
  border: 2px solid var(--color-patriot-gold);
  color: #fff1b0;
  padding: 12px 28px;
  border-radius: 30px;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 2px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.8), 0 0 25px rgba(212, 175, 55, 0.6);
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: none;
}

.toast-pop-enter-active {
  animation: toastIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.toast-pop-leave-active {
  animation: toastOut 0.4s ease-in forwards;
}

@keyframes toastIn {
  0% { opacity: 0; transform: translate(-50%, -20px) scale(0.85); }
  100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
}

@keyframes toastOut {
  0% { opacity: 1; transform: translate(-50%, 0) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -30px) scale(0.9); }
}

/* Full-Screen Tactical Map Modal (Press Q) */
.map-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(10, 18, 30, 0.85);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: auto;
  z-index: 85;
}

.map-modal-card {
  background: #f4e8cb;
  color: #1b263b;
  padding: 24px 30px;
  border-radius: 10px;
  max-width: 920px;
  width: 92%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.95);
  animation: modalScaleIn 0.25s ease-out;
}

.map-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--color-antique-gold);
  padding-bottom: 8px;
  margin-bottom: 12px;
}

.map-modal-title {
  display: flex;
  align-items: center;
  gap: 14px;
}

.map-title-icon {
  font-size: 2rem;
}

.map-modal-title h2 {
  font-size: 1.35rem;
  letter-spacing: 2px;
  color: #8b2500;
  margin: 0;
}

.map-title-sub {
  font-size: 0.85rem;
  color: #4a4a4a;
}

.map-close-btn {
  background: #1b263b;
  color: #f5e6c8;
  border: 1px solid var(--color-patriot-gold);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  transition: all 0.2s;
}

.map-close-btn:hover {
  background: #8b0000;
  color: #fff;
}

.map-layout-body {
  display: flex;
  gap: 20px;
}

.main-map-viewport {
  flex: 1;
  aspect-ratio: 1 / 1;
  max-height: 520px;
  background: #004c8c;
  position: relative;
  overflow: hidden;
  border-radius: 6px;
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.6);
}

.map-terrain-layer {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  position: relative;
}

.map-grid-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.grid-line {
  position: absolute;
  background: rgba(212, 175, 55, 0.25);
}

.grid-line.v-1 { top: 0; bottom: 0; left: 25%; width: 1px; }
.grid-line.v-2 { top: 0; bottom: 0; left: 50%; width: 1px; }
.grid-line.v-3 { top: 0; bottom: 0; left: 75%; width: 1px; }
.grid-line.h-1 { left: 0; right: 0; top: 25%; height: 1px; }
.grid-line.h-2 { left: 0; right: 0; top: 50%; height: 1px; }
.grid-line.h-3 { left: 0; right: 0; top: 75%; height: 1px; }

.cardinal-marker {
  position: absolute;
  font-size: 0.65rem;
  font-weight: 800;
  color: rgba(255, 245, 204, 0.9);
  background: rgba(13, 27, 42, 0.7);
  padding: 2px 6px;
  border-radius: 4px;
}

.map-n { top: 6px; left: 50%; transform: translateX(-50%); color: #ff6b6b; }
.map-s { bottom: 6px; left: 50%; transform: translateX(-50%); }
.map-e { right: 6px; top: 50%; transform: translateY(-50%); }
.map-w { left: 6px; top: 50%; transform: translateY(-50%); }

.map-landmark-pin {
  position: absolute;
  transform: translate(-50%, -50%);
  cursor: pointer;
  z-index: 10;
}

.pin-star {
  color: #ffd700;
  font-size: 16px;
  text-shadow: 0 0 6px #000;
  animation: starPulse 1.5s ease-in-out infinite alternate;
}

@keyframes starPulse {
  from { transform: scale(0.9); }
  to { transform: scale(1.2); }
}

.pin-tooltip {
  display: none;
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #1b263b;
  color: #fff;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  white-space: nowrap;
  border: 1px solid var(--color-patriot-gold);
}

.map-landmark-pin:hover .pin-tooltip {
  display: block;
}

.map-player-pin {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 20;
}

.player-heading-cone {
  position: absolute;
  top: 50%; left: 50%;
  width: 0; height: 0;
  transition: transform 0.05s linear;
}

.fov-arrow {
  position: absolute;
  top: -24px; left: -6px;
  color: #ff2222;
  font-size: 14px;
  line-height: 1;
  text-shadow: 0 0 6px rgba(0, 0, 0, 0.9);
}

.player-dot-center {
  width: 10px;
  height: 10px;
  background: #ff2222;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 10px #ff2222;
}

.player-tag {
  position: absolute;
  top: 12px; left: 50%;
  transform: translateX(-50%);
  font-size: 0.65rem;
  font-weight: 800;
  color: #ff2222;
  background: rgba(0, 0, 0, 0.6);
  padding: 1px 4px;
  border-radius: 3px;
}

.map-sidebar {
  width: 250px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sidebar-box {
  background: rgba(27, 38, 59, 0.08);
  padding: 12px 14px;
  border-radius: 6px;
}

.sidebar-heading {
  font-size: 0.8rem;
  letter-spacing: 1px;
  color: #8b2500;
  margin: 0 0 10px 0;
  border-bottom: 1px solid rgba(139, 37, 0, 0.2);
  padding-bottom: 4px;
}

.elevation-legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 16px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.3);
}

.legend-color.ocean { background: #0072b2; }
.legend-color.sand { background: #e0cfb0; }
.legend-color.plains { background: #3e6b36; }
.legend-color.forest { background: #274e22; }
.legend-color.mountain { background: #5c574f; }
.legend-color.peak { background: #eef2f7; }

.legend-text {
  font-size: 0.72rem;
  color: #2b2b2b;
}

.intel-details {
  font-size: 0.8rem;
  color: #333;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.frozen-badge {
  color: #8b0000;
  font-weight: 800;
}

/* Backpack Modal Backdrop & Card */
.backpack-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(10, 18, 30, 0.82);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: auto;
  z-index: 80;
}

.backpack-modal-card {
  background: #f4e8cb;
  color: #1b263b;
  padding: 28px 36px;
  border-radius: 10px;
  max-width: 650px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.95);
  animation: modalScaleIn 0.25s ease-out;
}

@keyframes modalScaleIn {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}

.backpack-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--color-antique-gold);
  padding-bottom: 10px;
  margin-bottom: 8px;
}

.backpack-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.backpack-title h2 {
  font-size: 1.25rem;
  letter-spacing: 1.5px;
  color: #8b2500;
  margin: 0;
}

.bag-icon {
  font-size: 1.6rem;
}

.backpack-close-btn {
  background: transparent;
  border: none;
  font-size: 1.4rem;
  color: #555;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.backpack-close-btn:hover {
  color: #8b0000;
  background: rgba(0, 0, 0, 0.08);
}

.backpack-sub {
  font-size: 0.95rem;
  color: #4a4a4a;
  margin-bottom: 18px;
}

.inventory-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.inventory-grid.single-item {
  grid-template-columns: 1fr;
}

.inv-item {
  display: flex;
  align-items: center;
  background: rgba(27, 38, 59, 0.06);
  border: 1px solid rgba(139, 101, 8, 0.35);
  padding: 10px 14px;
  border-radius: 6px;
  gap: 12px;
}

.wood-item {
  background: rgba(139, 69, 19, 0.12);
  border: 2px solid #8b4513;
}

.hero-wood-card {
  padding: 20px 24px;
  background: radial-gradient(circle at center, rgba(139, 69, 19, 0.16) 0%, rgba(92, 45, 12, 0.22) 100%);
  border: 2px solid #8b4513;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.hero-wood-card .inv-item-icon {
  font-size: 3.2rem;
  margin-right: 8px;
}

.hero-wood-card .inv-item-name {
  font-size: 1.25rem;
  color: #5c2d0c;
  letter-spacing: 1px;
}

.hero-wood-card .inv-item-desc {
  font-size: 0.9rem;
  color: #3b281c;
  margin: 4px 0 8px 0;
}

.inv-item-stats {
  display: flex;
  gap: 14px;
  font-size: 0.75rem;
  color: #8b2500;
}

.hero-count {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px !important;
}

.hero-count .count-num {
  font-size: 2.2rem;
  font-weight: 900;
  line-height: 1;
  color: #8b2500;
}

.hero-count .count-unit {
  font-size: 0.65rem;
  letter-spacing: 1px;
  font-weight: 700;
  color: #5c2d0c;
}

.backpack-loadout-strip {
  display: flex;
  justify-content: space-between;
  background: #1b263b;
  color: #f5e6c8;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 0.8rem;
  margin-bottom: 0;
}

.equipped-slot .slot-tag {
  color: var(--color-patriot-gold);
  margin-right: 4px;
}

/* Pointer Lock Prompt Screen */
.lock-prompt-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(13, 27, 42, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: auto;
  cursor: pointer;
  z-index: 50;
}

.lock-prompt-card {
  background: #f5e6c8;
  color: #1b263b;
  padding: 30px 40px;
  border-radius: 8px;
  text-align: center;
  max-width: 520px;
  box-shadow: 0 15px 50px rgba(0, 0, 0, 0.9);
}

.prompt-title {
  font-size: 1.4rem;
  letter-spacing: 2px;
  color: #8b2500;
  margin-bottom: 12px;
}

.prompt-keys {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin: 14px 0;
  font-size: 0.9rem;
}

.prompt-keys kbd {
  background: #2b1d06;
  color: #f5e6c8;
  padding: 3px 7px;
  border-radius: 4px;
  font-family: monospace;
  margin-right: 4px;
}

.loadout-summary-pill {
  background: rgba(27, 38, 59, 0.15);
  border: 1px solid var(--color-antique-gold);
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 0.85rem;
  margin: 10px 0;
}

.prompt-actions-row {
  display: flex;
  justify-content: center;
  gap: 14px;
  margin-top: 14px;
}

.prompt-btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 1.5px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.resume-btn {
  background: radial-gradient(circle at center, #d4af37 0%, #8b6508 100%);
  border: 1px solid #fff5cc;
  color: #0d1b2a;
  box-shadow: 0 4px 15px rgba(212, 175, 55, 0.5);
}

.resume-btn:hover {
  background: radial-gradient(circle at center, #fff1b0 0%, #d4af37 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 245, 204, 0.7);
}

.title-menu-btn {
  background: #1b263b;
  border: 1px solid var(--color-patriot-gold);
  color: var(--color-parchment);
}

.title-menu-btn:hover {
  background: #2c3e50;
  border-color: #fff1b0;
  color: #fff;
  transform: translateY(-2px);
}

/* Active HUD Layout */
.active-hud-container {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px;
  box-sizing: border-box;
}

/* Top Left Compass */
.top-left-panel {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.compass-widget {
  background: rgba(245, 230, 200, 0.9);
  padding: 8px 12px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
}

.compass-dial {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 2px solid var(--color-antique-gold);
  position: relative;
  background: #0d1b2a;
  display: flex;
  justify-content: center;
  align-items: center;
}

.compass-pt {
  position: absolute;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--color-parchment);
}

.compass-pt.north { top: 2px; color: var(--color-colonial-red); }
.compass-pt.south { bottom: 2px; }
.compass-pt.east { right: 4px; }
.compass-pt.west { left: 4px; }

.needle {
  width: 2px;
  height: 38px;
  background: linear-gradient(to bottom, var(--color-colonial-red) 50%, var(--color-parchment) 50%);
}

.compass-info {
  margin-top: 4px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #1b263b;
  display: flex;
  gap: 6px;
}

/* Top Right Navigation & Action Bar */
.top-right-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.quick-nav-bar {
  background: rgba(245, 230, 200, 0.92);
  padding: 6px 10px;
  border-radius: 6px;
  display: flex;
  gap: 6px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
}

.action-btn {
  background: #2b1d0c;
  color: var(--color-patriot-gold);
  border: 1px solid var(--color-patriot-gold);
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.backpack-hud-btn {
  background: radial-gradient(circle at center, #8b4513 0%, #5c2d0c 100%);
  color: #fff5cc;
}

.backpack-hud-btn:hover {
  background: radial-gradient(circle at center, #a0522d 0%, #8b4513 100%);
  transform: translateY(-1px);
}

.map-hud-btn {
  background: radial-gradient(circle at center, #1b3b22 0%, #0c2012 100%);
  color: #bbf2c8;
}

.map-hud-btn:hover {
  background: radial-gradient(circle at center, #275430 0%, #1b3b22 100%);
  transform: translateY(-1px);
}

.icon-btn {
  padding: 5px 8px;
}

.title-btn {
  background: #8b2500;
  color: #fff;
  border-color: #d4af37;
}

.title-btn:hover {
  background: #a82e00;
}

/* Mini-Map Radar (Renders Actual Topographic Terrain Chart) */
.mini-map-box {
  background: rgba(245, 230, 200, 0.92);
  padding: 8px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  transition: transform 0.2s ease;
}

.mini-map-box:hover {
  transform: scale(1.04);
}

.radar-circle {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 2px solid var(--color-antique-gold);
  position: relative;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.8);
}

.radar-crosshair-v {
  position: absolute;
  top: 0; bottom: 0; left: 50%;
  width: 1px;
  background: rgba(212, 175, 55, 0.35);
}

.radar-crosshair-h {
  position: absolute;
  left: 0; right: 0; top: 50%;
  height: 1px;
  background: rgba(212, 175, 55, 0.35);
}

.player-blip {
  position: absolute;
  color: #ff2222;
  font-size: 14px;
  line-height: 14px;
  text-shadow: 0 0 4px #fff;
}

.landmark-blip {
  position: absolute;
  transform: translate(-50%, -50%);
  color: #ffd700;
  font-size: 10px;
  text-shadow: 0 0 3px #000;
}

.map-label {
  font-size: 0.65rem;
  font-weight: 800;
  color: #1b263b;
  margin-top: 4px;
  letter-spacing: 0.5px;
}

/* Center Crosshair */
.center-crosshair {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.reticle-dot {
  width: 4px;
  height: 4px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
}

.reloading-dot {
  background: var(--color-patriot-gold);
  box-shadow: 0 0 8px var(--color-patriot-gold);
}

.reticle-line {
  position: absolute;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
}

.reticle-line.top { width: 2px; height: 8px; top: -14px; left: 1px; }
.reticle-line.bottom { width: 2px; height: 8px; bottom: -14px; left: 1px; }
.reticle-line.left { width: 8px; height: 2px; left: -14px; top: 1px; }
.reticle-line.right { width: 8px; height: 2px; right: -14px; top: 1px; }

/* Reloading Gauge */
.hud-reload-gauge {
  position: absolute;
  top: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(13, 27, 42, 0.85);
  border: 1px solid var(--color-patriot-gold);
  padding: 6px 12px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 140px;
}

.reload-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(212, 175, 55, 0.3);
  border-top-color: var(--color-patriot-gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.reload-label {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-patriot-gold);
}

.reload-bar-track {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  overflow: hidden;
}

.reload-bar-fill {
  height: 100%;
  background: var(--color-patriot-gold);
  transition: width 0.05s linear;
}

/* Bottom Center Panel */
.bottom-center-panel {
  align-self: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* Status Bars Container */
.status-bars-container {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.health-bar-container {
  background: rgba(245, 230, 200, 0.92);
  padding: 6px 12px;
  border-radius: 6px;
  width: 180px;
}

.bar-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  font-weight: 700;
  margin-bottom: 4px;
  color: #1b263b;
}

.bar-outer {
  height: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.health-fill {
  height: 100%;
  background: linear-gradient(to right, #4caf50, #8bc34a);
  transition: width 0.2s ease;
}

.health-low {
  background: linear-gradient(to right, #e53935, #f44336);
  animation: healthPulse 1s ease infinite alternate;
}

@keyframes healthPulse {
  0% { opacity: 0.8; }
  100% { opacity: 1; }
}

.stamina-bar-container {
  background: rgba(245, 230, 200, 0.92);
  padding: 6px 12px;
  border-radius: 6px;
  width: 150px;
}

.stamina-bar-container .bar-title {
  color: #b8860b;
}

.stamina-fill {
  height: 100%;
  background: linear-gradient(to right, #f59e0b, #fbbf24);
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
  transition: width 0.1s linear;
}

.stamina-depleted {
  background: linear-gradient(to right, #d97706, #ef4444);
  animation: staminaPulse 0.6s ease infinite alternate;
}

.stamina-exhausted {
  color: #dc2626 !important;
  font-weight: 800;
  animation: staminaPulse 0.6s ease infinite alternate;
}

@keyframes staminaPulse {
  0% { opacity: 0.6; }
  100% { opacity: 1; }
}

.specialty-indicator {
  background: rgba(245, 230, 200, 0.92);
  padding: 6px 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.spec-icon {
  font-size: 1.2rem;
}

.spec-text {
  display: flex;
  flex-direction: column;
}

.spec-name {
  font-size: 0.75rem;
  font-weight: 700;
  color: #8b2500;
}

.spec-tag {
  font-size: 0.6rem;
  color: #555;
}

/* Weapon Hotbar */
.weapon-hotbar {
  background: rgba(245, 230, 200, 0.92);
  padding: 6px 10px;
  border-radius: 8px;
  display: flex;
  gap: 8px;
}

.hotbar-slot {
  position: relative;
  background: #1b263b;
  border: 1px solid var(--color-antique-gold);
  border-radius: 6px;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
}

.hotbar-slot:hover {
  background: #2c3e50;
  transform: translateY(-2px);
}

.hotbar-slot.active {
  background: radial-gradient(circle at center, #2c3e50 0%, #0d1b2a 100%);
  border-color: var(--color-patriot-gold);
  box-shadow: 0 0 15px rgba(212, 175, 55, 0.6);
}

.slot-num {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--color-patriot-gold);
  background: rgba(0, 0, 0, 0.4);
  padding: 2px 6px;
  border-radius: 4px;
}

.slot-icon {
  font-size: 1.3rem;
}

.slot-info {
  display: flex;
  flex-direction: column;
}

.slot-name {
  font-size: 0.8rem;
  font-weight: 700;
  color: #fff;
}

.slot-cat {
  font-size: 0.65rem;
  color: var(--color-parchment);
}

.slot-reload-overlay {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 4px;
  background: rgba(0, 0, 0, 0.5);
}

.slot-reload-fill {
  height: 100%;
  background: var(--color-patriot-gold);
}

/* Underwater Atmosphere Screen Effect */
.underwater-screen-fx {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  background: radial-gradient(circle at center, rgba(0, 80, 160, 0.45) 0%, rgba(0, 20, 60, 0.82) 100%);
  animation: underwaterPulse 4s ease-in-out infinite alternate;
}

@keyframes underwaterPulse {
  0% { opacity: 0.85; filter: hue-rotate(0deg); }
  100% { opacity: 0.98; filter: hue-rotate(15deg); }
}

.water-vignette {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 120px rgba(0, 10, 30, 0.95), inset 0 0 40px rgba(0, 160, 240, 0.4);
}

.water-bubbles-fx {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.water-bubbles-fx .bubble {
  position: absolute;
  font-size: 24px;
  animation: floatUp 3s linear infinite;
  opacity: 0.6;
}

.bubble.b1 { left: 25%; bottom: -30px; animation-duration: 3.2s; animation-delay: 0.2s; font-size: 28px; }
.bubble.b2 { left: 55%; bottom: -30px; animation-duration: 2.8s; animation-delay: 0.8s; font-size: 20px; }
.bubble.b3 { left: 80%; bottom: -30px; animation-duration: 3.6s; animation-delay: 1.4s; font-size: 24px; }

@keyframes floatUp {
  0% { transform: translateY(0) scale(0.8); opacity: 0; }
  20% { opacity: 0.7; }
  80% { opacity: 0.7; }
  100% { transform: translateY(-110vh) scale(1.3); opacity: 0; }
}

/* Oxygen / Breath Gauge */
.breath-bar-container {
  background: rgba(10, 30, 60, 0.92);
  border: 1px solid #4fc3f7;
  padding: 6px 12px;
  border-radius: 6px;
  width: 160px;
  box-shadow: 0 4px 15px rgba(0, 114, 178, 0.5);
  animation: breathPopIn 0.3s ease-out;
}

@keyframes breathPopIn {
  from { opacity: 0; transform: translateY(10px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.breath-bar-container .bar-title {
  color: #81d4fa;
}

.breath-bar-container .bar-num {
  color: #e1f5fe;
  font-weight: 800;
}

.breath-fill {
  height: 100%;
  background: linear-gradient(to right, #0288d1, #29b6f6);
  box-shadow: 0 0 8px rgba(79, 195, 247, 0.8);
  transition: width 0.1s linear;
}

.breath-low {
  background: linear-gradient(to right, #d32f2f, #ff5252);
  animation: breathFlashing 0.6s ease infinite alternate;
  box-shadow: 0 0 12px rgba(255, 82, 82, 0.9);
}

.breath-critical {
  color: #ff5252 !important;
  animation: breathFlashing 0.6s ease infinite alternate;
}

@keyframes breathFlashing {
  0% { opacity: 0.7; }
  100% { opacity: 1; }
}

/* Swimming Status Badge */
.swimming-badge {
  background: rgba(0, 76, 140, 0.9);
  border: 1px solid #4fc3f7;
  color: #e1f5fe;
  padding: 5px 10px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 1px;
}

.swim-info-col {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
  text-align: left;
}

.swim-sub {
  font-size: 0.65rem;
  color: #b3e5fc;
  letter-spacing: 0.5px;
}

.swim-icon {
  font-size: 1.2rem;
}

/* Land Crouching Status Badge */
.crouch-badge {
  background: rgba(43, 29, 12, 0.9);
  border: 1px solid var(--color-patriot-gold);
  color: #fff1b0;
  padding: 5px 10px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 1px;
}

.crouch-icon {
  font-size: 1.1rem;
}

/* Ladder Climbing Status Badge */
.climbing-badge {
  background: rgba(30, 20, 10, 0.95);
  border: 1.5px solid var(--color-patriot-gold);
  color: #fff1b0;
  padding: 5px 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 15px rgba(212, 175, 55, 0.35);
}

.climb-icon {
  font-size: 1.2rem;
}

.climb-info-col {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
  text-align: left;
}

.climb-text {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 1px;
  color: #ffd700;
}

.climb-sub {
  font-size: 0.65rem;
  color: #ebd7b2;
  letter-spacing: 0.5px;
}

.active-badge {
  color: #2e7d32;
  font-weight: 800;
}

/* Expedition Casualty & Death Screen Overlay */
.death-modal-backdrop {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(80, 0, 0, 0.75) 0%, rgba(10, 0, 0, 0.95) 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
  pointer-events: auto;
  animation: deathFadeIn 0.8s ease-out forwards;
}

@keyframes deathFadeIn {
  0% { opacity: 0; transform: scale(1.05); }
  100% { opacity: 1; transform: scale(1); }
}

.death-modal-card {
  background: #f4e8d1;
  color: #2b1d06;
  padding: 32px 36px;
  border-radius: 12px;
  max-width: 580px;
  width: 90%;
  text-align: center;
  border: 4px solid #8b0000;
  box-shadow: 0 0 50px rgba(139, 0, 0, 0.8), 0 20px 60px rgba(0, 0, 0, 0.95);
  animation: deathCardPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes deathCardPop {
  0% { transform: scale(0.85); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.death-icon-header {
  font-size: 3rem;
  margin-bottom: 8px;
  filter: drop-shadow(0 0 10px rgba(139, 0, 0, 0.6));
}

.death-title {
  font-size: 1.9rem;
  letter-spacing: 3px;
  color: #8b0000;
  margin: 0 0 10px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.death-cause-banner {
  display: inline-block;
  background: #2b0808;
  color: #ffcccc;
  padding: 6px 18px;
  border-radius: 20px;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 1px;
  border: 1px solid #8b0000;
  margin-bottom: 14px;
}

.death-quote {
  font-size: 0.95rem;
  font-style: italic;
  line-height: 1.45;
  color: #5a422d;
  margin: 0 0 18px 0;
  border-left: 3px solid #8b0000;
  border-right: 3px solid #8b0000;
  padding: 0 14px;
}

.death-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 24px;
}

.death-stat-box {
  background: rgba(43, 29, 6, 0.08);
  border: 1px solid var(--color-antique-gold);
  padding: 10px 8px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.dstat-val {
  font-size: 0.95rem;
  font-weight: 800;
  color: #8b2500;
}

.dstat-lbl {
  font-size: 0.65rem;
  letter-spacing: 0.5px;
  color: #555;
}

.death-actions-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.death-btn {
  padding: 12px 20px;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 1.5px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.respawn-btn {
  background: radial-gradient(circle at center, #d4af37 0%, #8b6508 100%);
  border: 1px solid #fff5cc;
  color: #0d1b2a;
  box-shadow: 0 4px 15px rgba(212, 175, 55, 0.5);
}

.respawn-btn:hover {
  background: radial-gradient(circle at center, #fff1b0 0%, #d4af37 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 245, 204, 0.7);
}

.death-btn.title-btn {
  background: #1b263b;
  border: 1px solid var(--color-patriot-gold);
  color: var(--color-parchment);
}

.death-btn.title-btn:hover {
  background: #2c3e50;
  border-color: #fff1b0;
  color: #fff;
  transform: translateY(-2px);
}

/* =========================================
   1776 Frontier Building Construction Dock
   ========================================= */
.building-mode-dock {
  position: absolute;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 920px;
  background: rgba(13, 27, 42, 0.95);
  border: 2px solid var(--color-patriot-gold);
  border-radius: 8px;
  padding: 14px 18px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.9), 0 0 25px rgba(212, 175, 55, 0.4);
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.build-dock-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(212, 175, 55, 0.3);
  padding-bottom: 8px;
}

.build-title-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.build-title-badge {
  background: var(--color-patriot-gold);
  color: #0d1b2a;
  padding: 3px 10px;
  border-radius: 4px;
  font-weight: 900;
  font-size: 0.85rem;
  letter-spacing: 1.5px;
}

.build-wood-inventory {
  color: #fff1b0;
  font-size: 0.9rem;
  letter-spacing: 1px;
}

.build-wood-inventory strong {
  color: #fff;
  font-size: 1.05rem;
  text-shadow: 0 0 8px rgba(212, 175, 55, 0.8);
}

.build-help-hints {
  color: #d1ccc0;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

.build-help-hints strong {
  color: var(--color-patriot-gold);
}

.exit-build-btn {
  background: #c0392b;
  border: 1px solid #e74c3c;
  color: #fff;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.exit-build-btn:hover {
  background: #e74c3c;
  transform: scale(1.04);
}

.blueprints-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

.blueprint-card {
  position: relative;
  background: rgba(27, 38, 59, 0.85);
  border: 1.5px solid rgba(212, 175, 55, 0.35);
  border-radius: 6px;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.blueprint-card:hover {
  border-color: var(--color-patriot-gold);
  transform: translateY(-3px);
  box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
}

.blueprint-card.selected-bp {
  background: radial-gradient(circle at center, rgba(212, 175, 55, 0.25) 0%, rgba(27, 38, 59, 0.95) 100%);
  border-color: #fff1b0;
  box-shadow: 0 0 20px rgba(212, 175, 55, 0.6);
  transform: translateY(-4px);
}

.blueprint-card.cannot-afford {
  opacity: 0.65;
  filter: grayscale(0.2);
}

.bp-key-badge {
  position: absolute;
  top: 4px;
  left: 6px;
  font-size: 0.7rem;
  color: var(--color-patriot-gold);
  font-weight: 900;
}

.bp-icon {
  font-size: 1.8rem;
  margin-top: 4px;
}

.bp-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bp-name {
  color: #fff;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  line-height: 1.2;
}

.bp-cost {
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 1px;
}

.bp-cost.cost-ok {
  color: #2ed573;
}

.bp-cost.cost-err {
  color: #ff4757;
}

.bp-desc {
  font-size: 0.68rem;
  color: #b2bec3;
  line-height: 1.15;
  margin-top: 2px;
}

.bp-active-tag {
  background: var(--color-patriot-gold);
  color: #0d1b2a;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.62rem;
  font-weight: 900;
  letter-spacing: 1px;
}

/* Backpack Blueprints Section */
.backpack-blueprints-section {
  margin-top: 15px;
  background: rgba(244, 238, 219, 0.6);
  border: 1px dashed rgba(139, 101, 8, 0.4);
  border-radius: 6px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bp-sec-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bp-sec-title {
  font-size: 0.85rem;
  font-weight: 900;
  color: #3b2a1a;
  letter-spacing: 1px;
}

.enter-build-btn {
  background: radial-gradient(circle at center, #d4af37 0%, #8b6508 100%);
  border: 1px solid #fff5cc;
  color: #0d1b2a;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.enter-build-btn:hover {
  transform: scale(1.04);
  box-shadow: 0 2px 10px rgba(212, 175, 55, 0.5);
}

.backpack-bp-list {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.backpack-bp-card {
  background: #efe6cc;
  border: 1px solid #c2a878;
  border-radius: 5px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.backpack-bp-card:hover {
  background: #fbf5df;
  border-color: #8b6508;
  transform: translateY(-2px);
}

.bbp-icon {
  font-size: 1.4rem;
}

.bbp-name {
  font-size: 0.72rem;
  font-weight: 800;
  color: #2c1e11;
}

.bbp-desc {
  font-size: 0.62rem;
  color: #555;
  line-height: 1.1;
}

.bbp-cost-badge {
  font-size: 0.7rem;
  font-weight: 900;
  padding: 2px 6px;
  border-radius: 3px;
  background: #e74c3c;
  color: #fff;
}

.bbp-cost-badge.ok {
  background: #27ae60;
  color: #fff;
}

.bbp-badges-row {
  display: flex;
  gap: 4px;
  align-items: center;
}

.bbp-time-badge {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 2px 5px;
  border-radius: 3px;
  background: #3b2a1a;
  color: #f1dfa8;
}

.bp-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0;
}

.bp-time-tag {
  font-size: 0.72rem;
  font-weight: 800;
  color: #8b6508;
  background: rgba(212, 175, 55, 0.15);
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid rgba(212, 175, 55, 0.4);
}

/* Construction Channeling Bar */
.construction-channel-bar {
  position: absolute;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  background: radial-gradient(circle at center, rgba(30, 20, 10, 0.95) 0%, rgba(15, 10, 5, 0.98) 100%);
  border: 2px solid var(--color-patriot-gold);
  border-radius: 8px;
  padding: 10px 18px;
  min-width: 380px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.75), 0 0 20px rgba(212, 175, 55, 0.3);
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 100;
}

.channel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.channel-icon {
  font-size: 1.2rem;
  animation: hammerBounce 0.55s infinite ease-in-out;
}

@keyframes hammerBounce {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-25deg) translateY(-2px); }
}

.channel-title {
  font-size: 0.85rem;
  font-weight: 900;
  color: #fff2b2;
  letter-spacing: 1px;
  flex: 1;
  text-align: left;
}

.channel-timer {
  font-size: 0.85rem;
  font-weight: 700;
  color: #e0cfb0;
}

.channel-progress-outer {
  width: 100%;
  height: 12px;
  background: rgba(0, 0, 0, 0.65);
  border-radius: 6px;
  border: 1px solid rgba(212, 175, 55, 0.5);
  overflow: hidden;
}

.channel-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #b8860b 0%, #ffd700 50%, #ffae19 100%);
  border-radius: 6px;
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.8);
  transition: width 0.05s linear;
}

.channel-hint {
  font-size: 0.72rem;
  color: #c4b595;
  text-align: center;
}

/* Animations */
.build-dock-slide-enter-active,
.build-dock-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.build-dock-slide-enter-from,
.build-dock-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, 40px);
}
</style>
