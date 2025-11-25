/**
 * Drawing Tools Utilities
 * Provides utilities for shape creation and area calculations
 */

/**
 * Calculate area of a polygon given vertices
 * Uses the Shoelace formula
 */
export function calculatePolygonArea(vertices) {
  if (!vertices || vertices.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area / 2);
}

/**
 * Calculate bounding box for a set of points
 */
export function calculateBoundingBox(points) {
  if (!points || points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    minX = Math.min(minX, points[i].x);
    minY = Math.min(minY, points[i].y);
    maxX = Math.max(maxX, points[i].x);
    maxY = Math.max(maxY, points[i].y);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Snap point to grid
 */
export function snapToGrid(point, gridSize = 1) {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

/**
 * Distance between two points
 */
export function distance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Create rectangle object from start and end points
 */
/**
 * Get color and label based on type
 */
function getTypeProperties(type) {
  switch (type) {
    case "tinshed":
      return { color: "#93c5fd", label: "Tin Shed" };
    case "tree":
      return { color: "rgba(22, 163, 74, 0.6)", label: "Tree" };
    case "obstacle":
      return { color: "rgba(239, 68, 68, 0.6)", label: "Obstacle" };
    case "structure":
    default:
      return { color: "#475569", label: "Structure" };
  }
}

/**
 * Create rectangle object from start and end points
 */
export function createRectangle(start, end, type = "structure", height = 3.0) {
  const minX = Math.min(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxX = Math.max(start.x, end.x);
  const maxY = Math.max(start.y, end.y);

  const width = maxX - minX;
  const depth = maxY - minY;

  const props = getTypeProperties(type);

  return {
    id: "struct_" + Date.now(),
    type: type,
    x: minX,
    y: minY,
    w: width,
    h: depth,
    h_z: height, // Height above ground in meters (structure height)
    relative_h: 0,
    rotation: 0,
    label: props.label,
    color: props.color,
    cost: Math.round(width * depth * 500), // Rough cost estimate
    area: width * depth,
    vertices: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
  };
}

/**
 * Create polygon object from vertices
 */
export function createPolygon(vertices, type = "structure", height = 3.0) {
  if (vertices.length < 3) return null;

  const bbox = calculateBoundingBox(vertices);
  const area = calculatePolygonArea(vertices);

  const props = getTypeProperties(type);

  return {
    id: "poly_" + Date.now(),
    type: type,
    x: bbox.minX,
    y: bbox.minY,
    w: bbox.maxX - bbox.minX,
    h: bbox.maxY - bbox.minY,
    h_z: height, // Height of structure in meters
    relative_h: 0,
    rotation: 0,
    label: props.label,
    color: props.color,
    cost: Math.round(area * 500),
    area: area,
    isPolygon: true,
    vertices: vertices, // Use absolute vertices
  };
}

/**
 * Simplify polyline/freehand path by removing close points
 */
export function simplifyPath(points, threshold = 2) {
  if (points.length < 3) return points;

  const simplified = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const lastAdded = simplified[simplified.length - 1];
    const dist = distance(lastAdded, points[i]);

    if (dist >= threshold) {
      simplified.push(points[i]);
    }
  }

  // Always add the last point
  if (distance(simplified[simplified.length - 1], points[points.length - 1]) > 0) {
    simplified.push(points[points.length - 1]);
  }

  return simplified;
}

/**
 * Check if a point is inside a polygon
 */
export function pointInPolygon(point, vertices) {
  let inside = false;

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;

    const intersect =
      yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Create a closed polygon from an open path by connecting endpoints
 */
export function closePath(points) {
  if (points.length < 3) return points;

  const simplified = simplifyPath(points, 2);

  // Check if path is already closed
  const first = simplified[0];
  const last = simplified[simplified.length - 1];

  if (distance(first, last) > 5) {
    // Not closed, so close it
    simplified.push(first);
  }

  return simplified;
}

/**
 * Estimate cost based on area and type
 */
export function estimateCost(area, type = "structure") {
  // Base cost per square meter varies by type
  const costPerSqm = {
    structure: 0, // INR per sq meter
    obstacle: 0, // Obstacles are cheaper
    terrain: 0, // Terrain features
  };

  const rate = costPerSqm[type] || costPerSqm.structure;
  return Math.round(area * rate);
}

/**
 * Create an array of panels within a bounding box
 */
export function createPanelArray(start, end, baseHeight = 0, panelType = null, objects = []) {
  const minX = Math.min(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  // Use provided panel type or default
  const panelW = panelType?.w || 1.134;
  const panelH = panelType?.h || 2.278;
  const panelWatts = panelType?.watts || 550;
  const panelCost = panelType?.cost || 15000;
  const panelLabel = panelType?.label || "Panel";
  const gap = 0.05; // 5cm gap between panels
  const obstructionBuffer = 0.1; // Buffer around obstructions (10cm)

  const cols = Math.floor(width / (panelW + gap));
  const rows = Math.floor(height / (panelH + gap));

  const panels = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = minX + c * (panelW + gap);
      const y = minY + r * (panelH + gap);

      // Check if panel position overlaps with any obstruction
      // baseHeight > 0 means placing on a roof (skip ground structures)
      // baseHeight = 0 means placing on ground (check all obstacles)
      if (!isPositionObstructed(x, y, panelW, panelH, objects, obstructionBuffer, baseHeight)) {
        panels.push({
          id: "panel_" + Date.now() + "_" + r + "_" + c + "_" + Math.random().toString(36).substr(2, 5),
          type: "panel",
          x: x,
          y: y,
          w: panelW,
          h: panelH,
          h_z: baseHeight + 0.1, // Height above base
          relative_h: 0.1,
          rotation: 0,
          label: panelLabel,
          color: "#1e3a8a",
          watts: panelWatts,
          cost: panelCost
        });
      }
    }
  }
  return panels;
}

/**
 * Check if a panel position is obstructed by structures or obstacles
 * @param {number} x - Panel left position
 * @param {number} y - Panel top position
 * @param {number} w - Panel width
 * @param {number} h - Panel height
 * @param {Array} objects - All canvas objects
 * @param {number} buffer - Safety buffer around obstructions
 * @returns {boolean} True if position is obstructed
 */
function isPositionObstructed(x, y, w, h, objects, buffer = 0.1, baseHeight = 0) {
  for (const obj of objects) {
    // Determine which objects to check based on placement location
    let shouldCheck = false;

    if (baseHeight > 0) {
      // Placing on a roof/structure - only avoid obstacles and trees
      // (don't avoid the structure itself since we're mounting on it)
      shouldCheck = obj.type === 'obstacle' || obj.type === 'tree';
    } else {
      // Placing on ground - avoid structures, obstacles, and trees
      shouldCheck = obj.type === 'structure' || obj.type === 'obstacle' || obj.type === 'tree' || obj.type === 'tinshed';
    }

    if (shouldCheck) {
      // Check if panel bounding box overlaps with obstruction
      // Using rectangle-to-rectangle intersection with buffer zone
      const panelLeft = x - buffer;
      const panelRight = x + w + buffer;
      const panelTop = y - buffer;
      const panelBottom = y + h + buffer;

      const objLeft = obj.x;
      const objRight = obj.x + obj.w;
      const objTop = obj.y;
      const objBottom = obj.y + obj.h;

      // Check for intersection (AABB - Axis-Aligned Bounding Box collision)
      const isIntersecting = !(panelRight < objLeft || panelLeft > objRight ||
        panelBottom < objTop || panelTop > objBottom);

      if (isIntersecting) {
        return true;
      }
    }
  }
  return false;
}
