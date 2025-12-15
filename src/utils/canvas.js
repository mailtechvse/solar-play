import { SunCalc } from "./suncalc";

/**
 * Color scheme for canvas rendering
 * Can be switched between dark, light, and sepia modes
 */
export const COLORS = {
  dark: {
    grid: "#374151",
    bg: "#1f2937",
    wire_dc: "#ef4444",
    wire_ac: "#eab308",
    earth: "#16a34a",
    roof: "#6b7280",
    tinshed: "#93c5fd",
    obstacle: "rgba(239, 68, 68, 0.6)",
    shadow: "rgba(0, 0, 0, 0.5)",
    highlight: "rgba(59, 130, 246, 0.4)",
    tree: "rgba(22, 163, 74, 0.8)",
    building: "#475569",
  },
  light: {
    grid: "#e5e7eb",
    bg: "#f9fafb",
    wire_dc: "#dc2626",
    wire_ac: "#d97706",
    earth: "#15803d",
    roof: "#9ca3af",
    tinshed: "#bfdbfe",
    obstacle: "rgba(239, 68, 68, 0.4)",
    shadow: "rgba(0, 0, 0, 0.2)",
    highlight: "rgba(59, 130, 246, 0.4)",
    tree: "rgba(22, 163, 74, 0.6)",
    building: "#64748b",
  },
  sepia: {
    grid: "#d6cbb8",
    bg: "#f5f0e6",
    wire_dc: "#b91c1c",
    wire_ac: "#b45309",
    earth: "#15803d",
    roof: "#a8a29e",
    tinshed: "#dbeafe",
    obstacle: "rgba(185, 28, 28, 0.4)",
    shadow: "rgba(66, 32, 6, 0.2)",
    highlight: "rgba(234, 179, 8, 0.4)",
    tree: "rgba(21, 128, 61, 0.6)",
    building: "#78716c",
  },
};

let currentTheme = COLORS.dark;

/**
 * Switch color theme
 */
export function setColorTheme(theme) {
  currentTheme = COLORS[theme] || COLORS.dark;
}

/**
 * Main canvas rendering function
 * Handles all drawing of grid, objects, wires, shadows, and sun path
 */
export function renderCanvas(canvas, ctx, state) {
  const {
    scale,
    offsetX,
    offsetY,
    showGrid,
    objects,
    wires,
    selectedObjectId,
    additionalSelectedIds,
    sunTime,
    orientation,
    cableMode,
    lat,
    lon,
  } = state;

  // Clear canvas
  ctx.fillStyle = currentTheme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Save context for transformations
  ctx.save();

  // Handle High DPI
  const dpr = window.devicePixelRatio || 1;
  ctx.scale(dpr, dpr);

  // Apply view transformations (pan and zoom)
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Draw grid
  if (showGrid) {
    drawGrid(ctx, canvas, scale, offsetX, offsetY);
  }

  // Draw map overlay if available (from imported buildings)
  if (state.mapImage && state.mapMetersPerPixel) {
    drawMapOverlay(ctx, state.mapImage, state.mapMetersPerPixel, canvas, scale, offsetX, offsetY);
  }

  // Draw wires first (below objects for proper layering)
  wires.forEach((wire) => {
    drawWire(ctx, wire, objects, cableMode, state);
  });

  // Sort objects by h_z (height) for proper depth rendering
  const sortedObjects = [...objects].sort((a, b) => (a.h_z || 0) - (b.h_z || 0));
  const shadowVector = getShadowVector(sunTime, lat, lon, orientation);

  // Calculate effective heights for all objects (considering stacking)
  const effectiveHeights = new Map();
  sortedObjects.forEach((obj) => {
    effectiveHeights.set(obj.id, calculateEffectiveHeight(obj, objects, shadowVector));
  });

  // Group objects by height for proper shadow layering
  const groups = [];
  let currentGroup = [];
  let currentHeight = -1;

  sortedObjects.forEach(obj => {
    const h = obj.h_z || 0;
    if (currentGroup.length === 0 || Math.abs(h - currentHeight) < 0.01) {
      currentGroup.push(obj);
      currentHeight = h;
    } else {
      groups.push(currentGroup);
      currentGroup = [obj];
      currentHeight = h;
    }
  });
  if (currentGroup.length > 0) groups.push(currentGroup);

  // 0. Global Shadow Pass (Absolute Height)
  // Ensures elevated objects cast their full shadow on the ground (e.g. Lift on Building)
  // Fix: Use clipping to prevent "Double Shadow" artifacts where child shadow overlaps parent shadow
  if (shadowVector) {
    sortedObjects.forEach(obj => {
      const relH = obj.relative_h !== undefined ? obj.relative_h : obj.h_z;
      const absH = obj.h_z || 0;

      // Draw absolute shadow if object is elevated relative to ground and is stacked
      if (Math.abs(absH - relH) > 0.01 && absH > 0) {
        // Find Parent (object below this one)
        const parent = sortedObjects.find(p => {
          if (p.id === obj.id) return false;
          if ((p.h_z || 0) >= absH) return false;

          // Check overlap (Area Intersection) matching adjustObjectLayering logic
          const overlapW = Math.max(0, Math.min(obj.x + obj.w, p.x + p.w) - Math.max(obj.x, p.x));
          const overlapH = Math.max(0, Math.min(obj.y + obj.h, p.y + p.h) - Math.max(obj.y, p.y));
          const overlapArea = overlapW * overlapH;
          const objArea = obj.w * obj.h;

          return overlapArea > (objArea * 0.01);
        });

        if (parent) {
          ctx.save();

          // Define Clipping Region: Inverse of Parent's Projected Shadow Top
          // This prevents drawing the child's shadow where the parent's shadow already exists
          const pDx = shadowVector.x * (parent.h_z || 0);
          const pDy = shadowVector.y * (parent.h_z || 0);

          ctx.beginPath();
          // Universe Rect
          const margin = 2000; // Sufficiently large
          ctx.rect(obj.x - margin, obj.y - margin, margin * 2, margin * 2);

          // Hole: Parent's Projected Top (Main shadow body)
          const px = parent.x + pDx;
          const py = parent.y + pDy;
          ctx.rect(px, py, parent.w, parent.h);

          // Use evenodd rule to subtract the parent rect from the universe
          ctx.clip("evenodd");

          drawShadow(ctx, obj, shadowVector, absH);
          ctx.restore();
        } else {
          drawShadow(ctx, obj, shadowVector, absH);
        }
      }
    });
  }

  // Render groups
  groups.forEach(group => {
    // 1. Draw Relative Shadows for ALL objects in this group
    // This ensures shadows are drawn on top of lower layers (e.g. roof or ground)
    if (shadowVector) {
      group.forEach(obj => {
        const relH = obj.relative_h !== undefined ? obj.relative_h : obj.h_z;
        drawShadow(ctx, obj, shadowVector, relH);
      });
    }

    // 2. Draw Objects for this group
    group.forEach(obj => {
      const isSelected = obj.id === selectedObjectId || (additionalSelectedIds || []).includes(obj.id);
      drawObject(ctx, obj, isSelected, scale, offsetX, offsetY, state.showLabels, state.hoveredObjectId);
    });
  });

  // Draw sun direction indicator on the grid
  if (shadowVector && sunTime >= 6 && sunTime <= 18) {
    drawSunDirection(ctx, shadowVector, canvas, scale, offsetX, offsetY);
  }

  // Draw measurement/temp visualization if in measure mode
  if (state.measureStart && state.measureEnd) {
    drawMeasurement(ctx, state.measureStart, state.measureEnd);
  }

  // Draw in-progress drawing
  if (state.drawingMode && state.drawingPoints && state.drawingPoints.length > 0) {
    drawInProgressDrawing(ctx, state.drawingMode, state.drawingPoints, state.drawingPreview);
  }

  // Draw placement ghost
  if (state.drawingPreview && state.drawingPreview.isGhost) {
    ctx.save();
    ctx.globalAlpha = 0.5; // Semi-transparent
    drawObject(ctx, state.drawingPreview, false, scale, offsetX, offsetY);
    ctx.restore();
  }

  // Draw alignment guides (dynamic alignment)
  if (state.alignmentGuides && state.alignmentGuides.length > 0) {
    drawAlignmentGuides(ctx, state.alignmentGuides);
  }

  // Draw distance guides (Smart Guides)
  if (state.distanceGuides && state.distanceGuides.length > 0) {
    drawDistanceGuides(ctx, state.distanceGuides);
  }

  // Draw dimensions
  // Show if global toggle is ON OR if an object is selected (Auto-show for selection)
  if (state.showDimensions || selectedObjectId) {
    drawDimensions(ctx, objects, selectedObjectId, state.showDimensions, scale, offsetX, offsetY);
  }

  // Draw selection box
  if (state.selectionBox) {
    drawSelectionBox(ctx, state.selectionBox);
  }

  // Draw resize handles for selected object
  if (selectedObjectId) {
    const selectedObj = objects.find(o => o.id === selectedObjectId);
    if (selectedObj) {
      drawResizeHandles(ctx, selectedObj);
    }
  }

  // Restore context
  ctx.restore();

  // Draw UI overlays (compass, stats, sun path) on screen space (AFTER restore)
  if (state.showCompass) {
    drawCompass(canvas, ctx, orientation);
  }

  // Draw sun path indicator in screen space
  if (shadowVector && sunTime >= 6 && sunTime <= 18) {
    drawSunPath(ctx, shadowVector, canvas, scale, offsetX, offsetY);
  }

  // Draw rulers on top and left
  drawRulers(canvas, ctx, scale, offsetX, offsetY);
}


/**
 * Draw alignment guides (dashed lines)
 */
function drawAlignmentGuides(ctx, guides) {
  ctx.save();
  ctx.strokeStyle = "#3b82f6"; // Blue
  ctx.lineWidth = 0.05;
  ctx.setLineDash([0.2, 0.2]);

  guides.forEach(guide => {
    ctx.beginPath();
    ctx.moveTo(guide.x1, guide.y1);
    ctx.lineTo(guide.x2, guide.y2);
    ctx.stroke();
  });

  ctx.restore();
}


/**
 * Draw distance guides with labels
 */

function drawDistanceGuides(ctx, guides) {
  // We need to know 'scale' to unscale text. 
  // Since we can't easily change the signature in this "Replace" block comfortably without checking caller,
  // we can infer scale from the matrix (approx).
  // transform.a is scale_x.
  const t = ctx.getTransform();
  // scale is roughly t.a / dpr. 
  // Let's just assume we can get it.
  // Actually, let's just make the Font Size huge? No.

  // Safe approach: Use 1/scale factor.
  // We will assume 'guides' are in World Space.
  const pixelScale = 1 / Math.abs(t.a / (window.devicePixelRatio || 1) || 1); // rough estimate

  // Wait, t.a includes dpr.
  // We want to cancel out t.a (which maps 1 unit -> N pixels).
  // We want text to be 12 pixels high.
  // So WorldHeight = 12 / t.a * dpr? No.
  // WorldHeight * t.a = 12 (screen pixels).
  // WorldHeight = 12 / t.a. 

  const fontSizeWorld = 14 / Math.abs(t.a);
  const font = `bold ${fontSizeWorld}px 'Inter', sans-serif`;

  ctx.save();
  ctx.strokeStyle = "#ef4444";
  ctx.fillStyle = "#ef4444";
  ctx.lineWidth = 0.05;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  guides.forEach(guide => {
    // Line
    ctx.beginPath();
    ctx.moveTo(guide.x1, guide.y1);
    ctx.lineTo(guide.x2, guide.y2);
    ctx.stroke();

    // Label
    const midX = (guide.x1 + guide.x2) / 2;
    const midY = (guide.y1 + guide.y2) / 2;

    const textWidth = ctx.measureText(guide.label).width;
    const textHeight = fontSizeWorld * 1.2;

    // Draw background pill
    ctx.save();
    ctx.fillStyle = "rgba(30, 30, 30, 0.85)";
    ctx.beginPath();
    // Use slightly larger padding
    const PadX = fontSizeWorld * 0.4;
    const PadY = fontSizeWorld * 0.2;
    ctx.roundRect(midX - textWidth / 2 - PadX, midY - textHeight / 2 - PadY, textWidth + PadX * 2, textHeight + PadY * 2, fontSizeWorld * 0.3);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#ffffff"; // White Text
    ctx.fillText(guide.label, midX, midY);
  });

  ctx.restore();
}

/**
 * Draw dimensions for all objects (Dimension Sheet Mode)
 * Includes individual sizes AND relative distances between objects
 */
function drawDimensions(ctx, objects, selectedObjectId, showAll, scale, offsetX, offsetY) {
  ctx.save();
  ctx.strokeStyle = "#6b7280";
  ctx.fillStyle = "#6b7280";
  ctx.lineWidth = 0.03;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const drawChainDim = (start, end, text, axisPos, isVert) => {
    // ... Existing logic, updated for robustness ...
    // ...
  };

  // To avoid copy-pasting the massive drawChainDim helper inside this constrained replacement,
  // I will focus on the loop logic where axisPos is calculated.
  // But wait, the helper IS defined inside.

  // Re-defining drawChainDim to be cleaner
  const renderChainHelper = (points, axisPos, isVert) => {
    const sorted = points.filter(p => p && p.val !== null).sort((a, b) => a.val - b.val);
    if (sorted.length < 2) return;

    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 0.04;
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 2;

    const startMain = sorted[0];
    const endMain = sorted[sorted.length - 1];
    const sMain = isVert ? { x: axisPos, y: startMain.val } : { x: startMain.val, y: axisPos };
    const eMain = isVert ? { x: axisPos, y: endMain.val } : { x: endMain.val, y: axisPos };

    ctx.beginPath();
    ctx.moveTo(sMain.x, sMain.y); ctx.lineTo(eMain.x, eMain.y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    sorted.forEach(p => {
      const val = p.val;
      const lvl = p.level;
      const t = 0.08;
      ctx.beginPath();
      if (!isVert) {
        ctx.moveTo(val - t, axisPos - t); ctx.lineTo(val + t, axisPos + t); // Tick
      } else {
        ctx.moveTo(axisPos - t, val + t); ctx.lineTo(axisPos + t, val - t); // Tick
      }
      ctx.stroke();

      // Extension Line
      const GAP = 0.05;
      const OVER = 0.15;
      // Direction to draw extension: From Level towards Axis
      // But axis can be on either side.
      const dir = axisPos >= lvl ? 1 : -1;

      ctx.beginPath();
      if (!isVert) {
        // If axis is very close to level (gap < 0.1), don't draw extension line to avoid clutter?
        // Or draw simplified.
        const dist = Math.abs(axisPos - lvl);
        if (dist > 0.1) {
          // Draw full ext
          ctx.moveTo(val, lvl + (GAP * dir));
          ctx.lineTo(val, axisPos + (OVER * dir));
        } else {
          // Just small overlap
          ctx.moveTo(val, lvl);
          ctx.lineTo(val, axisPos + (OVER * dir));
        }
      } else {
        const dist = Math.abs(axisPos - lvl);
        if (dist > 0.1) {
          ctx.moveTo(lvl + (GAP * dir), val);
          ctx.lineTo(axisPos + (OVER * dir), val);
        } else {
          ctx.moveTo(lvl, val);
          ctx.lineTo(axisPos + (OVER * dir), val);
        }
      }
      ctx.stroke();
    });

    for (let i = 0; i < sorted.length - 1; i++) {
      const p1 = sorted[i];
      const p2 = sorted[i + 1];
      const dist = p2.val - p1.val;
      if (dist < 0.01) continue;
      const midVal = (p1.val + p2.val) / 2;

      ctx.restore(); ctx.save();
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 1. Calculate Base Screen Anchor Point (On the Line)
      let baseSx, baseSy, rot;
      if (!isVert) {
        baseSx = (midVal * scale) + offsetX;
        baseSy = (axisPos * scale) + offsetY;
        rot = 0;
      } else {
        baseSx = (axisPos * scale) + offsetX;
        baseSy = (midVal * scale) + offsetY;
        rot = -Math.PI / 2;
      }

      // 2. Determine Screen Space Offset (Staggering)
      const baseOffset = 18; // 18px from line
      const staggerOffset = 34; // 34px from line (staggered)
      // Stagger if segment is small to avoid bunching
      const isTight = dist < 1.25;
      // Logic: If current is tight, check parity.
      // Or simply: if tight, use checkerboard.
      const pixelOffset = (isTight && i % 2 !== 0) ? staggerOffset : baseOffset;

      ctx.translate(baseSx, baseSy);
      ctx.rotate(rot);
      // Move "Above" the line (which is Left for Vertical, Top for Horizontal due to rotation)
      ctx.translate(0, -pixelOffset);

      ctx.font = '700 13px "Inter", sans-serif'; // Bigger, bolder font

      const label = `${dist.toFixed(2)}m`;
      const tw = ctx.measureText(label).width;

      // Draw Text with Outline (No Pill)
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
      ctx.lineWidth = 3;
      ctx.strokeText(label, 0, 1);

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 0, 1);

      ctx.restore(); ctx.save();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.04;
    }
    ctx.restore();
  };

  // 1. Helper: Hit Testing
  const getHit = (dir, obj) => {
    let best = null;
    let minGap = Infinity; // Track gap size
    const EPSILON = 0.05;

    // Find "Context" (Immediate Container)
    let context = null;
    let minContextArea = Infinity;
    const objArea = obj.w * obj.h;

    objects.forEach(o => {
      if (o.id === obj.id) return;
      const oArea = o.w * o.h;
      if (oArea <= objArea) return;

      const overlapX = Math.max(0, Math.min(obj.x + obj.w, o.x + o.w) - Math.max(obj.x, o.x));
      const overlapY = Math.max(0, Math.min(obj.y + obj.h, o.y + o.h) - Math.max(obj.y, o.y));
      const overlapArea = overlapX * overlapY;

      if (overlapArea > objArea * 0.95) { // STRICTER: Must be 95% inside to be considered "Inside"
        if (oArea < minContextArea) {
          minContextArea = oArea;
          context = o;
        }
      }
    });

    if (context) {
      // Internal Dimensions: Anchor strictly to the wall projection aligned with the object
      let target = null;
      if (dir === 'left') {
        // Measure horizontal distance to Context Left Wall
        // Align at object bottom for standard chain
        target = { val: context.x, level: obj.y + obj.h, isWall: true };
        minGap = obj.x - context.x;
      } else if (dir === 'right') {
        // Measure horizontal distance to Context Right Wall
        target = { val: context.x + context.w, level: obj.y + obj.h, isWall: true };
        minGap = (context.x + context.w) - (obj.x + obj.w);
      } else if (dir === 'top') {
        // Measure vertical distance to Context Top Wall
        // Align at object left for standard chain
        target = { val: context.y, level: obj.x, isWall: true };
        minGap = obj.y - context.y;
      } else if (dir === 'bottom') {
        // Measure vertical distance to Context Bottom Wall
        target = { val: context.y + context.h, level: obj.x, isWall: true };
        minGap = (context.y + context.h) - (obj.y + obj.h);
      }

      return { hit: target, minGap };
    }

    // IF NO Context, search Neighbors (standard behavior)
    let bestCandidate = null;
    const candidates = [];

    for (const other of objects) {
      if (other.id === obj.id) continue;

      if (dir === 'left' && other.x + other.w <= obj.x + EPSILON) {
        if (Math.max(0, Math.min(obj.y + obj.h, other.y + other.h) - Math.max(obj.y, other.y)) > 0.05)
          candidates.push({ val: other.x + other.w, level: other.y + other.h, isWall: false });
      }
      else if (dir === 'right' && other.x >= obj.x + obj.w - EPSILON) {
        if (Math.max(0, Math.min(obj.y + obj.h, other.y + other.h) - Math.max(obj.y, other.y)) > 0.05)
          candidates.push({ val: other.x, level: other.y + other.h, isWall: false });
      }
      else if (dir === 'top' && other.y + other.h <= obj.y + EPSILON) {
        if (Math.max(0, Math.min(obj.x + obj.w, other.x + other.w) - Math.max(obj.x, other.x)) > 0.05)
          candidates.push({ val: other.y + other.h, level: other.x, isWall: false });
      }
      else if (dir === 'bottom' && other.y >= obj.y + obj.h - EPSILON) {
        if (Math.max(0, Math.min(obj.x + obj.w, other.x + other.w) - Math.max(obj.x, other.x)) > 0.05)
          candidates.push({ val: other.y, level: other.x, isWall: false });
      }
    }

    if (dir === 'left') {
      candidates.sort((a, b) => b.val - a.val); // Max < Left
      bestCandidate = candidates[0];
      if (bestCandidate) minGap = obj.x - bestCandidate.val;
    } else if (dir === 'right') {
      candidates.sort((a, b) => a.val - b.val); // Min > Right
      bestCandidate = candidates[0];
      if (bestCandidate) minGap = bestCandidate.val - (obj.x + obj.w);
    } else if (dir === 'top') {
      candidates.sort((a, b) => b.val - a.val); // Max < Top
      bestCandidate = candidates[0];
      if (bestCandidate) minGap = obj.y - bestCandidate.val;
    } else if (dir === 'bottom') {
      candidates.sort((a, b) => a.val - b.val); // Min > Bottom
      bestCandidate = candidates[0];
      if (bestCandidate) minGap = bestCandidate.val - (obj.y + obj.h);
    }

    return { hit: bestCandidate || null, minGap };
  };


  objects.forEach(obj => {
    const isSelected = obj.id === selectedObjectId;
    if (!showAll && !isSelected) return;
    if (!obj.w || !obj.h) return;
    if (obj.isGhost && obj.drawingMode) return;

    ctx.save();
    if (obj.rotation) {
      ctx.translate(obj.x + obj.w / 2, obj.y + obj.h / 2);
      ctx.rotate((obj.rotation * Math.PI) / 180);
      ctx.translate(-(obj.x + obj.w / 2), -(obj.y + obj.h / 2));
    }

    const leftData = getHit('left', obj);
    const rightData = getHit('right', obj);
    const topData = getHit('top', obj);
    const bottomData = getHit('bottom', obj);

    // Calculate Dynamic Offset for Rulers
    // Default 0.6, but shrink if gap is small
    const hOffset = Math.min(0.6, Math.max(0.3, bottomData.minGap * 0.6));
    const vOffset = Math.min(0.6, Math.max(0.3, leftData.minGap * 0.6));

    // For Horizontal Chain (Bottom)
    const hPoints = [
      { val: obj.x, level: obj.y + obj.h },
      { val: obj.x + obj.w, level: obj.y + obj.h }
    ];
    if (leftData.hit) hPoints.push(leftData.hit);
    if (rightData.hit) hPoints.push(rightData.hit);

    renderChainHelper(hPoints, obj.y + obj.h + hOffset, false);

    // For Vertical Chain (Left)
    const vPoints = [
      { val: obj.y, level: obj.x },
      { val: obj.y + obj.h, level: obj.x }
    ];
    if (topData.hit) vPoints.push(topData.hit);
    if (bottomData.hit) vPoints.push(bottomData.hit);

    renderChainHelper(vPoints, obj.x - vOffset, true);

    ctx.restore();
  });

  ctx.restore();
}

/**
 * Draw resize handles for selected object
 * 8 handles: 4 corners + 4 edges
 */
function drawResizeHandles(ctx, obj) {
  if (!obj || !obj.w || !obj.h) return;

  ctx.save();

  const handleSize = 0.3; // Size in meters
  const x = obj.x;
  const y = obj.y;
  const w = obj.w;
  const h = obj.h;

  // Define handle positions
  const handles = [
    { x: x, y: y, type: 'nw' },                    // Top-left
    { x: x + w / 2, y: y, type: 'n' },            // Top-center
    { x: x + w, y: y, type: 'ne' },               // Top-right
    { x: x + w, y: y + h / 2, type: 'e' },        // Middle-right
    { x: x + w, y: y + h, type: 'se' },           // Bottom-right
    { x: x + w / 2, y: y + h, type: 's' },        // Bottom-center
    { x: x, y: y + h, type: 'sw' },               // Bottom-left
    { x: x, y: y + h / 2, type: 'w' },            // Middle-left
  ];

  // Draw each handle
  handles.forEach(handle => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 0.05;

    ctx.fillRect(
      handle.x - handleSize / 2,
      handle.y - handleSize / 2,
      handleSize,
      handleSize
    );
    ctx.strokeRect(
      handle.x - handleSize / 2,
      handle.y - handleSize / 2,
      handleSize,
      handleSize
    );
  });

  ctx.restore();
}

/**
 * Draw grid with 1m spacing
 */
function drawGrid(ctx, canvas, scale, offsetX, offsetY) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  const gridSize = 1; // 1 meter
  const majorGridSize = 5; // Major grid every 5 meters

  const startX = Math.floor(-offsetX / scale / gridSize) * gridSize;
  const startY = Math.floor(-offsetY / scale / gridSize) * gridSize;
  const endX = startX + width / scale / gridSize + 2;
  const endY = startY + height / scale / gridSize + 2;

  // Draw minor grid lines
  ctx.strokeStyle = currentTheme.grid;
  ctx.lineWidth = 0.03;
  ctx.globalAlpha = 0.4;

  for (let x = startX; x < endX; x += gridSize) {
    // Skip if this is a major grid line (will draw separately)
    if (x % majorGridSize !== 0) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
  }

  for (let y = startY; y < endY; y += gridSize) {
    // Skip if this is a major grid line (will draw separately)
    if (y % majorGridSize !== 0) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
  }

  // Draw major grid lines (every 5 meters) - more visible
  ctx.strokeStyle = currentTheme.grid;
  ctx.lineWidth = 0.08;
  ctx.globalAlpha = 0.8;

  for (let x = Math.ceil(startX / majorGridSize) * majorGridSize; x < endX; x += majorGridSize) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }

  for (let y = Math.ceil(startY / majorGridSize) * majorGridSize; y < endY; y += majorGridSize) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

const textureCache = new Map();

/**
 * Draw individual object with proper styling based on type
 */
function drawObject(ctx, obj, isSelected, scale, offsetX, offsetY, showLabels = true, hoveredObjectId = null) {
  ctx.save();

  const screenX = (obj.x * scale) + offsetX;
  const screenY = (obj.y * scale) + offsetY;
  const screenW = obj.w * scale;
  const screenH = obj.h * scale;

  // Apply rotation if specified (only for rectangles for now)
  if (obj.rotation && obj.type !== "polygon") {
    ctx.translate(obj.x + obj.w / 2, obj.y + obj.h / 2);
    ctx.rotate((obj.rotation * Math.PI) / 180);
    ctx.translate(-(obj.x + obj.w / 2), -(obj.y + obj.h / 2));
  }

  // Determine color based on type
  let fillColor = obj.color || "#1e3a8a";

  // Visual feedback for De-energized state (Power Outage / Disconnected)
  const ELECTRICAL_TYPES = [
    'grid', 'panel', 'battery', 'load', 'inverter', 'meter', 'net_meter', 'gross_meter',
    'vcb', 'acb', 'lt_panel', 'ht_panel', 'transformer', 'acdb', 'bess', 'pss'
  ];

  if (ELECTRICAL_TYPES.includes(obj.type)) {
    // If explicitly de-energized (and not undefined, which implies not processed yet)
    if (obj.isEnergized === false) {
      if (obj.type === 'vcb' || obj.type === 'acb') {
        // VCB/ACB should turn RED to indicate failure/loss of power/trip condition clearly
        // Or should it be Grey? User asked: "In case of outage, the VCB should switch over to red"
        fillColor = "#ef4444"; // Red
      } else {
        fillColor = "#475569"; // Slate 600 (Grey) for others
      }
    }
  }

  const points = obj.points || obj.vertices;

  if ((obj.type === "polygon" || obj.isPolygon) && points && points.length > 0) {
    // Draw Polygon - vertices are relative to obj.x, obj.y
    ctx.beginPath();
    ctx.moveTo(obj.x + points[0].x, obj.y + points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(obj.x + points[i].x, obj.y + points[i].y);
    }
    ctx.closePath();

    if (obj.texture) {
      let img = textureCache.get(obj.id);
      if (!img) {
        img = new Image();
        img.src = obj.texture;
        textureCache.set(obj.id, img);
      }

      if (img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.clip(); // Clip to polygon path
        // Draw image stretched to bounding box
        ctx.drawImage(img, obj.x, obj.y, obj.w, obj.h);
        ctx.restore();
      } else {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
    } else {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }

    // Draw border
    ctx.strokeStyle = isSelected ? "#3b82f6" : adjustColor(fillColor, -40);
    ctx.lineWidth = isSelected ? 0.08 : 0.02;

    // Visual feedback for Tripped/OFF state
    if (obj.isOn === false) {
      ctx.strokeStyle = "#ef4444"; // Red
      ctx.lineWidth = 0.1;
    }

    ctx.stroke();
    ctx.stroke();

    // Add selection highlight
    if (isSelected) {
      ctx.strokeStyle = "rgba(59, 130, 246, 0.5)";
      ctx.lineWidth = 0.15;
      ctx.stroke();
    }
  } else {
    // Draw Rectangle (default)
    ctx.fillStyle = fillColor;
    ctx.fillRect(obj.x, obj.y, obj.w, obj.h);

    // Draw border - thicker if selected
    ctx.strokeStyle = isSelected ? "#3b82f6" : adjustColor(fillColor, -40);
    ctx.lineWidth = isSelected ? 0.08 : 0.02;
    ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);

    // Add selection highlight
    // Add selection highlight
    if (isSelected) {
      ctx.strokeStyle = "rgba(59, 130, 246, 0.5)";
      ctx.lineWidth = 0.15;
      ctx.strokeRect(obj.x - 0.1, obj.y - 0.1, obj.w + 0.2, obj.h + 0.2);
    }

    // Visual feedback for Power Status (ON/OFF)
    if (['vcb', 'acb', 'lt_panel', 'ht_panel', 'acdb', 'grid'].includes(obj.type)) {
      const statusColor = obj.isOn !== false ? "#22c55e" : "#ef4444"; // Green or Red
      ctx.beginPath();
      ctx.arc(obj.x + obj.w - 0.3, obj.y + 0.3, 0.15, 0, 2 * Math.PI);
      ctx.fillStyle = statusColor;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.02;
      ctx.stroke();
    }
  }

  // Draw type-specific icons/content (only for rects or center of poly)
  // Draw Content (Labels, Icons)
  // Content is drawn in Screen Space to remain sharp
  drawObjectContent(ctx, obj, scale, offsetX, offsetY, showLabels, hoveredObjectId);

  ctx.restore();
}

/**
 * Draw object-specific content (labels, icons, specs)
 */
/**
 * Draw object-specific content (labels, icons, specs)
 */
function drawObjectContent(ctx, obj, scale = 1, offsetX = 0, offsetY = 0, showLabels = true, hoveredObjectId = null) {
  // Constants for screen-space sizes (in pixels)
  const SCREEN_FONT_SIZE = 14;
  const SCREEN_PADDING_X = 8;
  const SCREEN_PADDING_Y = 4;
  const SCREEN_RADIUS = 4;

  // Calculate screen coordinates for the object center
  // We use these to draw text in screen space for maximum crispness
  const centerX = obj.x + obj.w / 2;
  const centerY = obj.y + obj.h / 2;

  const isHovered = hoveredObjectId === obj.id;
  const shouldShowLabel = showLabels || isHovered;

  // Prepare lines of text
  const lines = [];
  if (shouldShowLabel && obj.label) {
    if (isHovered && !showLabels) {
      // If showing only because of hover, we might want to style it differently (e.g. side tooltip)
      // For now, let's just show it normally but maybe with a different color/opacity
      lines.push({ text: obj.label, size: SCREEN_FONT_SIZE, weight: "600", isHoverTooltip: true });
    } else {
      lines.push({ text: obj.label, size: SCREEN_FONT_SIZE, weight: "600" });
    }
  }

  // Specs text
  let specText = "";
  let specColor = "#ffffff"; // Default white
  let isDigital = false;
  let showBatteryBar = false;

  if (obj.type === "panel" && obj.watts) specText = `${obj.watts}W`;
  else if (obj.type === "inverter" && obj.capKw) specText = `${obj.capKw}kW`;
  else if (obj.type === "battery" || obj.type === "bess") {
    const cap = obj.capKwh || (obj.specifications?.battery_capacity || 0);
    specText = `${cap}kWh`;
    showBatteryBar = true;
  }
  else if (obj.type === "load" && obj.units) specText = `${obj.units}U`;
  else if (obj.type === "grid") {
    if (obj.isOutage) {
      specText = "OUTAGE";
      specColor = "#ef4444";
    }
  }
  else if ((obj.type === "vcb" || obj.type === "acb")) {
    if (obj.isOn === false) {
      specText = "TRIPPED";
      specColor = "#ef4444";
    } else if (obj.isEnergized === false) {
      // If it's ON but de-energized (e.g. grid outage), show status
      specText = "NO POWER";
      specColor = "#f59e0b"; // Amber
    }
  }
  else if (obj.type === "net_meter" || obj.type === "gross_meter") {
    specText = `${(obj.reading || 0).toFixed(2)} kWh`;
    specColor = "#10b981"; // Emerald
    isDigital = true;
  }

  // Calculate dimensions
  let totalHeight = 0;
  let maxWidth = 0;

  // Measure Label
  if (lines.length > 0) {
    ctx.font = `${lines[0].weight} ${lines[0].size}px "Inter", system-ui, -apple-system, sans-serif`;
    const m = ctx.measureText(lines[0].text);
    maxWidth = Math.max(maxWidth, m.width);
    totalHeight += lines[0].size * 1.2;
  }

  // Measure Spec Text
  if (specText) {
    const size = SCREEN_FONT_SIZE * 0.85;
    const font = isDigital
      ? `700 ${size}px "Courier New", monospace`
      : `500 ${size}px "Inter", system-ui, -apple-system, sans-serif`;
    ctx.font = font;
    const m = ctx.measureText(specText);
    maxWidth = Math.max(maxWidth, m.width);
    totalHeight += size * 1.2;
  }

  // Measure Battery Bar
  let barHeight = 0;
  let barWidth = 0;
  if (showBatteryBar) {
    barWidth = (obj.w * scale) * 0.8; // 80% of object width (in screen pixels)
    barHeight = SCREEN_FONT_SIZE * 0.6;
    maxWidth = Math.max(maxWidth, barWidth);
    totalHeight += barHeight + SCREEN_PADDING_Y;
  }

  if (lines.length === 0 && !specText && !showBatteryBar) return;

  // Draw background pill
  const bgWidth = maxWidth + (SCREEN_PADDING_X * 2);
  const bgHeight = totalHeight + (SCREEN_PADDING_Y * 2);

  // Switch to Screen Space
  ctx.save();
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Reset to DPR-scaled screen space

  // Calculate screen position
  let screenX = (centerX * scale) + offsetX;
  const screenY = (centerY * scale) + offsetY;

  // If showing as a hover tooltip, position it to the right of the object
  if (lines.length > 0 && lines[0].isHoverTooltip) {
    const objRightScreen = ((obj.x + obj.w) * scale) + offsetX;
    screenX = objRightScreen + 10 + (bgWidth / 2);
  }

  const bgX = screenX - bgWidth / 2;
  const bgY = screenY - bgHeight / 2;

  ctx.fillStyle = "rgba(175, 138, 138, 0.85)"; // Neutral black background
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;

  // Rounded Rect
  ctx.beginPath();
  ctx.roundRect(bgX, bgY, bgWidth, bgHeight, SCREEN_RADIUS);
  ctx.fill();

  // Border
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.shadowColor = "transparent";

  // Draw Content
  let currentY = bgY + SCREEN_PADDING_Y;

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // 1. Label
  if (lines.length > 0) {
    const line = lines[0];
    ctx.font = `${line.weight} ${line.size}px "Inter", system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line.text, screenX, currentY);
    currentY += line.size * 1.2;
  }

  // 2. Spec Text (Meter Reading / Capacity / Status)
  if (specText) {
    const size = SCREEN_FONT_SIZE * 0.85;
    ctx.font = isDigital
      ? `700 ${size}px "Courier New", monospace`
      : `500 ${size}px "Inter", system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = specColor;
    ctx.fillText(specText, screenX, currentY);
    currentY += size * 1.2;
  }

  // 3. Battery Bar
  if (showBatteryBar) {
    const soc = obj.soc !== undefined ? obj.soc : 0;
    const barY = currentY + (SCREEN_PADDING_Y / 2);

    // Background track
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    ctx.roundRect(screenX - barWidth / 2, barY, barWidth, barHeight, barHeight / 2);
    ctx.fill();

    // Fill
    let barColor = "#22c55e"; // Green
    if (soc < 20) barColor = "#ef4444"; // Red
    else if (soc < 50) barColor = "#eab308"; // Yellow

    ctx.fillStyle = barColor;
    ctx.beginPath();
    const fillWidth = Math.max(0, (soc / 100) * barWidth);
    ctx.roundRect(screenX - barWidth / 2, barY, fillWidth, barHeight, barHeight / 2);
    ctx.fill();

    // Text %
    ctx.font = `600 ${barHeight * 0.8}px "Inter", sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(`${soc.toFixed(0)}%`, screenX, barY + barHeight / 2);
  }

  ctx.restore();
}

/**
 * Draw wire connections between objects
 * Supports both straight and orthogonal routing
 */
function drawWire(ctx, wire, objects, cableMode = "straight", state = {}) {
  const fromObj = objects.find((o) => o.id === wire.from);
  const toObj = objects.find((o) => o.id === wire.to);

  if (!fromObj || !toObj) return;

  const fromX = fromObj.x + fromObj.w / 2;
  const fromY = fromObj.y + fromObj.h / 2;
  const toX = toObj.x + toObj.w / 2;
  const toY = toObj.y + toObj.h / 2;

  // Wire color based on type
  const wireColors = {
    dc: currentTheme.wire_dc,
    ac: currentTheme.wire_ac,
    earth: currentTheme.earth,
  };

  let strokeColor = wireColors[wire.type] || currentTheme.wire_dc;

  // Visual feedback for De-energized wires
  const isDeEnergized = fromObj.isEnergized === false || toObj.isEnergized === false;
  if (isDeEnergized) {
    strokeColor = "#475569"; // Slate 600
  }

  ctx.save(); // Save context for line styles

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 0.08;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Animation Logic
  const flowOffset = state.flowOffset || 0;
  if (flowOffset && !isDeEnergized) {
    ctx.setLineDash([0.2, 0.1]);
    ctx.lineDashOffset = -flowOffset;
    ctx.strokeStyle = "rgba(34, 197, 94, 0.9)"; // Green for active flow
    ctx.lineWidth = 0.15;
  }

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);

  if (cableMode === "ortho" && wire.path && wire.path.length > 0) {
    // Draw orthogonal path with waypoints
    wire.path.forEach((point) => {
      ctx.lineTo(point.x, point.y);
    });
  }

  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.restore(); // Restore context (clears dash, resets color/width)

  // Draw Highlight if Selected
  if (state.selectedWireId === wire.id) {
    ctx.save();
    ctx.strokeStyle = "rgba(59, 130, 246, 0.5)"; // Blue highlight
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    if (cableMode === "ortho" && wire.path && wire.path.length > 0) {
      wire.path.forEach((point) => {
        ctx.lineTo(point.x, point.y);
      });
    }
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.restore();
  }

  // Draw small circles at connection points
  ctx.fillStyle = wireColors[wire.type] || currentTheme.wire_dc;
  ctx.beginPath();
  ctx.arc(fromX, fromY, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(toX, toY, 0.08, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Calculate effective height of an object considering objects beneath it
 * If an object is placed on top of another object, its height should be relative
 * to the base object's height
 */
function calculateEffectiveHeight(obj, allObjects, shadowVector) {
  if (!obj || !obj.h_z) return obj.h_z || 0;

  // Find if this object is on top of another object
  const objCenterX = obj.x + obj.w / 2;
  const objCenterY = obj.y + obj.h / 2;

  let baseHeight = 0;
  let foundBase = false;

  // Check all other objects to see if this object is on top of any
  for (const other of allObjects) {
    if (other.id === obj.id) continue;
    if (!other.h_z || other.h_z === 0) continue;

    // Ignore exact duplicates to prevent accidental double-height shadows
    if (Math.abs(other.x - obj.x) < 0.01 &&
      Math.abs(other.y - obj.y) < 0.01 &&
      Math.abs(other.w - obj.w) < 0.01 &&
      Math.abs(other.h - obj.h) < 0.01) continue;

    // Check overlap (Area Intersection) matching adjustObjectLayering logic
    const overlapW = Math.max(0, Math.min(obj.x + obj.w, other.x + other.w) - Math.max(obj.x, other.x));
    const overlapH = Math.max(0, Math.min(obj.y + obj.h, other.y + other.h) - Math.max(obj.y, other.y));
    const overlapArea = overlapW * overlapH;
    const objArea = obj.w * obj.h;

    const isWithinBounds = overlapArea > (objArea * 0.01);

    if (isWithinBounds) {
      // Object is on top of this base object
      // Use the higher base if multiple objects are stacked
      if (other.h_z > baseHeight) {
        baseHeight = other.h_z;
        foundBase = true;
      }
    }
  }

  if (!foundBase) {
    // Object is on ground, use its own height
    return obj.h_z;
  }

  // Object is on top of another object
  // Check if it's at the edge or center
  if (!shadowVector) {
    return baseHeight + obj.h_z;
  }

  // Calculate shadow distance for the base object
  const baseShadowDist = Math.sqrt(
    Math.pow(shadowVector.x * baseHeight, 2) +
    Math.pow(shadowVector.y * baseHeight, 2)
  );

  // Find the base object again to check edge distance
  for (const other of allObjects) {
    if (other.id === obj.id) continue;
    if (!other.h_z || other.h_z === 0) continue;

    const isWithinBounds =
      objCenterX >= other.x &&
      objCenterX <= other.x + other.w &&
      objCenterY >= other.y &&
      objCenterY <= other.y + other.h;

    if (isWithinBounds && other.h_z === baseHeight) {
      // Calculate distance from object center to nearest edge of base
      const distToLeftEdge = Math.abs(objCenterX - other.x);
      const distToRightEdge = Math.abs(objCenterX - (other.x + other.w));
      const distToTopEdge = Math.abs(objCenterY - other.y);
      const distToBottomEdge = Math.abs(objCenterY - (other.y + other.h));

      const minEdgeDist = Math.min(
        distToLeftEdge,
        distToRightEdge,
        distToTopEdge,
        distToBottomEdge
      );

      // Calculate shadow length of the object on the roof
      const relativeH = obj.h_z - baseHeight;
      const objShadowLen = Math.sqrt(
        Math.pow(shadowVector.x * relativeH, 2) +
        Math.pow(shadowVector.y * relativeH, 2)
      );

      // If object shadow extends beyond the base edge, use absolute height
      if (minEdgeDist < objShadowLen) {
        return obj.h_z;
      } else {
        // Object shadow is contained on the roof, use relative height
        return relativeH;
      }
    }
  }

  return obj.h_z; // Fallback to absolute height
}

/**
 * Draw shadows cast by objects based on sun position
 */


// Helper to draw shadow with correct rotation handling
function drawShadow(ctx, obj, shadowVector, effectiveHeight = null) {
  const height = effectiveHeight !== null ? effectiveHeight : obj.h_z;
  if (!height || height === 0) return;

  ctx.save();

  const isRoof = obj.relative_h && obj.relative_h > 0;
  ctx.globalAlpha = isRoof ? 0.5 : 0.7;
  ctx.fillStyle = currentTheme.shadow;

  // Calculate world space offset
  const worldDx = shadowVector.x * height;
  const worldDy = shadowVector.y * height;

  if ((obj.type === "polygon" || obj.isPolygon) && obj.vertices && obj.vertices.length > 0) {
    drawShadowPolygon(ctx, obj.x, obj.y, obj.vertices, worldDx, worldDy);
  } else {
    // For rectangles, we need to handle rotation carefully.
    // We'll calculate the 4 corners in WORLD space, then project them.

    const cx = obj.x + obj.w / 2;
    const cy = obj.y + obj.h / 2;
    const rad = ((obj.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Helper to rotate point around center
    const rotatePoint = (x, y) => ({
      x: cx + (x - cx) * cos - (y - cy) * sin,
      y: cy + (x - cx) * sin + (y - cy) * cos
    });

    // Base corners in world space
    const p1 = rotatePoint(obj.x, obj.y); // TL
    const p2 = rotatePoint(obj.x + obj.w, obj.y); // TR
    const p3 = rotatePoint(obj.x + obj.w, obj.y + obj.h); // BR
    const p4 = rotatePoint(obj.x, obj.y + obj.h); // BL

    // Projected corners
    const pp1 = { x: p1.x + worldDx, y: p1.y + worldDy };
    const pp2 = { x: p2.x + worldDx, y: p2.y + worldDy };
    const pp3 = { x: p3.x + worldDx, y: p3.y + worldDy };
    const pp4 = { x: p4.x + worldDx, y: p4.y + worldDy };

    // Draw the "Cap" (Projected Top)
    ctx.beginPath();
    ctx.moveTo(pp1.x, pp1.y);
    ctx.lineTo(pp2.x, pp2.y);
    ctx.lineTo(pp3.x, pp3.y);
    ctx.lineTo(pp4.x, pp4.y);
    ctx.closePath();
    ctx.fill();

    // Draw the convex hull of the extrusion (connecting sides)
    // We can just draw the 4 connecting quads. The internal ones will be covered or fill same area.
    // To be cleaner, we should only draw the silhouette, but drawing all 4 quads is easier and correct for filling.

    // Side 1: p1-p2
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(pp2.x, pp2.y);
    ctx.lineTo(pp1.x, pp1.y);
    ctx.closePath();
    ctx.fill();

    // Side 2: p2-p3
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(pp3.x, pp3.y);
    ctx.lineTo(pp2.x, pp2.y);
    ctx.closePath();
    ctx.fill();

    // Side 3: p3-p4
    ctx.beginPath();
    ctx.moveTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.lineTo(pp4.x, pp4.y);
    ctx.lineTo(pp3.x, pp3.y);
    ctx.closePath();
    ctx.fill();

    // Side 4: p4-p1
    ctx.beginPath();
    ctx.moveTo(p4.x, p4.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(pp1.x, pp1.y);
    ctx.lineTo(pp4.x, pp4.y);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw shadow for a polygon object
 * Projects polygon shadow based on offset
 */
function drawShadowPolygon(ctx, baseX, baseY, vertices, dx, dy) {
  if (!vertices || vertices.length < 3) return;

  // For complex polygons, draw the shadow as a filled shape
  // that includes both the projected top and the connecting sides

  // 1. First draw the projected top face ("cap")
  ctx.beginPath();
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const x = baseX + v.x + dx;
    const y = baseY + v.y + dy;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // 2. Draw connecting sides (extrusion) - each as separate fill
  for (let i = 0; i < vertices.length; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % vertices.length];

    const b1 = { x: baseX + v1.x, y: baseY + v1.y };
    const b2 = { x: baseX + v2.x, y: baseY + v2.y };
    const t1 = { x: baseX + v1.x + dx, y: baseY + v1.y + dy };
    const t2 = { x: baseX + v2.x + dx, y: baseY + v2.y + dy };

    ctx.beginPath();
    ctx.moveTo(b1.x, b1.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(t1.x, t1.y);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Calculate shadow vector based on sun position
 * Returns {x, y} representing shadow direction
 * Based on solar-board.html implementation
 */
export function getShadowVector(sunTime, lat = 28.6, lon = 77.2, orientation = 0) {
  // Hybrid approach:
  // 1. Use Simple Linear Angle for Direction (User prefers "South below, North top" consistency)
  const angle = ((sunTime - 6) / 12) * Math.PI + (orientation * Math.PI / 180);

  // 2. Use SunCalc for Altitude (Length) to get physically reasonable shadow lengths
  // We use June 21st (Summer Solstice) to ensure shadows are not excessively long (User complaint)
  const date = new Date();
  date.setMonth(5); // June
  date.setDate(21);
  const hours = Math.floor(sunTime);
  const minutes = (sunTime - hours) * 60;
  date.setHours(hours, minutes, 0, 0);

  const sunPos = SunCalc.getPosition(date, lat, lon);
  const altitude = sunPos.altitude;

  if (altitude < 0.05) return null;

  const safeAlt = Math.max(0.1, altitude);
  let len = 1 / Math.tan(safeAlt);

  // Cap shadow length to avoid unrealistic infinite shadows near sunset/sunrise
  // 5.0 means shadow is 5x the object height (pretty long but readable)
  len = Math.min(len, 5.0);

  return {
    x: -Math.cos(angle) * len,
    y: -Math.sin(angle) * len,
  };
}

/**
 * Draw sun path visualization
 * Shows the sun's position and path arc during the day
 */
function drawSunPath(ctx, shadowVector, canvas, scale, offsetX, offsetY) {
  ctx.save();

  // Fixed screen space position (bottom left corner)
  const dpr = window.devicePixelRatio || 1;
  const height = canvas.height / dpr;

  const padding = 20;
  const cx = padding + 60;
  const cy = height - padding - 20;
  const r = 40;

  // Draw sun path arc (semi-circle from 6 AM to 6 PM)
  ctx.strokeStyle = "rgba(234, 179, 8, 0.3)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0, false);
  ctx.stroke();
  ctx.setLineDash([]);

  // Calculate sun position on the arc based on time of day (6 AM to 6 PM = 0 to Math.PI)
  // shadowVector.angle represents the direction, we need to map it to position on arc
  const angle = Math.atan2(shadowVector.y, shadowVector.x);
  // Map angle to arc position (6 AM = Math.PI, 6 PM = 0)
  const sunX = cx + Math.cos(angle) * r;
  const sunY = cy - Math.sin(angle) * r;

  // Draw sun as a yellow circle with glow effect (fixed screen space)
  ctx.fillStyle = "#fbbf24";
  ctx.shadowColor = "rgba(251, 191, 36, 0.8)";
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Draw time labels
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("6am", cx - r - 5, cy + 12);
  ctx.fillText("6pm", cx + r + 5, cy + 12);
  ctx.fillText("Noon", cx, cy - r - 8);

  ctx.restore();
}

/**
 * Draw compass for orientation reference
 */
function drawCompass(canvas, ctx, orientation = 0) {
  ctx.save();

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  const x = width - 80;
  const y = height - 80;
  const radius = 30;

  ctx.translate(x, y);
  ctx.rotate((orientation * Math.PI) / 180);

  // Draw compass circle
  ctx.strokeStyle = "#666666";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Draw cardinal directions
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText("N", 0, -radius + 8);
  ctx.fillText("S", 0, radius - 8);
  ctx.fillText("E", radius - 8, 0);
  ctx.fillText("W", -radius + 8, 0);

  // Draw north needle
  ctx.strokeStyle = "#ff0000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -radius + 5);
  ctx.lineTo(0, -10);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw measurement visualization (distance tool)
 */
function drawMeasurement(ctx, start, end) {
  if (!start || !end) return;

  ctx.save();

  // Draw line
  ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
  ctx.lineWidth = 0.1;
  ctx.setLineDash([0.2, 0.1]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw points
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.arc(start.x, start.y, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(end.x, end.y, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Draw distance label
  const distance = Math.sqrt(
    Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
  );
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 0.15px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  ctx.fillText(`${distance.toFixed(2)}m`, midX, midY - 0.1);

  ctx.restore();
}


/**
 * Draw map overlay from imported satellite/map image
 */
function drawMapOverlay(ctx, mapImage, metersPerPixel, canvas, scale, offsetX, offsetY) {
  ctx.save();

  // Calculate how to scale and position the map image
  const pixelsPerMeter = 1 / metersPerPixel;
  const mapWidthMeters = mapImage.width * metersPerPixel;
  const mapHeightMeters = mapImage.height * metersPerPixel;

  // Center map at world origin
  ctx.globalAlpha = 0.6;
  ctx.drawImage(
    mapImage,
    -mapWidthMeters / 2,
    -mapHeightMeters / 2,
    mapWidthMeters,
    mapHeightMeters
  );

  ctx.restore();
}

/**
 * Convert screen coordinates to world coordinates
 */
export function screenToWorld(screenX, screenY, offsetX, offsetY, scale) {
  return {
    x: (screenX - offsetX) / scale,
    y: (screenY - offsetY) / scale,
  };
}

/**
 * Convert world coordinates to screen coordinates
 */
export function worldToScreen(worldX, worldY, offsetX, offsetY, scale) {
  return {
    x: worldX * scale + offsetX,
    y: worldY * scale + offsetY,
  };
}

/**
 * Check if a point is inside an object (for hit detection)
 */
export function isPointInObject(point, obj) {
  if (obj.type === "polygon" && obj.points) {
    // Ray casting algorithm for point in polygon
    let inside = false;
    for (let i = 0, j = obj.points.length - 1; i < obj.points.length; j = i++) {
      const xi = obj.points[i].x, yi = obj.points[i].y;
      const xj = obj.points[j].x, yj = obj.points[j].y;

      const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Default rectangle check
  return (
    point.x >= obj.x &&
    point.x <= obj.x + obj.w &&
    point.y >= obj.y &&
    point.y <= obj.y + obj.h
  );
}

/**
 * Find object at screen coordinates
 */
export function getObjectAtScreenPoint(screenX, screenY, objects, offsetX, offsetY, scale) {
  const worldPoint = screenToWorld(screenX, screenY, offsetX, offsetY, scale);

  // Check objects in reverse z-order (top to bottom)
  const sorted = [...objects].sort((a, b) => (b.h_z || 0) - (a.h_z || 0));

  for (const obj of sorted) {
    if (isPointInObject(worldPoint, obj)) {
      return obj;
    }
  }

  return null;
}

/**
 * Calculate orthogonal wire path (L-shaped routing)
 */
export function calculateOrthogonalPath(from, to) {
  const midX = (from.x + to.x) / 2;
  return [{ x: midX, y: from.y }, { x: midX, y: to.y }];
}

/**
 * Draw in-progress drawing (rectangle, polygon, or freehand)
 */
function drawInProgressDrawing(ctx, mode, points, preview) {
  ctx.save();

  if (mode === "rectangle" && points.length >= 2) {
    const start = points[0];
    const end = points[points.length - 1];
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    // Draw semi-transparent rectangle
    ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
    ctx.fillRect(minX, minY, width, height);

    // Draw outline
    ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
    ctx.lineWidth = 0.05;
    ctx.strokeRect(minX, minY, width, height);

    // Draw dimensions
    ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
    ctx.font = "bold 0.3px 'Inter', system-ui, sans-serif";
    ctx.fillText(`${width.toFixed(1)}m x ${height.toFixed(1)}m`, minX + 0.2, minY - 0.1);
  } else if (mode === "polygon" || mode === "freehand") {
    // Draw path points
    for (let i = 0; i < points.length; i++) {
      const point = points[i];

      // Draw point
      ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
      ctx.beginPath();
      ctx.arc(point.x, point.y, 0.15, 0, Math.PI * 2);
      ctx.fill();

      // Draw line to next point
      if (i < points.length - 1) {
        ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(points[i + 1].x, points[i + 1].y);
        ctx.stroke();
      }

      // Draw point number
      if (mode === "polygon") {
        ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
        ctx.font = "bold 0.2px 'Inter', system-ui, sans-serif";
        ctx.fillText(String(i + 1), point.x + 0.2, point.y + 0.2);
      }
    }

    // For preview, draw line to current cursor position if provided
    if (preview && points.length > 0) {
      ctx.strokeStyle = "rgba(59, 130, 246, 0.3)";
      ctx.lineWidth = 0.05;
      ctx.setLineDash([0.1, 0.1]);
      ctx.beginPath();
      ctx.moveTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.lineTo(preview.x, preview.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw preview point
      ctx.fillStyle = "rgba(59, 130, 246, 0.5)";
      ctx.beginPath();
      ctx.arc(preview.x, preview.y, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // For polygon, optionally close the shape to show what it will look like
    if (mode === "polygon" && points.length > 2 && !preview) {
      ctx.strokeStyle = "rgba(59, 130, 246, 0.3)";
      ctx.lineWidth = 0.05;
      ctx.setLineDash([0.1, 0.1]);
      ctx.beginPath();
      ctx.moveTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.lineTo(points[0].x, points[0].y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  ctx.restore();
}

/**
 * Draw rulers on the top and left edges of the canvas
 * Shows meter scale for measurements
 */
function drawRulers(canvas, ctx, scale, offsetX, offsetY) {
  ctx.save();

  // Ruler styling - matching solar-board.html
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  ctx.fillStyle = "#374151"; // Dark gray background for rulers
  ctx.fillRect(0, 0, width, 20); // Top ruler
  ctx.fillRect(0, 0, 20, height); // Left ruler

  ctx.strokeStyle = "#6b7280"; // Grid lines
  ctx.fillStyle = "#9ca3af"; // Text color
  ctx.font = "10px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "center";

  // Draw top ruler ticks and labels
  const startX = Math.floor(-offsetX / scale);
  const endX = Math.ceil((width - offsetX) / scale);

  ctx.beginPath();
  for (let i = startX; i <= endX; i++) {
    const x = i * scale + offsetX;
    if (i % 5 === 0) {
      // Major tick (every 5 meters)
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 15);
      ctx.fillText(i.toString(), x, 12);
    } else {
      // Minor tick (every meter)
      ctx.moveTo(x, 15);
      ctx.lineTo(x, 20);
    }
  }
  ctx.stroke();

  // Draw left ruler ticks and labels
  const startY = Math.floor(-offsetY / scale);
  const endY = Math.ceil((height - offsetY) / scale);

  ctx.beginPath();
  ctx.textAlign = "left";
  for (let i = startY; i <= endY; i++) {
    const y = i * scale + offsetY;
    if (i % 5 === 0) {
      // Major tick (every 5 meters)
      ctx.moveTo(0, y);
      ctx.lineTo(15, y);
      ctx.save();
      ctx.translate(2, y - 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(i.toString(), 0, 10);
      ctx.restore();
    } else {
      // Minor tick (every meter)
      ctx.moveTo(15, y);
      ctx.lineTo(20, y);
    }
  }
  ctx.stroke();

  ctx.restore();
}

/**
 * Helper to darken/lighten color
 */
function adjustColor(color, amount) {
  return color; // Simplified for now, can implement proper color manipulation later
}

/**
 * Draw sun direction indicator on the grid
 * Draws a line from the center of the viewport towards the sun
 */
function drawSunDirection(ctx, shadowVector, canvas, scale, offsetX, offsetY) {
  ctx.save();

  // Calculate center of the viewport in world coordinates
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  const centerX = -offsetX / scale + (width / 2) / scale;
  const centerY = -offsetY / scale + (height / 2) / scale;

  // Shadow vector points AWAY from sun. Sun direction is opposite.
  // Normalize shadow vector to get direction
  const len = Math.sqrt(shadowVector.x * shadowVector.x + shadowVector.y * shadowVector.y);
  if (len < 0.001) {
    ctx.restore();
    return;
  }

  const sunDirX = -shadowVector.x / len;
  const sunDirY = -shadowVector.y / len;

  // Draw a line pointing to the sun
  const lineLength = 10; // 10 meters long line

  ctx.strokeStyle = "rgba(251, 191, 36, 0.6)"; // Yellow
  ctx.lineWidth = 0.1;
  ctx.setLineDash([0.5, 0.2]);

  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + sunDirX * lineLength, centerY + sunDirY * lineLength);
  ctx.stroke();

  // Draw sun icon at the end
  const sunX = centerX + sunDirX * lineLength;
  const sunY = centerY + sunDirY * lineLength;

  ctx.fillStyle = "#fbbf24";
  ctx.shadowColor = "rgba(251, 191, 36, 0.8)";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Get resize handle at a given world point
 * Returns handle type ('nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w') or null
 */
export function getResizeHandleAtPoint(worldX, worldY, obj) {
  if (!obj || !obj.w || !obj.h) return null;

  const handleSize = 0.3;
  const threshold = handleSize / 2;
  const x = obj.x;
  const y = obj.y;
  const w = obj.w;
  const h = obj.h;

  // Define handle positions (same as in drawResizeHandles)
  const handles = [
    { x: x, y: y, type: 'nw' },
    { x: x + w / 2, y: y, type: 'n' },
    { x: x + w, y: y, type: 'ne' },
    { x: x + w, y: y + h / 2, type: 'e' },
    { x: x + w, y: y + h, type: 'se' },
    { x: x + w / 2, y: y + h, type: 's' },
    { x: x, y: y + h, type: 'sw' },
    { x: x, y: y + h / 2, type: 'w' },
  ];

  // Check each handle
  for (const handle of handles) {
    const dx = Math.abs(worldX - handle.x);
    const dy = Math.abs(worldY - handle.y);
    if (dx <= threshold && dy <= threshold) {
      return handle.type;
    }
  }

  return null;
}

/**
 * Draw selection box
 */
function drawSelectionBox(ctx, box) {
  const { x, y, w, h } = box;
  ctx.save();
  ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
  ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
  ctx.lineWidth = 0.05;

  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}
/**
 * Check if a screen point is clicking on a wire
 */
export function getWireAtScreenPoint(screenX, screenY, wires, objects, offsetX, offsetY, scale, cableMode = 'straight') {
  const worldPos = screenToWorld(screenX, screenY, offsetX, offsetY, scale);
  const clickThreshold = 1.0; // Increased threshold to 1.0m

  for (const wire of wires) {
    const fromObj = objects.find(o => o.id === wire.from);
    const toObj = objects.find(o => o.id === wire.to);
    if (!fromObj || !toObj) continue;

    const p1 = { x: Number(fromObj.x) + Number(fromObj.w) / 2, y: Number(fromObj.y) + Number(fromObj.h) / 2 };
    const p2 = { x: Number(toObj.x) + Number(toObj.w) / 2, y: Number(toObj.y) + Number(toObj.h) / 2 };

    let dist = Infinity;

    // 1. Check Orthogonal Path (if applicable or always?)
    // Let's check both to be safe and generous
    const path = calculateOrthogonalPath(p1, p2);
    if (path && path.length > 0) {
      for (let i = 0; i < path.length - 1; i++) {
        const d = distanceToSegment(worldPos, path[i], path[i + 1]);
        if (d < dist) dist = d;
      }
    }

    // 2. Check Straight Line (Fallback)
    const distStraight = distanceToSegment(worldPos, p1, p2);
    if (distStraight < dist) dist = distStraight;

    if (dist < clickThreshold) {
      return wire;
    }
  }
  return null;
}

function distanceToSegment(p, v, w) {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}
