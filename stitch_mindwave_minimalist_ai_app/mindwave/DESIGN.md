---
name: Mindwave
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1b'
  surface-container: '#1f1f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#303030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#4a4949'
  on-secondary-container: '#bab8b7'
  tertiary: '#ffffff'
  on-tertiary: '#303030'
  tertiary-container: '#e5e2e1'
  on-tertiary-container: '#656464'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474646'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#474746'
  background: '#131313'
  on-background: '#e2e2e2'
  surface-variant: '#353535'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1200px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 40px
  section-gap: 80px
---

## Brand & Style

The brand personality of this design system is "The Intelligent Void." It is designed to feel like a high-end architectural space—silent, expansive, and profoundly powerful. The target audience consists of power users and professionals who value clarity of thought and a distraction-free environment for AI-assisted workflows.

The aesthetic is a fusion of **Ultra-Minimalism** and **Dark Glassmorphism**. It utilizes a "black-hole" philosophy where the background is a pure, infinite abyss (#000000), allowing the content to float as luminous, high-contrast artifacts. The emotional response is one of calm, exclusivity, and precision. It avoids the clutter of traditional SaaS interfaces, favoring generous whitespace and a "timeless" quality that feels relevant both now and a decade from now.

## Colors

The palette of this design system is strictly monochromatic to maximize contrast and focus. 

- **Pure Black (#000000):** Used for the primary background to create an infinite depth.
- **Pure White (#FFFFFF):** Reserved for primary actions, primary text, and high-impact accents.
- **Surface Grey (#111111):** Used for card containers and secondary surfaces to provide a subtle lift from the background.
- **Stroke Grey (#222222):** The standard for borders and dividers, providing structure without visual noise.

Color is intentionally absent to ensure that the AI's output and the user's data remain the sole focus. Success, error, and warning states should be handled through iconography and typography weight rather than traditional semantic colors where possible.

## Typography

This design system utilizes **Inter** for its systematic, utilitarian, and modern characteristics. The type hierarchy is built on extreme contrast: large, bold headlines and small, spacious labels.

- **Headlines:** Use tight letter-spacing and substantial weight to ground the layout.
- **Body:** Prioritize legibility with a generous line height (1.6) to ensure long-form AI responses are effortless to read.
- **Labels:** Use uppercase and increased letter-spacing for metadata and small UI elements to create an "architectural" feel.

Type color should be varied between Primary White (#FFFFFF) for headers and Muted Grey (#A1A1A1) for secondary body text to establish a clear information hierarchy.

## Layout & Spacing

The layout philosophy of this design system is "Breathability." It relies on a **Fixed Grid** for desktop and a **Fluid Grid** for mobile, emphasizing extreme margins to center the user’s focus.

- **The 8px Rhythm:** All spacing (padding, margins, gaps) must be a multiple of 8px to maintain mathematical harmony.
- **Margins:** Desktop layouts use a massive 40px outer margin to frame the content. Mobile uses 20px.
- **Section Gaps:** Use 80px or larger gaps between major functional blocks to signify a mental shift between tasks.
- **Desktop Grid:** A 12-column grid with 24px gutters. Elements typically span the center 8 columns for readability, leaving the outer columns for whitespace or secondary navigation.

## Elevation & Depth

Hierarchy in this design system is achieved through **Tonal Layering** and **Dark Glassmorphism**. Because the background is pure black, elevation is indicated by "lifting" elements into a lighter grey space.

1.  **Level 0 (Base):** #000000. The infinite canvas.
2.  **Level 1 (Cards/Panels):** #111111 with a 1px solid border of #222222.
3.  **Level 2 (Modals/Popovers):** #111111 with a backdrop-blur (minimum 20px) and a slightly brighter border (#333333).

**Glassmorphism Details:** Floating elements should use a semi-transparent fill of #111111 at 80% opacity combined with a background blur. This allows the "void" below to peek through, creating a sense of sophisticated translucency without sacrificing content legibility. Shadows are rarely used; if necessary, use a large, diffused black shadow (0 20px 40px rgba(0,0,0,0.5)) to create depth against the pure black base.

## Shapes

The shape language is defined by "The Softened Edge." To contrast the stark, high-contrast colors, all interactive elements and containers utilize a consistent 16px (1rem) radius.

- **Standard Containers:** 16px radius.
- **Small Elements (Chips/Tags):** 8px (0.5rem) radius.
- **Buttons:** 16px radius to match the primary containers.

This consistency in roundedness ensures that even with a brutalist color palette, the app feels approachable, modern, and high-end.

## Components

### Buttons
- **Primary:** Pure White background with Pure Black text. Bold weight. No border.
- **Secondary:** Ghost style. Transparent background with a 1px border (#222222). White text.
- **Hover States:** Primary buttons should slightly dim (90% opacity); Secondary buttons should fill with a subtle #111111 background.

### Cards
- **Base:** #111111 background, 16px corner radius, 1px #222222 border.
- **Padding:** 24px or 32px depending on content density.
- **Interaction:** On hover, the border color may brighten to #444444 to indicate interactivity.

### Input Fields
- **Resting:** #000000 background, 1px #222222 border, 16px radius.
- **Focus:** Border color transitions to Pure White (#FFFFFF). Text is always White.
- **Placeholder:** Muted Grey (#555555).

### Chips & Tags
- **Style:** Small 12px uppercase text. #111111 background with #222222 border. 8px radius.

### AI Chat Bubbles
- **User:** Right-aligned, minimal styling, white text.
- **AI:** Left-aligned, contained within a standard #111111 card to differentiate the "machine" response from the user's "human" input.

### Glass Overlays
- Floating navigation bars or context menus should use the glassmorphic blur effect (20px blur) to maintain the sense of depth.