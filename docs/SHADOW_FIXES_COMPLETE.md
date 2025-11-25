# Shadow Rendering Fixes

## Objective
Fix the issue where shadows of objects with the same height appear inconsistent (one being much longer/taller than the other).

## Root Cause Analysis
- The issue was caused by **accidental object duplication**.
- When two identical objects are placed at the exact same position (e.g., via double-clicking or a bug), the `calculateEffectiveHeight` function interpreted this as one object being "stacked" on top of the other.
- This resulted in the "top" object having an effective height of `h_z + h_z` (2x height), leading to a shadow that was twice as long.
- The visual evidence (darker shadow, longer shadow) strongly supported this hypothesis.

## Fix Implemented
- Modified `calculateEffectiveHeight` in `src/utils/canvas.js`.
- Added a check to **ignore exact duplicates** (objects with the same x, y, w, h within a small tolerance) when calculating stacking height.
- This prevents the system from artificially doubling the height of duplicated objects, ensuring shadows reflect the intended single-object height.

## Verification
- **Scenario**: Two identical objects at the same position.
- **Before**: Shadow length = 2x (stacked). Shadow opacity = Darker (double draw).
- **After**: Shadow length = 1x (not stacked). Shadow opacity = Darker (still double draw, but length is correct).
- **Result**: The visual discrepancy in shadow length between a single object and a duplicated object is resolved.
