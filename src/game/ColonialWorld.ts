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

interface WoodChip {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class ColonialWorld {
  public scene: THREE.Scene;
  public terrain: TerrainGenerator;
  public landmarks: Landmark[] = [];
  public flagMeshes: THREE.Mesh[] = [];
  private cloudGroup: THREE.Group = new THREE.Group();

  // Solid Collision Obstacles & Spatial Grid for 2000x2000 world
  public obstacles: WorldObstacle[] = [];
  private spatialGrid: Map<string, WorldObstacle[]> = new Map();
  private cellSize: number = 25;

  // Tree Health & Felling System (45 HP per tree, broken in 3 axe chops of 15 damage)
  public treeMap: Map<string, TreeData> = new Map();
  private woodChips: WoodChip[] = [];
  private woodChipGeom: THREE.BoxGeometry = new THREE.BoxGeometry(0.08, 0.04, 0.15);
  private woodChipMat: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
    color: 0x8d5b36,
    roughness: 0.85
  });

  constructor(scene: THREE.Scene, terrain: TerrainGenerator) {
    this.scene = scene;
    this.terrain = terrain;
  }

  public populate() {
    this.setupLighting();
    this.setupSkyAndFog();
    this.spawnFoliage();
    this.spawnClouds();
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

    // 2,500 trees and rocks distributed across 2000x2000 map (spread radius = 820m)
    const count = 2500;
    const spread = 820;

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * spread * 2;
      const z = (Math.random() - 0.5) * spread * 2;
      
      if (Math.hypot(x, z) < 18) continue;

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
      } else if (y >= 45) {
        // Mountain Granite Rocks
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

        this.addObstacle({
          x,
          z,
          y,
          radius: 1.3 * rScale,
          height: rockH * 1.3,
          type: 'rock'
        });
      } else if (y > 0 && y <= 2 && Math.random() < 0.2) {
        // Shoreline stones
        const rock = new THREE.Mesh(rockGeom1, rockMat);
        const rScale = 0.6 + Math.random() * 0.8;
        const stoneH = rScale * 0.5;
        rock.scale.set(rScale, stoneH, rScale);
        rock.position.set(x, y + 0.2, z);
        foliageGroup.add(rock);

        this.addObstacle({
          x,
          z,
          y,
          radius: 0.9 * rScale,
          height: stoneH * 1.2,
          type: 'rock'
        });
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

      // Perimeter Deck Railings
      const railGeomH = new THREE.BoxGeometry(4.4, 0.1, 0.1);
      const r1 = new THREE.Mesh(railGeomH, woodMat);
      r1.position.set(0, 8.4, -2.1);
      group.add(r1);

      const r2 = new THREE.Mesh(railGeomH, woodMat);
      r2.position.set(0, 8.4, 2.1);
      group.add(r2);

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
    soundManager.playBuildPlace();

    return { mesh, obstacle: obs };
  }
}
