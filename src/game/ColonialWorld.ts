import * as THREE from 'three';
import { soundManager } from '../audio/SoundManager';
import type { TerrainGenerator } from './TerrainGenerator';
import type { Landmark, WorldObstacle, BuildingId } from '../types';
import { BUILDING_BLUEPRINTS } from '../types';

interface TreeData {
  obstacle: WorldObstacle;
  mesh: THREE.Group;
  initialY: number;
  fallProgress: number;
  fallDir: THREE.Vector3;
  despawnTimer: number;
}

interface RockData {
  obstacle: WorldObstacle;
  mesh: THREE.Mesh;
  isBroken?: boolean;
}

interface WoodChip {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  life: number;
  maxLife: number;
}

export interface LadderVolume {
  id: string;
  x: number;
  z: number;
  bottomY: number;
  topY: number;
  deckY: number;
  radius: number;
  ladderX: number;
  ladderZ: number;
}

export class ColonialWorld {
  public scene: THREE.Scene;
  public terrain: TerrainGenerator;
  public landmarks: Landmark[] = [];
  public flagMeshes: THREE.Mesh[] = [];
  private cloudGroup: THREE.Group = new THREE.Group();

  // Solid Collision Obstacles & Spatial Grid for 2000x2000 world
  public obstacles: WorldObstacle[] = [];
  public ladders: LadderVolume[] = [];
  private spatialGrid: Map<string, WorldObstacle[]> = new Map();
  private cellSize: number = 25;

  // Tree Health & Felling System (45 HP per tree, broken in 3 axe chops of 15 damage)
  public treeMap: Map<string, TreeData> = new Map();
  // Rock Mining System (50 HP per boulder, broken in 5 pickaxe hits of 10 damage)
  public rockMap: Map<string, RockData> = new Map();
  private woodChips: WoodChip[] = [];
  private woodChipGeom: THREE.BoxGeometry = new THREE.BoxGeometry(0.08, 0.04, 0.15);
  private woodChipMat: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
    color: 0x8d5b36,
    roughness: 0.85
  });
  private stoneChipMat: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
    color: 0x7f8c8d,
    roughness: 0.90
  });

  constructor(scene: THREE.Scene, terrain: TerrainGenerator) {
    this.scene = scene;
    this.terrain = terrain;
  }

  public populate() {
    this.setupLighting();
    this.setupSkyAndFog();
    this.setupLandmarks();
    this.spawnFoliage();
    this.spawnClouds();
  }

  private setupLandmarks() {
    this.landmarks = [
      {
        id: 'flat_commons',
        name: 'Pioneer Commons (Flat Area #1)',
        type: 'settlement',
        x: 80,
        z: 140,
        y: 20.0,
        description: 'Expansive 170m wide level plain at y=20m, prime location for colonial settlements & fortifications.'
      },
      {
        id: 'flat_citadel',
        name: 'Highland Citadel Mesa (Flat Area #2)',
        type: 'fort',
        x: 420,
        z: -180,
        y: 35.0,
        description: 'Strategic elevated flat mesa at y=35m overlooking the northern river valley & great lake.'
      },
      {
        id: 'flat_prairie',
        name: 'Western Prairie Grounds (Flat Area #3)',
        type: 'settlement',
        x: -400,
        z: 120,
        y: 18.0,
        description: 'Sprawling flat meadow between the western mountain crags and emerald forest lake.'
      },
      {
        id: 'spawn_point',
        name: 'Frontier Outpost (Spawn)',
        type: 'camp',
        x: 0,
        z: 0,
        y: 20.0,
        description: 'Continental expedition outpost & muster ground.'
      },
      {
        id: 'lake_north',
        name: 'Lake Champlain Basin',
        type: 'water',
        x: 340,
        z: -520,
        y: 10.0,
        description: 'Northern deep water reservoir.'
      },
      {
        id: 'lake_nw',
        name: 'Northwest Alpine Lake',
        type: 'water',
        x: -580,
        z: -520,
        y: 10.0,
        description: 'Glacial alpine lake amidst mountain crags.'
      },
      {
        id: 'lake_sw',
        name: 'Emerald Forest Lake',
        type: 'water',
        x: -520,
        z: 520,
        y: 10.0,
        description: 'Dense woodland lake teeming with timber pines.'
      },
      {
        id: 'lake_se',
        name: 'Highland Mirror Lake',
        type: 'water',
        x: 550,
        z: 540,
        y: 10.0,
        description: 'Pristine highland lake reflecting the southern sky.'
      }
    ];
  }

  private getGridKey(x: number, z: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx},${cz}`;
  }

  public addObstacle(obs: WorldObstacle) {
    this.obstacles.push(obs);
    const key = this.getGridKey(obs.x, obs.z);
    if (!this.spatialGrid.has(key)) {
      this.spatialGrid.set(key, []);
    }
    this.spatialGrid.get(key)!.push(obs);
  }

  public removeObstacle(obs: WorldObstacle) {
    const idx = this.obstacles.indexOf(obs);
    if (idx !== -1) {
      this.obstacles.splice(idx, 1);
    }
    const key = this.getGridKey(obs.x, obs.z);
    const list = this.spatialGrid.get(key);
    if (list) {
      const listIdx = list.indexOf(obs);
      if (listIdx !== -1) {
        list.splice(listIdx, 1);
      }
    }
  }

  /**
   * Fast spatial grid lookup for obstacles within distance of (x, z)
   */
  public getObstaclesNear(x: number, z: number, searchRadius: number = 8): WorldObstacle[] {
    const result: WorldObstacle[] = [];
    const minCx = Math.floor((x - searchRadius) / this.cellSize);
    const maxCx = Math.floor((x + searchRadius) / this.cellSize);
    const minCz = Math.floor((z - searchRadius) / this.cellSize);
    const maxCz = Math.floor((z + searchRadius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const list = this.spatialGrid.get(`${cx},${cz}`);
        if (list) {
          for (let i = 0; i < list.length; i++) {
            const obs = list[i];
            const distSq = (obs.x - x) * (obs.x - x) + (obs.z - z) * (obs.z - z);
            const totalR = obs.radius + searchRadius;
            if (distSq <= totalR * totalR) {
              result.push(obs);
            }
          }
        }
      }
    }
    return result;
  }

  /**
   * Finds a tree within chopping reach of player looking in direction
   */
  public findTreeInReach(origin: THREE.Vector3, direction: THREE.Vector3, reach: number = 4.2): WorldObstacle | null {
    const nearby = this.getObstaclesNear(origin.x, origin.z, reach + 2);
    let bestTree: WorldObstacle | null = null;
    let closestDist = Infinity;

    for (let i = 0; i < nearby.length; i++) {
      const obs = nearby[i];
      if (obs.type !== 'tree' || obs.isFelled) continue;

      const toTreeX = obs.x - origin.x;
      const toTreeZ = obs.z - origin.z;
      const dist = Math.hypot(toTreeX, toTreeZ);

      if (dist > reach + obs.radius) continue;

      // Check if tree is in front of the player (dot product > 0.35)
      const normToTreeX = toTreeX / (dist || 1);
      const normToTreeZ = toTreeZ / (dist || 1);
      const dot = normToTreeX * direction.x + normToTreeZ * direction.z;

      if (dot > 0.35 && dist < closestDist) {
        closestDist = dist;
        bestTree = obs;
      }
    }

    return bestTree;
  }

  /**
   * Chops a tree for 15 damage (3 hits break the 45 HP tree and awards 9-14 Wood Timber)
   */
  public hitTree(treeId: string, damage: number = 15, chopDir?: THREE.Vector3): { hit: boolean; felled: boolean; remainingHp: number; woodYield: number } {
    const treeData = this.treeMap.get(treeId);
    if (!treeData || treeData.obstacle.isFelled) {
      return { hit: false, felled: false, remainingHp: 0, woodYield: 0 };
    }

    const currentHp = treeData.obstacle.health ?? 45;
    const newHp = Math.max(0, currentHp - damage);
    treeData.obstacle.health = newHp;

    // Wood chip splinter splatter at trunk
    this.createWoodChips(treeData.obstacle.x, treeData.obstacle.y + 1.8, treeData.obstacle.z, 16);

    // Immediate physical impulse shake
    treeData.mesh.rotation.z += (Math.random() - 0.5) * 0.12;

    if (newHp <= 0) {
      // Tree is FELLED!
      treeData.obstacle.isFelled = true;
      treeData.fallProgress = 0.001;
      treeData.despawnTimer = 20.0; // Disappears in 20 seconds!
      if (chopDir) {
        treeData.fallDir = new THREE.Vector3(chopDir.x, 0, chopDir.z).normalize();
      }

      soundManager.playTreeFell();

      // Instantly remove obstacle from physical collision grid so player can walk through!
      this.removeObstacle(treeData.obstacle);

      // Huge timber splinter shower
      this.createWoodChips(treeData.obstacle.x, treeData.obstacle.y + 2.5, treeData.obstacle.z, 35);

      // Random 9-14 wood reward!
      const woodYield = Math.floor(Math.random() * 6) + 9;

      return { hit: true, felled: true, remainingHp: 0, woodYield };
    } else {
      soundManager.playWoodChopHit();
      return { hit: true, felled: false, remainingHp: newHp, woodYield: 0 };
    }
  }

  /**
   * Spawns physical wood chip particles on axe impact
   */
  public createWoodChips(x: number, y: number, z: number, count: number = 15) {
    for (let i = 0; i < count; i++) {
      const chip = new THREE.Mesh(this.woodChipGeom, this.woodChipMat);
      chip.position.set(
        x + (Math.random() - 0.5) * 0.4,
        y + (Math.random() - 0.5) * 0.6,
        z + (Math.random() - 0.5) * 0.4
      );
      this.scene.add(chip);

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 4.5;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        2.5 + Math.random() * 4.0,
        Math.sin(angle) * speed
      );

      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      );

      this.woodChips.push({
        mesh: chip,
        vel,
        rotSpeed,
        life: 0,
        maxLife: 1.2 + Math.random() * 0.6
      });
    }
  }

  /**
   * Spawns stone / rock chip particle burst on pickaxe impact
   */
  public createStoneChips(x: number, y: number, z: number, count: number = 15) {
    for (let i = 0; i < count; i++) {
      const chip = new THREE.Mesh(this.woodChipGeom, this.stoneChipMat);
      chip.position.set(
        x + (Math.random() - 0.5) * 0.4,
        y + (Math.random() - 0.5) * 0.5,
        z + (Math.random() - 0.5) * 0.4
      );
      this.scene.add(chip);

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 4.0;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        2.0 + Math.random() * 3.5,
        Math.sin(angle) * speed
      );

      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18
      );

      this.woodChips.push({
        mesh: chip,
        vel,
        rotSpeed,
        life: 0,
        maxLife: 1.0 + Math.random() * 0.5
      });
    }
  }

  /**
   * Searches for a rock obstacle directly in the player's reach and crosshair
   */
  public findRockInReach(origin: THREE.Vector3, direction: THREE.Vector3, reach: number = 4.8): WorldObstacle | null {
    const nearby = this.getObstaclesNear(origin.x, origin.z, reach + 3);
    let bestRock: WorldObstacle | null = null;
    let closestDist = Infinity;

    for (let i = 0; i < nearby.length; i++) {
      const obs = nearby[i];
      if (obs.type !== 'rock' || obs.isFelled) continue;

      const toRockX = obs.x - origin.x;
      const toRockZ = obs.z - origin.z;
      const dist = Math.hypot(toRockX, toRockZ);

      if (dist > reach + obs.radius) continue;

      // Check if rock is in front of the player
      const normToRockX = toRockX / (dist || 1);
      const normToRockZ = toRockZ / (dist || 1);
      const dot = normToRockX * direction.x + normToRockZ * direction.z;

      if (dot > 0.25 && dist < closestDist) {
        closestDist = dist;
        bestRock = obs;
      }
    }

    return bestRock;
  }

  /**
   * Hits a rock for 10 damage (5 hits shatter the 50 HP boulder)
   */
  public hitRock(rockId: string, damage: number = 10, _hitDir?: THREE.Vector3): { hit: boolean; broken: boolean; remainingHp: number; stoneYield: number } {
    const rockData = this.rockMap.get(rockId);
    if (!rockData || rockData.isBroken) {
      return { hit: false, broken: false, remainingHp: 0, stoneYield: 0 };
    }

    const currentHp = rockData.obstacle.health ?? 50;
    const newHp = Math.max(0, currentHp - damage);
    rockData.obstacle.health = newHp;

    // Stone particle burst at impact point
    this.createStoneChips(rockData.obstacle.x, rockData.obstacle.y + 0.6, rockData.obstacle.z, 14);

    // Rock vibration shake
    rockData.mesh.rotation.y += (Math.random() - 0.5) * 0.15;
    rockData.mesh.rotation.z += (Math.random() - 0.5) * 0.1;

    if (newHp <= 0) {
      // Rock is SHATTERED on 5th hit!
      rockData.isBroken = true;
      rockData.obstacle.isFelled = true;
      rockData.mesh.visible = false;

      // Remove physical obstacle collision
      this.removeObstacle(rockData.obstacle);

      // Massive stone shatter particle explosion
      this.createStoneChips(rockData.obstacle.x, rockData.obstacle.y + 0.8, rockData.obstacle.z, 36);

      soundManager.playExplosion();

      // Random 3-7 stone yield!
      const stoneYield = Math.floor(Math.random() * 5) + 3;

      return { hit: true, broken: true, remainingHp: 0, stoneYield };
    } else {
      soundManager.playToolAction('pickaxe');
      return { hit: true, broken: false, remainingHp: newHp, stoneYield: 0 };
    }
  }

  private setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0xb8d5e5, 0x3a532e, 0.75);
    hemiLight.position.set(0, 300, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff4d6, 1.35);
    dirLight.position.set(250, 450, 200);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 1200;
    const d = 500;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    const ambLight = new THREE.AmbientLight(0xd4af37, 0.22);
    this.scene.add(ambLight);
  }

  private setupSkyAndFog() {
    const fogColor = new THREE.Color(0x9cbcd6);
    this.scene.background = fogColor;
    this.scene.fog = new THREE.FogExp2(0x9cbcd6, 0.0018);
  }

  /**
   * Spawns breakable trees (45 HP) and boulders across the vast 2000x2000 map
   */
  private spawnFoliage() {
    const foliageGroup = new THREE.Group();

    // Shared geometries & materials
    const pineTrunkGeom = new THREE.CylinderGeometry(0.35, 0.55, 4.5, 6);
    const pineTrunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9 });

    const pineLayer1Geom = new THREE.ConeGeometry(3.2, 4, 7);
    const pineLayer2Geom = new THREE.ConeGeometry(2.5, 3.5, 7);
    const pineLayer3Geom = new THREE.ConeGeometry(1.8, 3, 7);
    const pineFoliageMat = new THREE.MeshStandardMaterial({ color: 0x1e3f20, roughness: 0.8 });

    // Broadleaf Oak geometries
    const oakTrunkGeom = new THREE.CylinderGeometry(0.4, 0.65, 4.0, 7);
    const oakCanopyGeom = new THREE.DodecahedronGeometry(3.0, 1);
    const oakFoliageMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.85 });

    // Weathered Mountain Granite Rock geometries
    const rockGeom1 = new THREE.DodecahedronGeometry(1.6, 1);
    const rockGeom2 = new THREE.DodecahedronGeometry(2.2, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a554c, roughness: 0.92 });
    const mossyRockMat = new THREE.MeshStandardMaterial({ color: 0x485240, roughness: 0.95 });

    // 5,000 trees, boulders, and rocks distributed across 2000x2000 map (2X DENSITY)
    const count = 5000;
    const spread = 840;

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * spread * 2;
      const z = (Math.random() - 0.5) * spread * 2;
      
      if (Math.hypot(x, z) < 18) continue;

      // Keep the 3 flat building areas open and clear for construction
      const flat = this.terrain.getFlatAreaProfile(x, z);
      if (flat.isFlatArea && flat.blendFactor > 0.5 && Math.random() < 0.82) {
        continue; // Leave flat area core open with occasional peripheral trees
      }

      const y = this.terrain.getHeightAt(x, z);

      if (y > 11.5 && y < 75) {
        const isPine = Math.random() < 0.65;
        const scale = 0.85 + Math.random() * 0.7;
        const treeId = `tree_${i}`;

        if (isPine) {
          const tree = new THREE.Group();
          const trunk = new THREE.Mesh(pineTrunkGeom, pineTrunkMat);
          trunk.position.y = 2.25;
          trunk.castShadow = true;
          tree.add(trunk);

          const l1 = new THREE.Mesh(pineLayer1Geom, pineFoliageMat);
          l1.position.y = 4.8;
          l1.castShadow = true;
          tree.add(l1);

          const l2 = new THREE.Mesh(pineLayer2Geom, pineFoliageMat);
          l2.position.y = 6.8;
          l2.castShadow = true;
          tree.add(l2);

          const l3 = new THREE.Mesh(pineLayer3Geom, pineFoliageMat);
          l3.position.y = 8.5;
          l3.castShadow = true;
          tree.add(l3);

          tree.scale.set(scale, scale, scale);
          tree.rotation.y = Math.random() * Math.PI * 2;
          tree.position.set(x, y, z);
          foliageGroup.add(tree);

          // Register 45 HP breakable tree
          const treeObs: WorldObstacle = {
            id: treeId,
            x,
            z,
            y,
            radius: 0.55 * scale,
            height: 4.5 * scale,
            type: 'tree',
            health: 45,
            maxHealth: 45,
            isFelled: false
          };
          this.addObstacle(treeObs);
          this.treeMap.set(treeId, {
            obstacle: treeObs,
            mesh: tree,
            initialY: y,
            fallProgress: 0,
            fallDir: new THREE.Vector3(1, 0, 0),
            despawnTimer: -1
          });
        } else {
          // Broadleaf Oak tree
          const oak = new THREE.Group();
          const trunk = new THREE.Mesh(oakTrunkGeom, pineTrunkMat);
          trunk.position.y = 2.0;
          trunk.castShadow = true;
          oak.add(trunk);

          const canopy = new THREE.Mesh(oakCanopyGeom, oakFoliageMat);
          canopy.position.y = 4.8;
          canopy.scale.set(1.1, 0.9, 1.1);
          canopy.castShadow = true;
          oak.add(canopy);

          oak.scale.set(scale, scale, scale);
          oak.rotation.y = Math.random() * Math.PI * 2;
          oak.position.set(x, y, z);
          foliageGroup.add(oak);

          // Register 45 HP breakable oak tree
          const treeObs: WorldObstacle = {
            id: treeId,
            x,
            z,
            y,
            radius: 0.65 * scale,
            height: 4.2 * scale,
            type: 'tree',
            health: 45,
            maxHealth: 45,
            isFelled: false
          };
          this.addObstacle(treeObs);
          this.treeMap.set(treeId, {
            obstacle: treeObs,
            mesh: oak,
            initialY: y,
            fallProgress: 0,
            fallDir: new THREE.Vector3(0, 0, 1),
            despawnTimer: -1
          });
        }
      } else if (y >= 40) {
        // Mountain Granite Rocks & Boulders (2X Density)
        const rScale = 0.8 + Math.random() * 2.0;
        const geom = Math.random() < 0.5 ? rockGeom1 : rockGeom2;
        const mat = Math.random() < 0.4 ? mossyRockMat : rockMat;
        const rock = new THREE.Mesh(geom, mat);

        const rockH = (0.6 + Math.random() * 0.7) * rScale;
        rock.scale.set(rScale, rockH, rScale);
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        rock.position.set(x, y + 0.3, z);
        rock.castShadow = true;
        rock.receiveShadow = true;
        foliageGroup.add(rock);

        const rockId = `rock_mtn_${foliageGroup.children.length}`;
        const rockObs: WorldObstacle = {
          id: rockId,
          x,
          z,
          y,
          radius: 1.3 * rScale,
          height: rockH * 1.3,
          type: 'rock',
          health: 50,
          maxHealth: 50,
          isFelled: false
        };
        this.addObstacle(rockObs);
        this.rockMap.set(rockId, { obstacle: rockObs, mesh: rock });
      } else if (y > 10.0 && y <= 13.5 && Math.random() < 0.45) {
        // Shoreline stones along coastal and river beaches (2X Density)
        const rock = new THREE.Mesh(rockGeom1, rockMat);
        const rScale = 0.6 + Math.random() * 0.8;
        const stoneH = rScale * 0.5;
        rock.scale.set(rScale, stoneH, rScale);
        rock.position.set(x, y + 0.2, z);
        foliageGroup.add(rock);

        const rockId = `rock_shore_${foliageGroup.children.length}`;
        const rockObs: WorldObstacle = {
          id: rockId,
          x,
          z,
          y,
          radius: 0.9 * rScale,
          height: stoneH * 1.2,
          type: 'rock',
          health: 50,
          maxHealth: 50,
          isFelled: false
        };
        this.addObstacle(rockObs);
        this.rockMap.set(rockId, { obstacle: rockObs, mesh: rock });
      }
    }

    this.scene.add(foliageGroup);
  }

  private spawnClouds() {
    this.cloudGroup = new THREE.Group();
    const cloudGeom = new THREE.DodecahedronGeometry(24, 1);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1.0,
      transparent: true,
      opacity: 0.72
    });

    for (let i = 0; i < 35; i++) {
      const cloud = new THREE.Mesh(cloudGeom, cloudMat);
      cloud.position.set(
        (Math.random() - 0.5) * 1800,
        190 + Math.random() * 60,
        (Math.random() - 0.5) * 1800
      );
      cloud.scale.set(1.5 + Math.random() * 1.5, 0.6 + Math.random() * 0.4, 1.2 + Math.random() * 1.0);
      this.cloudGroup.add(cloud);
    }
    this.scene.add(this.cloudGroup);
  }

  /**
   * Updates world animations per frame (Cloth flags, clouds, wood chips & tree felling physics)
   */
  public update(elapsedTime: number, delta: number) {
    // 1. Realistic Cloth Simulation for 1777 Betsy Ross Flags
    const windSpeed = 3.5;
    const waveFreq = 2.0;
    const waveAmp = 0.35;

    this.flagMeshes.forEach(flagMesh => {
      const geom = flagMesh.geometry as THREE.PlaneGeometry;
      const posAttr = geom.attributes.position;

      for (let i = 0; i < posAttr.count; i++) {
        const u = posAttr.getX(i);
        const v = posAttr.getY(i);

        const zDisplacement = Math.sin(u * waveFreq - elapsedTime * windSpeed) * (u / 6) * waveAmp
          + Math.cos(v * 3.0 - elapsedTime * 2.0) * 0.08 * (u / 6);

        posAttr.setZ(i, zDisplacement);
      }
      posAttr.needsUpdate = true;
      geom.computeVertexNormals();
    });

    // 2. Slow drifting clouds
    if (this.cloudGroup) {
      this.cloudGroup.position.x += delta * 2.2;
      if (this.cloudGroup.position.x > 900) {
        this.cloudGroup.position.x = -900;
      }
    }

    // 3. Tree Felling Animations & 20-Second Despawn System
    const treesToRemove: string[] = [];
    this.treeMap.forEach((treeData, treeId) => {
      if (treeData.obstacle.isFelled) {
        // Animate toppling over onto ground
        if (treeData.fallProgress > 0 && treeData.fallProgress < 1.0) {
          treeData.fallProgress += delta * 1.8;
          const p = Math.min(1.0, treeData.fallProgress);
          
          treeData.mesh.rotation.z = p * (Math.PI / 2.1);
          treeData.mesh.position.y = treeData.initialY - p * 1.2;

          if (p >= 1.0) {
            treeData.mesh.scale.multiplyScalar(0.92);
          }
        }

        // Count down 20-second despawn timer
        if (treeData.despawnTimer > 0) {
          treeData.despawnTimer -= delta;

          // In the last 3 seconds of the 20s, smoothly sink into ground before disappearing
          if (treeData.despawnTimer < 3.0) {
            treeData.mesh.position.y -= delta * 0.4;
            const shrink = Math.max(0.01, treeData.despawnTimer / 3.0);
            treeData.mesh.scale.setScalar(shrink * 0.92);
          }

          if (treeData.despawnTimer <= 0) {
            this.scene.remove(treeData.mesh);
            treesToRemove.push(treeId);
          }
        }
      }
    });

    for (let i = 0; i < treesToRemove.length; i++) {
      this.treeMap.delete(treesToRemove[i]);
    }

    // 4. Physical Wood Chip Particle Physics
    for (let i = this.woodChips.length - 1; i >= 0; i--) {
      const chip = this.woodChips[i];
      chip.life += delta;

      // Gravity & position
      chip.vel.y -= 18 * delta;
      chip.mesh.position.addScaledVector(chip.vel, delta);
      chip.mesh.rotation.x += chip.rotSpeed.x * delta;
      chip.mesh.rotation.y += chip.rotSpeed.y * delta;
      chip.mesh.rotation.z += chip.rotSpeed.z * delta;

      // Fade & shrink
      const remaining = 1 - chip.life / chip.maxLife;
      chip.mesh.scale.setScalar(Math.max(0.01, remaining));

      if (chip.life >= chip.maxLife) {
        this.scene.remove(chip.mesh);
        chip.mesh.geometry.dispose();
        this.woodChips.splice(i, 1);
      }
    }
  }

  /**
   * Generates a 3D building mesh for either active placement preview (ghost) or live world structure
   */
  public createBuildingMesh(type: BuildingId, isGhost: boolean = false, hasEnoughWood: boolean = true): THREE.Group {
    const group = new THREE.Group();

    // Ghost preview material vs real solid materials
    const ghostMat = new THREE.MeshBasicMaterial({
      color: hasEnoughWood ? 0x2ed573 : 0xff4757,
      transparent: true,
      opacity: 0.65,
      wireframe: false
    });

    const woodMat = isGhost ? ghostMat : new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.85 });
    const logMat = isGhost ? ghostMat : new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9 });
    const stoneMat = isGhost ? ghostMat : new THREE.MeshStandardMaterial({ color: 0x5a554c, roughness: 0.92 });
    const roofMat = isGhost ? ghostMat : new THREE.MeshStandardMaterial({ color: 0x2b1d06, roughness: 0.8 });
    const fireMat = isGhost ? ghostMat : new THREE.MeshBasicMaterial({ color: 0xff5500 });

    if (type === 'campfire') {
      // 1. Stone Ring
      const stoneGeom = new THREE.DodecahedronGeometry(0.18, 0);
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const stone = new THREE.Mesh(stoneGeom, stoneMat);
        stone.position.set(Math.cos(angle) * 0.65, 0.12, Math.sin(angle) * 0.65);
        stone.scale.set(1 + Math.random() * 0.3, 0.8, 1 + Math.random() * 0.3);
        group.add(stone);
      }

      // 2. Crossed Pine Logs
      const logGeom = new THREE.CylinderGeometry(0.08, 0.10, 1.1, 7);
      logGeom.rotateZ(Math.PI / 2);
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI;
        const log = new THREE.Mesh(logGeom, logMat);
        log.position.set(0, 0.15 + i * 0.04, 0);
        log.rotation.y = angle;
        group.add(log);
      }

      // 3. Flame Core
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.75, 6), fireMat);
      flame.position.set(0, 0.45, 0);
      group.add(flame);

      if (!isGhost) {
        const light = new THREE.PointLight(0xff7700, 3.5, 14);
        light.position.set(0, 0.6, 0);
        group.add(light);
      }
    } else if (type === 'palisade') {
      // 7 Vertical Spiked Pine Logs
      const logGeom = new THREE.CylinderGeometry(0.14, 0.17, 3.0, 8);
      const tipGeom = new THREE.ConeGeometry(0.17, 0.5, 8);

      for (let i = 0; i < 7; i++) {
        const xOffset = -1.8 + i * 0.6;
        const log = new THREE.Mesh(logGeom, logMat);
        log.position.set(xOffset, 1.5, (Math.random() - 0.5) * 0.08);
        group.add(log);

        const tip = new THREE.Mesh(tipGeom, logMat);
        tip.position.set(xOffset, 3.25, log.position.z);
        group.add(tip);
      }

      // 2 Horizontal Cross Beams
      const beamGeom = new THREE.BoxGeometry(4.2, 0.14, 0.16);
      const beam1 = new THREE.Mesh(beamGeom, woodMat);
      beam1.position.set(0, 0.9, 0.15);
      group.add(beam1);

      const beam2 = new THREE.Mesh(beamGeom, woodMat);
      beam2.position.set(0, 2.2, 0.15);
      group.add(beam2);
    } else if (type === 'stone_wall') {
      // Heavy Granite Stone Redoubt / Bastion Wall (4.2m wide, 2.8m high, 1.2m thick)
      const baseWallGeom = new THREE.BoxGeometry(4.2, 2.2, 1.2);
      const baseWall = new THREE.Mesh(baseWallGeom, stoneMat);
      baseWall.position.set(0, 1.1, 0);
      group.add(baseWall);

      // Top Embrasures / Crenellations (3 stone merlons with 2 firing gaps)
      const merlonGeom = new THREE.BoxGeometry(0.9, 0.6, 1.25);
      const m1 = new THREE.Mesh(merlonGeom, stoneMat);
      m1.position.set(-1.65, 2.5, 0);
      group.add(m1);

      const m2 = new THREE.Mesh(merlonGeom, stoneMat);
      m2.position.set(0, 2.5, 0);
      group.add(m2);

      const m3 = new THREE.Mesh(merlonGeom, stoneMat);
      m3.position.set(1.65, 2.5, 0);
      group.add(m3);

      // Heavy timber cap coping & bracing ties
      const timberTieGeom = new THREE.BoxGeometry(4.3, 0.12, 0.25);
      const tTie1 = new THREE.Mesh(timberTieGeom, woodMat);
      tTie1.position.set(0, 2.25, 0.55);
      group.add(tTie1);

      const tTie2 = new THREE.Mesh(timberTieGeom, woodMat);
      tTie2.position.set(0, 2.25, -0.55);
      group.add(tTie2);
    } else if (type === 'bridge') {
      // 2 Long Heavy Timber Stringers
      const stringerGeom = new THREE.BoxGeometry(0.22, 0.28, 5.5);
      const s1 = new THREE.Mesh(stringerGeom, woodMat);
      s1.position.set(-1.4, 0.75, 0);
      group.add(s1);

      const s2 = new THREE.Mesh(stringerGeom, woodMat);
      s2.position.set(1.4, 0.75, 0);
      group.add(s2);

      // 9 Wide Timber Planks
      const plankGeom = new THREE.BoxGeometry(3.1, 0.10, 0.52);
      for (let i = 0; i < 9; i++) {
        const zPos = -2.3 + i * 0.58;
        const plank = new THREE.Mesh(plankGeom, woodMat);
        plank.position.set(0, 0.92, zPos);
        group.add(plank);
      }

      // 4 Support Pilings
      const postGeom = new THREE.CylinderGeometry(0.12, 0.15, 2.0, 8);
      const postPositions = [
        [-1.4, 0, -2.2],
        [1.4, 0, -2.2],
        [-1.4, 0, 2.2],
        [1.4, 0, 2.2]
      ];
      for (const [px, py, pz] of postPositions) {
        const post = new THREE.Mesh(postGeom, logMat);
        post.position.set(px, py + 0.5, pz);
        group.add(post);
      }
    } else if (type === 'cabin') {
      // 4-Walled Interlocking Log Cabin with Open Doorway
      const wallLogGeom = new THREE.CylinderGeometry(0.12, 0.14, 5.2, 8);
      wallLogGeom.rotateZ(Math.PI / 2);

      const sideLogGeom = new THREE.CylinderGeometry(0.12, 0.14, 5.2, 8);
      sideLogGeom.rotateX(Math.PI / 2);

      // Back Wall (solid logs)
      for (let i = 0; i < 9; i++) {
        const log = new THREE.Mesh(wallLogGeom, logMat);
        log.position.set(0, 0.2 + i * 0.24, -2.5);
        group.add(log);
      }

      // Left Wall
      for (let i = 0; i < 9; i++) {
        const log = new THREE.Mesh(sideLogGeom, logMat);
        log.position.set(-2.5, 0.2 + i * 0.24, 0);
        group.add(log);
      }

      // Right Wall
      for (let i = 0; i < 9; i++) {
        const log = new THREE.Mesh(sideLogGeom, logMat);
        log.position.set(2.5, 0.2 + i * 0.24, 0);
        group.add(log);
      }

      // Front Wall with Doorway Opening
      const shortLogGeom = new THREE.CylinderGeometry(0.12, 0.14, 1.8, 8);
      shortLogGeom.rotateZ(Math.PI / 2);

      for (let i = 0; i < 9; i++) {
        const yPos = 0.2 + i * 0.24;
        if (i < 7) {
          // Left of doorway
          const lLog = new THREE.Mesh(shortLogGeom, logMat);
          lLog.position.set(-1.7, yPos, 2.5);
          group.add(lLog);

          // Right of doorway
          const rLog = new THREE.Mesh(shortLogGeom, logMat);
          rLog.position.set(1.7, yPos, 2.5);
          group.add(rLog);
        } else {
          // Lintel above doorway
          const topLog = new THREE.Mesh(wallLogGeom, logMat);
          topLog.position.set(0, yPos, 2.5);
          group.add(topLog);
        }
      }

      // Pitched Gable Roof
      const roofPlateGeom = new THREE.BoxGeometry(3.2, 0.12, 5.6);
      const roofL = new THREE.Mesh(roofPlateGeom, roofMat);
      roofL.position.set(-1.3, 3.0, 0);
      roofL.rotation.z = 0.55;
      group.add(roofL);

      const roofR = new THREE.Mesh(roofPlateGeom, roofMat);
      roofR.position.set(1.3, 3.0, 0);
      roofR.rotation.z = -0.55;
      group.add(roofR);
    } else if (type === 'watchtower') {
      // 4 Tall Corner Column Posts
      const postGeom = new THREE.CylinderGeometry(0.16, 0.22, 7.5, 8);
      const postCoords = [
        [-1.8, 3.75, -1.8],
        [1.8, 3.75, -1.8],
        [-1.8, 3.75, 1.8],
        [1.8, 3.75, 1.8]
      ];
      for (const [px, py, pz] of postCoords) {
        const post = new THREE.Mesh(postGeom, logMat);
        post.position.set(px, py, pz);
        group.add(post);
      }

      // Cross-Bracing Ties
      const tieGeom = new THREE.BoxGeometry(3.8, 0.12, 0.12);
      for (const y of [2.5, 5.0]) {
        const t1 = new THREE.Mesh(tieGeom, woodMat);
        t1.position.set(0, y, -1.8);
        group.add(t1);

        const t2 = new THREE.Mesh(tieGeom, woodMat);
        t2.position.set(0, y, 1.8);
        group.add(t2);
      }

      // Elevated Observation Deck Floor
      const deckGeom = new THREE.BoxGeometry(4.4, 0.20, 4.4);
      const deck = new THREE.Mesh(deckGeom, woodMat);
      deck.position.set(0, 7.4, 0);
      group.add(deck);

      // Perimeter Deck Railings (with ladder entry opening at the back)
      const railGeomFront = new THREE.BoxGeometry(4.4, 0.1, 0.1);
      const rFront = new THREE.Mesh(railGeomFront, woodMat);
      rFront.position.set(0, 8.4, 2.1);
      group.add(rFront);

      const railGeomSides = new THREE.BoxGeometry(0.1, 0.1, 4.4);
      const rLeft = new THREE.Mesh(railGeomSides, woodMat);
      rLeft.position.set(-2.1, 8.4, 0);
      group.add(rLeft);

      const rRight = new THREE.Mesh(railGeomSides, woodMat);
      rRight.position.set(2.1, 8.4, 0);
      group.add(rRight);

      // Back Railing split to leave open doorway access for ladder
      const backRailGeom = new THREE.BoxGeometry(1.6, 0.1, 0.1);
      const rBackLeft = new THREE.Mesh(backRailGeom, woodMat);
      rBackLeft.position.set(-1.3, 8.4, -2.1);
      group.add(rBackLeft);

      const rBackRight = new THREE.Mesh(backRailGeom, woodMat);
      rBackRight.position.set(1.3, 8.4, -2.1);
      group.add(rBackRight);

      // -------------------------------------------------------------
      // 3D CLIMBABLE TIMBER LADDER
      // -------------------------------------------------------------
      const ladderRailGeom = new THREE.BoxGeometry(0.08, 7.8, 0.08);
      const ladderRailL = new THREE.Mesh(ladderRailGeom, logMat);
      ladderRailL.position.set(-0.35, 3.9, -1.84);
      group.add(ladderRailL);

      const ladderRailR = new THREE.Mesh(ladderRailGeom, logMat);
      ladderRailR.position.set(0.35, 3.9, -1.84);
      group.add(ladderRailR);

      // Ladder Rungs (20 evenly spaced wooden steps)
      const rungGeom = new THREE.BoxGeometry(0.68, 0.06, 0.06);
      for (let y = 0.35; y <= 7.6; y += 0.38) {
        const rung = new THREE.Mesh(rungGeom, woodMat);
        rung.position.set(0, y, -1.84);
        group.add(rung);
      }

      // Top Safety Handles extending onto Observation Deck
      const topHandleGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8);
      const hL = new THREE.Mesh(topHandleGeom, woodMat);
      hL.position.set(-0.35, 8.05, -1.95);
      hL.rotation.x = -0.3;
      group.add(hL);

      const hR = new THREE.Mesh(topHandleGeom, woodMat);
      hR.position.set(0.35, 8.05, -1.95);
      hR.rotation.x = -0.3;
      group.add(hR);

      // Lookout Roof Canopy
      const canopyGeom = new THREE.BoxGeometry(4.8, 0.14, 4.8);
      const canopy = new THREE.Mesh(canopyGeom, roofMat);
      canopy.position.set(0, 9.6, 0);
      group.add(canopy);
    }

    return group;
  }

  /**
   * Spawns a physical constructed building in the world and registers solid collision
   */
  public spawnBuilding(type: BuildingId, x: number, y: number, z: number, rotationY: number = 0) {
    const mesh = this.createBuildingMesh(type, false);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;
    this.scene.add(mesh);

    const bp = BUILDING_BLUEPRINTS[type];
    const obs: WorldObstacle = {
      x,
      y,
      z,
      radius: Math.max(bp.width, bp.depth) / 2,
      height: bp.height,
      type: 'building',
      id: `building_${type}_${Date.now()}`
    };

    this.addObstacle(obs);

    // Register climbable ladder volume for watchtowers
    if (type === 'watchtower') {
      const rot = rotationY || 0;
      // Ladder is placed at local offset (0, 0, -1.84)
      const lx = x + (-1.84) * Math.sin(rot);
      const lz = z + (-1.84) * Math.cos(rot);
      this.ladders.push({
        id: `ladder_watchtower_${Date.now()}_${Math.random()}`,
        x,
        z,
        bottomY: y,
        topY: y + 7.5,
        deckY: y + 7.4,
        radius: 1.8,
        ladderX: lx,
        ladderZ: lz
      });
    }

    soundManager.playBuildPlace();

    return { mesh, obstacle: obs };
  }

  /**
   * Checks if player coordinate is near any climbable ladder volume
   */
  public getNearbyLadder(px: number, py: number, pz: number): LadderVolume | null {
    for (let i = 0; i < this.ladders.length; i++) {
      const lad = this.ladders[i];
      const dx = px - lad.ladderX;
      const dz = pz - lad.ladderZ;
      const distSq = dx * dx + dz * dz;

      // Distance to ladder rung face or watchtower frame base
      const tdx = px - lad.x;
      const tdz = pz - lad.z;
      const tDistSq = tdx * tdx + tdz * tdz;

      if ((distSq <= lad.radius * lad.radius || tDistSq <= 2.4 * 2.4) && py >= lad.bottomY - 0.5 && py <= lad.topY + 2.5) {
        return lad;
      }
    }
    return null;
  }
}
