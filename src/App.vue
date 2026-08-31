<script setup lang="ts">
import { ref } from 'vue';
import TitleScreen from './components/TitleScreen.vue';
import LoadoutScene from './components/LoadoutScene.vue';
import GameView from './components/GameView.vue';
import type { GameState, PlayerLoadout } from './types';
import { DEFAULT_LOADOUT } from './types';

const gameState = ref<GameState>('title');
const playerLoadout = ref<PlayerLoadout>({ ...DEFAULT_LOADOUT });

const handleStartGame = (customLoadout?: PlayerLoadout) => {
  if (customLoadout) {
    playerLoadout.value = { ...customLoadout };
  }
  gameState.value = 'playing';
};

const handleOpenLoadout = () => {
  gameState.value = 'loadout';
};

const handleSaveLoadout = (newLoadout: PlayerLoadout) => {
  playerLoadout.value = { ...newLoadout };
};

const handleReturnToTitle = () => {
  gameState.value = 'title';
};
</script>

<template>
  <div class="app-root">
    <transition name="fade" mode="out-in">
      <TitleScreen
        v-if="gameState === 'title'"
        :loadout="playerLoadout"
        @start-game="handleStartGame"
        @open-loadout="handleOpenLoadout"
      />
      <LoadoutScene
        v-else-if="gameState === 'loadout'"
        :initial-loadout="playerLoadout"
        @save-loadout="handleSaveLoadout"
        @start-game="handleStartGame"
        @return-to-title="handleReturnToTitle"
      />
      <GameView
        v-else-if="gameState === 'playing'"
        :loadout="playerLoadout"
        @return-to-title="handleReturnToTitle"
      />
    </transition>
  </div>
</template>

<style scoped>
.app-root {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
