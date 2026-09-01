import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import type { TerrainConfig } from '../types';

export class TerrainGenerator {
  public config: TerrainConfig;
  private noise2D: (x: number, y: number) => number;
  private detailNoise2D: (x: number, y: number) => number;
  private warpNoise2D: (x: number, y: number) => number;
  public mesh: THREE.Mesh | null = null;
  public geometry: THREE.PlaneGeometry | null = null;

  constructor(config?: Partial<TerrainConfig>) {
    this.config = {
      seed: Math.random() * 10000,
      width: 2000,       // 2000 by 2000 map size
      depth: 2000,
      resolution: 240,   // High resolution for smooth 2000x2000 world
      baselineY: 20,
      maxMountainY: 120, // 100 higher than baseline (20 + 100 = 120)
      minValleyY: -5,    // valleys down to y = -5
      mountainScale: 0.002,
      detailScale: 0.012,
      ...config
    };

    // Deterministic pseudo-random number generator for seeded noise
    const rng = this.createSeededRNG(this.config.seed);
    this.noise2D = createNoise2D(rng);
    this.detailNoise2D = createNoise2D(this.createSeededRNG(this.config.seed + 101));
    this.warpNoise2D = createNoise2D(this.createSeededRNG(this.config.seed + 202));
  }

  private createSeededRNG(seed: number) {
    let s = Math.sin(seed) * 10000;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  /**
   * Evaluates the water body profile at (x, z).
   * Carves 1 thick East-to-West main river (130m wide)
   * and 4 distinct natural lakes in the quadrants.
   */
  private getWaterBodiesProfile(x: number, z: number): { isWaterBody: boolean; bedHeight: number; factor: number } {
    let minT = 1.0;
    let targetBed = 2.0;

    // -------------------------------------------------------------
    // 1. THICK MAIN RIVER (East to West across the entire 2000m map)
    // -------------------------------------------------------------
    // Grand 130-meter wide colonial river winding across the continent
    const mainRiverZ = -105 + Math.sin(x * 0.0035) * 95 + Math.cos(x * 0.009) * 45 + this.warpNoise2D(x * 0.002, 12.0) * 55;
    const distMain = Math.abs(z - mainRiverZ);
    const mainHalfWidth = 65.0; // 130 meters wide!

    if (distMain < mainHalfWidth) {
      const t = distMain / mainHalfWidth;
      if (t < minT) {
        minT = t;
        targetBed = 1.5; // 8.5 meters deep water below waterLevel 10.0
      }
    }

    // -------------------------------------------------------------
    // 2. LAKE #1: North Great Lake (Lake Champlain Basin)
    // -------------------------------------------------------------
    const l1Center = { x: 340, z: -520, rx: 125, rz: 95 };
    const l1Warp = this.warpNoise2D(x * 0.012, z * 0.012) * 0.22;
    const l1Dist = Math.hypot((x - l1Center.x) / l1Center.rx, (z - l1Center.z) / l1Center.rz) + l1Warp;
    if (l1Dist < 1.0) {
      if (l1Dist < minT) {
        minT = l1Dist;
        targetBed = 1.8;
      }
    }

    // -------------------------------------------------------------
    // 3. LAKE #2: Northwest Alpine Mountain Lake
    // -------------------------------------------------------------
    const l2Center = { x: -580, z: -520, rx: 105, rz: 105 };
    const l2Warp = this.warpNoise2D(x * 0.014, z * 0.014) * 0.20;
    const l2Dist = Math.hypot((x - l2Center.x) / l2Center.rx, (z - l2Center.z) / l2Center.rz) + l2Warp;
    if (l2Dist < 1.0) {
      if (l2Dist < minT) {
        minT = l2Dist;
        targetBed = 2.0;
      }
    }

    // -------------------------------------------------------------
    // 4. LAKE #3: Southwest Forest Emerald Lake
    // -------------------------------------------------------------
    const l3Center = { x: -520, z: 520, rx: 135, rz: 100 };
    const l3Warp = this.warpNoise2D(x * 0.011, z * 0.011) * 0.24;
    const l3Dist = Math.hypot((x - l3Center.x) / l3Center.rx, (z - l3Center.z) / l3Center.rz) + l3Warp;
    if (l3Dist < 1.0) {
      if (l3Dist < minT) {
        minT = l3Dist;
        targetBed = 1.6;
      }
    }

    // -------------------------------------------------------------
    // 5. LAKE #4: Southeast Highland Mirror Lake
    // -------------------------------------------------------------
    const l4Center = { x: 550, z: 540, rx: 115, rz: 115 };
    const l4Warp = this.warpNoise2D(x * 0.013, z * 0.013) * 0.22;
    const l4Dist = Math.hypot((x - l4Center.x) / l4Center.rx, (z - l4Center.z) / l4Center.rz) + l4Warp;
    if (l4Dist < 1.0) {
      if (l4Dist < minT) {
        minT = l4Dist;
        targetBed = 1.8;
      }
    }

    return {
      isWaterBody: minT < 1.0,
      bedHeight: targetBed,
      factor: minT
    };
  }

  /**
   * Calculates the exact terrain height at coordinate (x, z)
   * Guaranteed to maintain solid dry land across the continent,
   * carving 1 thick East-to-West river and 4 distinct regional lakes,
   * and tapering down into an endless sea at the borders.
   */
  public getHeightAt(x: number, z: number): number {
    // Domain warping for natural mountain ridges
    const warpX = x + this.warpNoise2D(x * 0.0015, z * 0.0015) * 55;
    const warpZ = z + this.warpNoise2D(z * 0.0015, x * 0.0015) * 55;

    // Macro elevation (mountains vs plains)
    const n1 = this.noise2D(warpX * this.config.mountainScale, warpZ * this.config.mountainScale);
    
    // Medium hills & ridges
    const n2 = this.noise2D(warpX * 0.006, warpZ * 0.006) * 0.5;
    
    // Fine terrain rocky details
    const n3 = this.detailNoise2D(x * this.config.detailScale, z * this.config.detailScale) * 0.25;

    // Combined normalized noise
    let rawNoise = n1 * 1.0 + n2 + n3;
    
    // Smooth shaping: push peaks higher (mountain ridges)
    if (rawNoise > 0.15) {
      const peakFactor = Math.pow((rawNoise - 0.15) / 1.6, 1.3);
      rawNoise = 0.15 + peakFactor * 1.6;
    }

    // Map to normalized 0..1 range
    const t = THREE.MathUtils.clamp((rawNoise + 1.25) / 2.8, 0, 1);

    // Baseline dry land: minimum terrestrial elevation is 15.5m (well above water level 10.0)
    let height: number;
    if (t < 0.25) {
      const valleyT = t / 0.25;
      height = THREE.MathUtils.lerp(15.5, this.config.baselineY, valleyT);
    } else {
      const mountainT = (t - 0.25) / 0.75;
      const smoothMountainT = mountainT * mountainT * (3 - 2 * mountainT);
      height = THREE.MathUtils.lerp(this.config.baselineY, this.config.maxMountainY, smoothMountainT);
    }

    // Carve the thick East-to-West Middle River + 4 Regional Lakes
    const water = this.getWaterBodiesProfile(x, z);
    if (water.isWaterBody) {
      const smoothBank = water.factor * water.factor * (3 - 2 * water.factor);
      height = THREE.MathUtils.lerp(water.bedHeight, height, smoothBank);
    }

    // Keep initial spawn region near (0,0) gently contoured around baseline y=20
    const distFromOrigin = Math.sqrt(x * x + z * z);
    if (distFromOrigin < 45) {
      const blend = THREE.MathUtils.smoothstep(distFromOrigin, 6, 45);
      height = THREE.MathUtils.lerp(this.config.baselineY, height, blend);
    }

    // World Border Island Taper into the Endless Sea (border transition starting at r=800m up to 1000m)
    const distEdge = Math.max(Math.abs(x), Math.abs(z));
    if (distEdge > 750) {
      const oceanFade = THREE.MathUtils.smoothstep(distEdge, 750, 990);
      height = THREE.MathUtils.lerp(height, -18, oceanFade);
    }

    // Apply any local shovel digging depressions
    const digKey = this.getDigKey(x, z);
    if (this.digOffsets.has(digKey)) {
      height -= this.digOffsets.get(digKey)!;
    }

    return height;
  }

  private digOffsets: Map<string, number> = new Map();

  private getDigKey(x: number, z: number): string {
    const rx = Math.round(x);
    const rz = Math.round(z);
    return `${rx},${rz}`;
  }

  /**
   * Physically digs down into the terrain by depth (3 feet per 4 shovel swings)
   */
  public digAt(x: number, z: number, depth: number = 3.0) {
    const digKey = this.getDigKey(x, z);
    const cur = this.digOffsets.get(digKey) ?? 0;
    this.digOffsets.set(digKey, cur + depth);

    // Deform 3D terrain geometry around the excavated 3-foot trench
    const digRadius = 3.8;
    if (this.geometry) {
      const pos = this.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vz = pos.getZ(i);
        const dist = Math.hypot(vx - x, vz - z);
        if (dist < digRadius) {
          const falloff = Math.cos((dist / digRadius) * (Math.PI / 2));
          pos.setY(i, pos.getY(i) - depth * falloff);
        }
      }
      pos.needsUpdate = true;
      this.geometry.computeVertexNormals();
    }
  }

  /**
   * Generates the Three.js mesh for the 2000x2000 procedural terrain
   */
  public generateMesh(): THREE.Mesh {
    const { width, depth, resolution } = this.config;
    const geometry = new THREE.PlaneGeometry(width, depth, resolution, resolution);
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    const colors: number[] = [];

    // Realistic Colonial Color Palette: Beach sand, rich grass, forest green, rock grey, snow peak, vibrant ocean blue
    const colorDeepWater = new THREE.Color(0x004c8c); // Deep vibrant royal azure ocean bed
    const colorSand = new THREE.Color(0xe0cfb0);
    const colorGrass = new THREE.Color(0x3e6b36);
    const colorForest = new THREE.Color(0x274e22);
    const colorRock = new THREE.Color(0x5c574f);
    const colorSnow = new THREE.Color(0xeef2f7);

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const y = this.getHeightAt(x, z);

      positions.setY(i, y);

      // Vertex Coloring according to elevation and slope
      const vertexColor = new THREE.Color();

      if (y <= 10.0) {
        // Submerged coast / ocean floor (vibrant deep ocean blue)
        vertexColor.copy(colorDeepWater);
      } else if (y < 14.0) {
        // Shoreline / Sandy coast
        const blend = THREE.MathUtils.smoothstep(y, 10.0, 14.0);
        vertexColor.copy(colorSand).lerp(colorGrass, blend);
      } else if (y < 34.0) {
        // Lowland grass / plains (around baseline y=20)
        const blend = THREE.MathUtils.smoothstep(y, 14.0, 34.0);
        vertexColor.copy(colorGrass).lerp(colorForest, blend);
      } else if (y < 68.0) {
        // Hillside & mountain forest
        const blend = THREE.MathUtils.smoothstep(y, 34.0, 68.0);
        vertexColor.copy(colorForest).lerp(colorRock, blend);
      } else if (y < 95.0) {
        // High rocky crags
        const blend = THREE.MathUtils.smoothstep(y, 68.0, 95.0);
        vertexColor.copy(colorRock).lerp(colorSnow, blend * 0.5);
      } else {
        // Alpine peaks (100-120 ft)
        const blend = THREE.MathUtils.smoothstep(y, 95.0, 120.0);
        vertexColor.copy(colorRock).lerp(colorSnow, blend);
      }

      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.08,
      flatShading: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    this.mesh = mesh;
    this.geometry = geometry;
    return mesh;
  }

  /**
   * Generates a vast, endless ocean water plane at sea level (y = 10.0) with rich vibrant azure blue
   */
  public generateWaterMesh(): THREE.Mesh {
    // 8000x8000 Endless Sea plane extending beyond horizon
    const waterGeom = new THREE.PlaneGeometry(8000, 8000, 64, 64);
    waterGeom.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0072b2, // Vibrant, crystal-clear Atlantic ocean azure blue
      roughness: 0.04,
      metalness: 0.88,
      transparent: true,
      opacity: 0.88
    });
    const waterMesh = new THREE.Mesh(waterGeom, waterMat);
    waterMesh.position.y = 10.0; // 2X Higher Sea & Water Level
    waterMesh.receiveShadow = true;
    return waterMesh;
  }

  /**
   * Generates an authentic top-down 2D topographic map data URL representing the true 2000x2000 terrain
   */
  public generateMapDataUrl(size: number = 400): string {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    const half = 1000; // -1000 to +1000

    for (let py = 0; py < size; py++) {
      const z = -half + (py / size) * 2000;
      for (let px = 0; px < size; px++) {
        const x = -half + (px / size) * 2000;
        const y = this.getHeightAt(x, z);

        // Simple hillshade slope factor
        const yRight = this.getHeightAt(x + 5, z);
        const yDown = this.getHeightAt(x, z + 5);
        const slope = (yRight - y) * 1.5 + (yDown - y) * 1.5;
        const shade = Math.max(0.75, Math.min(1.25, 1.0 + slope * 0.04));

        let r = 0, g = 0, b = 0;
        if (y <= 10.0) {
          // Atlantic Ocean Azure Blue
          r = 0; g = 114; b = 178;
        } else if (y < 14.0) {
          // Sandy Shoreline
          r = 224; g = 207; b = 176;
        } else if (y < 34.0) {
          // Lowland Grass & Plains
          r = 62; g = 107; b = 54;
        } else if (y < 68.0) {
          // Forest Highlands
          r = 39; g = 78; b = 34;
        } else if (y < 95.0) {
          // Granite Mountain Ridges
          r = 92; g = 87; b = 79;
        } else {
          // Snow Peak
          r = 238; g = 242; b = 247;
        }

        const idx = (py * size + px) * 4;
        data[idx] = Math.min(255, Math.max(0, Math.round(r * shade)));
        data[idx + 1] = Math.min(255, Math.max(0, Math.round(g * shade)));
        data[idx + 2] = Math.min(255, Math.max(0, Math.round(b * shade)));
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  }
}
