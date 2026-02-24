# Omni Assistant 3D Character Guide

## Overview

The Omni Assistant now features a **3D character mode** with a cute, minimalist mascot displaying 8 emotional states. This creates a more engaging and personality-driven chat experience compared to the abstract sigil or NOMI-inspired character modes.

---

## Available Modes

Users can choose between three visual styles:

1. **Sigil** - Abstract geometric circles with gold accents (default)
2. **Character** - Dark sphere with expressive gold eyes (NOMI-inspired)
3. **3D Character** - Cute minimalist 3D mascot with full emotional expressions (NEW!)

---

## How to Enable 3D Character Mode

### Option 1: Via localStorage (Developer)

```typescript
localStorage.setItem('omniscope-omni-mode', '3d-character');
window.location.reload();
```

### Option 2: Change Default in Code

Edit `client/src/components/PortalLayout.tsx`:

```typescript
const [omniMode, setOmniMode] = useState<OmniMode>(() => {
  try { 
    return (localStorage.getItem(OMNI_MODE_KEY) as OmniMode) || "3d-character"; 
  } catch { 
    return "3d-character"; 
  }
});
```

---

## Character States & Triggers

### 1. **Idle** (Default)
- **When:** Waiting for user input
- **Animation:** Gentle breathing
- **Visual:** Neutral expression, relaxed posture

### 2. **Wave** (Greeting)
- **When:** User opens chat, initiates conversation
- **Animation:** Subtle bounce
- **Visual:** Friendly waving gesture

### 3. **Thinking** (Processing)
- **When:** Processing request, analyzing data
- **Animation:** Pulse effect
- **Visual:** Thoughtful expression with hand on chin

### 4. **Success** (Completed)
- **When:** Task completed successfully
- **Animation:** Bounce with celebration effect
- **Visual:** Happy expression with arms raised

### 5. **Focused** (Working)
- **When:** Complex task, deep analysis
- **Animation:** Floating motion
- **Visual:** Concentrated expression

### 6. **Alert** (Attention)
- **When:** Important notification, urgent message
- **Animation:** Shake with orange glow
- **Visual:** Wide-eyed alert expression

### 7. **Proud** (Confident)
- **When:** Presenting results, showcasing features
- **Animation:** Slow float
- **Visual:** Confident smile, hands on hips

### 8. **Thumbs Up** (Approval)
- **When:** Confirming action, positive feedback
- **Animation:** Bounce
- **Visual:** Thumbs up gesture

---

## State Transition Flow

```
User opens chat → wave (2s) → idle
User sends message → thinking → focused (if complex) → success → idle
Error occurs → alert (2s) → idle
Task confirmed → thumbsup (1.5s) → idle
```

---

## Technical Implementation

### File Structure

```
client/src/components/
├── Character3D.tsx          # 3D character component
├── OmniAvatar.tsx           # Main avatar wrapper (all modes)
└── OmniChatPanel.tsx        # Chat interface with state management

client/src/index.css         # Character animations
```

### Character Assets (CDN)

All images hosted on Manus CDN with WebP compression:
- Idle, Wave, Thinking, Success, Focused, Alert, Proud, Thumbs Up
- 2048x2048px PNG format
- Optimized for web performance

### State Mapping

```typescript
function getCharacterAsset(state: OmniState): string {
  switch (state) {
    case "wave": case "hover": return CHARACTER_ASSETS.wave;
    case "thinking": case "waiting": return CHARACTER_ASSETS.thinking;
    case "success": case "celebrate": return CHARACTER_ASSETS.success;
    case "focused": case "curious": return CHARACTER_ASSETS.focused;
    case "alert": case "concerned": case "error": return CHARACTER_ASSETS.alert;
    case "proud": return CHARACTER_ASSETS.proud;
    case "thumbsup": return CHARACTER_ASSETS.thumbsup;
    default: return CHARACTER_ASSETS.idle;
  }
}
```

---

## Customization

### Adding New States

1. Generate character image (2048x2048 PNG)
2. Upload to CDN
3. Add to `CHARACTER_ASSETS` in `Character3D.tsx`
4. Update `getCharacterAsset()` mapping
5. Add animation in `index.css` if needed

### Adjusting Animation Speed

In `client/src/index.css`:

```css
.animate-float { animation: float 3s ease-in-out infinite; }
.animate-bounce-subtle { animation: bounce-subtle 1s ease-in-out 3; }
```

### Changing Default Size

In `Character3D.tsx`:

```typescript
export default function Character3D({ 
  state, 
  size = 120, // Change default size
  badge, 
  className = "" 
}: Character3DProps)
```

---

## Performance

- **Image Loading:** CDN-cached, lazy-loaded
- **Transitions:** 150ms smooth fade between states
- **Animations:** GPU-accelerated CSS animations
- **Mobile:** Scales appropriately on all devices

---

## Accessibility

- **Alt Text:** Descriptive alt text on all images
- **Keyboard Navigation:** Fully keyboard accessible
- **Screen Readers:** ARIA labels describe current state
- **Reduced Motion:** Respects `prefers-reduced-motion`

---

## Troubleshooting

### Character Not Showing

1. Check localStorage: `localStorage.getItem('omniscope-omni-mode')` should be `"3d-character"`
2. Verify CDN URLs are accessible (check browser console)
3. Clear cache and reload

### Animations Not Working

1. Verify animation classes are applied (inspect element)
2. Check `index.css` includes character animations
3. Look for CSS conflicts

### State Not Changing

1. Verify `setOmniState()` is called in `OmniChatPanel.tsx`
2. Check console for errors
3. Ensure `OmniContext` is providing state updates

---

## Future Enhancements

- Add more emotional states (surprised, confused, excited)
- Implement 3D rotation on hover
- Add particle effects for celebrations
- Create animated transitions between states
- Add voice interaction indicators
- Implement customizable character skins

---

## Credits

Character design inspired by minimalist 3D mascots. All assets custom-generated and optimized for web performance.

For questions, contact the OmniScope development team.
