import * as THREE from 'three';
import { TerrainGenerator } from './TerrainGenerator';
import { FirstPersonControls } from './FirstPersonControls';
import { ColonialWorld } from './ColonialWorld';
import { soundManager } from '../audio/SoundManager';
import type { PlayerState, Landmark, PlayerLoadout, BuildingId, ToolId } from '../types';
import { DEFAULT_LOADOUT, MAIN_WEAPONS, SUB_WEAPONS, TOOLS, SPECIALTIES, BUILDING_BLUEPRINTS } from '../types';

interface ActiveGrenade {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  rotVel: THREE.Vector3;
  fuseTimer: number;
}

interface ActiveExplosion {
  group: THREE.Group;
  sphere: THREE.Mesh;
  light: THREE.PointLight;
  particles: THREE.Points;
  particleVelocities: THREE.Vector3[];
  age: number;
  maxAge: number;
}

export class GameEngine {
  public container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public terrain: TerrainGenerator;
  public controls: FirstPersonControls;
  public colonialWorld: ColonialWorld;
  public loadout: PlayerLoadout;

  // Viewmodel & Attack Animations
  public weaponPivot: THREE.Group = new THREE.Group();
  public activeWeaponMesh: THREE.Group = new THREE.Group();
  public muzzleFlashLight: THREE.PointLight | null = null;
  public isAttacking: boolean = false;
  private attackProgress: number = 0;
  private isSwinging: boolean = false;
  private shovelSwings: number = 0;

  // Active Throwable Grenades & Explosion FX
  private activeGrenades: ActiveGrenade[] = [];
  private activeExplosions: ActiveExplosion[] = [];

  // 1776 Frontier Building Hologram Preview & Construction Channeling
  private ghostBuildingMesh: THREE.Group | null = null;
  private ghostBuildingType: BuildingId | null = null;
  private ghostBuildingValid: boolean = true;
  private isConstructing: boolean = false;
  private constructionTimer: number = 0;
  private constructionDuration: number = 0;
  private constructionTarget: { x: number; y: number; z: number; rot: number; type: BuildingId } | null = null;
  private hammerSoundTimer: number = 0;

  // Third-Person Player Character 3D Model
  private playerCharacterModel: THREE.Group = new THREE.Group();
  private playerCharTorso: THREE.Group = new THREE.Group();
  private playerCharLeftLeg: THREE.Group = new THREE.Group();
  private playerCharRightLeg: THREE.Group = new THREE.Group();
  private playerCharLeftArm: THREE.Group = new THREE.Group();
  private playerCharRightArm: THREE.Group = new THREE.Group();
  private playerCharHeldWeapon: THREE.Group = new THREE.Group();
  private walkCycleTimer: number = 0;

  private clock: THREE.Clock;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  private onStateUpdateCb: ((state: PlayerState) => void) | null = null;
  public onHarvestWoodCb: ((amount: number) => void) | null = null;
  public onToggleBackpackCb: (() => void) | null = null;
  public onToggleMapCb: (() => void) | null = null;
  public onToggleBuildCb: (() => void) | null = null;
  private onResizeBound: () => void;

  public waterMesh: THREE.Mesh | null = null;

  constructor(container: HTMLElement, loadout: PlayerLoadout = DEFAULT_LOADOUT) {
    this.container = container;
    this.loadout = loadout;
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();

    const aspect = container.clientWidth / (container.clientHeight || 1);
    this.camera = new THREE.PerspectiveCamera(72, aspect, 0.1, 1400);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    // Terrain & Baseline y=20
    this.terrain = new TerrainGenerator();
    const terrainMesh = this.terrain.generateMesh();
    this.scene.add(terrainMesh);
    this.waterMesh = this.terrain.generateWaterMesh();
    this.scene.add(this.waterMesh);

    // First Person Controller with Loadout Modifiers
    this.controls = new FirstPersonControls(this.camera, this.renderer.domElement, this.terrain, this.loadout);
    this.controls.setOnSlotChange((slot) => {
      this.rebuildWeaponViewModel(slot);
    });
    this.controls.setOnToggleBackpack(() => {
      if (this.onToggleBackpackCb) {
        this.onToggleBackpackCb();
      }
    });
    this.controls.setOnToggleMap(() => {
      if (this.onToggleMapCb) {
        this.onToggleMapCb();
      }
    });
    this.controls.setOnToggleBuild(() => {
      if (this.onToggleBuildCb) {
        this.onToggleBuildCb();
      }
    });

    // Colonial World & Atmosphere (3x foliage density & solid collision grid)
    this.colonialWorld = new ColonialWorld(this.scene, this.terrain);
    this.colonialWorld.populate();
    this.controls.setColonialWorld(this.colonialWorld);

    // Setup 3D Weapon Rig & Third-Person Player Character Model
    this.setupWeaponRig();
    this.buildPlayerCharacterModel();
    this.rebuildWeaponViewModel('main');

    this.onResizeBound = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.onResizeBound);
  }

  private setupWeaponRig() {
    this.weaponPivot = new THREE.Group();
    this.weaponPivot.position.set(0.24, -0.22, -0.48);

    this.muzzleFlashLight = new THREE.PointLight(0xffaa22, 0, 15);
    this.muzzleFlashLight.position.set(0, 0.05, -1.0);
    this.weaponPivot.add(this.muzzleFlashLight);

    this.camera.add(this.weaponPivot);
    this.scene.add(this.camera);
  }

  /**
   * Builds the authentic 1776 Continental Soldier 3D Player Character Model for Third-Person Perspective
   */
  private buildPlayerCharacterModel() {
    this.playerCharacterModel = new THREE.Group();

    const coatMat = new THREE.MeshStandardMaterial({ color: 0x1b3b6f, roughness: 0.75, metalness: 0.1 });
    const lapelMat = new THREE.MeshStandardMaterial({ color: 0xecd9b5, roughness: 0.85, metalness: 0.05 });
    const breechesMat = new THREE.MeshStandardMaterial({ color: 0xe0d4b8, roughness: 0.85 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.55, metalness: 0.25 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdfb48c, roughness: 0.65 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.9 });
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.25, metalness: 0.95 });
    const beltMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.6 });

    // 1. Torso Group
    this.playerCharTorso = new THREE.Group();
    this.playerCharTorso.position.y = 0.85;

    // Coat Body
    const coatBody = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.28), coatMat);
    coatBody.castShadow = true;
    this.playerCharTorso.add(coatBody);

    // Buff Waistcoat / Lapels Insert
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.54, 0.29), lapelMat);
    vest.position.set(0, -0.02, 0.01);
    this.playerCharTorso.add(vest);

    // Dual White Crossbelts
    const belt1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.64, 0.30), beltMat);
    belt1.rotation.z = 0.45;
    this.playerCharTorso.add(belt1);

    const belt2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.64, 0.30), beltMat);
    belt2.rotation.z = -0.45;
    this.playerCharTorso.add(belt2);

    // Central Brass Belt Plate
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.015, 12), goldMat);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0, 0, 0.155);
    this.playerCharTorso.add(badge);

    // Coat Tails
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.05), coatMat);
    tailL.position.set(-0.12, -0.38, -0.12);
    tailL.rotation.x = 0.15;
    this.playerCharTorso.add(tailL);

    const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.05), coatMat);
    tailR.position.set(0.12, -0.38, -0.12);
    tailR.rotation.x = 0.15;
    this.playerCharTorso.add(tailR);

    // 2. Head & Hat
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.46, 0);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.22), skinMat);
    head.castShadow = true;
    headGroup.add(head);

    const queue = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.16, 8), hairMat);
    queue.position.set(0, -0.06, -0.13);
    queue.rotation.x = -0.2;
    headGroup.add(queue);

    const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.09, 8), hatMat);
    hatCrown.position.set(0, 0.15, 0);
    headGroup.add(hatCrown);

    const brimGeom = new THREE.BoxGeometry(0.32, 0.12, 0.02);

    const brimBack = new THREE.Mesh(brimGeom, hatMat);
    brimBack.position.set(0, 0.16, -0.13);
    brimBack.rotation.x = 0.4;
    headGroup.add(brimBack);

    const brimLeft = new THREE.Mesh(brimGeom, hatMat);
    brimLeft.position.set(-0.12, 0.16, 0.06);
    brimLeft.rotation.set(-0.3, 0, 0.6);
    headGroup.add(brimLeft);

    const brimRight = new THREE.Mesh(brimGeom, hatMat);
    brimRight.position.set(0.12, 0.16, 0.06);
    brimRight.rotation.set(-0.3, 0, -0.6);
    headGroup.add(brimRight);

    const cockade = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.01, 8), goldMat);
    cockade.rotation.z = Math.PI / 2;
    cockade.position.set(-0.14, 0.18, 0.06);
    headGroup.add(cockade);

    this.playerCharTorso.add(headGroup);

    // 3. Left Arm
    this.playerCharLeftArm = new THREE.Group();
    this.playerCharLeftArm.position.set(-0.28, 0.24, 0);

    const lEpaulette = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.12), goldMat);
    lEpaulette.position.set(0, 0.04, 0);
    this.playerCharLeftArm.add(lEpaulette);

    const lSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), coatMat);
    lSleeve.position.set(0, -0.18, 0);
    this.playerCharLeftArm.add(lSleeve);

    const lCuff = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.13), lapelMat);
    lCuff.position.set(0, -0.34, 0);
    this.playerCharLeftArm.add(lCuff);

    const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.10, 0.09), skinMat);
    lHand.position.set(0, -0.42, 0);
    this.playerCharLeftArm.add(lHand);

    this.playerCharTorso.add(this.playerCharLeftArm);

    // 4. Right Arm (Holding Weapon)
    this.playerCharRightArm = new THREE.Group();
    this.playerCharRightArm.position.set(0.28, 0.24, 0);

    const rEpaulette = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.12), goldMat);
    rEpaulette.position.set(0, 0.04, 0);
    this.playerCharRightArm.add(rEpaulette);

    const rSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), coatMat);
    rSleeve.position.set(0, -0.18, 0);
    this.playerCharRightArm.add(rSleeve);

    const rCuff = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.13), lapelMat);
    rCuff.position.set(0, -0.34, 0);
    this.playerCharRightArm.add(rCuff);

    const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.10, 0.09), skinMat);
    rHand.position.set(0, -0.42, 0);
    this.playerCharRightArm.add(rHand);

    this.playerCharHeldWeapon = new THREE.Group();
    this.playerCharHeldWeapon.position.set(0, -0.44, 0.05);
    this.playerCharRightArm.add(this.playerCharHeldWeapon);

    this.playerCharTorso.add(this.playerCharRightArm);
    this.playerCharacterModel.add(this.playerCharTorso);

    // 5. Left Leg
    this.playerCharLeftLeg = new THREE.Group();
    this.playerCharLeftLeg.position.set(-0.13, 0.85, 0);

    const lThigh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.40, 0.16), breechesMat);
    lThigh.position.set(0, -0.20, 0);
    this.playerCharLeftLeg.add(lThigh);

    const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.48, 0.18), bootMat);
    lBoot.position.set(0, -0.58, 0.02);
    lBoot.castShadow = true;
    this.playerCharLeftLeg.add(lBoot);

    const lBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.02), goldMat);
    lBuckle.position.set(0, -0.74, 0.12);
    this.playerCharLeftLeg.add(lBuckle);

    this.playerCharacterModel.add(this.playerCharLeftLeg);

    // 6. Right Leg
    this.playerCharRightLeg = new THREE.Group();
    this.playerCharRightLeg.position.set(0.13, 0.85, 0);

    const rThigh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.40, 0.16), breechesMat);
    rThigh.position.set(0, -0.20, 0);
    this.playerCharRightLeg.add(rThigh);

    const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.48, 0.18), bootMat);
    rBoot.position.set(0, -0.58, 0.02);
    rBoot.castShadow = true;
    this.playerCharRightLeg.add(rBoot);

    const rBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.02), goldMat);
    rBuckle.position.set(0, -0.74, 0.12);
    this.playerCharRightLeg.add(rBuckle);

    this.playerCharacterModel.add(this.playerCharRightLeg);

    this.scene.add(this.playerCharacterModel);
    this.playerCharacterModel.visible = false;
  }

  /**
   * Returns the currently active Tool ID based on the player's selected tool index
   */
  public getActiveToolId(): ToolId {
    const tools = this.loadout.tools && this.loadout.tools.length > 0 ? this.loadout.tools : [this.loadout.tool || 'axe'];
    const idx = Math.min(Math.max(0, this.controls.selectedToolIndex), tools.length - 1);
    return tools[idx] || 'axe';
  }

  /**
   * Rebuilds the 3D first person viewmodel and third-person held weapon according to the active loadout slot
   */
  public rebuildWeaponViewModel(slot: 'main' | 'sub' | 'tool') {
    while (this.activeWeaponMesh.children.length > 0) {
      this.activeWeaponMesh.remove(this.activeWeaponMesh.children[0]);
    }
    this.weaponPivot.remove(this.activeWeaponMesh);

    while (this.playerCharHeldWeapon.children.length > 0) {
      this.playerCharHeldWeapon.remove(this.playerCharHeldWeapon.children[0]);
    }

    this.activeWeaponMesh = new THREE.Group();
    const thirdPersonWeapon = new THREE.Group();

    if (slot === 'main') {
      const mainId = this.loadout.mainWeapon;
      if (mainId === 'sword') {
        this.buildSwordModel(this.activeWeaponMesh);
        this.buildSwordModel(thirdPersonWeapon);
      } else if (mainId === 'kentucky') {
        this.buildKentuckyRifleModel(this.activeWeaponMesh);
        this.buildKentuckyRifleModel(thirdPersonWeapon);
      } else if (mainId === 'brown_bess') {
        this.buildBrownBessModel(this.activeWeaponMesh);
        this.buildBrownBessModel(thirdPersonWeapon);
      } else {
        this.buildSpringfieldModel(this.activeWeaponMesh);
        this.buildSpringfieldModel(thirdPersonWeapon);
      }
    } else if (slot === 'sub') {
      const subId = this.loadout.subWeapon;
      if (subId === 'knife') {
        this.buildKnifeModel(this.activeWeaponMesh);
        this.buildKnifeModel(thirdPersonWeapon);
      } else if (subId === 'machete') {
        this.buildMacheteModel(this.activeWeaponMesh);
        this.buildMacheteModel(thirdPersonWeapon);
      } else if (subId === 'grenade') {
        this.buildGrenadeModel(this.activeWeaponMesh);
        this.buildGrenadeModel(thirdPersonWeapon);
      } else {
        this.buildPistolModel(this.activeWeaponMesh);
        this.buildPistolModel(thirdPersonWeapon);
      }
    } else {
      const toolId = this.getActiveToolId();
      if (toolId === 'shovel') {
        this.buildShovelModel(this.activeWeaponMesh);
        this.buildShovelModel(thirdPersonWeapon);
      } else if (toolId === 'pickaxe') {
        this.buildPickaxeModel(this.activeWeaponMesh);
        this.buildPickaxeModel(thirdPersonWeapon);
      } else if (toolId === 'med_kit') {
        this.buildMedKitModel(this.activeWeaponMesh);
        this.buildMedKitModel(thirdPersonWeapon);
      } else {
        this.buildAxeModel(this.activeWeaponMesh);
        this.buildAxeModel(thirdPersonWeapon);
      }
    }

    this.weaponPivot.add(this.activeWeaponMesh);

    thirdPersonWeapon.scale.set(0.85, 0.85, 0.85);
    thirdPersonWeapon.rotation.set(Math.PI / 2, 0, 0);
    this.playerCharHeldWeapon.add(thirdPersonWeapon);
  }

  // --- Weapon 3D Model Builders ---

  private buildSpringfieldModel(parent: THREE.Group) {
    const gun = new THREE.Group();
    gun.position.set(0, -0.02, 0);

    const stockGeom = new THREE.BoxGeometry(0.06, 0.09, 0.95);
    const stockMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.7 });
    const stock = new THREE.Mesh(stockGeom, stockMat);
    stock.position.set(0, -0.04, -0.3);
    gun.add(stock);

    const barrelGeom = new THREE.CylinderGeometry(0.02, 0.024, 1.25, 12);
    barrelGeom.rotateX(Math.PI / 2);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x2b2d42, metalness: 0.9, roughness: 0.3 });
    const barrel = new THREE.Mesh(barrelGeom, barrelMat);
    barrel.position.set(0, 0.03, -0.65);
    gun.add(barrel);

    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.3 });
    const bandGeom = new THREE.CylinderGeometry(0.027, 0.027, 0.05, 12);
    bandGeom.rotateX(Math.PI / 2);
    const band1 = new THREE.Mesh(bandGeom, brassMat);
    band1.position.set(0, 0.03, -0.4);
    gun.add(band1);
    const band2 = new THREE.Mesh(bandGeom, brassMat);
    band2.position.set(0, 0.03, -0.85);
    gun.add(band2);

    parent.add(gun);
  }

  private buildKentuckyRifleModel(parent: THREE.Group) {
    const gun = new THREE.Group();
    gun.position.set(0, -0.02, 0);

    const stockGeom = new THREE.BoxGeometry(0.05, 0.08, 1.15);
    const stockMat = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.6 });
    const stock = new THREE.Mesh(stockGeom, stockMat);
    stock.position.set(0, -0.03, -0.4);
    gun.add(stock);

    const barrelGeom = new THREE.CylinderGeometry(0.016, 0.02, 1.5, 8);
    barrelGeom.rotateX(Math.PI / 2);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x1f2421, metalness: 0.95, roughness: 0.2 });
    const barrel = new THREE.Mesh(barrelGeom, barrelMat);
    barrel.position.set(0, 0.03, -0.8);
    gun.add(barrel);

    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.25 });
    const patchbox = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.15), brassMat);
    patchbox.position.set(0.03, -0.04, -0.2);
    gun.add(patchbox);

    parent.add(gun);
  }

  private buildBrownBessModel(parent: THREE.Group) {
    const gun = new THREE.Group();
    gun.position.set(0, -0.02, 0);

    const stockGeom = new THREE.BoxGeometry(0.07, 0.11, 1.0);
    const stockMat = new THREE.MeshStandardMaterial({ color: 0x2b1d06, roughness: 0.85 });
    const stock = new THREE.Mesh(stockGeom, stockMat);
    stock.position.set(0, -0.04, -0.32);
    gun.add(stock);

    const barrelGeom = new THREE.CylinderGeometry(0.026, 0.032, 1.3, 12);
    barrelGeom.rotateX(Math.PI / 2);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x3d3f47, metalness: 0.8, roughness: 0.4 });
    const barrel = new THREE.Mesh(barrelGeom, barrelMat);
    barrel.position.set(0, 0.04, -0.7);
    gun.add(barrel);

    const bayonetGeom = new THREE.ConeGeometry(0.015, 0.35, 4);
    bayonetGeom.rotateX(-Math.PI / 2);
    const bayonetMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.2 });
    const bayonet = new THREE.Mesh(bayonetGeom, bayonetMat);
    bayonet.position.set(0.04, 0.04, -1.45);
    gun.add(bayonet);

    parent.add(gun);
  }

  private buildSwordModel(parent: THREE.Group) {
    const sword = new THREE.Group();
    // Flipped to face upward in an upright high-ready combat stance
    sword.position.set(0.16, -0.22, -0.32);
    sword.rotation.set(0.58, -0.28, 0.14);

    // ==========================================
    // HIGH-DEFINITION SHADER MATERIALS
    // ==========================================
    // 1. Mirror Polished High-Carbon Steel (Beveled cutting edges and spatulate tip)
    const polishedSteelMat = new THREE.MeshStandardMaterial({
      color: 0xf8f9fa,
      metalness: 0.99,
      roughness: 0.08
    });

    // 2. Deep Tempered Central Fuller Groove Steel
    const fullerMat = new THREE.MeshStandardMaterial({
      color: 0x8a9ba8,
      metalness: 0.94,
      roughness: 0.25
    });

    // 3. Antique Carved Filigree Bronze / Dark Iron (Guard, Bosses, and Pommel)
    const antiqueBronzeMat = new THREE.MeshStandardMaterial({
      color: 0x3d3228,
      metalness: 0.88,
      roughness: 0.36
    });

    // 4. Ornate Gold Filigree Relief Accents
    const goldAccentMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.94,
      roughness: 0.18
    });

    // 5. Charcoal Blackened Cord & Braided Leather Grip
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x14171a,
      roughness: 0.92,
      metalness: 0.06
    });

    // ==========================================
    // 1. MASSIVE BROAD DOUBLE-EDGED STEEL BLADE
    // ==========================================
    const bladeGroup = new THREE.Group();

    // True Great Broadsword Proportions (1.25m Blade Length, 0.105m Width)
    const bladeLength = 1.25;
    const bladeWidth = 0.105;
    const bladeThickness = 0.016;

    // Left Cutting Edge Blade Half (Angled Sharp Bevel)
    const leftBladeGeom = new THREE.BoxGeometry(bladeWidth / 2, bladeThickness, bladeLength);
    leftBladeGeom.translate(-bladeWidth / 4, 0, -bladeLength / 2);
    const leftBlade = new THREE.Mesh(leftBladeGeom, polishedSteelMat);
    bladeGroup.add(leftBlade);

    // Right Cutting Edge Blade Half (Angled Sharp Bevel)
    const rightBladeGeom = new THREE.BoxGeometry(bladeWidth / 2, bladeThickness, bladeLength);
    rightBladeGeom.translate(bladeWidth / 4, 0, -bladeLength / 2);
    const rightBlade = new THREE.Mesh(rightBladeGeom, polishedSteelMat);
    bladeGroup.add(rightBlade);

    // Wide, Distinct Central Fuller (Blood Groove) running 85% down the blade length
    const fullerLength = 1.05;
    const fullerWidth = 0.046;
    const fullerGeom = new THREE.BoxGeometry(fullerWidth, bladeThickness + 0.003, fullerLength);
    fullerGeom.translate(0, 0, -fullerLength / 2 - 0.04);
    const fuller = new THREE.Mesh(fullerGeom, fullerMat);
    bladeGroup.add(fuller);

    // Central Fuller Inset Accent Line
    const fullerSpineGeom = new THREE.BoxGeometry(0.008, bladeThickness + 0.004, fullerLength * 0.92);
    fullerSpineGeom.translate(0, 0, -fullerLength / 2 - 0.04);
    const fullerSpine = new THREE.Mesh(fullerSpineGeom, polishedSteelMat);
    bladeGroup.add(fullerSpine);

    // Spatulate Spear-Point Tip
    const tipGeom = new THREE.ConeGeometry(bladeWidth * 0.70, 0.22, 4);
    tipGeom.rotateX(-Math.PI / 2);
    tipGeom.rotateZ(Math.PI / 4);
    const tip = new THREE.Mesh(tipGeom, polishedSteelMat);
    tip.position.set(0, 0, -bladeLength - 0.08);
    tip.scale.set(1.0, 0.16, 1.0);
    bladeGroup.add(tip);

    sword.add(bladeGroup);

    // ==========================================
    // 2. ORNATE CARVED BRONZE CROSSGUARD (LOWER HILT)
    // ==========================================
    const guardGroup = new THREE.Group();
    guardGroup.position.set(0, 0, -0.015);

    // Main Boat-Shaped Heavy Bronze Crossguard Bar
    const guardWidth = 0.25;
    const guardBarGeom = new THREE.BoxGeometry(guardWidth, 0.036, 0.052);
    const guardBar = new THREE.Mesh(guardBarGeom, antiqueBronzeMat);
    guardGroup.add(guardBar);

    // Gold Filigree Accent Ribs along Top and Bottom Rims
    const bandTop = new THREE.Mesh(new THREE.BoxGeometry(guardWidth + 0.006, 0.008, 0.054), goldAccentMat);
    bandTop.position.set(0, 0.016, 0);
    guardGroup.add(bandTop);

    const bandBot = new THREE.Mesh(new THREE.BoxGeometry(guardWidth + 0.006, 0.008, 0.054), goldAccentMat);
    bandBot.position.set(0, -0.016, 0);
    guardGroup.add(bandBot);

    // Symmetrical End Finials on Guard
    const finialL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), goldAccentMat);
    finialL.position.set(-guardWidth / 2, 0, 0);
    guardGroup.add(finialL);

    const finialR = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), goldAccentMat);
    finialR.position.set(guardWidth / 2, 0, 0);
    guardGroup.add(finialR);

    // Raised Diamond Central Boss on Both Sides of Guard
    const bossGeom = new THREE.OctahedronGeometry(0.020, 0);
    bossGeom.scale(1.3, 0.7, 1.3);
    const bossFront = new THREE.Mesh(bossGeom, goldAccentMat);
    bossFront.position.set(0, 0, -0.027);
    guardGroup.add(bossFront);

    const bossBack = new THREE.Mesh(bossGeom, goldAccentMat);
    bossBack.position.set(0, 0, 0.027);
    guardGroup.add(bossBack);

    sword.add(guardGroup);

    // ==========================================
    // 3. ERGONOMIC BRAIDED CHARCOAL GRIP
    // ==========================================
    const gripGroup = new THREE.Group();
    const gripLength = 0.17;
    gripGroup.position.set(0, 0, 0.085);

    // Waisted Ergonomic Wooden / Leather Core
    const gripGeom = new THREE.CylinderGeometry(0.022, 0.025, gripLength, 12);
    gripGeom.rotateX(Math.PI / 2);
    const grip = new THREE.Mesh(gripGeom, gripMat);
    gripGroup.add(grip);

    // Criss-Cross Gold Wire Lattice Wrapping Bands
    for (let i = 0; i < 8; i++) {
      const ringGeom = new THREE.TorusGeometry(0.024, 0.0024, 6, 14);
      const ring = new THREE.Mesh(ringGeom, goldAccentMat);
      ring.position.set(0, 0, -gripLength / 2 + 0.02 + i * (gripLength / 8.5));
      gripGroup.add(ring);
    }

    sword.add(gripGroup);

    // ==========================================
    // 4. LOBED TEA-COSY / MUSHROOM POMMEL (UPPER HILT)
    // ==========================================
    const pommelGroup = new THREE.Group();
    pommelGroup.position.set(0, 0, gripLength + 0.02);

    // Lower Pommel Crossbar Collar
    const pommelBarGeom = new THREE.BoxGeometry(0.14, 0.024, 0.044);
    const pommelBar = new THREE.Mesh(pommelBarGeom, antiqueBronzeMat);
    pommelGroup.add(pommelBar);

    // Upper Lobed Mushroom / Tea-Cosy Dome Cap
    const domeGeom = new THREE.SphereGeometry(0.046, 14, 12);
    domeGeom.scale(1.4, 0.72, 0.95);
    const dome = new THREE.Mesh(domeGeom, antiqueBronzeMat);
    dome.position.set(0, 0, 0.03);
    pommelGroup.add(dome);

    // Carved Relief Gold Bands on Pommel Dome
    const pBand = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.004, 6, 16), goldAccentMat);
    pBand.position.set(0, 0, 0.03);
    pommelGroup.add(pBand);

    // Top Crown Button Finial
    const crownBtn = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), goldAccentMat);
    crownBtn.position.set(0, 0, 0.065);
    pommelGroup.add(crownBtn);

    sword.add(pommelGroup);

    parent.add(sword);
  }

  private buildPistolModel(parent: THREE.Group) {
    const pistol = new THREE.Group();
    pistol.position.set(0, -0.02, 0);

    const stockGeom = new THREE.BoxGeometry(0.05, 0.08, 0.45);
    const stockMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.7 });
    const stock = new THREE.Mesh(stockGeom, stockMat);
    stock.position.set(0, -0.04, -0.15);
    pistol.add(stock);

    const barrelGeom = new THREE.CylinderGeometry(0.018, 0.022, 0.4, 12);
    barrelGeom.rotateX(Math.PI / 2);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.3 });
    const barrel = new THREE.Mesh(barrelGeom, barrelMat);
    barrel.position.set(0, 0.02, -0.28);
    pistol.add(barrel);

    parent.add(pistol);
  }

  private buildKnifeModel(parent: THREE.Group) {
    const knife = new THREE.Group();
    // Positioned in right hand, tilted slightly forward/inward in high-ready combat grip with blade pointed UP
    knife.position.set(0.04, 0.02, 0.05);
    knife.rotation.set(-0.20, 0.30, -0.12);

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.90,
      roughness: 0.25
    });

    const walnutMat = new THREE.MeshStandardMaterial({
      color: 0x3d2314,
      roughness: 0.70
    });

    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xf5f6fa,
      metalness: 0.98,
      roughness: 0.15
    });

    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 1.0,
      roughness: 0.08
    });

    // 1. Hardwood Handgrip with ergonomic contouring
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.13, 10), walnutMat);
    grip.position.set(0, -0.075, 0);
    knife.add(grip);

    // Brass grip rivets / pins
    for (const py of [-0.045, -0.075, -0.105]) {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.022, 6), brassMat);
      pin.rotation.z = Math.PI / 2;
      pin.position.set(0, py, 0);
      knife.add(pin);
    }

    // 2. Brass Butt / Pommel Cap at base
    const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.014, 0.026), brassMat);
    pommel.position.set(0, -0.145, 0);
    knife.add(pommel);

    // 3. Polished Brass Crossguard / Hilt Plate
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.014, 0.032), brassMat);
    guard.position.set(0, 0.0, 0);
    knife.add(guard);

    // 4. Upright Carbon-Steel Bowie Blade (Pointing Straight UP along +Y)
    // Main blade body
    const mainBlade = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.22, 0.046), bladeMat);
    mainBlade.position.set(0, 0.11, -0.004);
    knife.add(mainBlade);

    // Razor Sharp Leading Edge (facing -Z)
    const bevelEdge = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.22, 0.016), edgeMat);
    bevelEdge.position.set(0, 0.11, -0.026);
    knife.add(bevelEdge);

    // Tapered Bowie Clip-Point Tip (tapering upwards to sharp apex at y = 0.31)
    const tipGeom = new THREE.ConeGeometry(0.024, 0.09, 4);
    tipGeom.scale(0.38, 1.0, 1.4);
    const tip = new THREE.Mesh(tipGeom, bladeMat);
    tip.position.set(0, 0.265, -0.008);
    knife.add(tip);

    // Central Fuller / Blood Groove
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.008), new THREE.MeshStandardMaterial({
      color: 0x718093,
      metalness: 0.85,
      roughness: 0.4
    }));
    fuller.position.set(0, 0.10, 0);
    knife.add(fuller);

    parent.add(knife);
  }

  private buildMacheteModel(parent: THREE.Group) {
    const machete = new THREE.Group();
    machete.position.set(0.05, -0.12, -0.15);
    machete.rotation.set(-0.25, 0.15, -0.1);

    const bladeGeom = new THREE.BoxGeometry(0.018, 0.09, 0.6);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.9, roughness: 0.25 });
    const blade = new THREE.Mesh(bladeGeom, bladeMat);
    blade.position.set(0, 0.08, -0.3);
    machete.add(blade);

    const gripGeom = new THREE.BoxGeometry(0.03, 0.04, 0.16);
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.9 });
    const grip = new THREE.Mesh(gripGeom, gripMat);
    grip.position.set(0, 0.05, -0.02);
    machete.add(grip);

    parent.add(machete);
  }

  private buildGrenadeModel(parent: THREE.Group) {
    const orbGeom = new THREE.SphereGeometry(0.07, 16, 16);
    const orbMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, metalness: 0.8, roughness: 0.5 });
    const orb = new THREE.Mesh(orbGeom, orbMat);
    orb.position.set(0, 0, -0.25);
    parent.add(orb);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.03, 8), new THREE.MeshStandardMaterial({ color: 0xd4af37 }));
    cap.position.set(0, 0.075, -0.25);
    parent.add(cap);

    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.04, 6), new THREE.MeshStandardMaterial({ color: 0xff4757, emissive: 0xff4757 }));
    wick.position.set(0, 0.1, -0.25);
    parent.add(wick);
  }

  /**
   * Builds an authentically oriented, beautifully rendered Woodsman Felling Axe
   * Grip starts at player's hand, handle rises up, forged steel cutting blade faces forward into crosshair.
   */
  private buildAxeModel(parent: THREE.Group) {
    const axeAssembly = new THREE.Group();

    // 1. Hickory Wood Handle (Centered vertically in its local space from bottom 0 to top 0.65m)
    const handleLength = 0.68;
    const handleGeom = new THREE.CylinderGeometry(0.016, 0.023, handleLength, 10);
    handleGeom.translate(0, handleLength / 2, 0); // Bottom pivot at (0,0,0)
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      roughness: 0.75,
      metalness: 0.05
    });
    const handle = new THREE.Mesh(handleGeom, handleMat);
    axeAssembly.add(handle);

    // Leather wrapping around bottom grip
    const gripLength = 0.22;
    const gripGeom = new THREE.CylinderGeometry(0.025, 0.025, gripLength, 10);
    gripGeom.translate(0, gripLength / 2 + 0.02, 0);
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x2b1d0c, roughness: 0.95 });
    const grip = new THREE.Mesh(gripGeom, gripMat);
    axeAssembly.add(grip);

    // Bottom pommel knob
    const pommelGeom = new THREE.SphereGeometry(0.028, 8, 8);
    pommelGeom.scale(1, 0.6, 1);
    pommelGeom.translate(0, 0.02, 0);
    const pommel = new THREE.Mesh(pommelGeom, gripMat);
    axeAssembly.add(pommel);

    // 2. Forged Steel Axe Head at the TOP end (y = handleLength - 0.04)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, handleLength - 0.05, 0);

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x47535e,
      metalness: 0.88,
      roughness: 0.32
    });

    // Axe Eye Collar wrapping around handle
    const eyeGeom = new THREE.BoxGeometry(0.048, 0.075, 0.09);
    const eye = new THREE.Mesh(eyeGeom, steelMat);
    headGroup.add(eye);

    // Blade / Bit extending FORWARD along -Z (sharp chopping edge pointing directly at crosshair)
    const bladeGeom = new THREE.BoxGeometry(0.022, 0.16, 0.14);
    bladeGeom.translate(0, -0.01, -0.09); // Extended forward in -Z, bearded downwards slightly
    const blade = new THREE.Mesh(bladeGeom, steelMat);
    headGroup.add(blade);

    // Polished Silver Cutting Edge
    const edgeGeom = new THREE.BoxGeometry(0.007, 0.175, 0.04);
    edgeGeom.translate(0, -0.01, -0.17);
    const sharpEdgeMat = new THREE.MeshStandardMaterial({
      color: 0xe0e6ed,
      metalness: 0.98,
      roughness: 0.12
    });
    const edge = new THREE.Mesh(edgeGeom, sharpEdgeMat);
    headGroup.add(edge);

    // Flat Hammer Poll at the back (+Z)
    const pollGeom = new THREE.BoxGeometry(0.042, 0.06, 0.055);
    pollGeom.translate(0, 0, 0.065);
    const poll = new THREE.Mesh(pollGeom, steelMat);
    headGroup.add(poll);

    // Top metal wedge pin on handle top
    const wedgeGeom = new THREE.BoxGeometry(0.012, 0.01, 0.035);
    wedgeGeom.translate(0, 0.04, 0);
    const wedge = new THREE.Mesh(wedgeGeom, sharpEdgeMat);
    headGroup.add(wedge);

    axeAssembly.add(headGroup);

    // 3. Natural First-Person Ready Stance (Forward-angled, poised directly into the crosshair)
    axeAssembly.position.set(0.06, -0.22, -0.38);
    axeAssembly.rotation.set(-0.62, 0.0, -0.06);

    parent.add(axeAssembly);
  }

  private buildShovelModel(parent: THREE.Group) {
    const shovelAssembly = new THREE.Group();

    // 1. Turned Hickory Wood Shaft (sturdy cylindrical tool handle)
    const handleLength = 0.76;
    const handleGeom = new THREE.CylinderGeometry(0.018, 0.022, handleLength, 12);
    handleGeom.translate(0, handleLength / 2, 0);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x96613d,
      roughness: 0.70,
      metalness: 0.05
    });
    const handle = new THREE.Mesh(handleGeom, handleMat);
    shovelAssembly.add(handle);

    // 2. Heavy-Duty Metal D-Grip Handle at bottom
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      metalness: 0.85,
      roughness: 0.40
    });
    const dGripBracket = new THREE.Mesh(
      new THREE.TorusGeometry(0.048, 0.010, 8, 16, Math.PI),
      ironMat
    );
    dGripBracket.position.set(0, 0.02, 0);
    dGripBracket.rotation.x = Math.PI;
    shovelAssembly.add(dGripBracket);

    const dGripWood = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.095, 10),
      handleMat
    );
    dGripWood.rotation.z = Math.PI / 2;
    dGripWood.position.set(0, -0.028, 0);
    shovelAssembly.add(dGripWood);

    // 3. Forged Steel Shovel Spade Head Group (mounted at shaft top)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, handleLength - 0.03, 0);

    // Socket Collar & Straps wrapping the wooden shaft
    const socketGeom = new THREE.CylinderGeometry(0.026, 0.030, 0.14, 12);
    const socket = new THREE.Mesh(socketGeom, ironMat);
    socket.position.set(0, -0.02, 0);
    headGroup.add(socket);

    // Brass rivet pins securing socket to wood
    const rivetMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.92, roughness: 0.22 });
    for (let i = 0; i < 3; i++) {
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 6), rivetMat);
      rivet.position.set(0, -0.05 + i * 0.03, 0.027);
      headGroup.add(rivet);
    }

    // Curved Shovel Scoop Blade (tilted into forward digging angle)
    const spadeBladeGroup = new THREE.Group();
    spadeBladeGroup.position.set(0, 0.10, -0.055);
    spadeBladeGroup.rotation.x = -0.36; // Iconic forward scoop dish angle

    // Main Curved Dished Scoop Pan Body
    const scoopGeom = new THREE.BoxGeometry(0.24, 0.26, 0.022);
    const scoop = new THREE.Mesh(scoopGeom, ironMat);
    spadeBladeGroup.add(scoop);

    // Central Reinforcing Ridge (Frog Spine)
    const spineGeom = new THREE.CylinderGeometry(0.014, 0.020, 0.24, 8);
    const spine = new THREE.Mesh(spineGeom, ironMat);
    spine.position.set(0, 0.02, 0.012);
    spadeBladeGroup.add(spine);

    // Left and Right Stepped Foot Treads (folded metal shoulder steps for digging into earth)
    const treadGeom = new THREE.BoxGeometry(0.10, 0.024, 0.045);
    const treadL = new THREE.Mesh(treadGeom, ironMat);
    treadL.position.set(-0.08, 0.13, 0.018);
    spadeBladeGroup.add(treadL);

    const treadR = new THREE.Mesh(treadGeom, ironMat);
    treadR.position.set(0.08, 0.13, 0.018);
    spadeBladeGroup.add(treadR);

    // Tapered Sharp Spade Digging Point & Leading Lip (Polished Tempered Carbon Steel)
    const sharpEdgeMat = new THREE.MeshStandardMaterial({
      color: 0xecf0f1,
      metalness: 0.96,
      roughness: 0.18
    });

    const edgeGeom = new THREE.ConeGeometry(0.17, 0.13, 4);
    edgeGeom.rotateX(Math.PI);
    edgeGeom.rotateZ(Math.PI / 4);
    const edge = new THREE.Mesh(edgeGeom, sharpEdgeMat);
    edge.position.set(0, -0.165, 0);
    edge.scale.set(1.4, 1.0, 0.18);
    spadeBladeGroup.add(edge);

    headGroup.add(spadeBladeGroup);
    shovelAssembly.add(headGroup);

    // 4. Natural First-Person Ready Digging Stance (angled forward into the ground)
    shovelAssembly.position.set(0.06, -0.22, -0.36);
    shovelAssembly.rotation.set(-0.62, 0.0, -0.06);

    parent.add(shovelAssembly);
  }

  private buildPickaxeModel(parent: THREE.Group) {
    const pickAssembly = new THREE.Group();

    // 1. Turned Hickory Wood Shaft (0.75m long sturdy tool handle)
    const handleLength = 0.75;
    const handleGeom = new THREE.CylinderGeometry(0.016, 0.022, handleLength, 12);
    handleGeom.translate(0, handleLength / 2, 0);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x935f37,
      roughness: 0.72,
      metalness: 0.05
    });
    const handle = new THREE.Mesh(handleGeom, handleMat);
    pickAssembly.add(handle);

    // 2. Heavy Forged Steel Double-Ended Pick Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, handleLength - 0.03, 0);

    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x2d3436,
      metalness: 0.88,
      roughness: 0.35
    });

    const steelTipMat = new THREE.MeshStandardMaterial({
      color: 0xe0e6ed,
      metalness: 0.98,
      roughness: 0.12
    });

    // Central Iron Eye Collar Socket (anchoring handle)
    const socketGeom = new THREE.BoxGeometry(0.046, 0.075, 0.058);
    const socket = new THREE.Mesh(socketGeom, ironMat);
    headGroup.add(socket);

    // Top Retention Wedge
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.036), steelTipMat);
    wedge.position.set(0, 0.042, 0);
    headGroup.add(wedge);

    // Front Pointed Pick Spike (curves forward into -Z, tapered sharp pyramid tip)
    const spikeGroup = new THREE.Group();
    spikeGroup.position.set(0, -0.005, -0.03);

    // Spike base shank
    const shankGeom = new THREE.BoxGeometry(0.034, 0.038, 0.14);
    shankGeom.translate(0, -0.015, -0.07);
    const shank = new THREE.Mesh(shankGeom, ironMat);
    spikeGroup.add(shank);

    // Tapered diamond pick tip (pointed forward in -Z)
    const tipGeom = new THREE.ConeGeometry(0.038, 0.16, 4);
    tipGeom.rotateX(-Math.PI / 2);
    tipGeom.rotateZ(Math.PI / 4);
    tipGeom.translate(0, -0.04, -0.22);
    const pickTip = new THREE.Mesh(tipGeom, steelTipMat);
    spikeGroup.add(pickTip);

    headGroup.add(spikeGroup);

    // Rear Mattock / Chisel Adze Blade (extends into +Z)
    const adzeGroup = new THREE.Group();
    adzeGroup.position.set(0, 0, 0.03);

    const adzeShankGeom = new THREE.BoxGeometry(0.032, 0.036, 0.11);
    adzeShankGeom.translate(0, -0.008, 0.055);
    const adzeShank = new THREE.Mesh(adzeShankGeom, ironMat);
    adzeGroup.add(adzeShank);

    // Broad chisel digging/prying bevel blade
    const chiselGeom = new THREE.BoxGeometry(0.065, 0.008, 0.06);
    chiselGeom.translate(0, -0.014, 0.135);
    const chisel = new THREE.Mesh(chiselGeom, steelTipMat);
    adzeGroup.add(chisel);

    headGroup.add(adzeGroup);

    pickAssembly.add(headGroup);

    // 3. Poised Forward Mining Stance
    pickAssembly.position.set(0.06, -0.22, -0.38);
    pickAssembly.rotation.set(-0.62, 0.0, -0.06);

    parent.add(pickAssembly);
  }

  private buildMedKitModel(parent: THREE.Group) {
    const box = new THREE.Group();
    box.position.set(0.05, -0.08, -0.28);

    const boxGeom = new THREE.BoxGeometry(0.18, 0.14, 0.22);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xf5f6fa, roughness: 0.8 });
    const boxMesh = new THREE.Mesh(boxGeom, boxMat);
    box.add(boxMesh);

    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.03, 0.08), new THREE.MeshStandardMaterial({ color: 0xe84118 }));
    box.add(crossH);

    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.08, 0.03), new THREE.MeshStandardMaterial({ color: 0xe84118 }));
    box.add(crossV);

    parent.add(box);
  }

  /**
   * Spawns a physical 3D black powder grenade with ballistic toss arc & burning fuse
   */
  private throwGrenade() {
    const throwDir = new THREE.Vector3();
    this.camera.getWorldDirection(throwDir);

    const grenadeGroup = new THREE.Group();

    // 1. Cast-iron spherical casing
    const orbGeom = new THREE.SphereGeometry(0.10, 14, 14);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.85,
      roughness: 0.55
    });
    const orb = new THREE.Mesh(orbGeom, orbMat);
    grenadeGroup.add(orb);

    // 2. Brass neck cap
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.03, 0.04, 8),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.3 })
    );
    cap.position.set(0, 0.10, 0);
    grenadeGroup.add(cap);

    // 3. Burning fuse
    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6),
      new THREE.MeshBasicMaterial({ color: 0xff3838 })
    );
    wick.position.set(0, 0.13, 0);
    grenadeGroup.add(wick);

    // Spawn slightly in front of camera
    const spawnPos = this.camera.position.clone().add(throwDir.clone().multiplyScalar(0.6));
    grenadeGroup.position.copy(spawnPos);
    this.scene.add(grenadeGroup);

    // Toss velocity with parabolic arc
    const tossSpeed = 22.0;
    const velocity = throwDir.clone().multiplyScalar(tossSpeed);
    velocity.y += 6.0; // Upward toss lob

    const rotVel = new THREE.Vector3(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 14
    );

    this.activeGrenades.push({
      mesh: grenadeGroup,
      velocity,
      rotVel,
      fuseTimer: 2.5 // 2.5 second fuse countdown
    });

    soundManager.playSwordSlash(); // Whoosh throw acoustics
  }

  /**
   * Detonates black powder grenade: 100 direct HP, 50 indirect splash HP, expanding fireball, smoke & crater
   */
  private createExplosion(pos: THREE.Vector3) {
    const explosionGroup = new THREE.Group();
    explosionGroup.position.copy(pos);

    // Fiery expanding shockwave fireball (3X Size)
    const sphereGeom = new THREE.SphereGeometry(1.2, 20, 20);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    explosionGroup.add(sphere);

    // Blast point light (3X radius & intensity)
    const light = new THREE.PointLight(0xff7700, 45, 80);
    explosionGroup.add(light);

    // Smoke & flying blast debris (3X particle count & velocity)
    const particleCount = 120;
    const pGeom = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    const particleVelocities: THREE.Vector3[] = [];

    for (let i = 0; i < particleCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 0.8;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 0.8;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 0.8;

      particleVelocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 45,
        Math.random() * 28 + 6,
        (Math.random() - 0.5) * 45
      ));
    }
    pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xffaa33,
      size: 0.65,
      transparent: true,
      opacity: 0.95
    });
    const particles = new THREE.Points(pGeom, pMat);
    explosionGroup.add(particles);

    this.scene.add(explosionGroup);
    this.activeExplosions.push({
      group: explosionGroup,
      sphere,
      light,
      particles,
      particleVelocities,
      age: 0,
      maxAge: 1.3
    });

    // Play explosion acoustic boom
    soundManager.playExplosion();

    // Damage calculations: 3X Area - 100 HP Direct (<=10.5 yds), 50 HP Indirect (<=30.0 yds)
    const directRadius = 10.5;
    const splashRadius = 30.0;

    // 1. Blast damage to player
    const distToPlayer = pos.distanceTo(this.controls.position);
    if (distToPlayer <= directRadius) {
      this.controls.health = Math.max(0, this.controls.health - 100);
      if (this.controls.health <= 0) {
        this.controls.causeOfDeath = 'Blown to Pieces by Black Powder Grenade';
      }
    } else if (distToPlayer <= splashRadius) {
      this.controls.health = Math.max(0, this.controls.health - 50);
      if (this.controls.health <= 0) {
        this.controls.causeOfDeath = 'Mortally Wounded by Grenade Shrapnel';
      }
    }

    // 2. Felling / damaging trees in blast radius
    if (this.colonialWorld) {
      const nearbyObs = this.colonialWorld.getObstaclesNear(pos.x, pos.z, splashRadius);
      for (const obs of nearbyObs) {
        if (obs.type === 'tree' && obs.id) {
          const d = Math.hypot(obs.x - pos.x, obs.z - pos.z);
          const dmg = d <= directRadius ? 100 : 50;
          const blastDir = new THREE.Vector3(obs.x - pos.x, 0.25, obs.z - pos.z).normalize();
          const res = this.colonialWorld.hitTree(obs.id, dmg, blastDir);
          if (res.felled && res.woodYield > 0) {
            this.controls.addWood(res.woodYield);
            if (this.onHarvestWoodCb) {
              this.onHarvestWoodCb(res.woodYield);
            }
          }
        }
      }
    }

    // 3. Dig massive blast crater into terrain
    this.terrain.digAt(pos.x, pos.z, 2.4);
  }

  /**
   * Action trigger (Shooting, Slashing, Digging, Healing, Building) with reload time checks
   */
  public triggerWeaponAction() {
    if (this.controls.isSlotReloading() || this.isAttacking) return;

    // 1. Handle 1776 Frontier Construction Placement if in Building Mode
    if (this.controls.isBuildingMode) {
      if (this.isConstructing) return; // Already actively building!

      const selectedType = this.controls.selectedBuilding;
      const bp = BUILDING_BLUEPRINTS[selectedType];
      
      if (this.controls.inventory.wood >= bp.woodCost) {
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        const targetX = this.controls.position.x + forward.x * 6.5;
        const targetZ = this.controls.position.z + forward.z * 6.5;
        const targetY = this.terrain.getHeightAt(targetX, targetZ);

        this.isConstructing = true;
        this.constructionTimer = 0;
        this.constructionDuration = bp.buildTime;
        this.constructionTarget = {
          x: targetX,
          y: targetY,
          z: targetZ,
          rot: this.controls.buildingRotation,
          type: selectedType
        };
        this.hammerSoundTimer = 0;

        soundManager.playHammerStrike();
        this.colonialWorld.createWoodChips(targetX, targetY + 0.4, targetZ, 8);
      } else {
        soundManager.playCantBuild();
      }
      return;
    }

    this.isAttacking = true;
    this.attackProgress = 1.0;

    const slot = this.controls.activeSlot;

    if (slot === 'main') {
      const mainId = this.loadout.mainWeapon;
      const mainInfo = MAIN_WEAPONS[mainId];

      if (mainId === 'sword') {
        this.isSwinging = true;
        soundManager.playSwordSlash();
      } else if (mainId === 'kentucky') {
        this.isSwinging = false;
        soundManager.playRifleCrack();
        this.triggerMuzzleFlash();
        this.controls.startReload(mainInfo.reloadTime);
      } else if (mainId === 'brown_bess') {
        this.isSwinging = false;
        soundManager.playMusketFire();
        this.triggerMuzzleFlash();
        this.controls.startReload(mainInfo.reloadTime);
      } else {
        this.isSwinging = false;
        soundManager.playMusketFire();
        this.triggerMuzzleFlash();
        this.controls.startReload(mainInfo.reloadTime);
      }
    } else if (slot === 'sub') {
      const subId = this.loadout.subWeapon;
      const subInfo = SUB_WEAPONS[subId];

      if (subId === 'knife' || subId === 'machete') {
        this.isSwinging = true;
        soundManager.playSwordSlash();
      } else if (subId === 'grenade') {
        this.isSwinging = true;
        this.throwGrenade();
        // 2x reload time: 80.0 second reload cooldown for grenades
        this.controls.startReload(80.0);
      } else {
        this.isSwinging = false;
        soundManager.playPistolShot();
        this.triggerMuzzleFlash();
        this.controls.startReload(subInfo.reloadTime);
      }
    } else {
      const toolId = this.getActiveToolId();
      this.isSwinging = true;

      if (toolId === 'axe') {
        // Find tree in reach and chop for 15 damage (3 shots = 45 HP)
        const forwardDir = new THREE.Vector3();
        this.camera.getWorldDirection(forwardDir);
        const targetTree = this.colonialWorld.findTreeInReach(this.controls.position, forwardDir, 4.8);

        if (targetTree && targetTree.id) {
          const spec = SPECIALTIES[this.loadout.specialty];
          const dmg = TOOLS.axe.damage * (spec ? spec.modifiers.damageMultiplier : 1.0);
          const res = this.colonialWorld.hitTree(targetTree.id, dmg, forwardDir);

          if (res.felled && res.woodYield > 0) {
            this.controls.addWood(res.woodYield);
            if (this.onHarvestWoodCb) {
              this.onHarvestWoodCb(res.woodYield);
            }
          }
        } else {
          soundManager.playToolAction('axe');
        }
      } else if (toolId === 'shovel') {
        soundManager.playToolAction('shovel');
        this.shovelSwings++;
        if (this.shovelSwings % 4 === 0) {
          // Dig 3 feet of dirt (3.0 ft) into the earth at the player's front location
          const forwardDir = new THREE.Vector3();
          this.camera.getWorldDirection(forwardDir);
          const digX = this.controls.position.x + forwardDir.x * 1.5;
          const digZ = this.controls.position.z + forwardDir.z * 1.5;
          this.terrain.digAt(digX, digZ, 3.0);
          this.colonialWorld.createWoodChips(digX, this.controls.position.y - 1.2, digZ, 18);
        }
      } else if (toolId === 'pickaxe') {
        soundManager.playToolAction('pickaxe');
        const forwardDir = new THREE.Vector3();
        this.camera.getWorldDirection(forwardDir);
        const hitX = this.controls.position.x + forwardDir.x * 2.0;
        const hitZ = this.controls.position.z + forwardDir.z * 2.0;
        const hitY = this.terrain.getHeightAt(hitX, hitZ);
        this.colonialWorld.createWoodChips(hitX, hitY + 0.3, hitZ, 16);
      } else if (toolId === 'med_kit') {
        soundManager.playToolAction(toolId);
        // Heals 20 health
        const healAmt = 20 * (this.loadout.specialty === 'healer' ? 1.5 : 1.0);
        this.controls.health = Math.min(this.controls.maxHealth, this.controls.health + healAmt);
        // 1 minute (60s) reload cooldown!
        this.controls.startReload(60.0);
      } else {
        soundManager.playToolAction(toolId);
      }
    }

    setTimeout(() => {
      this.isAttacking = false;
    }, 380);
  }

  private triggerMuzzleFlash() {
    if (this.muzzleFlashLight) {
      this.muzzleFlashLight.intensity = 8;
      setTimeout(() => {
        if (this.muzzleFlashLight) this.muzzleFlashLight.intensity = 0;
      }, 75);
    }
  }

  public onWindowResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / (height || 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public setOnStateUpdate(callback: (state: PlayerState) => void) {
    this.onStateUpdateCb = callback;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.animate();
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private animate = () => {
    if (!this.isRunning) return;

    this.animationFrameId = requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    const playerState = this.controls.update(delta);

    // Dynamic Viewmodel Animations: Chopping Swing, Gun Recoil, or Reload
    this.attackProgress = THREE.MathUtils.lerp(this.attackProgress, 0, delta * 12);

    if (this.controls.isSlotReloading()) {
      // Reloading motion (lowering barrel/weapon slightly and ramming/cocking motion)
      const rPhase = Math.sin(playerState.reloadProgress * Math.PI * 3);
      this.weaponPivot.position.y = -0.32 + rPhase * 0.04;
      this.weaponPivot.position.z = -0.42;
      this.weaponPivot.rotation.x = -0.32 + rPhase * 0.08;
      this.weaponPivot.rotation.z = -0.15 + rPhase * 0.04;
    } else if (this.isSwinging) {
      // Powerful forward-driving downward chop
      const swingPhase = Math.sin(this.attackProgress * Math.PI);
      this.weaponPivot.position.x = 0.24;
      this.weaponPivot.position.y = -0.22 - swingPhase * 0.30; // Deep downward cleave
      this.weaponPivot.position.z = -0.48 - swingPhase * 0.45; // Thrusts deeply FORWARD into target (-Z)
      this.weaponPivot.rotation.x = -swingPhase * 1.70; // Direct forward-downward chop rotation
      this.weaponPivot.rotation.y = 0;
      this.weaponPivot.rotation.z = 0;
    } else {
      // Normal idle / gun firing recoil
      this.weaponPivot.position.set(0.24, -0.22, -0.48 + this.attackProgress * 0.16);
      this.weaponPivot.rotation.set(-this.attackProgress * 0.35, 0, 0);
    }

    // World animation (waving flags, drifting clouds & undulating ocean swells)
    if (this.waterMesh) {
      this.waterMesh.position.y = 10.0 + Math.sin(elapsedTime * 1.4) * 0.12;
    }
    this.colonialWorld.update(elapsedTime, delta);

    // Active Throwable Grenade Projectiles Simulation
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const g = this.activeGrenades[i];
      g.velocity.y -= 25 * delta; // Gravity
      g.mesh.position.addScaledVector(g.velocity, delta);
      g.mesh.rotation.x += g.rotVel.x * delta;
      g.mesh.rotation.y += g.rotVel.y * delta;

      // Terrain Ground Collision & Bounce
      const terrainY = this.terrain.getHeightAt(g.mesh.position.x, g.mesh.position.z);
      if (g.mesh.position.y <= terrainY + 0.12) {
        g.mesh.position.y = terrainY + 0.12;
        g.velocity.y = -g.velocity.y * 0.45; // Energy loss bounce
        g.velocity.x *= 0.82;
        g.velocity.z *= 0.82;
        g.rotVel.multiplyScalar(0.85);
      }

      g.fuseTimer -= delta;
      if (g.fuseTimer <= 0) {
        this.createExplosion(g.mesh.position.clone());
        this.scene.remove(g.mesh);
        this.activeGrenades.splice(i, 1);
      }
    }

    // Active Explosion Fireball & Particle Effects
    for (let i = this.activeExplosions.length - 1; i >= 0; i--) {
      const ex = this.activeExplosions[i];
      ex.age += delta;
      const progress = ex.age / ex.maxAge;

      // Fireball shockwave expansion & fade (3X Scale)
      const scale = 1.0 + progress * 24.0;
      ex.sphere.scale.set(scale, scale, scale);
      (ex.sphere.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1.0 - progress);
      ex.light.intensity = Math.max(0, 45 * (1.0 - progress));

      // Smoke and debris particle propagation
      const positions = ex.particles.geometry.attributes.position.array as Float32Array;
      for (let p = 0; p < ex.particleVelocities.length; p++) {
        const vel = ex.particleVelocities[p];
        vel.y -= 16 * delta;
        positions[p * 3] += vel.x * delta;
        positions[p * 3 + 1] += vel.y * delta;
        positions[p * 3 + 2] += vel.z * delta;
      }
      ex.particles.geometry.attributes.position.needsUpdate = true;
      (ex.particles.material as THREE.PointsMaterial).opacity = Math.max(0, 1.0 - progress);

      if (ex.age >= ex.maxAge) {
        this.scene.remove(ex.group);
        this.activeExplosions.splice(i, 1);
      }
    }

    // 1776 Frontier Construction Progress Channeling
    if (this.isConstructing && this.constructionTarget) {
      if (!this.controls.isBuildingMode || this.controls.isDead) {
        this.cancelBuilding();
      } else {
        const pDist = Math.hypot(
          this.controls.position.x - this.constructionTarget.x,
          this.controls.position.z - this.constructionTarget.z
        );

        if (pDist > 10.0) {
          // Moved too far away, cancel construction!
          this.cancelBuilding();
        } else {
          this.constructionTimer += delta;
          this.hammerSoundTimer += delta;

          if (this.hammerSoundTimer >= 0.55) {
            soundManager.playHammerStrike();
            this.colonialWorld.createWoodChips(
              this.constructionTarget.x,
              this.constructionTarget.y + 0.5,
              this.constructionTarget.z,
              6
            );
            this.hammerSoundTimer = 0;
          }

          // Construction viewmodel hammering cadence
          const hammerPhase = Math.sin(this.constructionTimer * Math.PI * 4);
          this.weaponPivot.position.y = -0.35 + hammerPhase * 0.08;
          this.weaponPivot.position.z = -0.42 - Math.abs(hammerPhase) * 0.06;
          this.weaponPivot.rotation.x = -0.45 + hammerPhase * 0.35;

          const bp = BUILDING_BLUEPRINTS[this.constructionTarget.type];

          // Check if construction finished!
          if (this.constructionTimer >= this.constructionDuration) {
            if (this.controls.inventory.wood >= bp.woodCost) {
              this.controls.inventory.wood -= bp.woodCost;

              this.colonialWorld.spawnBuilding(
                this.constructionTarget.type,
                this.constructionTarget.x,
                this.constructionTarget.y,
                this.constructionTarget.z,
                this.constructionTarget.rot
              );

              this.colonialWorld.createWoodChips(
                this.constructionTarget.x,
                this.constructionTarget.y + 1.2,
                this.constructionTarget.z,
                28
              );

              soundManager.playConstructionComplete();
            }

            this.isConstructing = false;
            this.constructionTarget = null;
          }
        }
      }
    }

    // Sync construction state to controls for PlayerState
    this.controls.isConstructing = this.isConstructing;
    if (this.isConstructing && this.constructionTarget) {
      this.controls.constructionProgress = Math.min(1.0, this.constructionTimer / this.constructionDuration);
      this.controls.constructionTimeTotal = this.constructionDuration;
      this.controls.constructionRemaining = Math.max(0, this.constructionDuration - this.constructionTimer);
      this.controls.constructingBuildingName = BUILDING_BLUEPRINTS[this.constructionTarget.type].name;
    } else {
      this.controls.constructionProgress = 0;
      this.controls.constructionTimeTotal = 0;
      this.controls.constructionRemaining = 0;
      this.controls.constructingBuildingName = '';
    }

    // 1776 Frontier Building Holographic Placement Preview
    if (this.controls.isBuildingMode) {
      const selectedType = this.controls.selectedBuilding;
      const bp = BUILDING_BLUEPRINTS[selectedType];
      const hasWood = (this.controls.inventory.wood >= bp.woodCost);

      if (!this.ghostBuildingMesh || this.ghostBuildingType !== selectedType || this.ghostBuildingValid !== hasWood) {
        if (this.ghostBuildingMesh) {
          this.scene.remove(this.ghostBuildingMesh);
        }
        this.ghostBuildingMesh = this.colonialWorld.createBuildingMesh(selectedType, true, hasWood);
        this.scene.add(this.ghostBuildingMesh);
        this.ghostBuildingType = selectedType;
        this.ghostBuildingValid = hasWood;
      }

      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      const targetX = this.controls.position.x + forward.x * 6.5;
      const targetZ = this.controls.position.z + forward.z * 6.5;
      const targetY = this.terrain.getHeightAt(targetX, targetZ);

      this.ghostBuildingMesh.position.set(targetX, targetY, targetZ);
      this.ghostBuildingMesh.rotation.y = this.controls.buildingRotation;

      if (!this.isConstructing) {
        // Lower weapon viewmodel during building preview
        this.weaponPivot.position.y = -0.55;
      }
    } else {
      if (this.ghostBuildingMesh) {
        this.scene.remove(this.ghostBuildingMesh);
        this.ghostBuildingMesh = null;
        this.ghostBuildingType = null;
      }
      if (this.isConstructing) {
        this.cancelBuilding();
      }
    }

    // Update Third-Person Character Model Visibility & Procedural Animation
    if (playerState.perspective === 'third') {
      this.playerCharacterModel.visible = true;
      this.weaponPivot.visible = false;

      const groundY = this.terrain.getHeightAt(this.controls.position.x, this.controls.position.z);
      this.playerCharacterModel.position.set(this.controls.position.x, groundY, this.controls.position.z);
      this.playerCharacterModel.rotation.y = this.controls.yaw;

      const isMoving = playerState.speed > 0.1;
      if (isMoving && !this.controls.isDead) {
        this.walkCycleTimer += delta * (playerState.speed > 6.0 ? 12.0 : 7.0);
        const legSwing = Math.sin(this.walkCycleTimer) * 0.75;
        this.playerCharLeftLeg.rotation.x = legSwing;
        this.playerCharRightLeg.rotation.x = -legSwing;
        this.playerCharLeftArm.rotation.x = -legSwing * 0.55;
        this.playerCharRightArm.rotation.x = legSwing * 0.40 - 0.35;
      } else {
        this.playerCharLeftLeg.rotation.x = THREE.MathUtils.lerp(this.playerCharLeftLeg.rotation.x, 0, delta * 10);
        this.playerCharRightLeg.rotation.x = THREE.MathUtils.lerp(this.playerCharRightLeg.rotation.x, 0, delta * 10);
        this.playerCharLeftArm.rotation.x = THREE.MathUtils.lerp(this.playerCharLeftArm.rotation.x, 0, delta * 10);
        this.playerCharRightArm.rotation.x = THREE.MathUtils.lerp(this.playerCharRightArm.rotation.x, -0.3, delta * 10);
      }

      // Crouch pose
      if (this.controls.isCrouching) {
        this.playerCharTorso.position.y = THREE.MathUtils.lerp(this.playerCharTorso.position.y, 0.50, delta * 14);
        this.playerCharLeftLeg.rotation.x = THREE.MathUtils.lerp(this.playerCharLeftLeg.rotation.x, 0.65, delta * 14);
        this.playerCharRightLeg.rotation.x = THREE.MathUtils.lerp(this.playerCharRightLeg.rotation.x, -0.40, delta * 14);
      } else {
        this.playerCharTorso.position.y = THREE.MathUtils.lerp(this.playerCharTorso.position.y, 0.85, delta * 14);
      }

      // Swimming pose
      if (this.controls.isSwimming) {
        this.playerCharacterModel.rotation.x = THREE.MathUtils.lerp(this.playerCharacterModel.rotation.x, 1.15, delta * 8);
      } else {
        this.playerCharacterModel.rotation.x = THREE.MathUtils.lerp(this.playerCharacterModel.rotation.x, 0, delta * 10);
      }
    } else {
      this.playerCharacterModel.visible = false;
      this.weaponPivot.visible = true;
    }

    this.renderer.render(this.scene, this.camera);

    if (this.onStateUpdateCb) {
      this.onStateUpdateCb(playerState);
    }
  };

  public cancelBuilding() {
    this.isConstructing = false;
    this.constructionTarget = null;
    if (this.ghostBuildingMesh) {
      this.scene.remove(this.ghostBuildingMesh);
      this.ghostBuildingMesh = null;
      this.ghostBuildingType = null;
    }
    this.controls.isConstructing = false;
    this.controls.constructionProgress = 0;
    this.controls.constructionTimeTotal = 0;
    this.controls.constructionRemaining = 0;
    this.controls.constructingBuildingName = '';
  }

  public getLandmarks(): Landmark[] {
    return this.colonialWorld.landmarks;
  }

  public getMapDataUrl(size: number = 400): string {
    return this.terrain.generateMapDataUrl(size);
  }

  public respawn() {
    this.controls.respawn();
  }

  public destroy() {
    this.stop();
    window.removeEventListener('resize', this.onResizeBound);
    this.controls.destroy();

    // Clean up character model
    if (this.playerCharacterModel) {
      this.scene.remove(this.playerCharacterModel);
    }

    // Clean up holographic ghost building preview
    if (this.ghostBuildingMesh) {
      this.scene.remove(this.ghostBuildingMesh);
      this.ghostBuildingMesh = null;
    }

    // Clean up any remaining grenades & explosions
    for (const g of this.activeGrenades) {
      this.scene.remove(g.mesh);
    }
    this.activeGrenades = [];

    for (const ex of this.activeExplosions) {
      this.scene.remove(ex.group);
    }
    this.activeExplosions = [];

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
