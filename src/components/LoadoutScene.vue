<script setup lang="ts">
import { ref } from 'vue';
import { soundManager } from '../audio/SoundManager';
import type { PlayerLoadout, MainWeaponId, SubWeaponId, ToolId, SpecialtyId } from '../types';
import { MAIN_WEAPONS, SUB_WEAPONS, TOOLS, SPECIALTIES } from '../types';

const props = defineProps<{
  initialLoadout: PlayerLoadout;
}>();

const emit = defineEmits<{
  (e: 'save-loadout', loadout: PlayerLoadout): void;
  (e: 'start-game', loadout: PlayerLoadout): void;
  (e: 'return-to-title'): void;
}>();

const selectedMain = ref<MainWeaponId>(props.initialLoadout.mainWeapon);
const selectedSub = ref<SubWeaponId>(props.initialLoadout.subWeapon);
const selectedTools = ref<ToolId[]>(
  props.initialLoadout.tools && props.initialLoadout.tools.length > 0
    ? [...props.initialLoadout.tools]
    : [props.initialLoadout.tool || 'axe']
);
const selectedTool = ref<ToolId>(selectedTools.value[0] || props.initialLoadout.tool || 'axe');
const selectedSpecialty = ref<SpecialtyId>(props.initialLoadout.specialty);

const activeTab = ref<'all' | 'main' | 'sub' | 'tool' | 'specialty'>('all');
const isManifestCollapsed = ref(false);

const toggleManifest = () => {
  isManifestCollapsed.value = !isManifestCollapsed.value;
  soundManager.playClick();
};

const selectMain = (id: MainWeaponId) => {
  selectedMain.value = id;
  soundManager.playClick();
  if (id === 'sword') soundManager.playSwordSlash();
  else if (id === 'kentucky') soundManager.playRifleCrack();
  else soundManager.playMusketFire();
};

const selectSub = (id: SubWeaponId) => {
  selectedSub.value = id;
  soundManager.playClick();
  if (id === 'flintlock_pistol') soundManager.playPistolShot();
  else if (id === 'knife' || id === 'machete') soundManager.playSwordSlash();
  else if (id === 'grenade') soundManager.playExplosion();
};

const toggleTool = (id: ToolId) => {
  soundManager.playClick();
  soundManager.playToolAction(id);

  const idx = selectedTools.value.indexOf(id);
  if (idx >= 0) {
    // If already equipped, deselect it unless it's the only one left (minimum 1)
    if (selectedTools.value.length > 1) {
      selectedTools.value.splice(idx, 1);
    }
  } else {
    // Equip tool up to max 3
    if (selectedTools.value.length < 3) {
      selectedTools.value.push(id);
    } else {
      // If already at max 3, replace the 3rd tool
      selectedTools.value[2] = id;
    }
  }
  selectedTool.value = selectedTools.value[0] || id;
};

const selectSpecialty = (id: SpecialtyId) => {
  selectedSpecialty.value = id;
  soundManager.playClick();
};

const getLoadoutObject = (): PlayerLoadout => ({
  mainWeapon: selectedMain.value,
  subWeapon: selectedSub.value,
  tool: selectedTools.value[0] || 'axe',
  tools: [...selectedTools.value],
  specialty: selectedSpecialty.value
});

const onDeployClicked = () => {
  soundManager.playClick();
  soundManager.startPatrioticTheme();
  emit('start-game', getLoadoutObject());
};

const onBackClicked = () => {
  soundManager.playClick();
  emit('save-loadout', getLoadoutObject());
  emit('return-to-title');
};
</script>

<template>
  <div class="loadout-scene-wrapper">
    <!-- Header -->
    <header class="loadout-header">
      <button class="back-btn font-cinzel" @click="onBackClicked">
        <span>← RETURN TO HEADQUARTERS</span>
      </button>

      <div class="header-center">
        <h1 class="loadout-title font-cinzel-dec">COLONIAL ARMORY & LOADOUT</h1>
        <p class="loadout-subtitle font-fell">
          Select exactly <strong>one</strong> from each section before marching into the 1776 frontier
        </p>
      </div>

      <button class="deploy-btn font-cinzel-dec" @click="onDeployClicked">
        <span>DEPLOY TO BATTLE →</span>
      </button>
    </header>

    <!-- Category Filter Tabs -->
    <nav class="category-tabs font-cinzel">
      <button :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'">ALL SECTIONS</button>
      <button :class="{ active: activeTab === 'main' }" @click="activeTab = 'main'">1. MAIN WEAPONS</button>
      <button :class="{ active: activeTab === 'sub' }" @click="activeTab = 'sub'">2. SUB WEAPONS</button>
      <button :class="{ active: activeTab === 'tool' }" @click="activeTab = 'tool'">3. TOOLS</button>
      <button :class="{ active: activeTab === 'specialty' }" @click="activeTab = 'specialty'">4. SPECIALTIES</button>
    </nav>

    <!-- Main Content Container (Scrollable) -->
    <div class="loadout-content-layout">
      <div class="sections-scroll-area">
        <!-- 1. MAIN WEAPONS SECTION -->
        <section v-if="activeTab === 'all' || activeTab === 'main'" class="loadout-section">
          <div class="section-badge font-cinzel">
            <span class="sec-num">SECTION 1</span>
            <span class="sec-title">MAIN WEAPONS (CHOOSE ONE)</span>
            <span class="sec-status">Selected: <strong>{{ MAIN_WEAPONS[selectedMain].name }}</strong></span>
          </div>

          <div class="cards-grid">
            <div
              v-for="weapon in Object.values(MAIN_WEAPONS)"
              :key="weapon.id"
              class="selection-card parchment-border"
              :class="{ selected: selectedMain === weapon.id }"
              @click="selectMain(weapon.id as MainWeaponId)"
            >
              <div class="card-radio-indicator">
                <span v-if="selectedMain === weapon.id">✓ EQUIPPED</span>
                <span v-else>CHOOSE</span>
              </div>

              <div class="card-header">
                <span class="weapon-icon">{{ weapon.icon }}</span>
                <div>
                  <h3 class="weapon-name font-cinzel">{{ weapon.name }}</h3>
                  <span class="weapon-type font-fell">{{ weapon.type }}</span>
                </div>
              </div>

              <p class="weapon-desc font-fell">{{ weapon.description }}</p>

              <!-- Stat Bars -->
              <div class="stat-bars">
                <div class="stat-row">
                  <span class="stat-lbl">DAMAGE:</span>
                  <div class="bar-track"><div class="bar-fill damage" :style="{ width: `${weapon.damage}%` }"></div></div>
                  <span class="stat-val">{{ weapon.damage }}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-lbl">RANGE:</span>
                  <div class="bar-track"><div class="bar-fill range" :style="{ width: `${(weapon.range / 250) * 100}%` }"></div></div>
                  <span class="stat-val">{{ weapon.range }}m</span>
                </div>
                <div class="stat-row">
                  <span class="stat-lbl">RELOAD:</span>
                  <div class="bar-track">
                    <div
                      class="bar-fill reload"
                      :style="{ width: `${weapon.reloadTime > 0 ? (weapon.reloadTime / 6.0) * 100 : 0}%` }"
                    ></div>
                  </div>
                  <span class="stat-val" :class="{ 'gold-text': weapon.reloadTime > 0 }">
                    {{ weapon.reloadTime > 0 ? `${weapon.reloadTime}s` : 'Instant' }}
                  </span>
                </div>
              </div>

              <div class="card-lore font-fell">📜 <em>{{ weapon.lore }}</em></div>
            </div>
          </div>
        </section>

        <!-- 2. SUB WEAPONS SECTION -->
        <section v-if="activeTab === 'all' || activeTab === 'sub'" class="loadout-section">
          <div class="section-badge font-cinzel">
            <span class="sec-num">SECTION 2</span>
            <span class="sec-title">SUB WEAPONS (CHOOSE ONE)</span>
            <span class="sec-status">Selected: <strong>{{ SUB_WEAPONS[selectedSub].name }}</strong></span>
          </div>

          <div class="cards-grid">
            <div
              v-for="sub in Object.values(SUB_WEAPONS)"
              :key="sub.id"
              class="selection-card parchment-border"
              :class="{ selected: selectedSub === sub.id }"
              @click="selectSub(sub.id as SubWeaponId)"
            >
              <div class="card-radio-indicator">
                <span v-if="selectedSub === sub.id">✓ EQUIPPED</span>
                <span v-else>CHOOSE</span>
              </div>

              <div class="card-header">
                <span class="weapon-icon">{{ sub.icon }}</span>
                <div>
                  <h3 class="weapon-name font-cinzel">{{ sub.name }}</h3>
                  <span class="weapon-type font-fell">{{ sub.type }}</span>
                </div>
              </div>

              <p class="weapon-desc font-fell">{{ sub.description }}</p>

              <div class="stat-bars">
                <div class="stat-row">
                  <span class="stat-lbl">DAMAGE:</span>
                  <div class="bar-track"><div class="bar-fill damage" :style="{ width: `${(sub.damage / 120) * 100}%` }"></div></div>
                  <span class="stat-val">{{ sub.damage }}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-lbl">SPEED:</span>
                  <div class="bar-track"><div class="bar-fill rate" :style="{ width: `${(sub.fireRate / 4) * 100}%` }"></div></div>
                  <span class="stat-val">{{ sub.fireRate }}x</span>
                </div>
                <div class="stat-row">
                  <span class="stat-lbl">RELOAD:</span>
                  <div class="bar-track">
                    <div
                      class="bar-fill reload"
                      :style="{ width: `${sub.reloadTime > 0 ? Math.min(100, (sub.reloadTime / 80.0) * 100) : 0}%` }"
                    ></div>
                  </div>
                  <span class="stat-val" :class="{ 'gold-text': sub.reloadTime > 0 }">
                    {{ sub.reloadTime > 0 ? `${sub.reloadTime}s` : 'Instant' }}
                  </span>
                </div>
              </div>

              <div class="card-lore font-fell">📜 <em>{{ sub.lore }}</em></div>
            </div>
          </div>
        </section>

        <!-- 3. TOOLS SECTION (EQUIP UP TO 3) -->
        <section v-if="activeTab === 'all' || activeTab === 'tool'" class="loadout-section">
          <div class="section-badge font-cinzel">
            <span class="sec-num">SECTION 3</span>
            <span class="sec-title">TOOLS (EQUIP UP TO THREE)</span>
            <span class="sec-status">Selected ({{ selectedTools.length }}/3): <strong>{{ selectedTools.map(t => TOOLS[t].name).join(' • ') }}</strong></span>
          </div>

          <div class="cards-grid cols-4">
            <div
              v-for="tool in Object.values(TOOLS)"
              :key="tool.id"
              class="selection-card parchment-border"
              :class="{ selected: selectedTools.includes(tool.id as ToolId) }"
              @click="toggleTool(tool.id as ToolId)"
            >
              <div class="card-radio-indicator">
                <span v-if="selectedTools.includes(tool.id as ToolId)">✓ EQUIPPED (SLOT {{ selectedTools.indexOf(tool.id as ToolId) + 3 }})</span>
                <span v-else>+ EQUIP (UP TO 3)</span>
              </div>

              <div class="card-header">
                <span class="weapon-icon">{{ tool.icon }}</span>
                <div>
                  <h3 class="weapon-name font-cinzel">{{ tool.name }}</h3>
                  <span class="weapon-type font-fell">{{ tool.type }}</span>
                </div>
              </div>

              <!-- Tool Stat Bars instead of description -->
              <div v-if="tool.id === 'axe'" class="stat-bars tool-stat-bars font-cinzel">
                <div class="stat-row">
                  <span class="stat-lbl">DAMAGE:</span>
                  <div class="bar-track"><div class="bar-fill damage" style="width: 25%;"></div></div>
                  <span class="stat-val">15 DMG</span>
                </div>
                <div class="stat-row">
                  <span class="stat-lbl">TREE CHOP:</span>
                  <div class="bar-track"><div class="bar-fill rate" style="width: 100%;"></div></div>
                  <span class="stat-val">3 Hits (45 HP)</span>
                </div>
                <div class="stat-row">
                  <span class="stat-lbl">TIMBER:</span>
                  <div class="bar-track"><div class="bar-fill gold" style="width: 85%;"></div></div>
                  <span class="stat-val">9-14 Wood 🪵</span>
                </div>
              </div>

              <div v-else-if="tool.id === 'shovel'" class="stat-bars tool-stat-bars font-cinzel">
                <div class="stat-row">
                  <span class="stat-lbl">DIG DEPTH:</span>
                  <div class="bar-track"><div class="bar-fill gold" style="width: 75%;"></div></div>
                  <span class="stat-val">3 FT / 4 Swings</span>
                </div>
                <div class="stat-row">
                  <span class="stat-lbl">DAMAGE:</span>
                  <div class="bar-track"><div class="bar-fill damage" style="width: 10%;"></div></div>
                  <span class="stat-val">5 DMG</span>
                </div>
                <div class="stat-row">
                  <span class="stat-lbl">DIG SPEED:</span>
                  <div class="bar-track"><div class="bar-fill rate" style="width: 60%;"></div></div>
                  <span class="stat-val">1.2x</span>
                </div>
              </div>

              <div v-else-if="tool.id === 'pickaxe'" class="stat-bars tool-stat-bars font-cinzel">
                <div class="stat-row">
                  <span class="stat-lbl">DAMAGE:</span>
                  <div class="bar-track"><div class="bar-fill damage" style="width: 40%;"></div></div>
                  <span class="stat-val">25 DMG</span>
                </div>
                <div class="stat-row">
                  <span class="stat-lbl">MINE SPEED:</span>
                  <div class="bar-track"><div class="bar-fill rate" style="width: 75%;"></div></div>
                  <span class="stat-val">1.1x</span>
                </div>
                <div class="stat-row">
                  <span class="stat-lbl">TARGET:</span>
                  <div class="bar-track"><div class="bar-fill gold" style="width: 90%;"></div></div>
                  <span class="stat-val">Rock & Stone 🪨</span>
                </div>
              </div>

              <div v-else class="stat-bars tool-stat-bars font-cinzel">
                <div class="stat-row">
                  <span class="stat-lbl">HEALING:</span>
                  <div class="bar-track"><div class="bar-fill health" style="width: 50%;"></div></div>
                  <span class="stat-val">+20 HP</span>
                </div>
                <div class="stat-row">
                  <span class="stat-lbl">RELOAD:</span>
                  <div class="bar-track"><div class="bar-fill reload" style="width: 100%;"></div></div>
                  <span class="stat-val">60s (1 MIN)</span>
                </div>
                <div class="stat-row">
                  <span class="stat-lbl">ITEM:</span>
                  <div class="bar-track"><div class="bar-fill rate" style="width: 100%;"></div></div>
                  <span class="stat-val">Med Kit Box 🧰</span>
                </div>
              </div>

              <div class="card-lore font-fell">📜 <em>{{ tool.lore }}</em></div>
            </div>
          </div>
        </section>

        <!-- 4. SPECIALTY SECTION -->
        <section v-if="activeTab === 'all' || activeTab === 'specialty'" class="loadout-section">
          <div class="section-badge font-cinzel specialty-sec-badge">
            <span class="sec-num">SECTION 4</span>
            <span class="sec-title">SPECIALTY (CHOOSE ONE)</span>
            <span class="sec-status">Selected: <strong>{{ SPECIALTIES[selectedSpecialty].name }}</strong></span>
          </div>

          <div class="cards-grid specialty-grid">
            <div
              v-for="spec in Object.values(SPECIALTIES)"
              :key="spec.id"
              class="selection-card specialty-card parchment-border"
              :class="{ selected: selectedSpecialty === spec.id }"
              @click="selectSpecialty(spec.id as SpecialtyId)"
            >
              <div class="card-radio-indicator">
                <span v-if="selectedSpecialty === spec.id">✓ ACTIVE SPECIALTY</span>
                <span v-else>SELECT</span>
              </div>

              <div class="card-header">
                <span class="weapon-icon">{{ spec.icon }}</span>
                <div>
                  <h3 class="weapon-name font-cinzel">{{ spec.name }}</h3>
                  <span class="weapon-type font-fell">{{ spec.tagline }}</span>
                </div>
              </div>

              <p class="weapon-desc font-fell spec-desc"><strong>{{ spec.description }}</strong></p>

              <div class="spec-traits font-fell">
                <div class="trait-group pros">
                  <div v-for="(pro, idx) in spec.pros" :key="idx" class="trait-line pro">
                    <span>✓</span> {{ pro }}
                  </div>
                </div>
                <div class="trait-group cons">
                  <div v-for="(con, idx) in spec.cons" :key="idx" class="trait-line con">
                    <span>✗</span> {{ con }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Expedition Manifest (Shrinkable to Short Bottom Bar / Expandable to Full Dashboard) -->
      <footer
        class="loadout-manifest-dock parchment-border font-cinzel"
        :class="{ 'is-short': isManifestCollapsed }"
      >
        <!-- Top Bar Header of Manifest with Shrink/Unshrink toggle -->
        <div class="manifest-dock-header">
          <div class="header-left">
            <span class="manifest-title-icon">📜</span>
            <span class="manifest-title-text">EXPEDITION MANIFEST</span>
            <span v-if="isManifestCollapsed" class="short-mode-tag font-fell">(SHRUNK VIEW)</span>
          </div>

          <!-- Shrunk Quick Slots Preview (Visible when short) -->
          <div v-if="isManifestCollapsed" class="short-manifest-preview font-fell" @click="toggleManifest">
            <div class="short-slot">
              <span class="short-cat font-cinzel">MAIN:</span>
              <span class="short-icon">{{ MAIN_WEAPONS[selectedMain].icon }}</span>
              <strong class="short-name">{{ MAIN_WEAPONS[selectedMain].name }}</strong>
            </div>
            <div class="short-slot">
              <span class="short-cat font-cinzel">SUB:</span>
              <span class="short-icon">{{ SUB_WEAPONS[selectedSub].icon }}</span>
              <strong class="short-name">{{ SUB_WEAPONS[selectedSub].name }}</strong>
            </div>
            <div class="short-slot">
              <span class="short-cat font-cinzel">TOOLS ({{ selectedTools.length }}/3):</span>
              <span class="short-icon">{{ selectedTools.map(t => TOOLS[t].icon).join(' ') }}</span>
              <strong class="short-name">{{ selectedTools.map(t => TOOLS[t].name).join(', ') }}</strong>
            </div>
            <div class="short-slot specialty-short-slot">
              <span class="short-cat font-cinzel">SPECIALTY:</span>
              <span class="short-icon">{{ SPECIALTIES[selectedSpecialty].icon }}</span>
              <strong class="short-name gold-text">{{ SPECIALTIES[selectedSpecialty].name }}</strong>
            </div>
          </div>

          <div class="header-actions">
            <button
              class="manifest-size-toggle-btn"
              :title="isManifestCollapsed ? 'Unshrink (Make Taller)' : 'Shrink (Make Shorter)'"
              @click="toggleManifest"
            >
              <span v-if="isManifestCollapsed">▲ UNSHRINK (EXPAND TALLER)</span>
              <span v-else>▼ SHRINK (MAKE SHORTER)</span>
            </button>
            <button class="manifest-quick-go-btn font-cinzel-dec" @click="onDeployClicked">
              GO (DEPLOY)
            </button>
          </div>
        </div>

        <!-- Expanded Full Details (Visible when NOT shrunk) -->
        <div v-if="!isManifestCollapsed" class="manifest-dock-expanded-content">
          <div class="summary-slots font-fell">
            <div class="summary-slot">
              <span class="slot-label font-cinzel">MAIN WEAPON</span>
              <div class="slot-val">
                <span class="slot-icon">{{ MAIN_WEAPONS[selectedMain].icon }}</span>
                <div>
                  <strong>{{ MAIN_WEAPONS[selectedMain].name }}</strong>
                  <div class="slot-sub">{{ MAIN_WEAPONS[selectedMain].type }}</div>
                </div>
              </div>
            </div>

            <div class="summary-slot">
              <span class="slot-label font-cinzel">SUB WEAPON</span>
              <div class="slot-val">
                <span class="slot-icon">{{ SUB_WEAPONS[selectedSub].icon }}</span>
                <div>
                  <strong>{{ SUB_WEAPONS[selectedSub].name }}</strong>
                  <div class="slot-sub">{{ SUB_WEAPONS[selectedSub].type }}</div>
                </div>
              </div>
            </div>

            <div class="summary-slot">
              <span class="slot-label font-cinzel">TOOLS ({{ selectedTools.length }}/3 EQUIPPED)</span>
              <div class="slot-val multi-tool-dock-list">
                <div v-for="(tId, tIdx) in selectedTools" :key="tId" class="multi-tool-dock-item">
                  <span class="slot-icon">{{ TOOLS[tId].icon }}</span>
                  <div>
                    <strong>[{{ tIdx + 3 }}] {{ TOOLS[tId].name }}</strong>
                    <div class="slot-sub">{{ TOOLS[tId].type }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="summary-slot specialty-slot">
              <span class="slot-label font-cinzel">SPECIALTY CLASS</span>
              <div class="slot-val">
                <span class="slot-icon">{{ SPECIALTIES[selectedSpecialty].icon }}</span>
                <div>
                  <strong class="gold-text">{{ SPECIALTIES[selectedSpecialty].name }}</strong>
                  <div class="slot-sub">{{ SPECIALTIES[selectedSpecialty].tagline }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Calculated Net Attribute Modifiers -->
          <div class="sidebar-stats font-cinzel">
            <div class="sidebar-stat-title">NET ATTRIBUTES</div>
            <div class="net-stat-row">
              <span>MAX HEALTH:</span>
              <strong :class="{ buff: SPECIALTIES[selectedSpecialty].modifiers.healthMultiplier > 1, debuff: SPECIALTIES[selectedSpecialty].modifiers.healthMultiplier < 1 }">
                {{ Math.round(100 * SPECIALTIES[selectedSpecialty].modifiers.healthMultiplier) }} HP
              </strong>
            </div>
            <div class="net-stat-row">
              <span>SPEED MODIFIER:</span>
              <strong :class="{ buff: SPECIALTIES[selectedSpecialty].modifiers.speedMultiplier > 1, debuff: SPECIALTIES[selectedSpecialty].modifiers.speedMultiplier < 1 }">
                {{ Math.round((SPECIALTIES[selectedSpecialty].modifiers.speedMultiplier - 1) * 100) > 0 ? '+' : '' }}{{ Math.round((SPECIALTIES[selectedSpecialty].modifiers.speedMultiplier - 1) * 100) }}%
              </strong>
            </div>
            <div class="net-stat-row">
              <span>DAMAGE MODIFIER:</span>
              <strong :class="{ buff: SPECIALTIES[selectedSpecialty].modifiers.damageMultiplier > 1, debuff: SPECIALTIES[selectedSpecialty].modifiers.damageMultiplier < 1 }">
                {{ Math.round((SPECIALTIES[selectedSpecialty].modifiers.damageMultiplier - 1) * 100) > 0 ? '+' : '' }}{{ Math.round((SPECIALTIES[selectedSpecialty].modifiers.damageMultiplier - 1) * 100) }}%
              </strong>
            </div>
          </div>

          <button class="deploy-action-btn font-cinzel-dec" @click="onDeployClicked">
            <span>MARCH TO 1776 (GO)</span>
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.loadout-scene-wrapper {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: radial-gradient(circle at center, #1b263b 0%, #0d1b2a 65%, #050a12 100%);
  color: var(--color-parchment);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.loadout-header {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 30px;
  background: rgba(13, 27, 42, 0.95);
  border-bottom: 2px solid var(--color-patriot-gold);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
}

.back-btn {
  background: #1b263b;
  border: 1px solid var(--color-antique-gold);
  color: var(--color-parchment);
  padding: 10px 18px;
  border-radius: 4px;
  font-size: 0.85rem;
  letter-spacing: 1.5px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-btn:hover {
  background: var(--color-antique-gold);
  color: #0d1b2a;
}

.header-center {
  text-align: center;
}

.loadout-title {
  font-size: 1.8rem;
  letter-spacing: 4px;
  color: #fff9e6;
  text-shadow: 0 0 10px rgba(212, 175, 55, 0.6);
}

.loadout-subtitle {
  font-size: 0.95rem;
  color: var(--color-antique-gold);
  margin-top: 4px;
}

.deploy-btn {
  background: radial-gradient(circle at center, #d4af37 0%, #a67c1e 100%);
  border: 2px solid #fff5cc;
  color: #0d1b2a;
  padding: 10px 24px;
  border-radius: 6px;
  font-size: 1rem;
  letter-spacing: 2px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(212, 175, 55, 0.4);
  transition: all 0.2s ease;
}

.deploy-btn:hover {
  background: radial-gradient(circle at center, #fff1b0 0%, #d4af37 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 245, 204, 0.7);
}

/* Category Tabs */
.category-tabs {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 10px 20px;
  background: rgba(13, 27, 42, 0.8);
  border-bottom: 1px solid rgba(212, 175, 55, 0.3);
}

.category-tabs button {
  background: transparent;
  border: 1px solid transparent;
  color: var(--color-parchment);
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.85rem;
  letter-spacing: 1.5px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.category-tabs button:hover {
  border-color: var(--color-antique-gold);
  color: #fff;
}

.category-tabs button.active {
  background: var(--color-patriot-gold);
  color: #0d1b2a;
  font-weight: 800;
  box-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
}

/* Layout: Content on top, Manifest dock on bottom */
.loadout-content-layout {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.sections-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px 30px;
  display: flex;
  flex-direction: column;
  gap: 35px;
}

.loadout-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-badge {
  display: flex;
  align-items: center;
  gap: 15px;
  background: rgba(13, 27, 42, 0.85);
  border-left: 4px solid var(--color-patriot-gold);
  padding: 8px 16px;
  border-radius: 0 6px 6px 0;
  font-size: 0.9rem;
  letter-spacing: 2px;
}

.sec-num {
  background: var(--color-patriot-gold);
  color: #0d1b2a;
  padding: 2px 8px;
  border-radius: 3px;
  font-weight: 900;
  font-size: 0.75rem;
}

.sec-title {
  color: #fff;
  font-weight: 700;
}

.sec-status {
  margin-left: auto;
  color: var(--color-antique-gold);
  font-size: 0.85rem;
}

.sec-status strong {
  color: #ffda79;
}

/* Cards Grid */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.cards-grid.cols-3 {
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.cards-grid.cols-4 {
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

.cards-grid.specialty-grid {
  grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
}

/* Selection Cards */
.selection-card {
  position: relative;
  background: rgba(13, 27, 42, 0.75);
  padding: 18px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.selection-card:hover {
  background: rgba(27, 38, 59, 0.85);
  transform: translateY(-4px);
  border-color: #fff1b0;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.8), 0 0 15px rgba(212, 175, 55, 0.4);
}

.selection-card.selected {
  background: radial-gradient(circle at top left, #1d2a44 0%, #0d1b2a 100%);
  border: 2px solid var(--color-patriot-gold);
  box-shadow: 0 0 20px rgba(212, 175, 55, 0.6), inset 0 0 15px rgba(212, 175, 55, 0.2);
}

.card-radio-indicator {
  position: absolute;
  top: 12px;
  right: 12px;
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  letter-spacing: 1px;
  padding: 3px 8px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(212, 175, 55, 0.4);
  color: #c5a059;
}

.selection-card.selected .card-radio-indicator {
  background: var(--color-patriot-gold);
  color: #0d1b2a;
  font-weight: 900;
  border-color: #fff5cc;
  box-shadow: 0 0 8px rgba(212, 175, 55, 0.8);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.weapon-icon {
  font-size: 2.2rem;
  background: rgba(0, 0, 0, 0.4);
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(212, 175, 55, 0.3);
}

.weapon-name {
  font-size: 1.15rem;
  color: #fff;
  letter-spacing: 1px;
}

.weapon-type {
  font-size: 0.85rem;
  color: var(--color-antique-gold);
}

.weapon-desc {
  font-size: 0.95rem;
  line-height: 1.4;
  color: #e5dec9;
}

.spec-desc {
  color: #ffda79 !important;
}

/* Stat Bars */
.stat-bars {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 4px 0;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  font-family: 'Cinzel', serif;
}

.stat-lbl {
  width: 70px;
  color: var(--color-antique-gold);
}

.bar-track {
  flex: 1;
  height: 6px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
}

.bar-fill.damage { background: linear-gradient(to right, #e74c3c, #ff7675); }
.bar-fill.range { background: linear-gradient(to right, #0984e3, #74b9ff); }
.bar-fill.accuracy { background: linear-gradient(to right, #00b894, #55efc4); }
.bar-fill.rate { background: linear-gradient(to right, #fdcb6e, #ffeaa7); }
.bar-fill.reload { background: linear-gradient(to right, #e67e22, #f1c40f); }

.stat-val {
  width: 35px;
  text-align: right;
  color: #fff;
}

.card-lore {
  font-size: 0.82rem;
  color: #a4b0be;
  border-top: 1px solid rgba(212, 175, 55, 0.2);
  padding-top: 6px;
  margin-top: auto;
}

/* Specialty Traits */
.spec-traits {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
}

.trait-line.pro {
  color: #2ed573;
}

.trait-line.con {
  color: #ff4757;
}

/* --- Expedition Manifest Bottom Dock (Shorter / Shrinkable) --- */
.loadout-manifest-dock {
  background: rgba(13, 27, 42, 0.96);
  border-top: 2px solid var(--color-patriot-gold);
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  z-index: 20;
  position: relative;
}

/* Shrunk mode: Very Short! */
.loadout-manifest-dock.is-short {
  height: 54px;
  min-height: 54px;
  padding: 8px 24px;
  box-sizing: border-box;
}

/* Unshrunk mode: Taller Dashboard */
.loadout-manifest-dock:not(.is-short) {
  padding: 16px 28px 20px 28px;
  max-height: 380px;
  overflow-y: auto;
}

.manifest-dock-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.manifest-title-icon {
  font-size: 1.2rem;
}

.manifest-title-text {
  font-size: 1rem;
  letter-spacing: 2px;
  color: var(--color-patriot-gold);
  font-weight: 800;
}

.short-mode-tag {
  color: #a4b0be;
  font-size: 0.75rem;
}

/* Shrunk Quick Slots Preview */
.short-manifest-preview {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  overflow-x: auto;
  padding: 0 10px;
  cursor: pointer;
}

.short-slot {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(212, 175, 55, 0.3);
  padding: 4px 10px;
  border-radius: 16px;
  white-space: nowrap;
  font-size: 0.85rem;
}

.short-cat {
  font-size: 0.65rem;
  color: var(--color-antique-gold);
  letter-spacing: 1px;
}

.short-icon {
  font-size: 1rem;
}

.short-name {
  color: #ffffff;
}

.specialty-short-slot {
  border-color: rgba(255, 218, 121, 0.5);
  background: rgba(212, 175, 55, 0.15);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.manifest-size-toggle-btn {
  background: #1b263b;
  border: 1px solid var(--color-antique-gold);
  color: var(--color-parchment);
  padding: 6px 14px;
  border-radius: 4px;
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  letter-spacing: 1.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.manifest-size-toggle-btn:hover {
  background: var(--color-patriot-gold);
  color: #0d1b2a;
  transform: translateY(-1px);
}

.manifest-quick-go-btn {
  background: radial-gradient(circle at center, #d4af37 0%, #8b6508 100%);
  border: 1px solid #fff5cc;
  color: #0d1b2a;
  padding: 6px 18px;
  border-radius: 4px;
  font-size: 0.85rem;
  letter-spacing: 1.5px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 0 10px rgba(212, 175, 55, 0.6);
  transition: all 0.2s ease;
}

.manifest-quick-go-btn:hover {
  background: radial-gradient(circle at center, #fff1b0 0%, #d4af37 100%);
  transform: scale(1.05);
}

/* Expanded Full Content */
.manifest-dock-expanded-content {
  display: grid;
  grid-template-columns: 2fr 1fr auto;
  gap: 20px;
  align-items: center;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(212, 175, 55, 0.3);
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}

.summary-slots {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.summary-slot {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(212, 175, 55, 0.3);
  padding: 8px 10px;
  border-radius: 6px;
}

.slot-label {
  font-size: 0.65rem;
  letter-spacing: 1.5px;
  color: var(--color-antique-gold);
}

.slot-val {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.multi-tool-dock-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.multi-tool-dock-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.multi-tool-dock-item .slot-icon {
  font-size: 1.1rem;
}

.slot-icon {
  font-size: 1.3rem;
}

.slot-sub {
  font-size: 0.72rem;
  color: #a4b0be;
}

.gold-text {
  color: #ffda79;
}

.sidebar-stats {
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(212, 175, 55, 0.3);
  padding: 10px 14px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-stat-title {
  font-size: 0.75rem;
  letter-spacing: 1.5px;
  color: var(--color-patriot-gold);
  margin-bottom: 2px;
}

.net-stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
}

.net-stat-row .buff {
  color: #2ed573;
}

.net-stat-row .debuff {
  color: #ff4757;
}

.deploy-action-btn {
  background: radial-gradient(circle at center, #d4af37 0%, #8b6508 100%);
  border: 2px solid #fff5cc;
  color: #0d1b2a;
  padding: 16px 28px;
  border-radius: 6px;
  font-size: 1.05rem;
  letter-spacing: 2px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(212, 175, 55, 0.5);
  transition: all 0.25s ease;
  white-space: nowrap;
}

.deploy-action-btn:hover {
  background: radial-gradient(circle at center, #fff1b0 0%, #d4af37 100%);
  transform: scale(1.03);
  box-shadow: 0 6px 30px rgba(255, 245, 204, 0.8);
}

@media (max-width: 1024px) {
  .manifest-dock-expanded-content {
    grid-template-columns: 1fr;
  }
  .summary-slots {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

