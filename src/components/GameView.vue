<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { GameEngine } from '../game/GameEngine';
import GameHUD from './GameHUD.vue';
import { soundManager } from '../audio/SoundManager';
import type { PlayerState, Landmark, PlayerLoadout, BuildingId } from '../types';
import { DEFAULT_LOADOUT } from '../types';

const props = withDefaults(defineProps<{
  loadout?: PlayerLoadout;
}>(), {
  loadout: () => DEFAULT_LOADOUT
});

const emit = defineEmits<{
  (e: 'return-to-title'): void;
}>();

const canvasContainer = ref<HTMLDivElement | null>(null);
let gameEngine: GameEngine | null = null;

const isLocked = ref(false);
const isPaused = ref(false);
const isBackpackOpen = ref(false);
const isMapOpen = ref(false);
const mapDataUrl = ref<string>('');
const harvestToast = ref<{ text: string; id: number } | null>(null);
let toastTimeout: any = null;

const landmarks = ref<Landmark[]>([]);
const playerState = ref<PlayerState>({
  x: 0,
  y: 20,
  z: 0,
  heading: 0,
  pitch: 0,
  speed: 0,
  isGrounded: true,
  isSwimming: false,
  isUnderwater: false,
  breath: 5.0,
  maxBreath: 5.0,
  altitude: 0,
  health: 100,
  maxHealth: 100,
  stamina: 100,
  maxStamina: 100,
  isExhausted: false,
  isDead: false,
  causeOfDeath: '',
  activeSlot: 'main',
  isReloading: false,
  reloadProgress: 0,
  reloadTimeTotal: 0,
  slotReloads: {
    main: { isReloading: false, progress: 1.0, remaining: 0 },
    sub: { isReloading: false, progress: 1.0, remaining: 0 },
    tool: { isReloading: false, progress: 1.0, remaining: 0 }
  },
  inventory: {
    wood: 0
  },
  isBuildingMode: false,
  selectedBuilding: 'campfire',
  buildingRotation: 0,
  isCrouching: false,
  isConstructing: false,
  constructionProgress: 0,
  constructionTimeTotal: 0,
  constructionRemaining: 0,
  constructingBuildingName: '',
  perspective: 'first'
});

const onPointerLockChange = () => {
  if (gameEngine) {
    isLocked.value = gameEngine.controls.isLocked;
    if (!gameEngine.controls.isLocked) {
      if (gameEngine.controls.isBuildingMode) {
        gameEngine.controls.isBuildingMode = false;
        gameEngine.cancelBuilding();
      }
      if (!isBackpackOpen.value && !isMapOpen.value && !playerState.value.isDead) {
        isPaused.value = true;
      }
    } else if (gameEngine.controls.isLocked) {
      isPaused.value = false;
    }
  }
};

const onRespawn = () => {
  if (gameEngine) {
    gameEngine.respawn();
    isPaused.value = false;
    setTimeout(() => {
      gameEngine?.controls.requestLock();
    }, 50);
  }
};

const onRequestLock = () => {
  isPaused.value = false;
  if (gameEngine && !isBackpackOpen.value && !isMapOpen.value) {
    gameEngine.controls.requestLock();
  }
};

const onToggleBackpack = () => {
  if (isBackpackOpen.value) {
    onCloseBackpack();
  } else {
    if (isMapOpen.value) onCloseMap();
    isPaused.value = false;
    isBackpackOpen.value = true;
    if (gameEngine) gameEngine.controls.isBackpackOpen = true;
    gameEngine?.controls.unlock();
  }
};

const onCloseBackpack = () => {
  isBackpackOpen.value = false;
  isPaused.value = false;
  if (gameEngine) gameEngine.controls.isBackpackOpen = false;
  gameEngine?.controls.requestLock();
};

const onToggleMap = () => {
  if (isMapOpen.value) {
    onCloseMap();
  } else {
    if (isBackpackOpen.value) isBackpackOpen.value = false;
    isPaused.value = false;
    isMapOpen.value = true;
    if (gameEngine) gameEngine.controls.isMapOpen = true;
    gameEngine?.controls.unlock();
  }
};

const onCloseMap = () => {
  isMapOpen.value = false;
  isPaused.value = false;
  if (gameEngine) gameEngine.controls.isMapOpen = false;
  gameEngine?.controls.requestLock();
};

const handleWindowKeyDown = (e: KeyboardEvent) => {
  if (e.code === 'KeyE') {
    e.preventDefault();
    e.stopPropagation();
    if (isMapOpen.value) onCloseMap();
    else onToggleBackpack();
  } else if (e.code === 'KeyQ') {
    e.preventDefault();
    e.stopPropagation();
    if (isBackpackOpen.value) onCloseBackpack();
    else onToggleMap();
  } else if (e.code === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    if (isMapOpen.value) {
      onCloseMap();
    } else if (isBackpackOpen.value) {
      onCloseBackpack();
    } else {
      if (isPaused.value) {
        onRequestLock();
      } else {
        isPaused.value = true;
        gameEngine?.controls.unlock();
      }
    }
  }
};

const onTeleport = (x: number, z: number) => {
  if (gameEngine) {
    gameEngine.controls.teleport(x, z);
    if (!isLocked.value && !isBackpackOpen.value && !isMapOpen.value) {
      onRequestLock();
    }
  }
};

const onShoot = () => {
  if (gameEngine) {
    gameEngine.triggerWeaponAction();
  }
};

const onSwitchSlot = (slot: 'main' | 'sub' | 'tool') => {
  if (gameEngine) {
    gameEngine.controls.switchSlot(slot);
  }
};

const onToggleBuildingMode = () => {
  if (gameEngine) {
    gameEngine.controls.isBuildingMode = !gameEngine.controls.isBuildingMode;
    if (isBackpackOpen.value) onCloseBackpack();
    if (isMapOpen.value) onCloseMap();
  }
};

const onSelectBuilding = (buildingId: BuildingId) => {
  if (gameEngine) {
    gameEngine.controls.selectedBuilding = buildingId;
    gameEngine.controls.isBuildingMode = true;
    if (isBackpackOpen.value) onCloseBackpack();
    if (isMapOpen.value) onCloseMap();
  }
};

const onTogglePerspective = () => {
  if (gameEngine) {
    gameEngine.controls.perspective = gameEngine.controls.perspective === 'first' ? 'third' : 'first';
    soundManager.playClick();
  }
};

const onCanvasClick = () => {
  if (isBackpackOpen.value || isMapOpen.value) return;
  if (isPaused.value) {
    onRequestLock();
    return;
  }
  if (isLocked.value && gameEngine) {
    gameEngine.triggerWeaponAction();
  }
};

onMounted(() => {
  if (!canvasContainer.value) return;

  // Initialize 3D First Person Engine with customized loadout
  gameEngine = new GameEngine(canvasContainer.value, props.loadout);
  landmarks.value = gameEngine.getLandmarks();

  // Generate authentic 2D topographic terrain survey chart
  mapDataUrl.value = gameEngine.getMapDataUrl(500);

  // Subscribe to real-time player telemetry
  gameEngine.setOnStateUpdate((state: PlayerState) => {
    playerState.value = state;
    isLocked.value = gameEngine?.controls.isLocked || false;
  });

  // Listen for Wood Harvest Events (9-14 wood per felled tree)
  gameEngine.onHarvestWoodCb = (woodYield: number) => {
    if (toastTimeout) clearTimeout(toastTimeout);
    harvestToast.value = {
      text: `+${woodYield} Wood Timber 🪵`,
      id: Date.now()
    };
    toastTimeout = setTimeout(() => {
      harvestToast.value = null;
    }, 3200);
  };

  // Listen for KeyE backpack toggle from controls
  gameEngine.onToggleBackpackCb = () => {
    onToggleBackpack();
  };

  // Listen for KeyQ map toggle from controls
  gameEngine.onToggleMapCb = () => {
    onToggleMap();
  };

  // Listen for KeyB building toggle from controls
  gameEngine.onToggleBuildCb = () => {
    if (isBackpackOpen.value) onCloseBackpack();
    if (isMapOpen.value) onCloseMap();
  };

  gameEngine.start();

  // Auto request pointer lock on entering game
  setTimeout(() => {
    gameEngine?.controls.requestLock();
  }, 100);

  document.addEventListener('pointerlockchange', onPointerLockChange);
  window.addEventListener('keydown', handleWindowKeyDown, true);
});

onUnmounted(() => {
  document.removeEventListener('pointerlockchange', onPointerLockChange);
  window.removeEventListener('keydown', handleWindowKeyDown, true);
  if (toastTimeout) clearTimeout(toastTimeout);
  if (gameEngine) {
    gameEngine.destroy();
    gameEngine = null;
  }
});
</script>

<template>
  <div class="game-view-container" @click="onCanvasClick">
    <!-- 3D WebGL Canvas Container -->
    <div ref="canvasContainer" class="three-canvas-container"></div>

    <!-- Interactive In-Game HUD -->
    <GameHUD
      :player-state="playerState"
      :is-locked="isLocked"
      :is-paused="isPaused"
      :is-backpack-open="isBackpackOpen"
      :is-map-open="isMapOpen"
      :map-data-url="mapDataUrl"
      :harvest-toast="harvestToast"
      :landmarks="landmarks"
      :loadout="loadout"
      @request-lock="onRequestLock"
      @toggle-backpack="onToggleBackpack"
      @close-backpack="onCloseBackpack"
      @toggle-map="onToggleMap"
      @close-map="onCloseMap"
      @toggle-building-mode="onToggleBuildingMode"
      @select-building="onSelectBuilding"
      @respawn="onRespawn"
      @return-to-title="emit('return-to-title')"
      @teleport="onTeleport"
      @shoot="onShoot"
      @switch-slot="onSwitchSlot"
      @toggle-perspective="onTogglePerspective"
    />
  </div>
</template>

<style scoped>
.game-view-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #000;
}

.three-canvas-container {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
}
</style>
