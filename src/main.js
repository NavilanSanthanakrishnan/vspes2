const WORLD_W = 118;
const WORLD_H = 72;
const WORLD_SIZE = WORLD_W * WORLD_H;
const STEP = 1 / 18;
const TAU = Math.PI * 2;
const MAX_HISTORY = 360;
const MAX_AGENTS = 420;
const SHADOW_WORLDS = 10000;
const SHADOW_STEPS = 48;
const SHADOW_CANDIDATES = 10;
const LEAGUE_HISTORY = 180;

const FACTIONS = {
  forager: {
    name: "Foragers",
    role: "prey / seed dispersal",
    color: "#72d47f",
    minPopulation: 42,
    maxPopulation: 210,
    baseGenome: {
      speed: 1.12,
      sense: 8.8,
      metabolism: 0.018,
      appetite: 1.08,
      risk: 0.32,
      social: 0.92,
      fertility: 1.18,
      thermal: 0.72,
      build: 0.05,
      aggression: 0.08,
      mutation: 0.12
    }
  },
  predator: {
    name: "Stalkers",
    role: "predator / pressure",
    color: "#f05d6c",
    minPopulation: 12,
    maxPopulation: 90,
    baseGenome: {
      speed: 1.38,
      sense: 11.5,
      metabolism: 0.03,
      appetite: 1.36,
      risk: 0.74,
      social: 0.62,
      fertility: 0.68,
      thermal: 0.6,
      build: 0.02,
      aggression: 1.12,
      mutation: 0.1
    }
  },
  builder: {
    name: "Architects",
    role: "builder / niche control",
    color: "#e3b95f",
    minPopulation: 18,
    maxPopulation: 110,
    baseGenome: {
      speed: 0.92,
      sense: 8.2,
      metabolism: 0.022,
      appetite: 0.72,
      risk: 0.42,
      social: 0.72,
      fertility: 0.74,
      thermal: 0.78,
      build: 1.28,
      aggression: 0.2,
      mutation: 0.11
    }
  }
};

const STRUCTURES = {
  none: 0,
  barrier: 1,
  nursery: 2,
  detox: 3,
  beacon: 4,
  den: 5
};

const STRUCTURE_META = {
  [STRUCTURES.barrier]: { name: "barrier", color: "#9f8055" },
  [STRUCTURES.nursery]: { name: "nursery", color: "#72d47f" },
  [STRUCTURES.detox]: { name: "detoxifier", color: "#62d5d0" },
  [STRUCTURES.beacon]: { name: "beacon", color: "#e3b95f" },
  [STRUCTURES.den]: { name: "den", color: "#f05d6c" }
};

const TOOLS = [
  { id: "observe", label: "Observe", radius: 1, cost: 0, hint: "inspect cell and nearby agents" },
  { id: "seed", label: "Seed", radius: 5, cost: 6, hint: "add flora, nutrients, and spores" },
  { id: "rain", label: "Rain", radius: 7, cost: 8, hint: "cool, hydrate, and suppress fire" },
  { id: "detox", label: "Detox", radius: 5, cost: 10, hint: "remove toxicity and disease stress" },
  { id: "mutate", label: "Mutate", radius: 6, cost: 12, hint: "increase local genome variation" },
  { id: "fireline", label: "Breakline", radius: 4, cost: 9, hint: "clear biomass to halt runaway fire" },
  { id: "ridge", label: "Ridge", radius: 4, cost: 11, hint: "raise a builder-friendly terrain rib" }
];

const GENE_KEYS = ["speed", "sense", "risk", "social", "fertility", "build", "aggression", "mutation"];

const dom = {
  canvas: document.querySelector("#worldCanvas"),
  historyCanvas: document.querySelector("#historyCanvas"),
  factionGrid: document.querySelector("#factionGrid"),
  geneBoard: document.querySelector("#geneBoard"),
  rewardGrid: document.querySelector("#rewardGrid"),
  eventLog: document.querySelector("#eventLog"),
  toolDock: document.querySelector("#toolDock"),
  pauseBtn: document.querySelector("#pauseBtn"),
  pauseIcon: document.querySelector("#pauseIcon"),
  stepBtn: document.querySelector("#stepBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  speedSlider: document.querySelector("#speedSlider"),
  rainSlider: document.querySelector("#rainSlider"),
  mutationSlider: document.querySelector("#mutationSlider"),
  disturbanceSlider: document.querySelector("#disturbanceSlider"),
  trainToggleBtn: document.querySelector("#trainToggleBtn"),
  burstTrainBtn: document.querySelector("#burstTrainBtn"),
  injectChampionBtn: document.querySelector("#injectChampionBtn"),
  speedLabel: document.querySelector("#speedLabel"),
  leagueCanvas: document.querySelector("#leagueCanvas"),
  leagueModeText: document.querySelector("#leagueModeText"),
  shadowWorldText: document.querySelector("#shadowWorldText"),
  leagueGenerationText: document.querySelector("#leagueGenerationText"),
  rolloutText: document.querySelector("#rolloutText"),
  leagueRatingText: document.querySelector("#leagueRatingText"),
  regimeText: document.querySelector("#regimeText"),
  epochText: document.querySelector("#epochText"),
  seasonText: document.querySelector("#seasonText"),
  scoreText: document.querySelector("#scoreText"),
  diversityText: document.querySelector("#diversityText"),
  stabilityText: document.querySelector("#stabilityText"),
  trendText: document.querySelector("#trendText"),
  clockText: document.querySelector("#clockText"),
  agentTotal: document.querySelector("#agentTotal"),
  cellReadout: document.querySelector("#cellReadout")
};

const ctx = dom.canvas.getContext("2d", { alpha: false });
const chartCtx = dom.historyCanvas.getContext("2d");
const leagueCtx = dom.leagueCanvas.getContext("2d");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function invLerp(a, b, value) {
  return clamp((value - a) / (b - a || 1), 0, 1);
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function mixColor(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `rgb(${Math.round(lerp(ca.r, cb.r, t))}, ${Math.round(lerp(ca.g, cb.g, t))}, ${Math.round(lerp(ca.b, cb.b, t))})`;
}

function hexToRgb(hex) {
  const raw = hex.replace("#", "");
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16)
  };
}

function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, seed) {
  let n = x * 374761393 + y * 668265263 + seed * 1442695041;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function noise2(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

function fbm(x, y, seed) {
  let value = 0;
  let amp = 0.56;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < 5; i += 1) {
    value += amp * noise2(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= 0.52;
    freq *= 2.02;
  }
  return value / norm;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function indexOf(x, y) {
  return clamp(Math.floor(y), 0, WORLD_H - 1) * WORLD_W + clamp(Math.floor(x), 0, WORLD_W - 1);
}

function mutateGenome(base, rng, strength = 1) {
  const genome = { ...base };
  const scale = (base.mutation ?? 0.1) * strength;
  for (const key of Object.keys(base)) {
    if (key === "lineage") continue;
    const drift = (rng() * 2 - 1) * scale;
    if (key === "metabolism") {
      genome[key] = clamp(base[key] * (1 + drift * 0.45), 0.01, 0.055);
    } else if (key === "sense") {
      genome[key] = clamp(base[key] * (1 + drift * 0.7), 4.5, 16);
    } else {
      genome[key] = clamp(base[key] * (1 + drift), 0.02, 2.8);
    }
  }
  genome.mutation = clamp(genome.mutation, 0.025, 0.34);
  return genome;
}

function describeGenome(faction, genome) {
  if (faction === "forager") {
    if (genome.risk < 0.25 && genome.social > 0.9) return "tight evasive herding";
    if (genome.speed > 1.25) return "fast wetland foraging";
    if (genome.fertility > 1.3) return "boom-bust seeding";
    return "balanced grazing";
  }
  if (faction === "predator") {
    if (genome.social > 0.78) return "pack pressure";
    if (genome.risk > 0.9) return "high-risk ambush";
    if (genome.sense > 12.5) return "long-range tracking";
    return "patient stalking";
  }
  if (genome.build > 1.4) return "infrastructure rush";
  if (genome.social > 0.85) return "repair clusters";
  if (genome.risk < 0.32) return "defensive zoning";
  return "adaptive construction";
}

class SpatialHash {
  constructor(cellSize = 7) {
    this.cellSize = cellSize;
    this.buckets = new Map();
  }

  clear() {
    this.buckets.clear();
  }

  key(cx, cy) {
    return `${cx}:${cy}`;
  }

  insert(agent) {
    const cx = Math.floor(agent.x / this.cellSize);
    const cy = Math.floor(agent.y / this.cellSize);
    const key = this.key(cx, cy);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = [];
      this.buckets.set(key, bucket);
    }
    bucket.push(agent);
  }

  query(x, y, radius) {
    const found = [];
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);
    const radiusSq = radius * radius;
    for (let cy = minY; cy <= maxY; cy += 1) {
      for (let cx = minX; cx <= maxX; cx += 1) {
        const bucket = this.buckets.get(this.key(cx, cy));
        if (!bucket) continue;
        for (const agent of bucket) {
          const dx = agent.x - x;
          const dy = agent.y - y;
          if (dx * dx + dy * dy <= radiusSq) found.push(agent);
        }
      }
    }
    return found;
  }
}

class ShadowLeague {
  constructor(seed = 9919) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.auto = true;
    this.generation = 0;
    this.rollouts = 0;
    this.virtualWorlds = SHADOW_WORLDS;
    this.rolloutSteps = SHADOW_STEPS;
    this.candidates = SHADOW_CANDIDATES;
    this.pool = { forager: [], predator: [], builder: [] };
    this.champions = {};
    this.history = [];
    this.lastRewards = {
      survival: 0,
      trophic: 0,
      construction: 0,
      resilience: 0,
      foundation: 0,
      novelty: 0
    };
    this.lastSummary = "league seeded";
    this.seedPool();
  }

  seedPool() {
    for (const faction of Object.keys(FACTIONS)) {
      for (let i = 0; i < 6; i += 1) {
        const genome = mutateGenome(FACTIONS[faction].baseGenome, this.rng, 0.7 + i * 0.12);
        genome.lineage = `${faction.slice(0, 1).toUpperCase()}-league-${i}`;
        this.pool[faction].push({
          genome,
          fitness: 0.45 + this.rng() * 0.1,
          rating: 1000,
          label: describeGenome(faction, genome),
          generation: 0
        });
      }
      this.pool[faction].sort((a, b) => b.fitness - a.fitness);
      this.champions[faction] = this.pool[faction][0];
    }
  }

  trainGeneration(liveMetrics) {
    const promoted = [];
    const rewardMean = {
      survival: 0,
      trophic: 0,
      construction: 0,
      resilience: 0,
      foundation: 0,
      novelty: 0
    };

    for (const faction of Object.keys(FACTIONS)) {
      const ranked = [];
      for (let i = 0; i < this.candidates; i += 1) {
        const candidate = this.makeCandidate(faction, i);
        const result = this.evaluateCandidate(faction, candidate, liveMetrics);
        ranked.push({
          genome: candidate,
          fitness: result.fitness,
          rating: this.projectRating(faction, result.fitness),
          label: describeGenome(faction, candidate),
          generation: this.generation + 1,
          components: result.components
        });
      }

      ranked.sort((a, b) => b.fitness - a.fitness);
      const best = ranked[0];
      const previous = this.champions[faction];
      this.pool[faction].push(...ranked.slice(0, 3));
      this.pool[faction].sort((a, b) => b.fitness - a.fitness);
      this.pool[faction] = this.pool[faction].slice(0, 18);
      this.champions[faction] = this.pool[faction][0];

      for (const key of Object.keys(rewardMean)) rewardMean[key] += best.components[key] ?? 0;
      if (!previous || best.fitness > previous.fitness * 1.025 + 0.015) {
        promoted.push(`${FACTIONS[faction].name} ${best.label}`);
      }
    }

    for (const key of Object.keys(rewardMean)) rewardMean[key] /= 3;
    this.lastRewards = rewardMean;
    this.generation += 1;
    this.rollouts += this.virtualWorlds * 3;
    const rating = this.rating();
    this.history.push({
      generation: this.generation,
      rating,
      foundation: rewardMean.foundation * 100,
      resilience: rewardMean.resilience * 100
    });
    if (this.history.length > LEAGUE_HISTORY) this.history.shift();
    this.lastSummary = promoted.length ? `promoted ${promoted.join(" / ")}` : "archive defended current champions";
    return { promoted, rating };
  }

  makeCandidate(faction, offset) {
    const source = this.pickPoolEntry(faction, 0.78);
    const pressure = 0.65 + this.rng() * 1.25 + offset * 0.035;
    const genome = mutateGenome(source.genome, this.rng, pressure);
    genome.lineage = source.genome.lineage || `${faction.slice(0, 1).toUpperCase()}-league`;
    return genome;
  }

  pickPoolEntry(faction, eliteBias = 0.65) {
    const pool = this.pool[faction];
    const curved = this.rng() ** (eliteBias ? 2.4 : 1);
    const index = Math.min(pool.length - 1, Math.floor(curved * pool.length));
    return pool[index] || { genome: FACTIONS[faction].baseGenome, fitness: 0.4, rating: 1000 };
  }

  projectRating(faction, fitness) {
    const current = this.champions[faction]?.rating ?? 1000;
    const baseline = this.champions[faction]?.fitness ?? 0.5;
    const delta = clamp((fitness - baseline) * 220, -38, 54);
    return Math.round(current + delta);
  }

  evaluateCandidate(faction, candidate, liveMetrics) {
    const worlds = Math.max(512, Math.floor(this.virtualWorlds / this.candidates));
    const batch = this.allocateBatch(worlds);
    this.seedVectorizedBatch(batch, faction, candidate, liveMetrics);
    this.runVectorizedBatch(batch);
    const components = this.scoreVectorizedBatch(batch, faction, candidate);
    const factionBuildWeight = faction === "builder" ? 0.18 : 0.08;
    const fitness =
      components.survival * 0.24 +
      components.trophic * 0.2 +
      components.construction * factionBuildWeight +
      components.resilience * 0.18 +
      components.foundation * 0.22 +
      components.novelty * 0.08;
    return { fitness, components };
  }

  allocateBatch(worlds) {
    return {
      worlds,
      forager: new Float32Array(worlds),
      predator: new Float32Array(worlds),
      builder: new Float32Array(worlds),
      startForager: new Float32Array(worlds),
      startPredator: new Float32Array(worlds),
      startBuilder: new Float32Array(worlds),
      flora: new Float32Array(worlds),
      moisture: new Float32Array(worlds),
      toxicity: new Float32Array(worlds),
      fire: new Float32Array(worlds),
      structures: new Float32Array(worlds),
      mineral: new Float32Array(worlds),
      disturbance: new Float32Array(worlds),
      grazeTrait: new Float32Array(worlds),
      evadeTrait: new Float32Array(worlds),
      huntTrait: new Float32Array(worlds),
      buildTrait: new Float32Array(worlds),
      foragerFertility: new Float32Array(worlds),
      predatorFertility: new Float32Array(worlds),
      builderFertility: new Float32Array(worlds),
      kills: new Float32Array(worlds),
      births: new Float32Array(worlds),
      built: new Float32Array(worlds),
      detoxed: new Float32Array(worlds)
    };
  }

  seedVectorizedBatch(batch, faction, candidate, liveMetrics) {
    for (let w = 0; w < batch.worlds; w += 1) {
      const genomes = {
        forager: this.pickPoolEntry("forager").genome,
        predator: this.pickPoolEntry("predator").genome,
        builder: this.pickPoolEntry("builder").genome
      };
      genomes[faction] = candidate;
      const scenario = this.sampleScenario(liveMetrics, w);
      batch.forager[w] = scenario.forager;
      batch.predator[w] = scenario.predator;
      batch.builder[w] = scenario.builder;
      batch.startForager[w] = scenario.forager;
      batch.startPredator[w] = scenario.predator;
      batch.startBuilder[w] = scenario.builder;
      batch.flora[w] = scenario.flora;
      batch.moisture[w] = scenario.moisture;
      batch.toxicity[w] = scenario.toxicity;
      batch.fire[w] = scenario.fire;
      batch.structures[w] = scenario.structures;
      batch.mineral[w] = scenario.mineral;
      batch.disturbance[w] = scenario.disturbance;
      batch.grazeTrait[w] =
        genomes.forager.appetite * 0.012 + genomes.forager.speed * 0.004 + genomes.forager.sense * 0.0007 + genomes.forager.social * 0.004;
      batch.evadeTrait[w] =
        genomes.forager.speed * 0.22 + (1.05 - genomes.forager.risk) * 0.2 + genomes.forager.social * 0.12 + genomes.forager.sense * 0.012;
      batch.huntTrait[w] =
        genomes.predator.speed * 0.18 + genomes.predator.aggression * 0.27 + genomes.predator.social * 0.12 + genomes.predator.sense * 0.013;
      batch.buildTrait[w] =
        genomes.builder.build * 0.23 + genomes.builder.social * 0.08 + genomes.builder.sense * 0.008 + (1 - genomes.builder.risk) * 0.04;
      batch.foragerFertility[w] = genomes.forager.fertility;
      batch.predatorFertility[w] = genomes.predator.fertility;
      batch.builderFertility[w] = genomes.builder.fertility;
    }
  }

  runVectorizedBatch(batch) {
    for (let step = 0; step < this.rolloutSteps; step += 1) {
      for (let w = 0; w < batch.worlds; w += 1) {
        const forager = batch.forager[w];
        const predator = batch.predator[w];
        const builder = batch.builder[w];
        const flora = batch.flora[w];
        const moisture = batch.moisture[w];
        const toxicity = batch.toxicity[w];
        const fire = batch.fire[w];
        const structures = batch.structures[w];
        const mineral = batch.mineral[w];
        const heatStress = clamp(0.18 + fire * 0.5 + toxicity * 0.26 - moisture * 0.1, 0, 1);
        const growth = flora * (1 - flora) * (0.08 + moisture * 0.12 + mineral * 0.04);
        const grazing = clamp(forager * batch.grazeTrait[w] * flora, 0, flora * 12);
        const predationPressure = Math.max(0, batch.huntTrait[w] - batch.evadeTrait[w] * 0.58);
        const predation = clamp((predator * forager * predationPressure) / 5200, 0, forager * 0.13);
        const starvation = clamp((0.18 - forager / 700) * predator, 0, predator * 0.08);
        const construction = clamp(builder * batch.buildTrait[w] * mineral * 0.04, 0, 3.6);
        const detox = clamp((structures * 0.004 + builder * batch.buildTrait[w] * 0.0018) * (1 - fire), 0, toxicity * 0.18 + 0.02);
        const fireSpread = clamp((flora * (1 - moisture) * batch.disturbance[w] - structures * 0.0015) * 0.045, -0.03, 0.055);

        batch.flora[w] = clamp(flora + growth - grazing * 0.018 - fire * 0.04 + batch.evadeTrait[w] * grazing * 0.001, 0, 1);
        batch.moisture[w] = clamp(moisture + (this.rng() - 0.48) * 0.018 - fire * 0.016 + structures * 0.00008, 0, 1);
        batch.toxicity[w] = clamp(toxicity + batch.disturbance[w] * 0.004 + fire * 0.008 - detox, 0, 1);
        batch.fire[w] = clamp(fire + fireSpread - moisture * 0.028 - structures * 0.0005, 0, 1);
        batch.mineral[w] = clamp(mineral - construction * 0.006 + fire * 0.004, 0, 1);
        batch.structures[w] = clamp(structures + construction - fire * 1.4 - toxicity * 0.12, 0, 180);
        batch.forager[w] = clamp(
          forager + grazing * batch.foragerFertility[w] * 0.12 - predation - heatStress * forager * 0.015 - toxicity * forager * 0.012,
          0,
          260
        );
        batch.predator[w] = clamp(
          predator + predation * batch.predatorFertility[w] * 0.28 - starvation - (fire + toxicity) * predator * 0.011,
          0,
          120
        );
        batch.builder[w] = clamp(
          builder + construction * batch.builderFertility[w] * 0.08 - (toxicity * 0.02 + fire * 0.014) * builder,
          0,
          150
        );
        batch.kills[w] += predation;
        batch.births[w] +=
          grazing * batch.foragerFertility[w] * 0.12 + predation * batch.predatorFertility[w] * 0.28 + construction * batch.builderFertility[w] * 0.08;
        batch.built[w] += construction;
        batch.detoxed[w] += detox;
      }
    }
  }

  scoreVectorizedBatch(batch, faction, candidate) {
    const totals = {
      survival: 0,
      trophic: 0,
      construction: 0,
      resilience: 0,
      foundation: 0,
      novelty: this.novelty(faction, candidate) * batch.worlds
    };

    for (let w = 0; w < batch.worlds; w += 1) {
      const total = Math.max(1, batch.forager[w] + batch.predator[w] + batch.builder[w]);
      const ratios = [batch.forager[w] / total, batch.predator[w] / total, batch.builder[w] / total];
      const entropy = ratios.reduce((sum, p) => (p > 0 ? sum - p * Math.log(p) : sum), 0) / Math.log(3);
      const predRatio = batch.predator[w] / Math.max(1, batch.forager[w]);
      const buildRatio = batch.builder[w] / Math.max(1, batch.forager[w]);
      const balance = clamp(1 - Math.abs(predRatio - 0.24) * 2.5 - Math.abs(buildRatio - 0.35) * 0.8, 0, 1);
      const resilience = clamp(1 - batch.toxicity[w] * 0.75 - batch.fire[w] * 0.65 + batch.structures[w] / 220 + batch.moisture[w] * 0.08, 0, 1);
      const foundation = clamp(
        entropy * 0.32 + balance * 0.26 + batch.flora[w] * 0.18 + resilience * 0.18 + clamp(batch.structures[w] / 120, 0, 1) * 0.06,
        0,
        1
      );
      const startPop =
        faction === "forager" ? batch.startForager[w] : faction === "predator" ? batch.startPredator[w] : batch.startBuilder[w];
      const endPop = faction === "forager" ? batch.forager[w] : faction === "predator" ? batch.predator[w] : batch.builder[w];
      const survival = clamp(endPop / Math.max(1, startPop), 0, 1.35) / 1.35;
      let construction = clamp(batch.built[w] / 80 + batch.structures[w] / 180, 0, 1);
      let trophic;

      if (faction === "forager") {
        trophic = clamp(batch.forager[w] / Math.max(35, batch.predator[w] * 3.9) + batch.flora[w] * 0.2, 0, 1);
        construction *= 0.55;
      } else if (faction === "predator") {
        const sustainableKills = clamp(batch.kills[w] / Math.max(1, batch.startForager[w] * 0.65), 0, 1);
        trophic = clamp(sustainableKills * 0.7 + balance * 0.3, 0, 1);
        construction *= 0.35;
      } else {
        trophic = clamp(balance * 0.45 + batch.forager[w] / Math.max(70, batch.startForager[w]) * 0.25 + resilience * 0.3, 0, 1);
        construction = clamp(construction * 1.15 + batch.detoxed[w] * 0.45, 0, 1);
      }

      totals.survival += survival;
      totals.trophic += trophic;
      totals.construction += construction;
      totals.resilience += resilience;
      totals.foundation += foundation;
    }

    const components = {};
    for (const key of Object.keys(totals)) components[key] = totals[key] / batch.worlds;
    return components;
  }

  sampleScenario(liveMetrics, worldIndex) {
    const curriculum = clamp(this.generation / 90, 0, 1);
    const seasonalShock = Math.sin((worldIndex + this.generation) * 0.37) * 0.5 + 0.5;
    const liveCounts = liveMetrics?.counts || { forager: 92, predator: 24, builder: 38 };
    return {
      forager: clamp(48 + liveCounts.forager * 0.38 + this.rng() * 82, 20, 210),
      predator: clamp(8 + liveCounts.predator * 0.45 + this.rng() * 34, 4, 88),
      builder: clamp(10 + liveCounts.builder * 0.45 + this.rng() * 42, 5, 112),
      flora: clamp((liveMetrics?.biomass ?? 0.46) + (this.rng() - 0.5) * 0.45, 0.08, 0.94),
      moisture: clamp(0.28 + this.rng() * 0.62 - curriculum * 0.08 + seasonalShock * 0.06, 0.05, 0.98),
      toxicity: clamp((liveMetrics?.toxicity ?? 0.05) + this.rng() * (0.18 + curriculum * 0.2), 0, 0.72),
      fire: clamp((this.rng() ** 3) * (0.26 + curriculum * 0.28), 0, 0.86),
      structures: clamp((liveMetrics?.structures ?? 30) * 0.42 + this.rng() * 34, 0, 130),
      mineral: clamp(0.25 + this.rng() * 0.7, 0, 1),
      disturbance: clamp(0.14 + this.rng() * 0.46 + curriculum * 0.2, 0.05, 0.9)
    };
  }

  rollout(genomes, scenario) {
    const start = { ...scenario };
    const state = { ...scenario };
    let kills = 0;
    let births = 0;
    let built = 0;
    let detoxed = 0;
    const fg = genomes.forager;
    const pg = genomes.predator;
    const bg = genomes.builder;

    for (let step = 0; step < this.rolloutSteps; step += 1) {
      const grazeTrait = fg.appetite * 0.012 + fg.speed * 0.004 + fg.sense * 0.0007 + fg.social * 0.004;
      const evadeTrait = fg.speed * 0.22 + (1.05 - fg.risk) * 0.2 + fg.social * 0.12 + fg.sense * 0.012;
      const huntTrait = pg.speed * 0.18 + pg.aggression * 0.27 + pg.social * 0.12 + pg.sense * 0.013;
      const buildTrait = bg.build * 0.23 + bg.social * 0.08 + bg.sense * 0.008 + (1 - bg.risk) * 0.04;
      const heatStress = clamp(0.18 + state.fire * 0.5 + state.toxicity * 0.26 - state.moisture * 0.1, 0, 1);
      const growth = state.flora * (1 - state.flora) * (0.08 + state.moisture * 0.12 + state.mineral * 0.04);
      const grazing = clamp(state.forager * grazeTrait * state.flora, 0, state.flora * 12);
      const predationPressure = Math.max(0, huntTrait - evadeTrait * 0.58);
      const predation = clamp((state.predator * state.forager * predationPressure) / 5200, 0, state.forager * 0.13);
      const starvation = clamp((0.18 - state.forager / 700) * state.predator, 0, state.predator * 0.08);
      const construction = clamp(state.builder * buildTrait * state.mineral * 0.04, 0, 3.6);
      const detox = clamp((state.structures * 0.004 + state.builder * bg.build * 0.0018) * (1 - state.fire), 0, state.toxicity * 0.18 + 0.02);
      const fireSpread = clamp((state.flora * (1 - state.moisture) * state.disturbance - state.structures * 0.0015) * 0.045, -0.03, 0.055);

      state.flora = clamp(state.flora + growth - grazing * 0.018 - state.fire * 0.04 + fg.social * grazing * 0.0012, 0, 1);
      state.moisture = clamp(state.moisture + (this.rng() - 0.48) * 0.018 - state.fire * 0.016 + state.structures * 0.00008, 0, 1);
      state.toxicity = clamp(state.toxicity + state.disturbance * 0.004 + state.fire * 0.008 - detox, 0, 1);
      state.fire = clamp(state.fire + fireSpread - state.moisture * 0.028 - state.structures * 0.0005, 0, 1);
      state.mineral = clamp(state.mineral - construction * 0.006 + state.fire * 0.004, 0, 1);
      state.structures = clamp(state.structures + construction - state.fire * 1.4 - state.toxicity * 0.12, 0, 180);
      state.forager = clamp(
        state.forager + grazing * fg.fertility * 0.12 - predation - heatStress * state.forager * 0.015 - state.toxicity * state.forager * 0.012,
        0,
        260
      );
      state.predator = clamp(
        state.predator + predation * pg.fertility * 0.28 - starvation - (state.fire + state.toxicity) * state.predator * 0.011,
        0,
        120
      );
      state.builder = clamp(
        state.builder + construction * bg.fertility * 0.08 - (state.toxicity * 0.02 + state.fire * 0.014) * state.builder,
        0,
        150
      );

      kills += predation;
      births += grazing * fg.fertility * 0.12 + predation * pg.fertility * 0.28 + construction * bg.fertility * 0.08;
      built += construction;
      detoxed += detox;
    }

    return { start, end: state, kills, births, built, detoxed };
  }

  rewardForFaction(faction, genome, outcome) {
    const { start, end } = outcome;
    const startPop = Math.max(1, start[faction]);
    const endPop = end[faction];
    const total = Math.max(1, end.forager + end.predator + end.builder);
    const ratios = [end.forager / total, end.predator / total, end.builder / total];
    const entropy = ratios.reduce((sum, p) => (p > 0 ? sum - p * Math.log(p) : sum), 0) / Math.log(3);
    const predRatio = end.predator / Math.max(1, end.forager);
    const buildRatio = end.builder / Math.max(1, end.forager);
    const balance = clamp(1 - Math.abs(predRatio - 0.24) * 2.5 - Math.abs(buildRatio - 0.35) * 0.8, 0, 1);
    const resilience = clamp(1 - end.toxicity * 0.75 - end.fire * 0.65 + end.structures / 220 + end.moisture * 0.08, 0, 1);
    const foundation = clamp(entropy * 0.32 + balance * 0.26 + end.flora * 0.18 + resilience * 0.18 + clamp(end.structures / 120, 0, 1) * 0.06, 0, 1);
    const survival = clamp(endPop / startPop, 0, 1.35) / 1.35;
    const novelty = this.novelty(faction, genome);

    let trophic;
    let construction = clamp(outcome.built / 80 + end.structures / 180, 0, 1);
    if (faction === "forager") {
      trophic = clamp(end.forager / Math.max(35, end.predator * 3.9) + end.flora * 0.2, 0, 1);
      construction *= 0.55;
    } else if (faction === "predator") {
      const sustainableKills = clamp(outcome.kills / Math.max(1, start.forager * 0.65), 0, 1);
      trophic = clamp(sustainableKills * 0.7 + balance * 0.3, 0, 1);
      construction *= 0.35;
    } else {
      trophic = clamp(balance * 0.45 + end.forager / Math.max(70, start.forager) * 0.25 + resilience * 0.3, 0, 1);
      construction = clamp(construction * 1.15 + outcome.detoxed * 0.45, 0, 1);
    }

    return { survival, trophic, construction, resilience, foundation, novelty };
  }

  novelty(faction, genome) {
    const pool = this.pool[faction].slice(0, 8);
    if (!pool.length) return 0.5;
    let distanceSum = 0;
    for (const entry of pool) {
      let geneSum = 0;
      for (const key of GENE_KEYS) {
        const scale = key === "sense" ? 12 : key === "mutation" ? 0.3 : 2.2;
        geneSum += Math.abs((genome[key] ?? 0) - (entry.genome[key] ?? 0)) / scale;
      }
      distanceSum += geneSum / GENE_KEYS.length;
    }
    return clamp(distanceSum / pool.length * 2.4, 0, 1);
  }

  rating() {
    const values = Object.keys(FACTIONS).map((faction) => this.champions[faction]?.rating ?? 1000);
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  championGenome(faction) {
    return this.champions[faction]?.genome || FACTIONS[faction].baseGenome;
  }
}

class BiomeSim {
  constructor(seed = Math.floor(Math.random() * 900000) + 1000) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.time = 0;
    this.epoch = 0;
    this.nextEpoch = 28;
    this.directorEnergy = 86;
    this.paused = false;
    this.singleEpochTarget = null;
    this.activeTool = "observe";
    this.hover = null;
    this.selected = null;
    this.idCounter = 1;
    this.spatial = new SpatialHash();
    this.agents = [];
    this.history = [];
    this.events = [];
    this.archive = {
      forager: [],
      predator: [],
      builder: []
    };
    this.league = new ShadowLeague(seed + 9001);
    this.leagueTimer = 0;
    this.settings = {
      speed: 1,
      rainfallBias: 0,
      mutationPressure: 1,
      disturbance: 0.35
    };
    this.metrics = this.emptyMetrics();
    this.height = new Float32Array(WORLD_SIZE);
    this.moisture = new Float32Array(WORLD_SIZE);
    this.temperature = new Float32Array(WORLD_SIZE);
    this.nutrient = new Float32Array(WORLD_SIZE);
    this.flora = new Float32Array(WORLD_SIZE);
    this.toxicity = new Float32Array(WORLD_SIZE);
    this.mineral = new Float32Array(WORLD_SIZE);
    this.fire = new Float32Array(WORLD_SIZE);
    this.spores = new Float32Array(WORLD_SIZE);
    this.structure = new Uint8Array(WORLD_SIZE);
    this.structureHp = new Float32Array(WORLD_SIZE);
    this.generateWorld();
    this.seedAgents();
    this.log("Biome initialized with evolving prey, predator, and builder factions.");
  }

  emptyMetrics() {
    return {
      counts: { forager: 0, predator: 0, builder: 0 },
      biomass: 0,
      toxicity: 0,
      structures: 0,
      diversity: 0,
      stability: 0,
      foundation: 0,
      regime: "Booting ecosystem",
      trend: "collecting signal"
    };
  }

  generateWorld() {
    for (let y = 0; y < WORLD_H; y += 1) {
      for (let x = 0; x < WORLD_W; x += 1) {
        const i = y * WORLD_W + x;
        const riverCenter =
          WORLD_H * 0.5 + Math.sin(x * 0.105 + this.seed) * 8 + Math.sin(x * 0.037) * 11;
        const river = Math.exp(-((y - riverCenter) ** 2) / 34);
        const ridge = fbm(x * 0.035, y * 0.04, this.seed + 4);
        const detail = fbm(x * 0.12, y * 0.12, this.seed + 33);
        const elevation = clamp(ridge * 0.82 + detail * 0.22 - river * 0.48, 0, 1);
        const moisture = clamp(0.34 + river * 0.55 + fbm(x * 0.075, y * 0.07, this.seed + 88) * 0.32 - elevation * 0.2, 0, 1);
        const temp = clamp(0.42 + (y / WORLD_H) * 0.32 - elevation * 0.2 + fbm(x * 0.06, y * 0.06, this.seed + 7) * 0.12, 0, 1);
        const nutrient = clamp(0.2 + fbm(x * 0.09, y * 0.09, this.seed + 51) * 0.64 + river * 0.16 - elevation * 0.08, 0, 1);
        const floraSuit = Math.sqrt(moisture * nutrient) * (1 - Math.abs(temp - 0.58));
        this.height[i] = elevation;
        this.moisture[i] = moisture;
        this.temperature[i] = temp;
        this.nutrient[i] = nutrient;
        this.flora[i] = clamp(floraSuit * 0.72 + (this.rng() - 0.5) * 0.16, 0, 1);
        this.toxicity[i] = Math.max(0, fbm(x * 0.05, y * 0.05, this.seed + 500) - 0.72) * 0.45;
        this.mineral[i] = clamp(elevation * 0.55 + fbm(x * 0.13, y * 0.11, this.seed + 102) * 0.35 - river * 0.2, 0, 1);
        this.fire[i] = 0;
        this.spores[i] = this.flora[i] * 0.16;
        this.structure[i] = STRUCTURES.none;
        this.structureHp[i] = 0;
      }
    }

    for (let n = 0; n < 14; n += 1) {
      const x = Math.floor(this.rng() * WORLD_W);
      const y = Math.floor(this.rng() * WORLD_H);
      this.placeStructure(x, y, STRUCTURES.nursery, 0.55);
    }
  }

  seedAgents() {
    this.agents.length = 0;
    this.spawnBatch("forager", 92);
    this.spawnBatch("predator", 24);
    this.spawnBatch("builder", 38);
  }

  spawnBatch(faction, count) {
    for (let i = 0; i < count; i += 1) {
      const cell = this.findSpawnCell(faction);
      this.spawnAgent(faction, cell.x + this.rng(), cell.y + this.rng(), mutateGenome(FACTIONS[faction].baseGenome, this.rng, 0.65));
    }
  }

  findSpawnCell(faction) {
    let best = { x: Math.floor(this.rng() * WORLD_W), y: Math.floor(this.rng() * WORLD_H), score: -Infinity };
    for (let k = 0; k < 36; k += 1) {
      const x = Math.floor(this.rng() * WORLD_W);
      const y = Math.floor(this.rng() * WORLD_H);
      const i = y * WORLD_W + x;
      let score = this.moisture[i] + this.flora[i] + this.nutrient[i] - this.toxicity[i] * 2 - this.fire[i] * 3;
      if (faction === "predator") score += this.localFieldAverage(this.flora, x, y, 5) * 0.5;
      if (faction === "builder") score += this.mineral[i] * 1.3 + this.height[i] * 0.3;
      if (score > best.score) best = { x, y, score };
    }
    return best;
  }

  spawnAgent(faction, x, y, genome, parent = null) {
    if (this.agents.length >= MAX_AGENTS) return null;
    const meta = FACTIONS[faction];
    const agent = {
      id: this.idCounter,
      faction,
      x: clamp(x, 0.5, WORLD_W - 1.5),
      y: clamp(y, 0.5, WORLD_H - 1.5),
      vx: (this.rng() - 0.5) * 0.25,
      vy: (this.rng() - 0.5) * 0.25,
      energy: faction === "predator" ? 1.65 : 1.15,
      health: 1,
      age: 0,
      cooldown: 5 + this.rng() * 8,
      carrying: 0,
      genome: { ...genome, lineage: genome.lineage || `${faction.slice(0, 1).toUpperCase()}-${this.idCounter}` },
      stats: {
        food: 0,
        kills: 0,
        births: 0,
        built: 0,
        repaired: 0,
        detox: 0,
        survivedEpochs: 0,
        parent
      },
      color: meta.color,
      flash: 0
    };
    this.idCounter += 1;
    this.agents.push(agent);
    return agent;
  }

  placeStructure(x, y, type, hp = 1) {
    const i = indexOf(x, y);
    if (this.structure[i] !== STRUCTURES.none && this.structureHp[i] > 0.15) return false;
    this.structure[i] = type;
    this.structureHp[i] = clamp(hp, 0, 1);
    return true;
  }

  step(dt) {
    if (this.paused && this.singleEpochTarget === null) return;
    const scaled = Math.min(0.25, dt * this.settings.speed);
    this.time += scaled;
    this.directorEnergy = clamp(this.directorEnergy + scaled * (0.9 + this.metrics.diversity * 0.8), 0, 100);
    this.leagueTimer += scaled;
    this.updateClimate(scaled);
    this.updateEnvironment(scaled);
    this.spatial.clear();
    for (const agent of this.agents) this.spatial.insert(agent);
    for (const agent of this.agents) this.updateAgent(agent, scaled);
    this.resolveDeaths();
    this.rebalanceExtinctions();

    if (this.time >= this.nextEpoch || (this.singleEpochTarget !== null && this.epoch < this.singleEpochTarget)) {
      this.runEpochSelection();
      this.nextEpoch = this.time + 28;
      if (this.singleEpochTarget !== null && this.epoch >= this.singleEpochTarget) {
        this.singleEpochTarget = null;
        this.paused = true;
      }
    }

    if (this.history.length === 0 || this.time - this.history[this.history.length - 1].time > 0.8) {
      this.collectMetrics();
    }

    if (this.league.auto && this.leagueTimer > 1.4) {
      const result = this.league.trainGeneration(this.metrics);
      this.leagueTimer = 0;
      if (result.promoted.length) this.log(`Shadow league ${this.league.lastSummary}.`);
    }
  }

  updateClimate(dt) {
    const seasonWave = Math.sin(this.time / 42);
    const stormWave = Math.sin(this.time / 11 + this.seed);
    this.rain = clamp(0.48 + seasonWave * 0.2 + stormWave * 0.06 + this.settings.rainfallBias, 0.04, 0.96);
    this.heat = clamp(0.48 - seasonWave * 0.18 + Math.sin(this.time / 67) * 0.08, 0.06, 0.96);

    const chance = dt * 0.018 * this.settings.disturbance;
    if (this.rng() < chance) {
      const x = Math.floor(this.rng() * WORLD_W);
      const y = Math.floor(this.rng() * WORLD_H);
      const i = indexOf(x, y);
      if (this.heat > 0.55 && this.moisture[i] < 0.38) {
        this.fire[i] = Math.max(this.fire[i], 0.8);
        this.log("Lightning ignited a dry biomass pocket.");
      } else {
        this.toxicity[i] = clamp(this.toxicity[i] + 0.45, 0, 1);
        this.log("A mineral seep shifted local toxicity gradients.");
      }
    }
  }

  seasonName() {
    if (this.rain > 0.67 && this.heat < 0.55) return "Wet rise";
    if (this.rain > 0.57 && this.heat >= 0.55) return "Warm bloom";
    if (this.rain < 0.35 && this.heat > 0.52) return "Dry pressure";
    if (this.heat < 0.36) return "Cold drift";
    return "Mixed season";
  }

  updateEnvironment(dt) {
    const windX = Math.sin(this.time / 12) * 0.18;
    const windY = Math.cos(this.time / 17) * 0.12;
    for (let y = 0; y < WORLD_H; y += 1) {
      for (let x = 0; x < WORLD_W; x += 1) {
        const i = y * WORLD_W + x;
        const elevation = this.height[i];
        const rainGain = this.rain * (1 - elevation * 0.45) * 0.038;
        const evaporation = this.heat * (0.018 + elevation * 0.01);
        this.moisture[i] = clamp(this.moisture[i] + (rainGain - evaporation) * dt, 0, 1);
        this.temperature[i] = clamp(this.temperature[i] + (this.heat - this.temperature[i]) * 0.025 * dt, 0, 1);

        const moistureSuit = 1 - Math.abs(this.moisture[i] - 0.62) * 1.55;
        const tempSuit = 1 - Math.abs(this.temperature[i] - 0.52) * 1.4;
        const structureBoost = this.structure[i] === STRUCTURES.nursery ? 0.2 : 0;
        const growth =
          Math.max(0, moistureSuit) *
          Math.max(0, tempSuit) *
          (0.12 + this.nutrient[i] * 0.42 + structureBoost) *
          this.flora[i] *
          (1.05 - this.flora[i]);
        const sporeGermination = this.spores[i] * (0.018 + this.moisture[i] * 0.05);
        const stress = this.toxicity[i] * 0.1 + this.fire[i] * 0.7 + Math.max(0, this.flora[i] - 0.93) * 0.02;
        this.flora[i] = clamp(this.flora[i] + (growth + sporeGermination - stress) * dt, 0, 1);
        this.nutrient[i] = clamp(this.nutrient[i] + (0.014 + this.fire[i] * 0.08 - this.flora[i] * 0.025) * dt, 0, 1);
        this.spores[i] = clamp(this.spores[i] * (1 - 0.11 * dt) + this.flora[i] * 0.008 * dt, 0, 1);

        if (this.structure[i] === STRUCTURES.detox) {
          this.toxicity[i] = Math.max(0, this.toxicity[i] - 0.18 * dt);
          this.structureHp[i] = Math.max(0, this.structureHp[i] - 0.006 * dt);
        } else {
          const neighborToxic = this.neighborAverage(this.toxicity, x, y);
          this.toxicity[i] = clamp(lerp(this.toxicity[i], neighborToxic, 0.006 * dt) - this.moisture[i] * 0.008 * dt, 0, 1);
        }

        if (this.fire[i] > 0.01) {
          this.flora[i] = Math.max(0, this.flora[i] - this.fire[i] * 0.65 * dt);
          this.moisture[i] = Math.max(0, this.moisture[i] - this.fire[i] * 0.12 * dt);
          this.toxicity[i] = clamp(this.toxicity[i] + this.fire[i] * 0.015 * dt, 0, 1);
          const spreadChance = (this.fire[i] * this.flora[i] * (1 - this.moisture[i]) * this.settings.disturbance) * dt * 0.34;
          if (this.rng() < spreadChance) {
            const nx = clamp(x + Math.round((this.rng() - 0.5) * 2 + windX), 0, WORLD_W - 1);
            const ny = clamp(y + Math.round((this.rng() - 0.5) * 2 + windY), 0, WORLD_H - 1);
            const ni = ny * WORLD_W + nx;
            if (this.structure[ni] !== STRUCTURES.barrier) this.fire[ni] = Math.max(this.fire[ni], this.fire[i] * 0.84);
          }
          this.fire[i] = Math.max(0, this.fire[i] - (this.rain * 0.22 + this.moisture[i] * 0.08) * dt);
        }

        if (this.structure[i] !== STRUCTURES.none) {
          this.structureHp[i] = Math.max(0, this.structureHp[i] - 0.0015 * dt);
          if (this.structureHp[i] <= 0) this.structure[i] = STRUCTURES.none;
        }
      }
    }
  }

  updateAgent(agent, dt) {
    agent.age += dt;
    agent.cooldown = Math.max(0, agent.cooldown - dt);
    agent.flash = Math.max(0, agent.flash - dt);
    const i = indexOf(agent.x, agent.y);
    const genome = agent.genome;
    const localToxic = this.toxicity[i];
    const localFire = this.fire[i];
    const tempStress = Math.abs(this.temperature[i] - genome.thermal);
    const metabolism = genome.metabolism * (1 + tempStress * 0.8 + localToxic * 0.5);
    agent.energy -= metabolism * dt;
    agent.health = clamp(agent.health - localToxic * 0.025 * dt - localFire * 0.18 * dt + (agent.energy > 0.65 ? 0.012 * dt : -0.02 * dt), 0, 1);

    const neighbors = this.spatial.query(agent.x, agent.y, genome.sense);
    let desire;
    if (agent.faction === "forager") {
      desire = this.foragerPolicy(agent, neighbors, dt);
    } else if (agent.faction === "predator") {
      desire = this.predatorPolicy(agent, neighbors, dt);
    } else {
      desire = this.builderPolicy(agent, neighbors, dt);
    }

    const hazard = this.fieldGradient(this.toxicity, agent.x, agent.y, 2.8);
    const fire = this.fieldGradient(this.fire, agent.x, agent.y, 3.2);
    desire.x -= hazard.x * 1.3 + fire.x * 1.8;
    desire.y -= hazard.y * 1.3 + fire.y * 1.8;

    const wander = Math.sin(this.time * 0.7 + agent.id * 12.9898);
    desire.x += Math.cos(wander * TAU) * 0.05;
    desire.y += Math.sin(wander * TAU) * 0.05;

    const length = Math.hypot(desire.x, desire.y) || 1;
    const terrainDrag = 1 - this.moisture[i] * 0.18 + this.height[i] * 0.12 + (this.structure[i] === STRUCTURES.barrier ? 0.75 : 0);
    const speed = genome.speed * clamp(agent.health * 0.7 + 0.35, 0.25, 1.1) / terrainDrag;
    agent.vx = lerp(agent.vx, (desire.x / length) * speed, clamp(dt * 3.2, 0, 1));
    agent.vy = lerp(agent.vy, (desire.y / length) * speed, clamp(dt * 3.2, 0, 1));

    const nx = agent.x + agent.vx * dt * 3.7;
    const ny = agent.y + agent.vy * dt * 3.7;
    this.moveAgent(agent, nx, ny);
    this.tryReproduce(agent, dt);
  }

  moveAgent(agent, nx, ny) {
    const ni = indexOf(nx, ny);
    if (this.structure[ni] === STRUCTURES.barrier && agent.faction !== "builder") {
      agent.vx *= -0.25;
      agent.vy *= -0.25;
      this.structureHp[ni] = Math.max(0, this.structureHp[ni] - 0.003);
      return;
    }
    agent.x = clamp(nx, 0.4, WORLD_W - 0.4);
    agent.y = clamp(ny, 0.4, WORLD_H - 0.4);
  }

  foragerPolicy(agent, neighbors, dt) {
    const genome = agent.genome;
    const i = indexOf(agent.x, agent.y);
    const desire = this.fieldGradient(this.flora, agent.x, agent.y, genome.sense * 0.42);
    desire.x *= 1.25 * genome.appetite;
    desire.y *= 1.25 * genome.appetite;

    let preyCount = 0;
    let centerX = 0;
    let centerY = 0;
    let alignX = 0;
    let alignY = 0;
    for (const other of neighbors) {
      if (other === agent) continue;
      const dx = other.x - agent.x;
      const dy = other.y - agent.y;
      const distSq = dx * dx + dy * dy + 0.001;
      if (other.faction === "predator") {
        const force = (1.35 + genome.risk * -0.8) * (genome.sense / distSq);
        desire.x -= dx * force;
        desire.y -= dy * force;
      } else if (other.faction === "forager") {
        preyCount += 1;
        centerX += other.x;
        centerY += other.y;
        alignX += other.vx;
        alignY += other.vy;
        if (distSq < 1.8) {
          desire.x -= dx * 0.65;
          desire.y -= dy * 0.65;
        }
      } else if (other.faction === "builder") {
        desire.x += dx * 0.004 * genome.social;
        desire.y += dy * 0.004 * genome.social;
      }
    }

    if (preyCount > 0) {
      centerX /= preyCount;
      centerY /= preyCount;
      desire.x += (centerX - agent.x) * 0.024 * genome.social + alignX * 0.018 * genome.social;
      desire.y += (centerY - agent.y) * 0.024 * genome.social + alignY * 0.018 * genome.social;
    }

    const eatRate = Math.min(this.flora[i], dt * 0.2 * genome.appetite * (1 - this.toxicity[i] * 0.45));
    if (eatRate > 0) {
      this.flora[i] -= eatRate;
      this.spores[i] = clamp(this.spores[i] + eatRate * 0.18, 0, 1);
      this.nutrient[i] = clamp(this.nutrient[i] + eatRate * 0.035, 0, 1);
      agent.energy = clamp(agent.energy + eatRate * 1.42, 0, 2.4);
      agent.stats.food += eatRate;
    }

    if (this.structure[i] === STRUCTURES.nursery) {
      agent.energy = clamp(agent.energy + 0.008 * dt, 0, 2.4);
    }

    return desire;
  }

  predatorPolicy(agent, neighbors, dt) {
    const genome = agent.genome;
    const desire = { x: 0, y: 0 };
    let closestPrey = null;
    let closestDist = Infinity;
    let packX = 0;
    let packY = 0;
    let packCount = 0;
    for (const other of neighbors) {
      if (other === agent) continue;
      const dx = other.x - agent.x;
      const dy = other.y - agent.y;
      const dist = Math.hypot(dx, dy);
      if (other.faction === "forager" && dist < closestDist) {
        closestDist = dist;
        closestPrey = other;
      } else if (other.faction === "predator") {
        packX += other.x;
        packY += other.y;
        packCount += 1;
        if (dist < 1.5) {
          desire.x -= dx * 0.4;
          desire.y -= dy * 0.4;
        }
      } else if (other.faction === "builder" && genome.risk > 0.85) {
        desire.x += dx * 0.012;
        desire.y += dy * 0.012;
      }
    }

    if (closestPrey) {
      const dx = closestPrey.x - agent.x;
      const dy = closestPrey.y - agent.y;
      const hunger = invLerp(1.5, 0.2, agent.energy);
      const attack = 1.25 + genome.aggression * 0.8 + hunger * 0.7;
      desire.x += dx * attack;
      desire.y += dy * attack;
      if (closestDist < 0.85) {
        const damage = dt * (0.34 + genome.aggression * 0.22) * (1 + packCount * 0.08);
        closestPrey.health -= damage;
        agent.energy = clamp(agent.energy + damage * 0.32, 0, 2.8);
        agent.flash = 0.1;
        if (closestPrey.health <= 0) {
          agent.stats.kills += 1;
          agent.energy = clamp(agent.energy + 0.82, 0, 2.8);
        }
      }
    } else {
      const flora = this.fieldGradient(this.flora, agent.x, agent.y, genome.sense * 0.5);
      desire.x += flora.x * 0.25;
      desire.y += flora.y * 0.25;
      const den = this.structureGradient(STRUCTURES.den, agent.x, agent.y, genome.sense);
      desire.x += den.x * 0.5;
      desire.y += den.y * 0.5;
    }

    if (packCount > 0) {
      desire.x += (packX / packCount - agent.x) * 0.018 * genome.social;
      desire.y += (packY / packCount - agent.y) * 0.018 * genome.social;
    }

    const i = indexOf(agent.x, agent.y);
    if (this.structure[i] === STRUCTURES.den) {
      agent.energy = clamp(agent.energy + 0.014 * dt, 0, 2.8);
      agent.health = clamp(agent.health + 0.02 * dt, 0, 1);
    }

    return desire;
  }

  builderPolicy(agent, neighbors, dt) {
    const genome = agent.genome;
    const i = indexOf(agent.x, agent.y);
    const mineralGradient = this.fieldGradient(this.mineral, agent.x, agent.y, genome.sense * 0.42);
    const toxicGradient = this.fieldGradient(this.toxicity, agent.x, agent.y, genome.sense * 0.55);
    const sparseFlora = this.fieldGradient(this.inverseFloraProxy, agent.x, agent.y, genome.sense * 0.45);
    const desire = {
      x: mineralGradient.x * (0.6 + (1 - agent.carrying) * 0.7) + toxicGradient.x * genome.build * 0.35 + sparseFlora.x * 0.2,
      y: mineralGradient.y * (0.6 + (1 - agent.carrying) * 0.7) + toxicGradient.y * genome.build * 0.35 + sparseFlora.y * 0.2
    };

    let predatorPressure = 0;
    let allyX = 0;
    let allyY = 0;
    let allies = 0;
    for (const other of neighbors) {
      if (other === agent) continue;
      const dx = other.x - agent.x;
      const dy = other.y - agent.y;
      const d2 = dx * dx + dy * dy + 0.1;
      if (other.faction === "predator") {
        predatorPressure += 1 / d2;
        desire.x -= dx * (0.5 - genome.risk * 0.2) / d2;
        desire.y -= dy * (0.5 - genome.risk * 0.2) / d2;
      } else if (other.faction === "builder") {
        allies += 1;
        allyX += other.x;
        allyY += other.y;
      } else if (other.faction === "forager") {
        desire.x += dx * 0.006 * genome.build;
        desire.y += dy * 0.006 * genome.build;
      }
    }

    if (allies > 0) {
      desire.x += (allyX / allies - agent.x) * 0.012 * genome.social;
      desire.y += (allyY / allies - agent.y) * 0.012 * genome.social;
    }

    const mined = Math.min(this.mineral[i], dt * 0.09 * genome.build);
    if (mined > 0) {
      this.mineral[i] -= mined;
      agent.carrying = clamp(agent.carrying + mined * 0.72, 0, 1.4);
      agent.energy = clamp(agent.energy + mined * 0.62, 0, 2.4);
      agent.stats.food += mined;
    }

    const grazerDensity = neighbors.filter((a) => a.faction === "forager").length / Math.max(1, neighbors.length);
    const buildUrgency =
      agent.carrying * 0.8 +
      genome.build * 0.2 +
      predatorPressure * 0.35 +
      this.toxicity[i] * 0.6 +
      (1 - this.flora[i]) * 0.14;
    if (agent.cooldown <= 0 && agent.energy > 0.78 && buildUrgency > 0.58 && this.structure[i] === STRUCTURES.none) {
      let type = STRUCTURES.nursery;
      if (this.toxicity[i] > 0.24) type = STRUCTURES.detox;
      else if (predatorPressure > 0.4 && grazerDensity > 0.18) type = STRUCTURES.barrier;
      else if (allies < 2 && agent.carrying > 0.55) type = STRUCTURES.beacon;
      else if (this.flora[i] > 0.62 && this.mineral[i] > 0.32 && this.metrics.counts.predator < 18) type = STRUCTURES.den;

      if (this.placeStructure(agent.x, agent.y, type, 0.55 + agent.carrying * 0.36)) {
        agent.energy -= 0.3;
        agent.carrying = Math.max(0, agent.carrying - 0.55);
        agent.cooldown = 7.5 / genome.build + this.rng() * 4;
        agent.stats.built += 1;
        if (type === STRUCTURES.detox) agent.stats.detox += 1;
        agent.flash = 0.16;
      }
    }

    if (this.structure[i] !== STRUCTURES.none && this.structure[i] !== STRUCTURES.den && this.structureHp[i] < 0.8 && agent.carrying > 0.05) {
      const repair = Math.min(agent.carrying, dt * 0.05 * genome.build);
      this.structureHp[i] = clamp(this.structureHp[i] + repair, 0, 1);
      agent.carrying -= repair;
      agent.stats.repaired += repair;
    }

    if (this.structure[i] === STRUCTURES.beacon) {
      agent.energy = clamp(agent.energy + 0.006 * dt, 0, 2.4);
    }

    return desire;
  }

  inverseFloraProxy = {
    get: (i) => 1 - this.flora[i]
  };

  fieldValue(field, i) {
    if (field instanceof Float32Array) return field[i];
    return field.get(i);
  }

  fieldGradient(field, x, y, radius) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    const samples = 8;
    let gx = 0;
    let gy = 0;
    let best = -Infinity;
    let bestX = 0;
    let bestY = 0;
    for (let s = 0; s < samples; s += 1) {
      const angle = (s / samples) * TAU;
      const sx = clamp(Math.floor(cx + Math.cos(angle) * radius), 0, WORLD_W - 1);
      const sy = clamp(Math.floor(cy + Math.sin(angle) * radius), 0, WORLD_H - 1);
      const v = this.fieldValue(field, sy * WORLD_W + sx);
      gx += Math.cos(angle) * v;
      gy += Math.sin(angle) * v;
      if (v > best) {
        best = v;
        bestX = sx - x;
        bestY = sy - y;
      }
    }
    return { x: gx * 0.25 + bestX * 0.04, y: gy * 0.25 + bestY * 0.04 };
  }

  structureGradient(type, x, y, radius) {
    const desire = { x: 0, y: 0 };
    const minX = clamp(Math.floor(x - radius), 0, WORLD_W - 1);
    const maxX = clamp(Math.floor(x + radius), 0, WORLD_W - 1);
    const minY = clamp(Math.floor(y - radius), 0, WORLD_H - 1);
    const maxY = clamp(Math.floor(y + radius), 0, WORLD_H - 1);
    for (let yy = minY; yy <= maxY; yy += 2) {
      for (let xx = minX; xx <= maxX; xx += 2) {
        const i = yy * WORLD_W + xx;
        if (this.structure[i] === type) {
          const dx = xx + 0.5 - x;
          const dy = yy + 0.5 - y;
          const d2 = dx * dx + dy * dy + 1;
          desire.x += dx / d2;
          desire.y += dy / d2;
        }
      }
    }
    return desire;
  }

  neighborAverage(field, x, y) {
    let sum = 0;
    let count = 0;
    for (let yy = Math.max(0, y - 1); yy <= Math.min(WORLD_H - 1, y + 1); yy += 1) {
      for (let xx = Math.max(0, x - 1); xx <= Math.min(WORLD_W - 1, x + 1); xx += 1) {
        sum += field[yy * WORLD_W + xx];
        count += 1;
      }
    }
    return sum / count;
  }

  localFieldAverage(field, x, y, radius) {
    let sum = 0;
    let count = 0;
    for (let yy = Math.max(0, y - radius); yy <= Math.min(WORLD_H - 1, y + radius); yy += 2) {
      for (let xx = Math.max(0, x - radius); xx <= Math.min(WORLD_W - 1, x + radius); xx += 2) {
        sum += field[yy * WORLD_W + xx];
        count += 1;
      }
    }
    return sum / Math.max(1, count);
  }

  tryReproduce(agent, dt) {
    if (agent.cooldown > 0 || agent.health < 0.52 || agent.age < 5) return;
    const meta = FACTIONS[agent.faction];
    if (this.metrics.counts[agent.faction] > meta.maxPopulation) return;
    const i = indexOf(agent.x, agent.y);
    const localSupport =
      agent.faction === "forager"
        ? this.flora[i] * 0.9 + (this.structure[i] === STRUCTURES.nursery ? 0.22 : 0)
        : agent.faction === "predator"
          ? invLerp(18, 120, this.metrics.counts.forager) + (this.structure[i] === STRUCTURES.den ? 0.2 : 0)
          : this.mineral[i] * 0.7 + (this.structure[i] === STRUCTURES.beacon ? 0.24 : 0);
    const threshold = agent.faction === "predator" ? 1.95 : 1.55;
    const chance = dt * 0.035 * agent.genome.fertility * localSupport;
    if (agent.energy > threshold && this.rng() < chance) {
      const childGenome = mutateGenome(agent.genome, this.rng, this.settings.mutationPressure);
      childGenome.lineage = agent.genome.lineage;
      const child = this.spawnAgent(
        agent.faction,
        agent.x + (this.rng() - 0.5) * 1.5,
        agent.y + (this.rng() - 0.5) * 1.5,
        childGenome,
        agent.id
      );
      if (child) {
        child.energy = agent.energy * 0.42;
        agent.energy *= 0.58;
        agent.cooldown = 8 + this.rng() * 9;
        agent.stats.births += 1;
      }
    }
  }

  resolveDeaths() {
    const before = this.agents.length;
    this.agents = this.agents.filter((agent) => {
      const oldAge = agent.age > (agent.faction === "predator" ? 170 : 210);
      const alive = agent.energy > -0.25 && agent.health > 0 && !oldAge;
      if (!alive) this.depositRemains(agent);
      return alive;
    });
    if (before - this.agents.length > 10) {
      this.log(`${before - this.agents.length} agents collapsed into nutrient pulses.`);
    }
  }

  depositRemains(agent) {
    const i = indexOf(agent.x, agent.y);
    this.nutrient[i] = clamp(this.nutrient[i] + 0.12, 0, 1);
    this.toxicity[i] = clamp(this.toxicity[i] + (agent.health < 0.05 ? 0.025 : 0), 0, 1);
  }

  rebalanceExtinctions() {
    for (const faction of Object.keys(FACTIONS)) {
      const count = this.agents.filter((a) => a.faction === faction).length;
      if (count >= FACTIONS[faction].minPopulation) continue;
      const needed = Math.min(3, FACTIONS[faction].minPopulation - count);
      for (let n = 0; n < needed; n += 1) {
        const cell = this.findSpawnCell(faction);
        const archive = this.archive[faction][Math.floor(this.rng() * Math.max(1, this.archive[faction].length))];
        const source = archive?.genome || FACTIONS[faction].baseGenome;
        this.spawnAgent(faction, cell.x + this.rng(), cell.y + this.rng(), mutateGenome(source, this.rng, 1.5));
      }
      if (needed > 0 && this.rng() < 0.02) this.log(`${FACTIONS[faction].name} reseeded from the evolutionary archive.`);
    }
  }

  runEpochSelection() {
    this.collectMetrics();
    this.epoch += 1;
    const summaries = [];
    for (const faction of Object.keys(FACTIONS)) {
      const ranked = this.agents
        .filter((agent) => agent.faction === faction)
        .map((agent) => ({ agent, fitness: this.agentFitness(agent) }))
        .sort((a, b) => b.fitness - a.fitness);
      for (const item of ranked.slice(0, 6)) {
        item.agent.stats.survivedEpochs += 1;
        this.archive[faction].push({
          genome: { ...item.agent.genome },
          fitness: item.fitness,
          epoch: this.epoch,
          label: describeGenome(faction, item.agent.genome)
        });
      }
      this.archive[faction].sort((a, b) => b.fitness - a.fitness);
      this.archive[faction] = this.archive[faction].slice(0, 14);
      const champion = this.archive[faction][0];
      summaries.push(`${FACTIONS[faction].name}: ${champion ? champion.label : "no champion"}`);
    }

    for (const agent of this.agents) {
      const stress = 1 - agent.health + Math.max(0, 0.7 - agent.energy) * 0.3;
      if (this.rng() < stress * 0.025 * this.settings.mutationPressure) {
        agent.genome = mutateGenome(agent.genome, this.rng, this.settings.mutationPressure * 0.8);
        agent.flash = 0.22;
      }
    }

    if (this.metrics.foundation > 74) {
      this.directorEnergy = clamp(this.directorEnergy + 12, 0, 100);
    }
    this.log(`Epoch ${this.epoch} selection: ${summaries.join(" / ")}.`);
  }

  agentFitness(agent) {
    const survival = agent.age * 0.015 + agent.health * 1.2 + agent.energy * 0.8 + agent.stats.survivedEpochs * 0.6;
    if (agent.faction === "forager") {
      return survival + agent.stats.food * 4.5 + agent.stats.births * 3.4 + this.metrics.diversity * 1.8;
    }
    if (agent.faction === "predator") {
      return survival + agent.stats.kills * 4.6 + agent.stats.births * 2.2 + invLerp(42, 130, this.metrics.counts.forager) * 1.5;
    }
    return survival + agent.stats.built * 3.7 + agent.stats.repaired * 5.5 + agent.stats.detox * 2.9 + this.metrics.stability * 2.3;
  }

  collectMetrics() {
    const counts = { forager: 0, predator: 0, builder: 0 };
    const genomeAverages = {
      forager: {},
      predator: {},
      builder: {}
    };
    for (const key of Object.keys(FACTIONS)) {
      for (const gene of GENE_KEYS) genomeAverages[key][gene] = 0;
    }

    for (const agent of this.agents) {
      counts[agent.faction] += 1;
      for (const gene of GENE_KEYS) genomeAverages[agent.faction][gene] += agent.genome[gene] ?? 0;
    }
    for (const key of Object.keys(FACTIONS)) {
      for (const gene of GENE_KEYS) genomeAverages[key][gene] /= Math.max(1, counts[key]);
    }

    let biomass = 0;
    let toxic = 0;
    let structures = 0;
    let fire = 0;
    for (let i = 0; i < WORLD_SIZE; i += 1) {
      biomass += this.flora[i];
      toxic += this.toxicity[i];
      fire += this.fire[i];
      if (this.structure[i] !== STRUCTURES.none) structures += 1;
    }
    biomass /= WORLD_SIZE;
    toxic /= WORLD_SIZE;
    fire /= WORLD_SIZE;

    const total = Math.max(1, counts.forager + counts.predator + counts.builder);
    let entropy = 0;
    for (const count of Object.values(counts)) {
      const p = count / total;
      if (p > 0) entropy -= p * Math.log(p);
    }
    const diversity = clamp(entropy / Math.log(3), 0, 1);
    const balanceTarget = clamp(1 - Math.abs(counts.predator / Math.max(1, counts.forager) - 0.24) * 2.6, 0, 1);
    const structureIntegration = clamp(structures / 115, 0, 1);
    const stability = this.computeStability(counts);
    const foundation = clamp(
      (diversity * 0.28 + stability * 0.25 + biomass * 0.18 + balanceTarget * 0.17 + structureIntegration * 0.12 - toxic * 0.1 - fire * 0.18) * 100,
      0,
      100
    );
    const regime = this.classifyRegime(counts, biomass, toxic, fire, structures, stability);

    this.metrics = {
      counts,
      biomass,
      toxicity: toxic,
      fire,
      structures,
      diversity,
      stability,
      foundation,
      regime,
      trend: this.classifyTrend(),
      genomeAverages
    };
    this.history.push({
      time: this.time,
      ...counts,
      biomass,
      toxicity: toxic,
      structures,
      foundation
    });
    if (this.history.length > MAX_HISTORY) this.history.shift();
  }

  computeStability(counts) {
    const recent = this.history.slice(-72);
    if (recent.length < 8) return 0.45;
    const keys = ["forager", "predator", "builder"];
    let volatility = 0;
    for (const key of keys) {
      const mean = recent.reduce((sum, row) => sum + row[key], 0) / recent.length;
      const variance = recent.reduce((sum, row) => sum + (row[key] - mean) ** 2, 0) / recent.length;
      volatility += Math.sqrt(variance) / Math.max(12, mean);
    }
    const currentPenalty =
      Math.abs(counts.predator / Math.max(1, counts.forager) - 0.24) * 0.6 +
      Math.abs(counts.builder / Math.max(1, counts.forager) - 0.33) * 0.35;
    return clamp(1 - volatility * 0.42 - currentPenalty, 0, 1);
  }

  classifyRegime(counts, biomass, toxic, fire, structures, stability) {
    if (toxic > 0.2 || fire > 0.08) return "Disturbance cascade";
    if (counts.forager < 28) return "Prey bottleneck";
    if (counts.predator < 10 && counts.forager > 130) return "Unchecked grazing boom";
    if (counts.predator > counts.forager * 0.45) return "Predator overshoot";
    if (structures > 95 && stability > 0.62) return "Engineered refuge web";
    if (biomass > 0.62 && counts.builder > 42) return "Constructed bloom";
    if (stability > 0.72 && this.metrics?.diversity > 0.72) return "Triadic equilibrium";
    return "Oscillating coexistence";
  }

  classifyTrend() {
    const recent = this.history.slice(-30);
    if (recent.length < 8) return "initializing";
    const first = recent[0];
    const last = recent[recent.length - 1];
    const delta = last.foundation - first.foundation;
    if (delta > 8) return "foundation rising";
    if (delta < -8) return "foundation falling";
    const predatorDelta = last.predator - first.predator;
    const forageDelta = last.forager - first.forager;
    if (Math.sign(predatorDelta) !== Math.sign(forageDelta) && Math.abs(predatorDelta) + Math.abs(forageDelta) > 18) {
      return "trophic phase shift";
    }
    return "dynamic balance";
  }

  applyTool(toolId, x, y) {
    const tool = TOOLS.find((item) => item.id === toolId);
    if (!tool) return;
    if (tool.id === "observe") {
      this.selected = { x: Math.floor(x), y: Math.floor(y) };
      return;
    }
    if (this.directorEnergy < tool.cost) {
      this.log(`Director energy too low for ${tool.label}.`);
      return;
    }
    this.directorEnergy -= tool.cost;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    const radius = tool.radius;
    for (let yy = Math.max(0, cy - radius); yy <= Math.min(WORLD_H - 1, cy + radius); yy += 1) {
      for (let xx = Math.max(0, cx - radius); xx <= Math.min(WORLD_W - 1, cx + radius); xx += 1) {
        const d = Math.hypot(xx - cx, yy - cy);
        if (d > radius) continue;
        const falloff = 1 - d / radius;
        const i = yy * WORLD_W + xx;
        if (tool.id === "seed") {
          this.flora[i] = clamp(this.flora[i] + 0.35 * falloff, 0, 1);
          this.nutrient[i] = clamp(this.nutrient[i] + 0.18 * falloff, 0, 1);
          this.spores[i] = clamp(this.spores[i] + 0.45 * falloff, 0, 1);
        } else if (tool.id === "rain") {
          this.moisture[i] = clamp(this.moisture[i] + 0.42 * falloff, 0, 1);
          this.temperature[i] = clamp(this.temperature[i] - 0.14 * falloff, 0, 1);
          this.fire[i] = Math.max(0, this.fire[i] - 0.72 * falloff);
        } else if (tool.id === "detox") {
          this.toxicity[i] = Math.max(0, this.toxicity[i] - 0.48 * falloff);
          if (d < 1.2) this.placeStructure(xx, yy, STRUCTURES.detox, 0.9);
        } else if (tool.id === "fireline") {
          this.flora[i] = Math.max(0, this.flora[i] - 0.55 * falloff);
          this.fire[i] = Math.max(0, this.fire[i] - 0.4 * falloff);
          this.nutrient[i] = clamp(this.nutrient[i] + 0.08 * falloff, 0, 1);
        } else if (tool.id === "ridge") {
          this.height[i] = clamp(this.height[i] + 0.2 * falloff, 0, 1);
          this.mineral[i] = clamp(this.mineral[i] + 0.25 * falloff, 0, 1);
          if (d < 1.3) this.placeStructure(xx, yy, STRUCTURES.barrier, 0.82);
        }
      }
    }

    if (tool.id === "mutate") {
      const nearby = this.spatial.query(x, y, radius);
      for (const agent of nearby) {
        agent.genome = mutateGenome(agent.genome, this.rng, 2.4 * this.settings.mutationPressure);
        agent.flash = 0.36;
      }
    }

    this.log(`${tool.label} intervention applied at (${cx}, ${cy}).`);
  }

  log(message) {
    this.events.unshift({ time: this.time, message });
    this.events = this.events.slice(0, 9);
  }

  injectLeagueChampions() {
    for (const faction of Object.keys(FACTIONS)) {
      const champion = this.league.champions[faction];
      if (!champion) continue;
      this.archive[faction].push({
        genome: { ...champion.genome },
        fitness: champion.fitness,
        epoch: this.epoch,
        label: `league ${champion.label}`
      });
      this.archive[faction].sort((a, b) => b.fitness - a.fitness);
      this.archive[faction] = this.archive[faction].slice(0, 18);

      let rewritten = 0;
      for (const agent of this.agents) {
        if (agent.faction !== faction || rewritten >= 10) continue;
        if (this.rng() < 0.32) {
          agent.genome = mutateGenome(champion.genome, this.rng, 0.35);
          agent.flash = 0.45;
          rewritten += 1;
        }
      }
      for (let i = 0; i < 5; i += 1) {
        const cell = this.findSpawnCell(faction);
        const agent = this.spawnAgent(faction, cell.x + this.rng(), cell.y + this.rng(), mutateGenome(champion.genome, this.rng, 0.45));
        if (agent) agent.flash = 0.55;
      }
    }
    this.directorEnergy = clamp(this.directorEnergy - 18, 0, 100);
    this.log(`Injected generation ${this.league.generation} league champions into the live biome.`);
  }
}

let sim = new BiomeSim(842791);
let accumulator = 0;
let lastTime = performance.now();
let lastUi = 0;
let activeTool = "observe";
let canvasSize = { width: 1, height: 1, scaleX: 1, scaleY: 1 };

function setupTools() {
  dom.toolDock.innerHTML = "";
  for (const tool of TOOLS) {
    const button = document.createElement("button");
    button.className = `tool-button ${tool.id === activeTool ? "active" : ""}`;
    button.type = "button";
    button.title = `${tool.hint}${tool.cost ? `, cost ${tool.cost}` : ""}`;
    button.innerHTML = `<span class="tool-symbol ${tool.id}"></span><span>${tool.label}</span>`;
    button.addEventListener("click", () => {
      activeTool = tool.id;
      sim.activeTool = tool.id;
      for (const child of dom.toolDock.children) child.classList.remove("active");
      button.classList.add("active");
    });
    dom.toolDock.append(button);
  }
}

function resizeCanvas() {
  const rect = dom.canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  dom.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  dom.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvasSize = {
    width: dom.canvas.width,
    height: dom.canvas.height,
    scaleX: dom.canvas.width / WORLD_W,
    scaleY: dom.canvas.height / WORLD_H
  };
}

function canvasToWorld(event) {
  const rect = dom.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WORLD_W,
    y: ((event.clientY - rect.top) / rect.height) * WORLD_H
  };
}

function bindEvents() {
  window.addEventListener("resize", resizeCanvas);
  dom.canvas.addEventListener("pointermove", (event) => {
    sim.hover = canvasToWorld(event);
    updateReadout();
  });
  dom.canvas.addEventListener("pointerleave", () => {
    sim.hover = null;
    updateReadout();
  });
  dom.canvas.addEventListener("pointerdown", (event) => {
    const point = canvasToWorld(event);
    sim.applyTool(activeTool, point.x, point.y);
    updateReadout();
  });
  dom.pauseBtn.addEventListener("click", () => {
    sim.paused = !sim.paused;
    sim.singleEpochTarget = null;
    dom.pauseIcon.textContent = sim.paused ? ">" : "II";
  });
  dom.stepBtn.addEventListener("click", () => {
    sim.singleEpochTarget = sim.epoch + 1;
    sim.paused = false;
    dom.pauseIcon.textContent = ">";
  });
  dom.resetBtn.addEventListener("click", () => {
    sim = new BiomeSim(Math.floor(Math.random() * 900000) + 1000);
    sim.settings.speed = Number(dom.speedSlider.value);
    sim.settings.rainfallBias = Number(dom.rainSlider.value);
    sim.settings.mutationPressure = Number(dom.mutationSlider.value);
    sim.settings.disturbance = Number(dom.disturbanceSlider.value);
    activeTool = "observe";
    dom.trainToggleBtn.textContent = "Pause League";
    setupTools();
  });
  dom.speedSlider.addEventListener("input", () => {
    sim.settings.speed = Number(dom.speedSlider.value);
    dom.speedLabel.textContent = `${sim.settings.speed.toFixed(2)}x`;
  });
  dom.rainSlider.addEventListener("input", () => {
    sim.settings.rainfallBias = Number(dom.rainSlider.value);
  });
  dom.mutationSlider.addEventListener("input", () => {
    sim.settings.mutationPressure = Number(dom.mutationSlider.value);
  });
  dom.disturbanceSlider.addEventListener("input", () => {
    sim.settings.disturbance = Number(dom.disturbanceSlider.value);
  });
  dom.trainToggleBtn.addEventListener("click", () => {
    sim.league.auto = !sim.league.auto;
    dom.trainToggleBtn.textContent = sim.league.auto ? "Pause League" : "Resume League";
    sim.log(sim.league.auto ? "Shadow self-play league resumed." : "Shadow self-play league paused.");
  });
  dom.burstTrainBtn.addEventListener("click", () => {
    for (let i = 0; i < 8; i += 1) sim.league.trainGeneration(sim.metrics);
    sim.log(`Manual burst completed through league generation ${sim.league.generation}.`);
    updateUi();
  });
  dom.injectChampionBtn.addEventListener("click", () => {
    sim.injectLeagueChampions();
    updateUi();
  });
}

function drawWorld() {
  const { width, height, scaleX, scaleY } = canvasSize;
  ctx.fillStyle = "#090c0f";
  ctx.fillRect(0, 0, width, height);
  const cellW = Math.ceil(scaleX + 0.75);
  const cellH = Math.ceil(scaleY + 0.75);

  for (let y = 0; y < WORLD_H; y += 1) {
    for (let x = 0; x < WORLD_W; x += 1) {
      const i = y * WORLD_W + x;
      const moisture = sim.moisture[i];
      const flora = sim.flora[i];
      const heightValue = sim.height[i];
      let color = mixColor("#604d3e", "#244f36", flora);
      if (moisture > 0.72 && heightValue < 0.38) color = mixColor(color, "#286790", invLerp(0.72, 1, moisture) * 0.82);
      if (heightValue > 0.72) color = mixColor(color, "#a89876", invLerp(0.72, 1, heightValue) * 0.45);
      if (sim.toxicity[i] > 0.08) color = mixColor(color, "#7c4bb0", clamp(sim.toxicity[i] * 1.6, 0, 0.75));
      if (sim.fire[i] > 0.03) color = mixColor(color, "#ff7b45", clamp(sim.fire[i] * 1.8, 0, 0.95));
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x * scaleX), Math.floor(y * scaleY), cellW, cellH);
    }
  }

  drawStructures();
  drawAgents();
  drawToolPreview();
}

function drawStructures() {
  const { scaleX, scaleY } = canvasSize;
  for (let y = 0; y < WORLD_H; y += 1) {
    for (let x = 0; x < WORLD_W; x += 1) {
      const i = y * WORLD_W + x;
      const type = sim.structure[i];
      if (type === STRUCTURES.none) continue;
      const meta = STRUCTURE_META[type];
      const cx = (x + 0.5) * scaleX;
      const cy = (y + 0.5) * scaleY;
      const s = Math.max(3, Math.min(scaleX, scaleY) * (0.75 + sim.structureHp[i] * 0.45));
      ctx.save();
      ctx.globalAlpha = 0.72 + sim.structureHp[i] * 0.22;
      ctx.strokeStyle = meta.color;
      ctx.fillStyle = meta.color;
      ctx.lineWidth = Math.max(1, Math.min(scaleX, scaleY) * 0.18);
      if (type === STRUCTURES.barrier) {
        ctx.fillRect(cx - s * 0.55, cy - s * 0.18, s * 1.1, s * 0.36);
      } else if (type === STRUCTURES.nursery) {
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.48, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.17, 0, TAU);
        ctx.fill();
      } else if (type === STRUCTURES.detox) {
        ctx.strokeRect(cx - s * 0.42, cy - s * 0.42, s * 0.84, s * 0.84);
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.32, cy);
        ctx.lineTo(cx + s * 0.32, cy);
        ctx.moveTo(cx, cy - s * 0.32);
        ctx.lineTo(cx, cy + s * 0.32);
        ctx.stroke();
      } else if (type === STRUCTURES.beacon) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.55);
        ctx.lineTo(cx + s * 0.55, cy);
        ctx.lineTo(cx, cy + s * 0.55);
        ctx.lineTo(cx - s * 0.55, cy);
        ctx.closePath();
        ctx.stroke();
      } else if (type === STRUCTURES.den) {
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.42, Math.PI, 0);
        ctx.lineTo(cx + s * 0.45, cy + s * 0.35);
        ctx.lineTo(cx - s * 0.45, cy + s * 0.35);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

function drawAgents() {
  const { scaleX, scaleY } = canvasSize;
  const ordered = [...sim.agents].sort((a, b) => (a.faction > b.faction ? 1 : -1));
  for (const agent of ordered) {
    const x = agent.x * scaleX;
    const y = agent.y * scaleY;
    const base = agent.faction === "predator" ? 4.8 : agent.faction === "builder" ? 4.5 : 3.8;
    const size = Math.max(2.7, base * Math.min(scaleX, scaleY) * 0.16);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(agent.vy, agent.vx));
    ctx.globalAlpha = clamp(agent.health * 0.75 + 0.25, 0.28, 1);
    ctx.fillStyle = agent.flash > 0 ? "#ffffff" : agent.color;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.42)";
    ctx.lineWidth = Math.max(1, size * 0.2);
    if (agent.faction === "forager") {
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.75, -size * 0.58);
      ctx.lineTo(-size * 0.45, 0);
      ctx.lineTo(-size * 0.75, size * 0.58);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (agent.faction === "predator") {
      ctx.beginPath();
      ctx.moveTo(size * 1.12, 0);
      ctx.lineTo(0, -size * 0.78);
      ctx.lineTo(-size * 1.05, 0);
      ctx.lineTo(0, size * 0.78);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      for (let k = 0; k < 6; k += 1) {
        const angle = (k / 6) * TAU;
        const px = Math.cos(angle) * size;
        const py = Math.sin(angle) * size;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawToolPreview() {
  const point = sim.hover;
  if (!point) return;
  const tool = TOOLS.find((item) => item.id === activeTool);
  if (!tool) return;
  const { scaleX, scaleY } = canvasSize;
  ctx.save();
  ctx.strokeStyle = activeTool === "mutate" ? "rgba(180, 140, 255, 0.8)" : "rgba(237, 242, 243, 0.72)";
  ctx.fillStyle = "rgba(237, 242, 243, 0.06)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(point.x * scaleX, point.y * scaleY, tool.radius * (scaleX + scaleY) * 0.5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function updateReadout() {
  const point = sim.hover || sim.selected;
  if (!point) {
    dom.cellReadout.textContent = "Move over the biome to inspect local state.";
    return;
  }
  const x = clamp(Math.floor(point.x), 0, WORLD_W - 1);
  const y = clamp(Math.floor(point.y), 0, WORLD_H - 1);
  const i = y * WORLD_W + x;
  const nearby = sim.spatial.query(x, y, 4);
  const counts = {
    forager: nearby.filter((a) => a.faction === "forager").length,
    predator: nearby.filter((a) => a.faction === "predator").length,
    builder: nearby.filter((a) => a.faction === "builder").length
  };
  const structure =
    sim.structure[i] === STRUCTURES.none ? "none" : `${STRUCTURE_META[sim.structure[i]].name} ${(sim.structureHp[i] * 100).toFixed(0)}%`;
  dom.cellReadout.textContent = `Cell ${x}, ${y} | flora ${(sim.flora[i] * 100).toFixed(0)}% | moisture ${(sim.moisture[i] * 100).toFixed(0)}% | nutrients ${(sim.nutrient[i] * 100).toFixed(0)}% | toxicity ${(sim.toxicity[i] * 100).toFixed(0)}% | structure ${structure} | nearby F/P/B ${counts.forager}/${counts.predator}/${counts.builder}`;
}

function updateUi() {
  const m = sim.metrics;
  dom.regimeText.textContent = m.regime;
  dom.epochText.textContent = `${sim.epoch}`;
  dom.seasonText.textContent = sim.seasonName();
  dom.scoreText.textContent = `${Math.round(m.foundation)} / 100`;
  dom.diversityText.textContent = `${Math.round(m.diversity * 100)}%`;
  dom.stabilityText.textContent = `${Math.round(m.stability * 100)}%`;
  dom.trendText.textContent = m.trend;
  dom.clockText.textContent = formatTime(sim.time);
  dom.agentTotal.textContent = `${sim.agents.length} agents`;
  dom.speedLabel.textContent = `${sim.settings.speed.toFixed(2)}x`;

  updateFactionGrid();
  updateLeaguePanel();
  updateGeneBoard();
  updateEventLog();
  drawHistory();
  drawLeagueChart();
}

function updateFactionGrid() {
  const counts = sim.metrics.counts;
  const max = Math.max(1, counts.forager, counts.predator, counts.builder);
  dom.factionGrid.innerHTML = "";
  for (const [key, meta] of Object.entries(FACTIONS)) {
    const row = document.createElement("div");
    row.className = "faction-row";
    row.style.color = meta.color;
    row.innerHTML = `
      <span class="faction-dot"></span>
      <div>
        <h3>${meta.name}</h3>
        <div class="meter"><span style="width:${(counts[key] / max) * 100}%"></span></div>
      </div>
      <strong class="faction-stat">${counts[key]}</strong>
    `;
    dom.factionGrid.append(row);
  }
}

function updateGeneBoard() {
  const averages = sim.metrics.genomeAverages;
  if (!averages) return;
  dom.geneBoard.innerHTML = "";
  for (const [faction, meta] of Object.entries(FACTIONS)) {
    const wrap = document.createElement("div");
    wrap.className = "gene-family";
    const champion = sim.archive[faction][0];
    wrap.innerHTML = `<div class="gene-title"><strong style="color:${meta.color}">${meta.name}</strong><span>${champion ? champion.label : "selection pending"}</span></div>`;
    for (const gene of GENE_KEYS) {
      const value = averages[faction][gene] ?? 0;
      const normalized = gene === "sense" ? invLerp(4, 16, value) : gene === "mutation" ? invLerp(0.02, 0.34, value) : invLerp(0, 2.2, value);
      const line = document.createElement("div");
      line.className = "gene-line";
      line.innerHTML = `
        <span>${gene}</span>
        <div class="meter" style="color:${meta.color}"><span style="width:${normalized * 100}%"></span></div>
        <span>${value.toFixed(gene === "sense" ? 1 : 2)}</span>
      `;
      wrap.append(line);
    }
    dom.geneBoard.append(wrap);
  }
}

function updateLeaguePanel() {
  const league = sim.league;
  dom.leagueModeText.textContent = league.auto ? "auto training" : "paused";
  dom.shadowWorldText.textContent = league.virtualWorlds.toLocaleString();
  dom.leagueGenerationText.textContent = league.generation.toLocaleString();
  dom.rolloutText.textContent = compactNumber(league.rollouts);
  dom.leagueRatingText.textContent = `${league.rating()}`;
  dom.trainToggleBtn.textContent = league.auto ? "Pause League" : "Resume League";

  dom.rewardGrid.innerHTML = "";
  const rows = [
    ["survival", "Survival"],
    ["trophic", "Trophic"],
    ["construction", "Build"],
    ["resilience", "Recovery"],
    ["foundation", "Foundation"],
    ["novelty", "Novelty"]
  ];
  for (const [key, label] of rows) {
    const value = league.lastRewards[key] ?? 0;
    const row = document.createElement("div");
    row.className = "reward-row";
    row.innerHTML = `
      <span>${label}</span>
      <div class="meter" style="color:${key === "foundation" ? "#62d5d0" : "#e3b95f"}"><span style="width:${clamp(value, 0, 1) * 100}%"></span></div>
      <strong>${Math.round(value * 100)}</strong>
    `;
    dom.rewardGrid.append(row);
  }
}

function compactNumber(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value}`;
}

function updateEventLog() {
  dom.eventLog.innerHTML = "";
  for (const event of sim.events) {
    const li = document.createElement("li");
    li.textContent = `${formatTime(event.time)} ${event.message}`;
    dom.eventLog.append(li);
  }
}

function drawLeagueChart() {
  const canvas = dom.leagueCanvas;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  leagueCtx.clearRect(0, 0, width, height);
  leagueCtx.fillStyle = "#10151a";
  leagueCtx.fillRect(0, 0, width, height);
  leagueCtx.strokeStyle = "rgba(255,255,255,0.08)";
  leagueCtx.lineWidth = 1;
  for (let i = 1; i < 3; i += 1) {
    const y = (height / 3) * i;
    leagueCtx.beginPath();
    leagueCtx.moveTo(0, y);
    leagueCtx.lineTo(width, y);
    leagueCtx.stroke();
  }
  const history = sim.league.history;
  if (history.length < 2) return;
  drawLeagueLine(history, "rating", "#b48cff", 900, Math.max(1200, ...history.map((row) => row.rating)));
  drawLeagueLine(history, "foundation", "#62d5d0", 0, 100);
  drawLeagueLine(history, "resilience", "#e3b95f", 0, 100);
}

function drawLeagueLine(history, key, color, minValue, maxValue) {
  const width = dom.leagueCanvas.width;
  const height = dom.leagueCanvas.height;
  leagueCtx.beginPath();
  leagueCtx.strokeStyle = color;
  leagueCtx.lineWidth = key === "rating" ? 2.3 : 1.6;
  history.forEach((row, idx) => {
    const x = (idx / Math.max(1, LEAGUE_HISTORY - 1)) * width;
    const y = height - invLerp(minValue, maxValue, row[key]) * (height - 18) - 8;
    if (idx === 0) leagueCtx.moveTo(x, y);
    else leagueCtx.lineTo(x, y);
  });
  leagueCtx.stroke();
}

function drawHistory() {
  const canvas = dom.historyCanvas;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  chartCtx.clearRect(0, 0, width, height);
  chartCtx.fillStyle = "#10151a";
  chartCtx.fillRect(0, 0, width, height);
  chartCtx.strokeStyle = "rgba(255,255,255,0.08)";
  chartCtx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    const y = (height / 4) * i;
    chartCtx.beginPath();
    chartCtx.moveTo(0, y);
    chartCtx.lineTo(width, y);
    chartCtx.stroke();
  }

  const history = sim.history;
  if (history.length < 2) return;
  const maxAgents = Math.max(80, ...history.map((row) => Math.max(row.forager, row.predator * 2.5, row.builder * 1.6)));
  drawLine(history, "forager", FACTIONS.forager.color, maxAgents);
  drawLine(history, "predator", FACTIONS.predator.color, maxAgents / 2.5);
  drawLine(history, "builder", FACTIONS.builder.color, maxAgents / 1.6);
  drawLine(history, "foundation", "#62d5d0", 100);
}

function drawLine(history, key, color, maxValue) {
  const width = dom.historyCanvas.width;
  const height = dom.historyCanvas.height;
  chartCtx.beginPath();
  chartCtx.strokeStyle = color;
  chartCtx.lineWidth = key === "foundation" ? 2.4 : 1.7;
  history.forEach((row, idx) => {
    const x = (idx / (MAX_HISTORY - 1)) * width;
    const y = height - clamp(row[key] / maxValue, 0, 1) * (height - 18) - 8;
    if (idx === 0) chartCtx.moveTo(x, y);
    else chartCtx.lineTo(x, y);
  });
  chartCtx.stroke();
}

function loop(now) {
  const elapsed = Math.min(0.08, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += elapsed;
  while (accumulator >= STEP) {
    sim.step(STEP);
    accumulator -= STEP;
  }
  drawWorld();
  if (now - lastUi > 280) {
    updateUi();
    updateReadout();
    lastUi = now;
  }
  requestAnimationFrame(loop);
}

setupTools();
bindEvents();
resizeCanvas();
sim.collectMetrics();
updateUi();
requestAnimationFrame(loop);

globalThis.__BIOME_TACTICS__ = {
  get sim() {
    return sim;
  },
  trainLeagueGenerations(count = 1) {
    for (let i = 0; i < count; i += 1) sim.league.trainGeneration(sim.metrics);
    updateUi();
    return sim.league.generation;
  },
  injectLeagueChampions() {
    sim.injectLeagueChampions();
    updateUi();
  }
};
