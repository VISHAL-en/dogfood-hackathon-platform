---
name: Cupertino Native
colors:
  surface: '#faf8fe'
  surface-dim: '#dbd9df'
  surface-bright: '#faf8fe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f8'
  surface-container: '#efedf3'
  surface-container-high: '#e9e7ed'
  surface-container-highest: '#e3e2e7'
  on-surface: '#1a1b1f'
  on-surface-variant: '#414753'
  inverse-surface: '#2f3034'
  inverse-on-surface: '#f1f0f6'
  outline: '#717785'
  outline-variant: '#c1c6d6'
  surface-tint: '#005cbb'
  primary: '#0059b5'
  on-primary: '#ffffff'
  primary-container: '#0071e3'
  on-primary-container: '#fcfbff'
  inverse-primary: '#abc7ff'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#4a47d2'
  on-tertiary: '#ffffff'
  tertiary-container: '#6462ec'
  on-tertiary-container: '#fefaff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#abc7ff'
  on-primary-fixed: '#001b3f'
  on-primary-fixed-variant: '#00458f'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#e2dfff'
  tertiary-fixed-dim: '#c2c1ff'
  on-tertiary-fixed: '#0c006b'
  on-tertiary-fixed-variant: '#332dbc'
  background: '#faf8fe'
  on-background: '#1a1b1f'
  surface-variant: '#e3e2e7'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 19px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.005em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.01em
  mono-code:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system channels the refined precision, physical restraint, and quiet authority of modern macOS desktop productivity suites. Built specifically for high-stakes hackathon submissions, technical evaluations, and collaborative jury grading, it bridges the gap between utilitarian developer tools and human-centered design craft.

The aesthetic philosophy centers on:
- **Calibrated Restraint:** Avoiding hyperactive gamification or neon tournament tropes. Instead, it relies on pristine typographic clarity, precise spatial alignment, and translucent structural planes.
- **Desktop Tactility:** Layered frosted glass panels (`backdrop-filter: blur(20px)`), ultra-fine perimeter borders (`rgba(0, 0, 0, 0.06)`), and muted, multi-stop ambient drop shadows that mirror high-density native desktop windows.
- **Focused Utility:** High legibility under data-dense judging matrices, split-pane diff comparisons, and rich media galleries. The interface recedes cleanly to let project demos, code snippets, and grading scorecards command complete focus.

## Colors

The palette establishes an airy, crystalline workspace anchored by cool off-white canvases and calibrated slate/blue anchors:

- **Canvas & Surfaces:**
  - `canvas-default`: `#F5F6F8` (Main backdrop behind panels and windows)
  - `canvas-subtle`: `#FBFBFD` (Workspaces, modal card interiors, and active editor panes)
  - `surface-elevated`: `rgba(255, 255, 255, 0.82)` with backdrop blur for toolbars, sidebars, and contextual sheets.
  - `surface-card`: `#FFFFFF` with ultra-fine borders for clear spatial separation.

- **Brand & Interaction Tiers:**
  - `primary`: `#0071E3` (Apple system blue for focal CTA triggers, active segment states, and selection boundaries)
  - `secondary`: `#2563EB` (Used for code links, developer identity indicators, and technical metrics)
  - `accent-subtle`: `#F0F4F8` (Pill backgrounds, hover states, and inactive tab tracks)

- **Semantic Event & Status Tokens:**
  - `status-registration`: Foreground `#0071E3`, Background `rgba(0, 113, 227, 0.08)`, Border `rgba(0, 113, 227, 0.16)`
  - `status-submission`: Foreground `#0284C7`, Background `rgba(2, 132, 199, 0.08)`, Border `rgba(2, 132, 199, 0.16)`
  - `status-judging`: Foreground `#D97706`, Background `rgba(217, 119, 6, 0.08)`, Border `rgba(217, 119, 6, 0.16)`
  - `status-completed`: Foreground `#10B981`, Background `rgba(16, 185, 129, 0.08)`, Border `rgba(16, 185, 129, 0.16)`

## Typography

The typographic engine uses Inter with native font fallbacks (`-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display"`).

- **Tabular Figures (`tnum`):** All numerical tables, score counters, timestamps, and ranking positions strictly activate OpenType tabular numbers (`font-variant-numeric: tabular-nums;`).
- **Tracking Discipline:** Larger headline styles compress spacing gently (`-0.015em` to `-0.03em`) to mimic macOS app window headers. Micro labels (`label-sm`) expand tracking slightly (`+0.01em`) to maintain sharp readability when rendered uppercase or in badges.
- **Code & Raw Metadata:** `JetBrains Mono` handles commit SHAs, API payloads, endpoint documentation, and submission repository metrics.

## Layout & Spacing

The layout model simulates high-productivity desktop workstations via a structural multi-pane workspace:

- **Desktop (1200px+):** Three-column or split-pane configurations (Collapsible navigation sidebar at 240px, Master record list at 360px, Dynamic Detail/Judging rubric canvas filling remaining width).
- **Tablet (768px - 1199px):** Split-view reduces to a 2-tier drawer with an off-canvas drawer navigation. Master view and inspector stack contextually.
- **Mobile (<768px):** Linear single-column flow with persistent top app bar and segmented sheet overlays for scoring sheets.

The 4px structural baseline grid governs all spacing:
- Use `space-xs` (4px) and `space-sm` (8px) for internal input chrome, badge internal padding, and tight icon pairing.
- Use `space-md` (12px) for card interiors and list groupings.
- Use `space-lg` (20px) and `space-xl` (32px) for sheet boundaries, master grid gaps, and section headers.

## Elevation & Depth

Visual hierarchy uses physical material layering rather than heavy drop shadows:

- **Level 0 (Flat / Recessed):** Canvas background `#F5F6F8` with subtle inset highlights. Used for sunken form sections, code inspection windows, and score input wells (`box-shadow: inset 0 1px 2px rgba(0,0,0,0.04)`).
- **Level 1 (Subtle Card / In-Canvas Panel):** Pure `#FFFFFF` surface layered over canvas.
  - Border: `1px solid rgba(0, 0, 0, 0.06)`
  - Shadow: `0 1px 3px rgba(0, 0, 0, 0.03), 0 4px 12px rgba(0, 0, 0, 0.02)`
- **Level 2 (Floating Window / Sheet / Popover):** Frosted panel `rgba(255, 255, 255, 0.88)` with `backdrop-filter: blur(20px) saturate(180%)`.
  - Border: `1px solid rgba(255, 255, 255, 0.7)` outer, inner rim `0 0 0 1px rgba(0, 0, 0, 0.05)`
  - Shadow: `0 8px 24px -4px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)`
- **Level 3 (Modal Dialog / Command Palette):**
  - Shadow: `0 24px 48px -12px rgba(0, 0, 0, 0.14), 0 4px 12px rgba(0, 0, 0, 0.05)`
  - Border: `1px solid rgba(0, 0, 0, 0.08)`

## Shapes

The design uses balanced, modern macOS squircle geometry (neither razor-sharp nor hyper-elliptical pills):

- **Default Elements (Buttons, Inputs, Selectors):** `10px` border-radius (`0.625rem`) provides an intentional desktop control feel.
- **Containers & Cards (`rounded-lg`):** `14px` border-radius (`0.875rem`) matches native macOS application windows.
- **Modal Dialogs & Large Sheets (`rounded-xl`):** `18px` border-radius (`1.125rem`) ensures harmonious corner curves at scale.
- **Pill Exception:** Pure pill geometry (`rounded-full` / `9999px`) is reserved exclusively for micro-status indicators (e.g., `Judging Live`, `Submitted`) and small avatar status pips.

## Components

### Buttons
- **Primary:** Solid `#0071E3`, white text, soft highlight rim `inset 0 1px 0 rgba(255, 255, 255, 0.2)`, shadow `0 1px 2px rgba(0, 113, 227, 0.2)`. On hover: `#0077ED`. Active state: subtle scale down (`transform: scale(0.985)`).
- **Secondary (Default macOS Push):** `#FFFFFF` with `1px solid rgba(0, 0, 0, 0.1)`, text `#1D1D1F`, subtle gradient `linear-gradient(180deg, #FFFFFF 0%, #F6F7F9 100%)`. On hover: background `#F9FAFB`.
- **Ghost / Toolbar:** Transparent background, `10px` radius, hover `rgba(0, 0, 0, 0.04)`.

### Hackathon Status Chips & Badges
- Semi-translucent pill container (`height: 22px; padding: 0 8px; border-radius: 9999px;`).
- Contains an active pulsing status orb (`6px` diameter) paired with `label-sm` text.
- Never use high-saturation opaque blocks; retain subtle frosted glass backgrounds with matching tinted borders.

### Input Fields & Scoring Criteria Sliders
- **Text Inputs:** Solid `#FFFFFF`, `border: 1px solid rgba(0, 0, 0, 0.12)`, `10px` radius, height `34px` for desktop density. Focused state: `border-color: #0071E3`, `box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15)`.
- **Score Slider / Stepper:** Custom horizontal track in `rgba(0, 0, 0, 0.06)` with filled blue progress segment, combined with a manual tabular numeric input field displaying normalized scores (e.g., `8.5 / 10`).

### Selection Controls (Checkboxes & Radios)
- **Checkbox:** `16px x 16px`, `4px` corner radius. Inactive: `#FFFFFF` with `rgba(0, 0, 0, 0.18)` border. Checked: `#0071E3` with crisp white check mark icon.
- **Segmented Control:** Grouped pill track (`#E5E7EB` / `rgba(0,0,0,0.05)` fill) with sliding `#FFFFFF` selection card, elevated with `0 1px 3px rgba(0,0,0,0.08)`.

### Project Submission Cards
- Dual-zone layout: Upper visual preview (16:9 aspect ratio with embedded live demo/video thumbnail) and lower metadata container.
- Metadata row: Track badges, team member avatar stacks, Github repo status indicators, and judging completion checkmarks.

### Live Rubric Drawer
- Slide-over evaluation pane for judges: Fixed floating header with team name and current rubric score total, scrollable criteria sections (Innovation, Technical Execution, Design, Polish), each with a markdown-enabled feedback field.