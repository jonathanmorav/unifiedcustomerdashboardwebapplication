# Cakewalk Design System Guidelines

## Table of Contents

- [Brand Identity & Logo](#brand-identity--logo)
- [Color Palette](#color-palette)
- [Typography](#typography)
- [Spacing System](#spacing-system)
- [Border Radius](#border-radius)
- [Shadows & Elevation](#shadows--elevation)
- [Animations & Transitions](#animations--transitions)
- [Layout Guidelines](#layout-guidelines)
- [Component Patterns](#component-patterns)
- [Accessibility Guidelines](#accessibility-guidelines)
- [Usage Examples](#usage-examples)

---

## Brand Identity & Logo

- **Logo**: SVG-based Cakewalk logo with blue gradient icon and dark navy text
- **Viewbox**: 1213x296 for horizontal layout
- **Usage**: Responsive sizing with `h-8 w-auto` for headers

---

## Color Palette

### Primary Colors

- **Primary Blue**: `#005dfe` (Medium Slate Blue) - Main brand color
- **Primary Light**: `#5791f3` (Cornflower Blue) - Lighter brand variant
- **Primary Dark**: `#0a214a` (Dark Slate Blue) - Headers and dark text
- **Primary Royal**: `#0051dc` (Royal Blue) - Hover states and accents

### Secondary Colors

- **Success Green**: `#15cb94` (Medium Sea Green) - Success states
- **Success Light**: `#53edbe` (Aquamarine) - Success backgrounds
- **Success Dark**: `#045d42` (Sea Green) - Success text
- **Warning**: `#f59e0b` - Warning states
- **Error**: `#ef4444` - Error states

### Background Colors

- **Alice Blue 100**: `#f4f8ff` - Main page background
- **Alice Blue 200**: `#eaf2ff` - Card backgrounds
- **Alice Blue 300**: `#eef1f8` - Subtle backgrounds
- **Lavender**: `#cbdeff` - Borders and dividers
- **White**: `#fff` - Card and component backgrounds

### Text Colors

- **Primary Text**: `#424b5b` (Dark Slate Gray) - Main text
- **Secondary Text**: `#5d6b85` (Slate Gray) - Secondary text
- **Tertiary Text**: `#5d6885` (Slate Gray 200) - Muted text

---

## Typography

### Font Families

- **Primary**: DM Sans (body text, UI components)
- **Secondary**: Space Grotesk (headings, hero titles)

### Font Sizes (Mobile-Optimized)

| Element          | Size | Line Height | Use Case           |
| ---------------- | ---- | ----------- | ------------------ |
| **H1**           | 36px | 1.2         | Hero titles        |
| **H2**           | 24px | 1.3         | Section headers    |
| **H3**           | 20px | 1.3         | Card titles        |
| **H4**           | 18px | 1.4         | Subsection headers |
| **H5**           | 16px | 1.4         | Small headers      |
| **Body Large**   | 20px | 1.5         | -                  |
| **Body Medium**  | 18px | 1.5         | -                  |
| **Body Small**   | 16px | 1.5         | Default body text  |
| **Body XSmall**  | 14px | 1.4         | Small text         |
| **Body XXSmall** | 13px | 1.4         | Fine print         |

### Font Weights

- **Normal**: 400 - Body text
- **Medium**: 500 - Emphasized text
- **Semibold**: 600 - Headings and buttons
- **Bold**: 700 - Hero titles and strong emphasis

### Typography Classes

Use Tailwind classes with `cakewalk-` prefix:

- `text-cakewalk-h1` through `text-cakewalk-h5`
- `text-cakewalk-body-lg` through `text-cakewalk-body-xxs`
- `font-cakewalk-normal` through `font-cakewalk-bold`

---

## Spacing System

### Gap Values

- **2px**: Micro spacing
- **4px**: Small spacing
- **8px**: Base unit
- **12px**: Medium spacing
- **16px**: Large spacing
- **20px**: XL spacing
- **24px**: XXL spacing
- **32px**: Section spacing

### Padding Values

- **8px**: Button padding
- **12px**: Input padding
- **16px**: Card padding (mobile)
- **24px**: Card padding (desktop)
- **32px**: Section padding
- **40px**: Large section padding

### Usage

- Use `gap-cakewalk-{size}` for flexbox/grid gaps
- Use `p-cakewalk-{size}` for padding
- Use consistent 8px increments for larger spacings

---

## Border Radius

- **Small**: 8px - Buttons, small components
- **Medium**: 12px - Input fields, cards
- **Large**: 16px - Large cards, modals
- **XLarge**: 20px - Hero sections, main containers

---

## Shadows & Elevation

### Shadow Levels

- **Light**: `0 1px 2px 0 rgb(0 0 0 / 0.05)` - Subtle elevation
- **Medium**: `0px 6px 8px rgba(0,0,0,0.05)` - Card elevation
- **Special**: `0px 3px 3px rgba(0,0,0,0.05)` - Component shadows
- **Hover**: `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` - Interactive states

### Usage

- Use `shadow-cakewalk-light` for minimal elevation
- Use `shadow-cakewalk-medium` for cards and components
- Use `shadow-cakewalk-hover` for interactive elements on hover

---

## Animations & Transitions

### Keyframes

- **Fade In**: Opacity 0→1 with translateY(10px)→0
- **Slide Up**: Opacity 0→1 with translateY(20px)→0
- **Slide Down**: Opacity 0→1 with translateY(-20px)→0
- **Scale In**: Opacity 0→1 with scale(0.95)→1

### Timing Functions

- **Standard**: `cubic-bezier(0.23, 1, 0.32, 1)` - Smooth, natural motion
- **Auth Flow**: `cubic-bezier(0.23, 1, 0.32, 1)` - Page transitions
- **Hover**: `ease-out` - Interactive feedback

### Animation Classes

- `animate-fade-in` - 0.3s fade in
- `animate-slide-up` - 0.6s slide up
- `animate-slide-down` - 0.3s slide down
- `animate-scale-in` - 0.2s scale in
- `animate-delay-{100,200,300,400,500}` - Staggered animations

### Page Transitions

- **Auth Flow**: `fade-in-auth` with scale transform
- **Terrace Effect**: Staggered entrance animations with delays
- **Card Transitions**: 0.5s cubic-bezier for smooth state changes

---

## Layout Guidelines

### Container

- **Max Width**: 816px for main content
- **Padding**: 2rem responsive padding
- **Centering**: Always center-aligned

### Grid System

- **Mobile First**: Single column on mobile
- **Breakpoints**:
  - sm: 640px (2 columns)
  - lg: 1024px (auto-fit minmax(300px, 1fr))
- **Employee Cards**: Special responsive grid with expansion states

### Responsive Design

- **Mobile**: 8px padding, stacked layouts
- **Tablet**: 16px padding, 2-column grids
- **Desktop**: 24px padding, multi-column layouts

---

## Component Patterns

### Cards

- **Background**: White with subtle blue borders (`#cbdeff`)
- **Border Radius**: 16px for main cards, 12px for nested
- **Shadow**: `0px 3px 3px #eaf2ff`
- **Padding**: 20px mobile, 24px desktop

### Buttons

- **Primary**: Blue background (`#005dfe`) with white text
- **Secondary**: White background with blue border
- **Hover**: Royal blue (`#0051dc`) with subtle scale transform
- **Border Radius**: 8px
- **Font**: Semibold, 14px

### Forms

- **Input Height**: 44px (11px padding)
- **Border**: 1px solid lavender (`#cbdeff`)
- **Focus**: Blue border with shadow ring
- **Border Radius**: 12px
- **Font Size**: 14px

### Status Indicators

- **Success**: Green backgrounds with dark green text
- **Warning**: Amber backgrounds with brown text
- **Error**: Red backgrounds with dark red text
- **Pending**: Gray backgrounds with muted text

---

## Accessibility Guidelines

### Color Contrast

- Ensure 4.5:1 contrast ratio for normal text
- Ensure 3:1 contrast ratio for large text
- Never rely solely on color for information

### Typography

- Minimum font size: 13px for fine print
- Use semantic HTML elements
- Maintain consistent line heights (1.4-1.5)

### Interactive Elements

- Minimum touch target: 44px
- Clear focus indicators
- Consistent hover states

---

## Usage Examples

### Class Naming Convention

```css
/* Use cakewalk- prefix for design system classes */
.text-cakewalk-body-sm
.bg-cakewalk-bg-alice-100
.border-cakewalk-border
.shadow-cakewalk-medium
.gap-cakewalk-16
```

### Common Patterns

```tsx
// Card component
<div className="bg-white border border-cakewalk-border rounded-cakewalk-large shadow-cakewalk-medium p-cakewalk-24">
  <h3 className="text-cakewalk-h3 text-cakewalk-primary-dark">Card Title</h3>
  <p className="text-cakewalk-body-sm text-cakewalk-secondary">Card content goes here...</p>
</div>

// Button component
<button className="bg-cakewalk-primary text-white rounded-cakewalk-small px-cakewalk-16 py-cakewalk-8 font-cakewalk-semibold text-cakewalk-body-xs hover:bg-cakewalk-primary-royal transition-colors">
  Click Me
</button>

// Typography
<h1 className="text-cakewalk-h1 font-cakewalk-bold text-cakewalk-primary-dark">
  Hero Title
</h1>
```

---

This design system ensures consistency, accessibility, and scalability across the entire Cakewalk application while maintaining the professional, clean aesthetic of the brand.
