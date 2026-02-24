# Animated Mascot Character - Research Findings

## Problem Statement

Current implementation has corrupted/incomplete 3D character images with missing body parts (face, arms, legs) and no actual animations between states. Need a professional solution for Omni Assistant mascot.

## Research Summary (Feb 24, 2026)

### Animation Approaches Evaluated

#### 1. **CSS Sprite Sheets** (RECOMMENDED)
**Best for:** Frame-by-frame character animations, micro-interactions

**Pros:**
- No external libraries required
- GPU-accelerated, runs off main thread
- Perfect for small character animations
- Interactive via CSS selectors (hover, click, etc.)
- Mobile-friendly and responsive
- Supports `prefers-reduced-motion` accessibility

**Cons:**
- Large image file if not optimized
- Limited to raster animations
- Requires careful sprite sheet creation

**Implementation:**
```css
.character {
  background-image: url('character-sprite-sheet.png');
  width: 100px;
  height: 100px;
  background-size: 800px 100px; /* 8 frames × 100px */
  animation: characterAnim 1s steps(8, jump-none) infinite;
}

@keyframes characterAnim {
  from { background-position: 0px 0px; }
  to { background-position: -700px 0px; }
}
```

**Key Insight:** Use `steps()` timing function to land exactly on frames, not smooth interpolation.

---

#### 2. **Lottie Animations**
**Best for:** Complex After Effects animations, designer-driven motion

**Pros:**
- Vector-based, crisp on any screen
- Small file sizes (JSON)
- Pixel-perfect replication of AE designs
- Cross-platform (Web, iOS, Android)

**Cons:**
- Requires Lottie runtime library (~300KB)
- Limited interactivity (pre-defined timelines)
- Only supports subset of AE features
- Can drop frames on complex animations

**When to use:** Rich, designer-driven animations where designer creates in After Effects

---

#### 3. **Rive Animations**
**Best for:** Interactive, state-driven character animations

**Pros:**
- Built-in state machine (idle, hover, clicked, etc.)
- Single file with multiple states
- GPU-optimized (C++/WebAssembly)
- Excellent performance at 60fps
- Reuses assets across states

**Cons:**
- Requires Rive runtime
- Designers must learn Rive tool (not After Effects)
- Additional dependency

**When to use:** Character needs to react dynamically to app state (smiling, frowning, different emotions)

---

#### 4. **CSS-only (Current Approach)**
**Best for:** Simple transitions, hover effects

**Pros:**
- No dependencies
- GPU-accelerated
- Easy to maintain

**Cons:**
- Limited to simple animations
- Can't handle complex sequences
- No frame-by-frame control

**Current Problem:** We're trying to do frame-by-frame character animation with CSS transitions, which doesn't work well.

---

## Recommended Solution

### **Approach: CSS Sprite Sheet Animation**

**Why:**
1. No external dependencies (lightweight)
2. Perfect for character mascot with 8 emotional states
3. GPU-accelerated performance
4. Interactive via CSS (hover, click, state changes)
5. Accessibility support built-in

**Implementation Plan:**

1. **Create Sprite Sheet**
   - Generate 8 high-quality character poses in a single horizontal strip
   - Each frame: 200×200px (for retina displays)
   - Total sheet: 1600×200px (8 frames)
   - Format: PNG with transparency
   - Optimize with pngquant or similar

2. **CSS Animation System**
   ```css
   .omni-character {
     width: 100px;
     height: 100px;
     background-image: url('omni-sprite-sheet.png');
     background-size: 800px 100px;
     background-repeat: no-repeat;
   }
   
   /* Idle state - breathing animation */
   .omni-character.idle {
     animation: breathe 3s steps(4, jump-none) infinite;
   }
   
   /* Thinking state - pulsing */
   .omni-character.thinking {
     background-position: -100px 0;
     animation: pulse 1.5s steps(2, jump-none) infinite;
   }
   
   /* Success state - celebration */
   .omni-character.success {
     background-position: -200px 0;
     animation: celebrate 0.8s steps(4, jump-none);
   }
   ```

3. **State Management**
   - React component receives `state` prop
   - Component applies appropriate CSS class
   - CSS handles all animation logic
   - Smooth transitions between states

---

## Alternative: Lottie (If Budget Allows)

If we want more sophisticated animations:

1. **Hire animator** to create character in After Effects
2. **Export to Lottie** JSON
3. **Implement with lottie-react**
4. **Create separate Lottie files** for each emotion
5. **Switch files** based on state

**Cost:** Higher (animator time + 300KB library)
**Benefit:** More fluid, professional animations

---

## Action Items

- [ ] Generate single sprite sheet with all 8 character states
- [ ] Verify each frame is complete (no missing body parts)
- [ ] Optimize sprite sheet file size
- [ ] Implement CSS sprite animation system
- [ ] Test across all emotional states
- [ ] Verify performance on mobile devices
- [ ] Add accessibility support (prefers-reduced-motion)

---

## References

- [CSS Sprite Sheet Animations](https://leanrada.com/notes/css-sprite-sheets/)
- [Advanced UI Animation Strategies](https://medium.com/@vacmultimedia/advanced-ui-animation-strategies-when-to-use-css-lottie-rive-js-or-video-56289e8d2629)
- [Twitter Heart Animation Example](https://leanrada.com/notes/css-sprite-sheets/) (29-frame sprite sheet)

---

## Decision

**Use CSS Sprite Sheets** for Omni Assistant character mascot.

**Rationale:**
- Lightweight (no dependencies)
- Perfect for our use case (8 emotional states)
- High performance
- Easy to maintain
- Accessible

**Next Step:** Generate professional sprite sheet with all 8 states in a single image.
