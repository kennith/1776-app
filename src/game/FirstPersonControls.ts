import * as THREE from 'three';
import { soundManager } from '../audio/SoundManager';
import type { TerrainGenerator } from './TerrainGenerator';
import type { ColonialWorld } from './ColonialWorld';
import type { PlayerState, PlayerLoadout, PlayerInventory, BuildingId } from '../types';
import { SPECIALTIES, MAIN_WEAPONS, SUB_WEAPONS, TOOLS } from '../types';

interface SlotCooldown {
  isReloading: boolean;
  remaining: number;
  total: number;
}

export class FirstPersonControls {
  public camera: THREE.PerspectiveCamera;
  public domElement: HTMLElement;
  public terrain: TerrainGenerator;
  public loadout: PlayerLoadout;
  public colonialWorld: ColonialWorld | null = null;

  // Player inventory (Wood Timber & Quarry Stone)
  public inventory: PlayerInventory = {
    wood: 0,
    stone: 0
  };

  // Player position & physics
  public position: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public isGrounded: boolean = true;
  public playerRadius: number = 0.55; // Player physical collision radius
  
  // Health & specialty attributes
  public health: number = 100;
  public maxHealth: number = 100;
  public activeSlot: 'main' | 'sub' | 'tool' = 'main';
  public selectedToolIndex: number = 0;

  // Per-slot persistent reload timers (prevents weapon-switch reload exploit!)
  public slotCooldowns: Record<'main' | 'sub' | 'tool', SlotCooldown> = {
    main: { isReloading: false, remaining: 0, total: 0 },
    sub: { isReloading: false, remaining: 0, total: 0 },
    tool: { isReloading: false, remaining: 0, total: 0 }
  };

  // Camera angles (Euler: YXZ order for FPS)
  public pitch: number = 0; // vertical (up/down)
  public yaw: number = 0;   // horizontal (left/right)

  // Configuration
  public eyeHeight: number = 1.8;
  public standingEyeHeight: number = 1.8;
  public crouchEyeHeight: number = 0.95;
  public currentEyeHeight: number = 1.8;
  public isCrouching: boolean = false;
  public baseWalkSpeed: number = 5.6; // Reduced by 60% from 14.0
  public baseRunSpeed: number = 11.2; // Reduced by 60% from 28.0
  public walkSpeed: number = 5.6;
  public runSpeed: number = 11.2;
  public jumpStrength: number = 13.5; // Agile jump to easily vault and scale boulders
  public gravity: number = 30;

  // Sprint Energy & Stamina System
  public stamina: number = 100;
  public maxStamina: number = 100;
  public isExhausted: boolean = false;
  private staminaDrainRate: number = 8.0; // Decreases 50% slower (100 / 8.0 = 12.5s continuous sprint)
  private staminaRecoveryRate: number = 22.0; // Recovers in ~4.5s

  // 1776 Frontier Building & Construction System
  public isBuildingMode: boolean = false;
  public selectedBuilding: BuildingId = 'campfire';
  public buildingRotation: number = 0;
  public buildingList: BuildingId[] = ['campfire', 'palisade', 'stone_wall', 'stone_furnace', 'stone_well', 'bridge', 'cabin', 'watchtower'];
  private onToggleBuildCallback: (() => void) | null = null;
  public isConstructing: boolean = false;
  public constructionProgress: number = 0;
  public constructionTimeTotal: number = 0;
  public constructionRemaining: number = 0;
  public constructingBuildingName: string = '';
  public perspective: 'first' | 'third' = 'first';
  public isClimbing: boolean = false;
  private climbStepTimer: number = 0;

  // Key state map
  private keys: Record<string, boolean> = {};
  public isLocked: boolean = false;
  public isMapOpen: boolean = false;
  public isBackpackOpen: boolean = false;

  // Water Swimming & 5-Second Underwater Breathing
  public isSwimming: boolean = false;
  public isUnderwater: boolean = false;
  public breath: number = 5.0; // 5.0 seconds maximum breath limit
  public maxBreath: number = 5.0;
  private wasUnderwater: boolean = false;
  private swimSplashTimer: number = 0;

  // Death & Respawn System
  public isDead: boolean = false;
  public causeOfDeath: string = '';
  private onDeathCallback: ((cause: string) => void) | null = null;

  // Fall Damage & Airborne Velocity Tracking
  private maxFallVelocity: number = 0;

  // Footstep & head bobbing
  private distanceTraveled: number = 0;
  private headBobTimer: number = 0;
  private headBobOffset: number = 0;

  // Event handlers
  private onMouseMoveBound: (e: MouseEvent) => void;
  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;
  private onWheelBound: (e: WheelEvent) => void;
  private onPointerLockChangeBound: () => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    terrain: TerrainGenerator,
    loadout: PlayerLoadout
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.terrain = terrain;
    this.loadout = loadout;

    this.applySpecialtyModifiers();

    const initialGroundY = this.terrain.getHeightAt(0, 0);
    this.position = new THREE.Vector3(0, initialGroundY + this.eyeHeight, 0);
    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';

    this.onMouseMoveBound = this.onMouseMove.bind(this);
    this.onKeyDownBound = this.onKeyDown.bind(this);
    this.onKeyUpBound = this.onKeyUp.bind(this);
    this.onWheelBound = this.onWheel.bind(this);
    this.onPointerLockChangeBound = this.onPointerLockChange.bind(this);

    this.attachEventListeners();
  }

  public setColonialWorld(world: ColonialWorld) {
    this.colonialWorld = world;
  }

  private applySpecialtyModifiers() {
    const spec = SPECIALTIES[this.loadout.specialty];
    const speedMult = spec.modifiers.speedMultiplier;
    const hpMult = spec.modifiers.healthMultiplier;

    this.walkSpeed = this.baseWalkSpeed * speedMult;
    this.runSpeed = this.baseRunSpeed * speedMult;
    this.maxHealth = Math.round(100 * hpMult);
    this.health = this.maxHealth;
  }

  private onSlotChangeCallback: ((slot: 'main' | 'sub' | 'tool') => void) | null = null;
  private onToggleBackpackCallback: (() => void) | null = null;
  private onToggleMapCallback: (() => void) | null = null;

  public setOnToggleBuild(cb: () => void) {
    this.onToggleBuildCallback = cb;
  }

  public setOnToggleBackpack(cb: () => void) {
    this.onToggleBackpackCallback = cb;
  }

  public setOnToggleMap(cb: () => void) {
    this.onToggleMapCallback = cb;
  }

  public setOnDeath(cb: (cause: string) => void) {
    this.onDeathCallback = cb;
  }

  public setOnSlotChange(cb: (slot: 'main' | 'sub' | 'tool') => void) {
    this.onSlotChangeCallback = cb;
  }

  public respawn() {
    this.health = this.maxHealth;
    this.breath = this.maxBreath;
    this.stamina = this.maxStamina;
    this.isExhausted = false;
    this.isDead = false;
    this.causeOfDeath = '';
    this.maxFallVelocity = 0;
    this.teleport(0, 0);
  }

  public addWood(amount: number) {
    this.inventory.wood += amount;
    soundManager.playWoodHarvest();
  }

  public addStone(amount: number) {
    this.inventory.stone += amount;
    soundManager.playWoodHarvest();
  }

  private attachEventListeners() {
    this.domElement.addEventListener('click', () => {
      if (!this.isLocked && !this.isMapOpen && !this.isBackpackOpen) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', this.onPointerLockChangeBound);
    document.addEventListener('mousemove', this.onMouseMoveBound);
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('wheel', this.onWheelBound, { passive: true });
  }

  private detachEventListeners() {
    document.removeEventListener('pointerlockchange', this.onPointerLockChangeBound);
    document.removeEventListener('mousemove', this.onMouseMoveBound);
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('wheel', this.onWheelBound);
  }

  public destroy() {
    this.detachEventListeners();
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  public requestLock() {
    this.domElement.requestPointerLock();
  }

  public unlock() {
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  private onPointerLockChange() {
    this.isLocked = document.pointerLockElement === this.domElement;
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.isLocked) return;

    const sensitivity = 0.0022;
    this.yaw -= e.movementX * sensitivity;
    this.pitch -= e.movementY * sensitivity;

    const maxPitch = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  private onKeyDown(e: KeyboardEvent) {
    if (this.isDead) return;
    this.keys[e.code] = true;
    if (e.code === 'KeyC') this.keys['KeyC'] = true;
    if (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight' || e.ctrlKey) {
      this.keys['Control'] = true;
      this.keys['ControlLeft'] = true;
    }

    // Toggle Camera Perspective: First-Person <-> Third-Person with [Z]
    if (e.code === 'KeyZ') {
      this.perspective = this.perspective === 'first' ? 'third' : 'first';
      soundManager.playClick();
    }

    const canMove = this.isLocked || this.isMapOpen || this.isBackpackOpen;

    if (e.code === 'Space' && canMove) {
      if (this.isSwimming) {
        this.velocity.y = 4.5;
        this.isGrounded = false;
        soundManager.playWaterSplash();
      } else if (this.isGrounded) {
        this.velocity.y = this.jumpStrength;
        this.isGrounded = false;
      }
    }

    // Press 'B' to toggle 1776 Frontier Building Mode
    if (e.code === 'KeyB') {
      this.isBuildingMode = !this.isBuildingMode;
      if (this.onToggleBuildCallback) {
        this.onToggleBuildCallback();
      }
    }

    // Press 'Escape' to exit building mode if active
    if (e.code === 'Escape') {
      if (this.isBuildingMode) {
        this.isBuildingMode = false;
        if (this.onToggleBuildCallback) {
          this.onToggleBuildCallback();
        }
      }
    }

    // Press 'E' to toggle backpack
    if (e.code === 'KeyE') {
      if (this.onToggleBackpackCallback) {
        this.onToggleBackpackCallback();
      }
    }

    // Press 'Q' to toggle full screen map
    if (e.code === 'KeyQ') {
      if (this.onToggleMapCallback) {
        this.onToggleMapCallback();
      }
    }

    // In Building Mode:
    if (this.isBuildingMode) {
      // Press 'R' to rotate building 45 degrees
      if (e.code === 'KeyR') {
        this.buildingRotation = (this.buildingRotation + Math.PI / 4) % (Math.PI * 2);
      }

      // Quick select structure blueprints 1-8
      if (e.code === 'Digit1' || e.code === 'Numpad1') this.selectedBuilding = 'campfire';
      else if (e.code === 'Digit2' || e.code === 'Numpad2') this.selectedBuilding = 'palisade';
      else if (e.code === 'Digit3' || e.code === 'Numpad3') this.selectedBuilding = 'stone_wall';
      else if (e.code === 'Digit4' || e.code === 'Numpad4') this.selectedBuilding = 'stone_furnace';
      else if (e.code === 'Digit5' || e.code === 'Numpad5') this.selectedBuilding = 'stone_well';
      else if (e.code === 'Digit6' || e.code === 'Numpad6') this.selectedBuilding = 'bridge';
      else if (e.code === 'Digit7' || e.code === 'Numpad7') this.selectedBuilding = 'cabin';
      else if (e.code === 'Digit8' || e.code === 'Numpad8') this.selectedBuilding = 'watchtower';
    } else {
      const equippedTools = this.loadout.tools && this.loadout.tools.length > 0 ? this.loadout.tools : [this.loadout.tool || 'axe'];

      // Weapon / Tool Slot Hotkeys: 1 (Main), 2 (Sub), 3 (Tool 1), 4 (Tool 2), 5 (Tool 3)
      if (e.code === 'Digit1' || e.code === 'Numpad1') {
        this.switchSlot('main');
      } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
        this.switchSlot('sub');
      } else if (e.code === 'Digit3' || e.code === 'Numpad3') {
        this.switchSlot('tool', 0);
      } else if (e.code === 'Digit4' || e.code === 'Numpad4') {
        if (equippedTools.length > 1) {
          this.switchSlot('tool', 1);
        }
      } else if (e.code === 'Digit5' || e.code === 'Numpad5') {
        if (equippedTools.length > 2) {
          this.switchSlot('tool', 2);
        }
      }
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    this.keys[e.code] = false;
    if (e.code === 'KeyC') this.keys['KeyC'] = false;
    if (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight' || !e.ctrlKey) {
      this.keys['Control'] = false;
      this.keys['ControlLeft'] = false;
      this.keys['ControlRight'] = false;
    }
  }

  private onWheel(e: WheelEvent) {
    if (!this.isLocked) return;

    if (this.isBuildingMode) {
      // Cycle through building structures
      const currIdx = this.buildingList.indexOf(this.selectedBuilding);
      if (e.deltaY > 0) {
        const nextIdx = (currIdx + 1) % this.buildingList.length;
        this.selectedBuilding = this.buildingList[nextIdx];
      } else if (e.deltaY < 0) {
        const prevIdx = (currIdx - 1 + this.buildingList.length) % this.buildingList.length;
        this.selectedBuilding = this.buildingList[prevIdx];
      }
    } else {
      // Cycle through weapon slots
      const slots: ('main' | 'sub' | 'tool')[] = ['main', 'sub', 'tool'];
      const currIdx = slots.indexOf(this.activeSlot);
      if (e.deltaY > 0) {
        const nextIdx = (currIdx + 1) % slots.length;
        this.switchSlot(slots[nextIdx]);
      } else if (e.deltaY < 0) {
        const prevIdx = (currIdx - 1 + slots.length) % slots.length;
        this.switchSlot(slots[prevIdx]);
      }
    }
  }

  /**
   * Switching weapon slot preserves the reload timer of all slots
   */
  public switchSlot(slot: 'main' | 'sub' | 'tool', toolIndex?: number) {
    if (this.isBuildingMode) {
      this.isBuildingMode = false;
    }

    const equippedTools = this.loadout.tools && this.loadout.tools.length > 0 ? this.loadout.tools : [this.loadout.tool || 'axe'];

    if (slot === 'tool') {
      if (toolIndex !== undefined && toolIndex >= 0 && toolIndex < equippedTools.length) {
        this.selectedToolIndex = toolIndex;
        this.activeSlot = 'tool';
      } else if (this.activeSlot === 'tool') {
        // Cycle through equipped tools when pressing 3 again without index
        this.selectedToolIndex = (this.selectedToolIndex + 1) % equippedTools.length;
      } else {
        this.activeSlot = 'tool';
      }
    } else {
      if (this.activeSlot === slot) return;
      this.activeSlot = slot;
    }

    soundManager.playClick();

    // If new slot is currently still reloading, play the reload sound ambience
    if (this.slotCooldowns[this.activeSlot].isReloading) {
      soundManager.playReloadSound();
    }

    if (this.onSlotChangeCallback) {
      this.onSlotChangeCallback(this.activeSlot);
    }
  }

  public startReload(duration: number) {
    if (duration <= 0) return;
    this.slotCooldowns[this.activeSlot] = {
      isReloading: true,
      remaining: duration,
      total: duration
    };
    soundManager.playReloadSound();
  }

  public isSlotReloading(slot: 'main' | 'sub' | 'tool' = this.activeSlot): boolean {
    return this.slotCooldowns[slot].isReloading;
  }

  public getActiveWeaponReloadTime(): number {
    if (this.activeSlot === 'main') {
      return MAIN_WEAPONS[this.loadout.mainWeapon].reloadTime;
    } else if (this.activeSlot === 'sub') {
      return SUB_WEAPONS[this.loadout.subWeapon].reloadTime;
    } else {
      const tools = this.loadout.tools && this.loadout.tools.length > 0 ? this.loadout.tools : [this.loadout.tool || 'axe'];
      const activeToolId = tools[this.selectedToolIndex] || tools[0] || 'axe';
      return TOOLS[activeToolId].reloadTime;
    }
  }

  /**
   * Performs height-aware solid obstacle collision resolution.
   * If the player's feet are above the obstacle top (jumping over it), horizontal movement is unhindered!
   */
  private resolveObstacleCollisions(posX: number, posZ: number, playerY: number): { x: number; z: number } {
    if (!this.colonialWorld) return { x: posX, z: posZ };

    let curX = posX;
    let curZ = posZ;
    const playerFeetY = playerY - this.eyeHeight;
    const nearby = this.colonialWorld.getObstaclesNear(curX, curZ, 6);

    if (nearby.length === 0) return { x: curX, z: curZ };

    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < nearby.length; i++) {
        const obs = nearby[i];
        const obsTopY = obs.y + obs.height;

        // Height Check: If player's feet are above obstacle top, player can freely jump/vault over!
        if (playerFeetY >= obsTopY - 0.2) {
          continue; // No horizontal blocking above obstacle!
        }

        // If player is well below obstacle base
        if (playerY < obs.y - 1.0) {
          continue;
        }

        const dx = curX - obs.x;
        const dz = curZ - obs.z;
        const distSq = dx * dx + dz * dz;
        const minDist = this.playerRadius + obs.radius;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const nz = dz / dist;
            curX += nx * overlap;
            curZ += nz * overlap;
          } else {
            curX += minDist;
          }
        }
      }
    }

    return { x: curX, z: curZ };
  }

  public update(delta: number): PlayerState {
    const dt = Math.min(delta, 0.1);

    // Passive regeneration for Healer
    if (this.loadout.specialty === 'healer' && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + dt * 4);
    }

    // Update per-slot reload timers persistently
    const slots: ('main' | 'sub' | 'tool')[] = ['main', 'sub', 'tool'];
    const slotReloads: Record<'main' | 'sub' | 'tool', { isReloading: boolean; progress: number; remaining: number }> = {
      main: { isReloading: false, progress: 1.0, remaining: 0 },
      sub: { isReloading: false, progress: 1.0, remaining: 0 },
      tool: { isReloading: false, progress: 1.0, remaining: 0 }
    };

    for (const s of slots) {
      const cd = this.slotCooldowns[s];
      if (cd.isReloading) {
        cd.remaining -= dt;
        if (cd.remaining <= 0) {
          cd.isReloading = false;
          cd.remaining = 0;
          if (s === this.activeSlot) {
            soundManager.playReloadComplete();
          }
        }
      }

      const prog = cd.isReloading && cd.total > 0
        ? Math.max(0, Math.min(1, 1 - cd.remaining / cd.total))
        : 1.0;

      slotReloads[s] = {
        isReloading: cd.isReloading,
        progress: prog,
        remaining: Math.max(0, cd.remaining)
      };
    }

    const currentCd = this.slotCooldowns[this.activeSlot];

    const canMove = this.isLocked || this.isMapOpen || this.isBackpackOpen;

    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const moveDir = new THREE.Vector3();
    if (canMove && !this.isDead) {
      if (this.keys['KeyW'] || this.keys['ArrowUp']) moveDir.add(forward);
      if (this.keys['KeyS'] || this.keys['ArrowDown']) moveDir.sub(forward);
      if (this.keys['KeyD'] || this.keys['ArrowRight']) moveDir.add(right);
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveDir.sub(right);
    }

    const isMoving = canMove && !this.isDead && moveDir.lengthSq() > 0.001;
    const wantsToRun = canMove && !this.isDead && Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);

    // Sprint Energy & Exhaustion System
    let isRunning = false;
    if (wantsToRun && isMoving && this.stamina > 0 && !this.isExhausted) {
      isRunning = true;
      this.stamina = Math.max(0, this.stamina - this.staminaDrainRate * dt);
      if (this.stamina <= 0) {
        this.isExhausted = true;
      }
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRecoveryRate * dt);
      if (this.isExhausted && this.stamina >= 25) {
        this.isExhausted = false;
      }
    }
    
    // Land Crouching with Control or C Key (when not swimming)
    const wantsToCrouch = canMove && !this.isDead && !this.isSwimming && Boolean(
      this.keys['ControlLeft'] || this.keys['ControlRight'] || this.keys['Control'] || this.keys['KeyC']
    );
    this.isCrouching = wantsToCrouch && this.isGrounded;

    // Smooth Eye Height Camera Lerp (1.8m standing <-> 0.95m crouching)
    const targetEyeHeight = this.isCrouching ? this.crouchEyeHeight : this.standingEyeHeight;
    this.currentEyeHeight = THREE.MathUtils.lerp(this.currentEyeHeight, targetEyeHeight, dt * 14);
    this.eyeHeight = this.currentEyeHeight;

    // Water surface level (2X Higher Water Level: y = 10.0)
    const waterLevel = 10.0;
    const playerFeetY = this.position.y - this.eyeHeight;
    this.isSwimming = playerFeetY < waterLevel;
    this.isUnderwater = this.position.y < waterLevel + 0.05; // Head submerged below water surface

    // Speed calculation (crouching is stealthy and 45% slower)
    const crouchSpeedMult = this.isCrouching ? 0.55 : 1.0;
    const baseWalk = this.isSwimming ? this.walkSpeed * 0.7 : (this.walkSpeed * crouchSpeedMult);
    const baseRun = this.isSwimming ? this.runSpeed * 0.65 : (this.isCrouching ? this.walkSpeed * 0.55 : this.runSpeed);
    const moveSpeed = isRunning && !this.isCrouching ? baseRun : baseWalk;

    let actualSpeed = 0;
    if (isMoving) {
      moveDir.normalize();

      // Cliff & Steep Hill Slope Detection (Climb 40% slower when ascending steep cliffs)
      let finalMoveSpeed = moveSpeed;
      if (!this.isSwimming) {
        const probeDist = 2.0;
        const probeX = this.position.x + moveDir.x * probeDist;
        const probeZ = this.position.z + moveDir.z * probeDist;
        const curY = this.terrain.getHeightAt(this.position.x, this.position.z);
        const nextY = this.terrain.getHeightAt(probeX, probeZ);
        const deltaElev = nextY - curY;
        const uphillSlope = deltaElev / probeDist;

        if (uphillSlope > 0.15) {
          // Progressively decelerate up to 40% slower (0.60x speed multiplier) for steep inclines & cliffs
          const climbFactor = THREE.MathUtils.clamp((uphillSlope - 0.15) / 0.25, 0, 1);
          const slopeMult = THREE.MathUtils.lerp(1.0, 0.60, climbFactor);
          finalMoveSpeed *= slopeMult;
        }
      }

      actualSpeed = finalMoveSpeed;

      // Proposed new horizontal positions
      const nextX = this.position.x + moveDir.x * finalMoveSpeed * dt;
      const nextZ = this.position.z + moveDir.z * finalMoveSpeed * dt;

      // Solid obstacle collision resolution with height-awareness
      const resolved = this.resolveObstacleCollisions(nextX, nextZ, this.position.y);
      this.position.x = resolved.x;
      this.position.z = resolved.z;

      if (this.isSwimming) {
        this.swimSplashTimer += dt;
        if (this.swimSplashTimer >= 0.65) {
          soundManager.playWaterSplash();
          this.swimSplashTimer = 0;
        }
        this.headBobTimer += dt * (isRunning ? 8 : 5);
        this.headBobOffset = Math.sin(this.headBobTimer) * 0.04;
      } else if (this.isGrounded) {
        const stepDist = isRunning ? 2.2 : this.isCrouching ? 1.0 : 1.4;
        this.distanceTraveled += finalMoveSpeed * dt;
        if (this.distanceTraveled >= stepDist) {
          if (!this.isCrouching) {
            soundManager.playFootstep();
          }
          this.distanceTraveled = 0;
        }

        this.headBobTimer += dt * (isRunning ? 11 : this.isCrouching ? 5 : 7);
        this.headBobOffset = Math.sin(this.headBobTimer) * (isRunning ? 0.08 : this.isCrouching ? 0.02 : 0.04);
      }
    } else {
      // Even when idle, resolve any obstacle overlap with height awareness
      const resolved = this.resolveObstacleCollisions(this.position.x, this.position.z, this.position.y);
      this.position.x = resolved.x;
      this.position.z = resolved.z;
      this.headBobOffset = THREE.MathUtils.lerp(this.headBobOffset, 0, dt * 10);
    }

    // 2000x2000 World Border Bounds
    const worldLimit = 985;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -worldLimit, worldLimit);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -worldLimit, worldLimit);

    // Underwater 5-Second Breathing Limit & Drowning System
    if (this.isUnderwater) {
      this.breath = Math.max(0, this.breath - dt);
      if (this.breath <= 0) {
        this.health = Math.max(0, this.health - 20 * dt);
      }
      this.wasUnderwater = true;
    } else {
      if (this.wasUnderwater && this.breath < 4.5) {
        soundManager.playGasp();
        this.wasUnderwater = false;
      }
      this.breath = Math.min(this.maxBreath, this.breath + dt * 2.5);
    }

    // Health Depletion & Death Trigger (health = 0)
    if (this.health <= 0) {
      this.health = 0;
      if (!this.isDead) {
        this.isDead = true;
        if (this.isUnderwater && this.breath <= 0) {
          this.causeOfDeath = 'Drowned in the Atlantic Ocean';
        } else if (this.maxFallVelocity > 16.5) {
          this.causeOfDeath = 'Lethal Fall from Mountain Cliff';
        } else {
          this.causeOfDeath = 'Succumbed to Mortal Wounds';
        }
        soundManager.playDeath();
        if (this.onDeathCallback) {
          this.onDeathCallback(this.causeOfDeath);
        }
      }
    }

    // -------------------------------------------------------------
    // Vertical Physics: Ladder Climbing vs Swimming vs Terrestrial Gravity
    // -------------------------------------------------------------
    const nearbyLadder = this.colonialWorld ? this.colonialWorld.getNearbyLadder(this.position.x, this.position.y, this.position.z) : null;

    if (nearbyLadder && canMove && !this.isDead && !this.isSwimming) {
      const wantsToClimbUp = Boolean(this.keys['KeyW'] || this.keys['Space'] || this.keys['ArrowUp']);
      const wantsToClimbDown = Boolean(this.keys['KeyS'] || this.keys['ControlLeft'] || this.keys['ControlRight'] || this.keys['Control'] || this.keys['KeyC'] || this.keys['ArrowDown']);

      if (wantsToClimbUp || wantsToClimbDown || this.isClimbing) {
        this.isClimbing = true;
        this.velocity.y = 0;
        this.maxFallVelocity = 0;

        if (wantsToClimbUp) {
          this.position.y += 4.8 * dt;
          this.climbStepTimer += dt;
          if (this.climbStepTimer >= 0.30) {
            soundManager.playFootstep();
            this.climbStepTimer = 0;
          }

          // Step onto observation deck when reaching the top
          if (this.position.y >= nearbyLadder.topY + this.eyeHeight - 0.25) {
            const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
            this.position.x += fwd.x * 2.2 * dt;
            this.position.z += fwd.z * 2.2 * dt;
          }
        } else if (wantsToClimbDown) {
          this.position.y -= 4.8 * dt;
          this.climbStepTimer += dt;
          if (this.climbStepTimer >= 0.30) {
            soundManager.playFootstep();
            this.climbStepTimer = 0;
          }
        }

        // Clamp height between ground level and deck top
        this.position.y = THREE.MathUtils.clamp(
          this.position.y,
          nearbyLadder.bottomY + this.eyeHeight,
          nearbyLadder.topY + this.eyeHeight + 0.3
        );
      } else {
        this.isClimbing = false;
      }
    } else {
      this.isClimbing = false;
    }

    if (this.isClimbing) {
      this.maxFallVelocity = 0;
      this.velocity.y = 0;
      this.isGrounded = false;
    } else if (this.isSwimming) {
      this.maxFallVelocity = 0;
      const surfaceEyeY = waterLevel + this.eyeHeight - 0.25;

      const wantsToSink = canMove && !this.isDead && Boolean(
        this.keys['ControlLeft'] || this.keys['ControlRight'] || this.keys['Control']
      );
      const wantsToSurface = canMove && !this.isDead && Boolean(this.keys['Space']);

      if (wantsToSink) {
        this.velocity.y = Math.max(this.velocity.y - 28 * dt, -6.5);
      } else if (wantsToSurface) {
        this.velocity.y = Math.min(this.velocity.y + 26 * dt, 5.5);
      } else {
        if (this.position.y < surfaceEyeY) {
          this.velocity.y += (18 + (surfaceEyeY - this.position.y) * 12) * dt;
        } else {
          this.velocity.y -= this.gravity * 0.35 * dt;
        }
      }

      this.velocity.y *= Math.pow(0.20, dt);
      this.position.y += this.velocity.y * dt;
    } else {
      // Normal Gravity
      this.velocity.y -= this.gravity * dt;
      this.position.y += this.velocity.y * dt;

      if (!this.isGrounded && this.velocity.y < 0) {
        this.maxFallVelocity = Math.max(this.maxFallVelocity, -this.velocity.y);
      }
    }

    // Terrain & Obstacle Top Surface Ground Landing
    const terrainY = this.terrain.getHeightAt(this.position.x, this.position.z);
    let groundY = terrainY;
    const playerFeetYCurrent = this.position.y - this.eyeHeight;

    if (this.colonialWorld) {
      const nearby = this.colonialWorld.getObstaclesNear(this.position.x, this.position.z, 4);
      for (let i = 0; i < nearby.length; i++) {
        const obs = nearby[i];
        const dx = this.position.x - obs.x;
        const dz = this.position.z - obs.z;
        const distSq = dx * dx + dz * dz;
        const effRadius = obs.radius + 0.25;

        if (distSq <= effRadius * effRadius) {
          // If watchtower, support elevated deck landing at y + 7.4
          if (obs.id && obs.id.includes('watchtower')) {
            const deckTopY = obs.y + 7.4;
            if (playerFeetYCurrent >= deckTopY - 0.7 && deckTopY > groundY) {
              groundY = deckTopY;
            }
          }
          const obsTopY = obs.y + obs.height;
          if (playerFeetYCurrent >= obsTopY - 0.6 && obsTopY > groundY) {
            groundY = obsTopY;
          }
        }
      }
    }

    const targetY = groundY + this.eyeHeight;

    // Smoothly adhere to ground height when already grounded and not jumping
    if (!this.isClimbing && this.isGrounded && !this.isSwimming && this.velocity.y <= 0.1) {
      this.position.y = targetY;
      this.velocity.y = 0;
      this.maxFallVelocity = 0;
    } else if (!this.isClimbing && this.position.y <= targetY) {
      this.position.y = targetY;

      // Fall Damage Calculation upon Landing (Impacts > 16.5 m/s)
      if (!this.isGrounded && !this.isSwimming && !this.isDead) {
        const impactVelocity = Math.max(this.maxFallVelocity, Math.abs(this.velocity.y));
        if (impactVelocity > 16.5) {
          const fallDamage = Math.round((impactVelocity - 16.5) * 2.0);
          if (fallDamage > 0) {
            this.health = Math.max(0, this.health - fallDamage);
            if (this.health <= 0) {
              this.health = 0;
              this.isDead = true;
              this.causeOfDeath = 'Lethal Fall from Mountain Cliff';
              soundManager.playDeath();
              if (this.onDeathCallback) {
                this.onDeathCallback(this.causeOfDeath);
              }
            } else {
              soundManager.playFallDamage();
            }
          }
        }
      }

      this.maxFallVelocity = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
    } else if (this.isSwimming || this.isClimbing) {
      this.maxFallVelocity = 0;
      this.isGrounded = false;
    } else {
      this.isGrounded = false;
    }

    // Camera Transform Positioning: First-Person vs Third-Person Over-the-Shoulder
    const forwardVec = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const rightVec = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    if (this.perspective === 'first') {
      this.camera.position.set(
        this.position.x,
        this.position.y + this.headBobOffset,
        this.position.z
      );
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    } else {
      // Third-Person Over-the-Shoulder Camera
      const camDist = 3.2;
      const shoulderOffset = 0.65;
      const heightOffset = 0.35;

      const camDir = new THREE.Vector3(0, 0, 1)
        .applyAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

      const targetCamPos = new THREE.Vector3(
        this.position.x + rightVec.x * shoulderOffset + camDir.x * camDist,
        this.position.y + heightOffset + camDir.y * camDist,
        this.position.z + rightVec.z * shoulderOffset + camDir.z * camDist
      );

      // Prevent camera from clipping through terrain ground
      const camGroundY = this.terrain.getHeightAt(targetCamPos.x, targetCamPos.z);
      if (targetCamPos.y < camGroundY + 0.65) {
        targetCamPos.y = camGroundY + 0.65;
      }

      this.camera.position.copy(targetCamPos);

      // Point camera at forward crosshair aim target
      const lookDist = 30.0;
      const aimTarget = new THREE.Vector3(
        this.position.x + forwardVec.x * lookDist,
        this.position.y + Math.tan(-this.pitch) * lookDist,
        this.position.z + forwardVec.z * lookDist
      );
      this.camera.lookAt(aimTarget);
    }

    let headingDegrees = THREE.MathUtils.radToDeg(-this.yaw) % 360;
    if (headingDegrees < 0) headingDegrees += 360;

    return {
      x: Math.round(this.position.x * 10) / 10,
      y: Math.round(this.position.y * 10) / 10,
      z: Math.round(this.position.z * 10) / 10,
      heading: Math.round(headingDegrees),
      pitch: Math.round(THREE.MathUtils.radToDeg(this.pitch)),
      speed: isMoving && !this.isDead ? Math.round(actualSpeed * 10) / 10 : 0,
      isGrounded: this.isGrounded,
      isSwimming: this.isSwimming,
      isUnderwater: this.isUnderwater,
      breath: Math.round(this.breath * 10) / 10,
      maxBreath: this.maxBreath,
      altitude: Math.round((this.position.y - this.terrain.config.baselineY) * 10) / 10,
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      stamina: Math.round(this.stamina),
      maxStamina: this.maxStamina,
      isExhausted: this.isExhausted,
      isDead: this.isDead,
      causeOfDeath: this.causeOfDeath,
      activeSlot: this.activeSlot,
      selectedToolIndex: this.selectedToolIndex,
      equippedTools: this.loadout.tools && this.loadout.tools.length > 0 ? [...this.loadout.tools] : [this.loadout.tool || 'axe'],
      isReloading: currentCd.isReloading,
      reloadProgress: slotReloads[this.activeSlot].progress,
      reloadTimeTotal: currentCd.total,
      slotReloads,
      inventory: { ...this.inventory },
      isBuildingMode: this.isBuildingMode,
      selectedBuilding: this.selectedBuilding,
      buildingRotation: this.buildingRotation,
      isCrouching: this.isCrouching,
      isConstructing: this.isConstructing,
      constructionProgress: this.constructionProgress,
      constructionTimeTotal: this.constructionTimeTotal,
      constructionRemaining: Math.round(this.constructionRemaining * 10) / 10,
      constructingBuildingName: this.constructingBuildingName,
      perspective: this.perspective,
      isClimbing: this.isClimbing
    };
  }

  public teleport(x: number, z: number) {
    this.position.x = x;
    this.position.z = z;
    const resolved = this.resolveObstacleCollisions(x, z, this.position.y);
    this.position.x = resolved.x;
    this.position.z = resolved.z;
    const terrainY = this.terrain.getHeightAt(this.position.x, this.position.z);
    this.position.y = terrainY + this.eyeHeight;
    this.velocity.set(0, 0, 0);
    this.camera.position.copy(this.position);
  }
}
