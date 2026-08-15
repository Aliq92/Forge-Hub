// Central configuration for the ecosystem simulation.
// Tweak these values to change how the simulation behaves.

export const CONFIG = {
  prey: {
    startCount: 150,
    maxCount: 500,          // hard cap so runaway reproduction can't tank performance
    maxSpeed: 1.6,
    turnRate: 0.18,          // max radians the heading can change per frame
    wanderJitter: 0.35,      // randomness added to heading each frame while wandering
    visionRadius: 90,        // how far prey can see food
    predatorDetectionRadius: 130, // how far prey can detect predators and flee
    size: 3.2,
    color: '#5CFFC7',
    glowColor: 'rgba(92, 255, 199, 0.55)',

    energyMax: 100,
    energyStart: 65,
    energyDrain: 0.045,      // energy lost per frame just from being alive
    fleeEnergyDrainMultiplier: 2.2, // extra drain while fleeing (fleeing is costly)
    energyFromFood: 32,
    eatRadius: 6,

    reproduceEnergyThreshold: 78,
    reproduceCost: 38,
    reproduceCooldownFrames: 240,
  },

  predator: {
    startCount: 20,
    maxCount: 120,
    maxSpeed: 2.05,          // slightly faster than prey
    turnRate: 0.14,
    wanderJitter: 0.25,
    visionRadius: 170,       // how far predators can see prey
    size: 6,
    color: '#FF5A3C',
    glowColor: 'rgba(255, 90, 60, 0.55)',

    energyMax: 150,
    energyStart: 90,
    energyDrain: 0.07,
    energyFromPrey: 58,
    killRadius: 8,

    reproduceEnergyThreshold: 115,
    reproduceCost: 55,
    reproduceCooldownFrames: 320,
  },

  food: {
    startCount: 300,
    maxCount: 420,
    size: 2.2,
    color: '#3DDC46',
    glowColor: 'rgba(61, 220, 70, 0.45)',
    energyValue: 32,         // kept in sync with prey.energyFromFood for clarity
    spawnPerFrame: 1.4,      // expected number of new food units spawned per frame
  },

  world: {
    wrapEdges: true,
  },

  simulation: {
    speeds: [0.5, 1, 2, 4],
    defaultSpeedIndex: 1,
  },
};
