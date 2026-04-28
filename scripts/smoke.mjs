const canvasMethods = new Set([
  "arc",
  "beginPath",
  "clearRect",
  "closePath",
  "fill",
  "fillRect",
  "lineTo",
  "moveTo",
  "restore",
  "rotate",
  "save",
  "stroke",
  "strokeRect",
  "translate"
]);

function createContext() {
  return new Proxy(
    {},
    {
      get(target, prop) {
        if (canvasMethods.has(prop)) return () => {};
        return target[prop] ?? 0;
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      }
    }
  );
}

class FakeClassList {
  add() {}
  remove() {}
  toggle() {}
}

class FakeElement {
  constructor(selector = "element") {
    this.selector = selector;
    this.children = [];
    this.style = {};
    this.className = "";
    this.classList = new FakeClassList();
    this.value = "1";
    this.textContent = "";
    this.width = 640;
    this.height = 360;
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  addEventListener() {}

  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      width: this.selector.includes("history") ? 390 : 1040,
      height: this.selector.includes("history") ? 150 : 720
    };
  }

  getContext() {
    return createContext();
  }

  set innerHTML(value) {
    this.children = [];
    this._innerHTML = value;
  }

  get innerHTML() {
    return this._innerHTML ?? "";
  }
}

const elements = new Map();
function getElement(selector) {
  if (!elements.has(selector)) elements.set(selector, new FakeElement(selector));
  return elements.get(selector);
}

globalThis.window = {
  devicePixelRatio: 1,
  addEventListener() {}
};
globalThis.document = {
  querySelector(selector) {
    return getElement(selector);
  },
  createElement(tag) {
    return new FakeElement(tag);
  }
};
globalThis.performance = {
  now: () => 0
};
globalThis.requestAnimationFrame = () => 0;

await import("../src/main.js");

if (!getElement("#worldCanvas").width || !getElement("#historyCanvas").width) {
  throw new Error("Canvas dimensions were not initialized.");
}

const api = globalThis.__BIOME_TACTICS__;
if (!api?.sim?.league) {
  throw new Error("Self-play league API was not initialized.");
}

api.trainLeagueGenerations(1);
if (api.sim.league.generation < 1 || api.sim.league.rollouts < 30000) {
  throw new Error("Self-play league did not complete a shadow rollout generation.");
}

console.log("Smoke test passed: app initialized, canvas booted, and self-play league trained one generation.");
