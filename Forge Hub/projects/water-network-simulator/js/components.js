/* components.js
   Constants, id prefixes, default property factories, and status thresholds
   shared across the Water Network Simulator. */
window.WNS = window.WNS || {};

(function (WNS) {
  'use strict';

  const Components = {};

  Components.TYPES = ['reservoir', 'pump', 'tank', 'junction', 'demand', 'valve'];

  Components.idPrefix = {
    reservoir: 'R',
    pump: 'PU',
    tank: 'T',
    junction: 'J',
    demand: 'D',
    valve: 'V',
    pipe: 'P'
  };

  Components.typeLabel = {
    reservoir: 'Reservoir',
    pump: 'Pump',
    tank: 'Storage Tank',
    junction: 'Junction',
    demand: 'Demand Node',
    valve: 'Valve',
    pipe: 'Pipe'
  };

  // ---- Hydraulic tuning constants -----------------------------------
  Components.HYD = {
    PIPE_K: 6.5e6,        // resistance constant: R = K * length(m) / diameter(mm)^4.8
    DIAM_EXP: 4.8,
    QMIN: 0.05,           // L/s floor used when linearizing conductance
    GMIN: 1e-5,
    GMAX: 50,
    INNER_ITERS: 30,
    OUTER_ITERS: 8,
    SOR_FACTOR: 0.55,
    HEAD_CLAMP_MIN: -80,
    HEAD_CLAMP_MAX: 400,
    FLOW_CLAMP: 800,      // L/s safety clamp on any single pipe flow
    VALVE_MIN_OPEN: 0.02, // fraction, avoids divide by zero when fully closed
    BREAK_R_MULT: 250,    // resistance multiplier applied to a broken pipe
    LEAK_COEFF: 0.6,      // L/s per sqrt(m head) at severity = 1
    PDA_HFULL: 18,        // meters head at which demand is 100% satisfied
    PDA_HZERO: 0,         // meters head at/below which supply is 0
    PUMP_MAX_BOOST_HEADROOM: 300
  };

  // ---- Pressure status thresholds (meters of head above elevation) --
  Components.PRESSURE_THRESHOLDS = {
    CRITICAL: 5,   // <= this => CRITICAL (if > 0)
    LOW: 15,       // <= this => LOW
    HIGH: 45       // >= this => HIGH, between LOW..HIGH => NORMAL
  };

  Components.pressureStatus = function (pressure, hasSupplyPath) {
    if (!hasSupplyPath) return 'NO SUPPLY';
    if (pressure <= 0) return 'NO SUPPLY';
    if (pressure <= Components.PRESSURE_THRESHOLDS.CRITICAL) return 'CRITICAL';
    if (pressure <= Components.PRESSURE_THRESHOLDS.LOW) return 'LOW';
    if (pressure >= Components.PRESSURE_THRESHOLDS.HIGH) return 'HIGH';
    return 'NORMAL';
  };

  Components.DEMAND_TYPES = {
    residential: { label: 'Residential', base: 6 },
    commercial: { label: 'Commercial', base: 14 },
    industrial: { label: 'Industrial', base: 30 },
    generic: { label: 'Generic', base: 10 }
  };

  // ---- Default property factories ------------------------------------
  Components.defaults = function (type) {
    switch (type) {
      case 'reservoir':
        return {
          name: 'Reservoir',
          elevation: 0,
          sourceHead: 60,
          capacity: Infinity,
          sourceLossActive: false,
          sourceLossFactor: 0.3
        };
      case 'pump':
        return {
          name: 'Pump',
          elevation: 0,
          enabled: true,
          pressureBoost: 25,
          maxFlow: 60,
          efficiency: 0.75,
          failed: false,
          autoControl: { enabled: false, tankId: null, startBelow: 30, stopAbove: 90 }
        };
      case 'tank':
        return {
          name: 'Tank',
          elevation: 5,
          capacity: 40000, // liters
          currentVolume: 20000,
          minLevel: 0,
          maxLevel: 8, // meters of water column
          level: 0,
          fillPercent: 50,
          netFlow: 0
        };
      case 'junction':
        return {
          name: 'Junction',
          elevation: 0
        };
      case 'demand':
        return {
          name: 'Demand',
          elevation: 0,
          demandType: 'residential',
          baseDemand: Components.DEMAND_TYPES.residential.base,
          priority: 'normal',
          surgeActive: false,
          surgeMultiplier: 3,
          requiredDemand: 0,
          suppliedFlow: 0,
          supplyPercent: 0
        };
      case 'valve':
        return {
          name: 'Valve',
          elevation: 0,
          open: 100,
          closedByFailure: false
        };
      default:
        return { name: type };
    }
  };

  Components.pipeDefaults = function () {
    return {
      name: '',
      length: 200,
      diameter: 150,
      enabled: true,
      leak: { active: false, severity: 0.4 },
      broken: false
    };
  };

  // ---- Simple icon color palette (also used by renderer) -------------
  Components.colors = {
    reservoir: '#37b6ff',
    pump: '#ffb84d',
    tank: '#66e0a3',
    junction: '#9aa7bd',
    demand: '#ff7a7a',
    valve: '#c98bff',
    pipeNormal: '#4d7fa8',
    pipeHigh: '#e0c95c',
    pipeOverload: '#ff5c5c',
    pipeClosed: '#54607a',
    pipeLeak: '#ff9d3c',
    pipeBroken: '#ff2d2d',
    pipeNoFlow: '#3a4658'
  };

  WNS.Components = Components;
})(window.WNS);
