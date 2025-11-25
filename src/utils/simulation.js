/**
 * Solar System Simulation Engine
 * Calculates generation, efficiency, and 25-year ROI projections
 * Ported from solar-board.html with Supabase integration
 */

/**
 * Run complete system simulation
 * @param {Array} objects - All canvas objects
 * @param {Array} wires - All wire connections
 * @param {Object} params - Simulation parameters
 * @returns {Object} Simulation results
 */
export function runSimulation(objects, wires, params) {
  let {
    baseLoad = 500, // units/month
    gridRate = 8.5, // ₹/unit
    systemCost = 0, // ₹
    isCommercial = false,
    extraCostItems = [],
  } = params;

  // Extract equipment from objects
  const panels = objects.filter(o => o.type === 'panel' || o.type === 'Solar Panel');
  const inverters = objects.filter(o => o.type === 'inverter' || o.type === 'Inverter');
  const batteries = objects.filter(o => o.type === 'battery' || o.type === 'Battery');
  const loadBoxes = objects.filter(o => o.type === 'load');

  // Calculate system size
  const dcCapacityKwp = panels.reduce((sum, p) => sum + (p.watts || 0), 0) / 1000;
  const acCapacityKw = inverters.reduce((sum, i) => sum + (i.capKw || 0), 0);
  const batteryCapacityKwh = batteries.reduce((sum, b) => sum + (b.capKwh || 0), 0);

  // Check if system exists
  if (dcCapacityKwp === 0) {
    return {
      valid: false,
      message: 'No solar panels in design',
      score: 0,
      dcCapacity: 0,
      acCapacity: 0,
      batteryCapacity: 0,
      batteryBackupHours: 0,
      annualGeneration: 0,
      shadowLoss: 0,
      monthlyData: [],
      yearlyData: [],
      issues: ['ERROR: No solar panels in design'],
      validations: [],
    };
  }

  // Total load (base + load boxes)
  const totalMonthlyLoad = baseLoad + loadBoxes.reduce((sum, b) => sum + (b.units || 0), 0);

  // Validation checks
  const { issues, validations } = validateSystem(objects, wires);

  // Calculate yearly shadow loss
  const shadowLossPct = calculateYearlyShadowLoss(objects);
  const shadowLossFactor = 1 - shadowLossPct;

  // Monthly simulation with seasonality
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const seasonality = [0.8, 0.9, 1.1, 1.2, 1.25, 1.1, 1.0, 0.95, 0.95, 1.0, 0.9, 0.8];

  const monthlyData = [];
  let totalAnnualGen = 0;
  const monthlyGenData = [];
  const monthlyLossData = [];

  months.forEach((month, i) => {
    // Potential generation based on capacity, seasonality, and 4.5 peak sun hours average
    const potentialGen = dcCapacityKwp * 4.5 * 30 * seasonality[i];
    const actualGen = potentialGen * shadowLossFactor;
    const shadowLoss = potentialGen - actualGen;

    monthlyGenData.push(actualGen);
    monthlyLossData.push(shadowLoss);
    totalAnnualGen += actualGen;

    // Net export/import
    const netExport = actualGen - totalMonthlyLoad;

    // Net metering: Income from generated power
    const netMeteringIncome = actualGen * gridRate;

    // Gross metering: All generation is sold
    const grossMeteringIncome = actualGen * gridRate;

    monthlyData.push({
      month,
      generation: actualGen,
      load: totalMonthlyLoad,
      netExport,
      netMeteringIncome,
      grossMeteringIncome,
      shadowLoss,
    });
  });

  // 25-year projection
  const yearlyData = [];
  let cumulativeSavings = 0;
  let breakEvenYear = null;
  let breakEvenMonth = 0;

  // Calculate performance score
  const issueCount = issues.filter(i => i.startsWith('ERROR')).length;
  const checklistScore = Math.max(0, 100 - (issueCount * 20));
  const efficiencyScore = Math.round(checklistScore * shadowLossFactor);

  // Optimization Suggestions
  const suggestions = [];
  if (shadowLossPct > 0.05) suggestions.push("High shadow loss detected (>5%). Consider relocating panels to reduce shading.");
  if (acCapacityKw > 0 && dcCapacityKwp / acCapacityKw > 1.5) suggestions.push("Inverter undersized (DC:AC > 1.5). Consider upgrading inverter to avoid clipping.");
  if (acCapacityKw > 0 && dcCapacityKwp / acCapacityKw < 1.0) suggestions.push("Inverter oversized (DC:AC < 1.0). You can add more panels to maximize inverter utilization.");
  if (batteryCapacityKwh === 0 && !isCommercial) suggestions.push("Consider adding a battery for backup during power outages.");
  if (efficiencyScore < 50) suggestions.push("System efficiency is low. Check connections and potential shading issues.");
  if (dcCapacityKwp > 0 && acCapacityKw === 0) suggestions.push("No Inverter detected. System will not function.");

  // Auto-calculate system cost if not provided
  if (!systemCost || systemCost === 0) {
    // Calculate structure cost based on mounting type
    const structureCost = panels.reduce((sum, p) => {
      const type = p.mountingType || 'ground';
      const costPerPanel = type === 'rcc' ? 1000 : type === 'tinshed' ? 1500 : 2000;
      return sum + costPerPanel;
    }, 0);

    const extraCost = extraCostItems.reduce((s, i) => s + (i.cost || 0), 0);

    const componentCost = panels.reduce((s, p) => s + (p.cost || 0), 0) +
      inverters.reduce((s, i) => s + (i.cost || 0), 0) +
      batteries.reduce((s, b) => s + (b.cost || 0), 0) +
      wires.length * 500 + // Estimate wire cost
      structureCost +
      extraCost;

    // If component cost is low (e.g. no costs assigned), use benchmark
    if (componentCost < 1000 && dcCapacityKwp > 0) {
      systemCost = dcCapacityKwp * 45000; // Fallback ₹45k/kWp
    } else {
      systemCost = componentCost;
    }
  }

  // Generate BOQ
  const boq = {};
  objects.forEach(o => {
    // Skip grid/ground objects if needed, but usually we want everything
    if (o.type === 'grid') return;
    const key = o.label || o.type;
    if (!boq[key]) boq[key] = { count: 0, cost: 0, type: o.type };
    boq[key].count++;
    boq[key].cost += (o.cost || 0);
  });

  // Add structure cost to BOQ
  if (panels.length > 0) {
    const rccCount = panels.filter(p => p.mountingType === 'rcc').length;
    const tinCount = panels.filter(p => p.mountingType === 'tinshed').length;
    const groundCount = panels.filter(p => !p.mountingType || p.mountingType === 'ground').length;

    if (rccCount > 0) boq['Structure (RCC)'] = { count: rccCount, cost: rccCount * 1000, type: 'structure' };
    if (tinCount > 0) boq['Structure (Tin Shed)'] = { count: tinCount, cost: tinCount * 1500, type: 'structure' };
    if (groundCount > 0) boq['Structure (Ground)'] = { count: groundCount, cost: groundCount * 2000, type: 'structure' };
  }

  // Add extra items to BOQ
  extraCostItems.forEach(item => {
    boq[item.label] = { count: 1, cost: item.cost, type: 'extra' };
  });

  if (wires.length > 0) {
    boq['DC/AC Wires'] = { count: wires.length, cost: wires.length * 500, type: 'wire' };
  }

  // Battery Backup Estimation (assuming 50% depth of discharge for lead-acid or 80% for Li-ion, using 80% generic)
  // Load is monthly. Avg hourly load = (TotalMonthlyLoad / 30 / 24) kW.
  // Backup Hours = (Battery kWh * 0.8) / Avg Load kW
  const avgLoadKw = totalMonthlyLoad > 0 ? (totalMonthlyLoad / 720) : 0;
  const batteryBackupHours = (avgLoadKw > 0 && batteryCapacityKwh > 0) ? (batteryCapacityKwh * 0.8) / avgLoadKw : 0;

  let bookValue = systemCost;

  for (let y = 1; y <= 25; y++) {
    const degradation = Math.pow(0.995, y - 1); // 0.5% annual degradation
    const yearlyGen = totalAnnualGen * degradation;
    let yearlySavings = yearlyGen * gridRate;
    let adBenefit = 0;

    // Accelerated depreciation benefit for commercial
    // User Requirement: 60% in first year, 40% in following years (WDV method)
    if (isCommercial) {
      const taxRate = 0.30; // Assuming 30% corporate tax bracket
      let depreciation = 0;

      if (y === 1) {
        depreciation = bookValue * 0.60;
      } else {
        depreciation = bookValue * 0.40;
      }

      bookValue -= depreciation;
      adBenefit = depreciation * taxRate;
      yearlySavings += adBenefit;
    }

    const prevCumulative = cumulativeSavings;
    cumulativeSavings += yearlySavings;

    // Determine ROI status & Payback
    let roiStatus = 'Recovering';
    if (!breakEvenYear && cumulativeSavings >= systemCost) {
      roiStatus = 'Break Even';
      breakEvenYear = y;

      // Calculate specific month
      const needed = systemCost - prevCumulative;
      const fraction = needed / yearlySavings;
      breakEvenMonth = Math.ceil(fraction * 12);
    } else if (breakEvenYear && y > breakEvenYear) {
      roiStatus = 'Profitable';
    }

    yearlyData.push({
      year: y,
      generation: yearlyGen,
      savings: yearlySavings,
      adBenefit,
      cumulative: cumulativeSavings,
      roiStatus,
    });
  }

  // Determine verdict
  let verdict = 'Critical Issues';
  if (efficiencyScore > 80) {
    verdict = 'System Optimized';
  } else if (efficiencyScore > 50) {
    verdict = 'Needs Improvement';
  }

  return {
    valid: issueCount === 0,
    verdict,
    score: efficiencyScore,
    dcCapacity: dcCapacityKwp,
    acCapacity: acCapacityKw,
    batteryCapacity: batteryCapacityKwh,
    batteryBackupHours,
    annualGeneration: totalAnnualGen,
    systemCost,
    monthlyData,
    yearlyData,
    boq,
    shadowLoss: shadowLossPct,
    issues,
    validations,
    suggestions,
    breakEvenYear,
    breakEvenMonth,
    monthlyGenData,
    monthlyLossData,
    months,
  };
}

/**
 * Validate electrical connections and system design
 * @param {Array} objects
 * @param {Array} wires
 * @returns {Object} Validation results
 */
export function validateSystem(objects, wires) {
  const issues = [];
  const validations = [];

  // Build adjacency list from wires
  const adj = {};
  wires.forEach(w => {
    const startObj = objects.find(o => o.id === w.from);
    const endObj = objects.find(o => o.id === w.to);

    // Skip if ACDB or LT/HT Panel is OFF
    if (startObj && (startObj.subtype === 'acdb' || startObj.subtype === 'lt_panel' || startObj.type === 'lt_panel' || startObj.type === 'ht_panel') && startObj.isOn === false) return;
    if (endObj && (endObj.subtype === 'acdb' || endObj.subtype === 'lt_panel' || endObj.type === 'lt_panel' || endObj.type === 'ht_panel') && endObj.isOn === false) return;

    if (!adj[w.from]) adj[w.from] = [];
    adj[w.from].push(w.to);
    if (!adj[w.to]) adj[w.to] = [];
    adj[w.to].push(w.from);
  });

  // Check 1: Panels connected to inverter
  const panels = objects.filter(o => o.type === 'panel');
  const inverters = objects.filter(o => o.type === 'inverter');

  let allPanelsConnected = true;
  if (panels.length > 0) {
    panels.forEach(panel => {
      const visited = new Set([panel.id]);
      const queue = [panel.id];
      let foundInverter = false;

      while (queue.length > 0 && !foundInverter) {
        const current = queue.shift();
        const obj = objects.find(o => o.id === current);

        if (obj && obj.type === 'inverter') {
          foundInverter = true;
          break;
        }

        if (adj[current]) {
          adj[current].forEach(neighbor => {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          });
        }
      }

      if (!foundInverter) {
        allPanelsConnected = false;
      }
    });

    if (!allPanelsConnected) {
      issues.push('ERROR: Some panels not connected to Inverter');
    } else {
      validations.push('✓ All panels connected to Inverter');
    }
  }

  // Check 2: Inverter connected to grid
  let invToGrid = true;
  if (inverters.length > 0) {
    inverters.forEach(inverter => {
      const visited = new Set([inverter.id]);
      const queue = [inverter.id];
      let foundGrid = false;

      while (queue.length > 0 && !foundGrid) {
        const current = queue.shift();
        const obj = objects.find(o => o.id === current);

        if (obj && (obj.type === 'grid' || obj.subtype?.includes('meter'))) {
          foundGrid = true;
          break;
        }

        if (adj[current]) {
          adj[current].forEach(neighbor => {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          });
        }
      }

      if (!foundGrid) {
        invToGrid = false;
      }
    });

    if (!invToGrid) {
      issues.push('ERROR: Inverter not connected to Meter/Grid');
    } else {
      validations.push('✓ Inverter connected to Grid');
    }
  }

  // Check 3: Load box connections
  const loadBoxes = objects.filter(o => o.type === 'load');
  if (loadBoxes.length > 0) {
    let allLoadsConnected = true;
    loadBoxes.forEach(load => {
      const visited = new Set([load.id]);
      const queue = [load.id];
      let foundSource = false;

      while (queue.length > 0 && !foundSource) {
        const current = queue.shift();
        const obj = objects.find(o => o.id === current);

        if (obj && (obj.type === 'grid' || obj.type === 'inverter')) {
          foundSource = true;
          break;
        }

        if (adj[current]) {
          adj[current].forEach(neighbor => {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          });
        }
      }

      if (!foundSource) {
        allLoadsConnected = false;
      }
    });

    if (!allLoadsConnected) {
      issues.push('WARNING: Some Load Boxes not connected to Power Source');
    }
  }

  // Check 4: Safety components
  const hasSafety = {
    earthing: objects.some(o => o.subtype === 'earth'),
    lightning: objects.some(o => o.subtype === 'la'),
  };

  if (!hasSafety.earthing) {
    issues.push('WARNING: No earthing pit present');
  } else {
    validations.push('✓ Earthing pit present');
  }

  if (!hasSafety.lightning) {
    issues.push('WARNING: No lightning arrestor present');
  } else {
    validations.push('✓ Lightning arrestor present');
  }

  return { issues, validations };
}

/**
 * Calculate yearly shadow loss using Monte Carlo sampling
 * @param {Array} objects
 * @returns {number} Shadow loss percentage (0-1)
 */
export function calculateYearlyShadowLoss(objects) {
  const panels = objects.filter(o => o.type === 'panel');
  if (panels.length === 0) return 0;

  let totalPanelArea = 0;
  let totalShadowArea = 0;

  // Sample shadow loss across 12 months
  for (let month = 0; month < 12; month++) {
    const shadowVector = getShadowVectorForMonth(month);
    if (!shadowVector) continue;

    panels.forEach(panel => {
      totalPanelArea += panel.w * panel.h;

      // Monte Carlo sampling: random points on panel
      const samples = 5; // 5 samples per panel per month for performance
      let shadedPoints = 0;

      for (let i = 0; i < samples; i++) {
        const px = panel.x + Math.random() * panel.w;
        const py = panel.y + Math.random() * panel.h;

        // Check if in shadow from any object
        let inShadow = false;
        for (const obj of objects) {
          if (obj.id === panel.id) continue;
          if (obj.h_z <= panel.h_z) continue; // Only higher objects cast shadow

          const dh = obj.h_z - panel.h_z;
          const dx = shadowVector.x * dh;
          const dy = shadowVector.y * dh;

          const sx = obj.x + dx;
          const sy = obj.y + dy;

          if (px >= sx && px <= sx + obj.w && py >= sy && py <= sy + obj.h) {
            inShadow = true;
            break;
          }
        }

        if (inShadow) shadedPoints++;
      }

      totalShadowArea += (shadedPoints / samples) * (panel.w * panel.h);
    });
  }

  return totalPanelArea > 0 ? totalShadowArea / totalPanelArea : 0;
}

/**
 * Get shadow vector for a specific month
 * Simplified: assumes consistent elevation throughout day
 * @param {number} month - 0-11
 * @returns {Object} {x, y} shadow direction vector
 */
function getShadowVectorForMonth(month) {
  // Simplistic approach: use noon sun position
  const sunTime = 12; // Noon
  const angle = ((sunTime - 6) / 12) * Math.PI;
  const elevation = Math.sin(((sunTime - 6) / 12) * Math.PI);

  if (elevation < 0.1) return null;

  // Shadow direction (opposite of sun)
  const len = Math.min(3.0, (1 / Math.max(0.15, elevation)) * 0.7);
  return {
    x: -Math.cos(angle) * len,
    y: -Math.sin(angle) * len,
  };
}

/**
 * Calculate ROI metrics
 * @param {Object} simulationResult
 * @returns {Object} ROI metrics
 */
export function calculateROIMetrics(simulationResult) {
  const { yearlyData, systemCost } = simulationResult;

  const breakEven = yearlyData.find(d => d.roiStatus === 'Break Even');
  const totalSavings = yearlyData[yearlyData.length - 1]?.cumulative || 0;
  const roi = systemCost > 0 ? ((totalSavings - systemCost) / systemCost) * 100 : 0;

  return {
    breakEvenYear: breakEven?.year || null,
    totalSavings25Year: totalSavings,
    roi25Year: roi,
    paybackPeriod: yearlyData.find(d => d.cumulative >= systemCost)?.year || null,
  };
}

/**
 * Format currency with INR symbol
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Format energy with appropriate unit
 * @param {number} kwh
 * @returns {string}
 */
export function formatEnergy(kwh) {
  if (kwh >= 1000) {
    return `${(kwh / 1000).toFixed(1)} MWh`;
  }
  return `${Math.round(kwh)} kWh`;
}
