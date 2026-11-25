# DESIGN.md: Jeeny Design Language

Sources: screenshots of the Jeeny rider app (Android, Nov 2026) and App Store images of
the Jeeny for Drivers app. Sizes are in CSS px.
`≈` = estimated from screenshots. Verify with a color picker before locking.

## 1. Language & Direction
- UI language: English. Direction: LTR only. No RTL mirroring.
- Arabic appears only inside data (street names, addresses, people's names) and
  renders inline within the LTR layout.
- Font stacks must include an Arabic fallback so mixed strings render cleanly.

## 2. Colors

### Accent rule (most important)
One theme with an `--accent` token. Components never hard-code pink or purple.
- Rider screens: `--accent: var(--pink-500)`, `--accent-soft: var(--pink-50)`, `--accent-dark: var(--pink-600)`
- Driver screens: `--accent: var(--purple-500)`, `--accent-soft: var(--purple-50)`, `--accent-dark: var(--purple-800)`

### Rider brand
| Token | Hex | Use |
|---|---|---|
| `--pink-500` | ≈ #EC008C | Rider accent: primary buttons, links, active borders, pins, checks |
| `--pink-600` | ≈ #C8007A | Bottom edge of primary buttons, pressed state |
| `--pink-100` | ≈ #FBD9EA | Logo watermark, subtle accents |
| `--pink-50` | ≈ #FDEEF6 | Service tiles, wallet header, icon circles, selected row background |

### Driver brand
| Token | Hex | Use |
|---|---|---|
| `--purple-500` | ≈ #7E35C0 | Driver accent: buttons, icons, chart bars, selected states |
| `--purple-800` | ≈ #4A1E78 | Dark end of driver gradients |
| `--purple-200` | ≈ #D3A2EE | Secondary chart bars, legend dots |
| `--purple-50` | ≈ #F4ECFB | Soft backgrounds, icon circles |

Driver header gradient: `linear-gradient(135deg, #8A3FC8, #4A1E78)`.

### Shared colors
| Token | Hex | Use |
|---|---|---|
| `--purple-600` | ≈ #6B2D8F | Destination color (drop-off pins, "Dropoff" label) in both apps |
| `--purple-700` | ≈ #5B2D90 | "Drive with Jeeny" link, promo banners |
| `--teal-500` | ≈ #12A5B5 | MAX badge |
| `--teal-600` | ≈ #0B8A9C | MAX promo strip (gradient to ≈ #0E9AAE) |

**Location color rule:** pickup = pink-500, destination = purple-600, in both apps.

### Neutrals
| Token | Hex | Use |
|---|---|---|
| `--white` | #FFFFFF | Cards, sheets, list surfaces |
| `--gray-25` | ≈ #F7F8FA | Secondary screen backgrounds, strips |
| `--gray-50` | ≈ #F1F2F5 | Header blocks, section gap bands, sheet backgrounds behind cards |
| `--gray-100` | ≈ #ECEDF0 | Icon tiles, filled search bar, unselected chips, segmented track |
| `--gray-200` | ≈ #E4E6EA | Dividers, card borders, secondary button border |
| `--gray-300` | ≈ #D3D5DA | Selected chip, grab handle, radio border, chevrons |
| `--gray-500` | ≈ #8A8F98 | Secondary text, placeholders |
| `--gray-700` | ≈ #4A4F57 | Icons, body text |
| `--gray-900` | ≈ #1C1E21 | Headings, primary text |

### Semantic and map
| Token | Hex | Use |
|---|---|---|
| `--success` | ≈ #1E9E4F | "Completed", positive amounts, online dot |
| `--success-50` | ≈ #E8F9EC | "Active" banner background |
| `--danger` | ≈ #E5393B | "Expired", negative amounts, "Cancel Ride" |
| `--amber-500` | ≈ #F5A623 | Warning icon (outstanding balance) |
| `--cash-green` | ≈ #22A447 | Cash payment icon |
| `--tooltip` | ≈ #1F2933 | Dark tooltips (white text) |
| `--route` | ≈ #2B2B2B | Route line on maps (4px, rounded caps) |
| `--search-pulse` | ≈ #4A90E2 at 20–40% | Pulsing circles while searching for a driver |
| `--scrim` | rgba(0,0,0,0.35) | Overlay behind sheets and the drawer |

## 3. Typography
- Font: **Poppins** (Google Fonts), weights 400/500/600/700.
- Stack: `"Poppins", "Noto Sans Arabic", system-ui, sans-serif`.
- Money is always `JOD 1.25`: currency code first, 2 decimals.

| Style | Size / Line height | Weight | Example |
|---|---|---|---|
| Display | 32 / 40 | 700 | "My Cards", "JOD 122.00", trip offer fare |
| Status title | 26 / 34 | 700 | "Ride Requested" |
| H1 | 22 / 30 | 600 | "November 2026", "You're Online" |
| H2 (sheet title) | 20 / 28 | 600 | "Gender", "Pickup Location" |
| Nav title | 18 / 24 | 500 | "My Rides" (centered) |
| Option name | 19 / 26 | 500 | "Economy" (600 when selected) |
| Body L | 16–17 / 24 | 400 | List labels, addresses |
| Body | 15 / 22 | 400 | Descriptions, labels in gray |
| Caption | 14 / 20 | 400 | Times, small secondary text |
| Small label | 13 / 18 | 500 | "Pickup"/"Dropoff" labels, badges |
| Button | 17 / 24 | 600 | "Confirm Economy" |
| Link | 16 / 24 | 500 | "Add New", "Read more" (accent) |

Patterns:
- Date in gray-900 + time in gray-500 on one line ("18 Nov, 2026, 08:38 AM").
- "To:" label weight 500 gray-900 + address gray-700.
- Price gray-900 + status in semantic color inline ("JOD 0.60 • Completed").

## 4. Spacing, Radius, Elevation
- Base unit 4px. Steps: 4, 8, 12, 16, 20, 24, 32.
- Screen horizontal padding: **20px**.
- List rows: 16px vertical padding, 12px gap between icon and text.

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 8px | Badges, tooltips |
| `--radius-md` | 12px | Icon tiles, back button, avatars, stat cards |
| `--radius-lg` | 14px | Buttons, inputs, floating address cards |
| `--radius-xl` | 20px | Info cards in sheets, service tiles |
| `--radius-2xl` | 24px | Bottom sheet top corners |
| `--radius-pill` | 999px | Chips, segmented control, progress segments, count badges |

| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | 0 1px 3px rgba(0,0,0,0.08) | Back button, small round buttons |
| `--shadow-md` | 0 2px 8px rgba(0,0,0,0.08) | Cards, floating address cards |
| `--shadow-sheet` | 0 -4px 16px rgba(0,0,0,0.08) | Bottom sheets |

Shadows are always soft and light.

## 5. Core Components

### Primary button
- Full width minus screen padding, height 52px, radius 14px.
- `--accent` background, white text 17/600, centered.
- 1px bottom border in `--accent-dark` (slightly raised look).
- Pressed: `--accent-dark` background, scale 0.98.
- Optional leading icon. Label names the action ("Confirm Shared Ride").
- Pinned to the bottom of action screens, 16px from the bottom edge.

### Secondary button
- Same size. White, 1.5px gray-200 border, gray-900 text 17/500.
- Optional leading accent-colored icon ("Set on Map").

### Text link
- `--accent`, 16/500, no underline.

### Back button / icon button
- 44×44px, white, radius 12px, 1px gray-200 border, shadow-sm.
- Chevron-left 20px gray-700. Top-left, 16px from edges. Also floats over maps.
- On purple driver headers: white at 20% opacity, white chevron.
- Home header uses the same style for the menu and bell buttons.

### Nav header
- Back button left, title centered (18/500). White with 1px gray-200 bottom border,
  or directly on the screen background.

### Search field
- Resting: height 56px, gray-100 fill, 1px gray-200 border, radius 16px, search icon
  gray-500, placeholder "Where to, {name}?" 17/400 gray-900.
- Active: white fill, 1.5px `--accent` border, glow `0 0 0 3px var(--accent-soft)`.

### Phone input
- Height 56px, white, 1px gray-200 border, radius 14px.
- Flag (24px circle) + small chevron + "+962" 17/400, then the number.

### Chips
- Height 36px, radius pill, padding 0 16px, 15/500, 8px gaps, horizontal scroll.
- Selected: gray-300 background, gray-900 text. Unselected: gray-100, gray-500 text.

### Segmented control
- Track gray-100, radius pill, height 44px, padding 4px.
- Segments equal width, 15/400 gray-500. Selected: white pill, shadow-sm, 15/500 gray-900.

### List row with icon tile
- Tile 60×60px, radius 12px, gray-100 fill, 24px outline icon gray-700 (or car image).
- Text block up to 3 lines (title / meta / price + status).
- Trailing heart (gray-500) or 44px white circular action buttons with shadow-sm.
- Divider 1px gray-200, inset to the text start.

### Settings row
- ~56px tall. 24px outline icon gray-700, label Body L, optional right value gray-700,
  chevron 16px gray-300. Inset divider. Groups separated by 8px gray-50 bands.

### Bottom sheet
- White, top radius 24px, shadow-sheet, scrim behind.
- Grab handle 44×4px gray-300, centered, 12px from top.
- Optional close × (24px gray-900) top-right. Title H2 left-aligned.
- Primary button pinned at the bottom.

### Radio / checkbox
- Radio: 22px circle, 1.5px gray-300 border. Selected: accent border + 10px accent dot.
  Label Body L gray-700, rows ~56px, inset dividers.
- Checkbox: 20px, radius 5px. Checked: accent fill, white check.

### Card
- White, radius 12px, shadow-md, padding 20px.
- Notification variant: 6px accent bar down the left edge.

### Stat card
- White, 1px gray-200 border, radius 12px, padding 16px, 2-column grid, 12px gap.
- 24px accent outline icon, label 15/400 gray-500, value 24/600 gray-900, optional ⓘ top-right.

### Badges and status
- Count / "New": pill, accent-soft background, accent text 13/500, padding 2px 8px.
- MAX badge: teal-500 background, white text and logo, radius 8px.
- Online: 8px success dot + "You're Online" 22/600 + chevron.
- "Active" banner: success-50 background, success dot + text 17/500, centered.

### Avatar
- Rounded square, radius 16px (12px when small), white, 1px gray-300 border,
  initials 600 gray-900. 72px on profiles, 56px in the drawer, 48px in the seat row.

### Service tile
- accent-soft background, radius 20px, ~170px tall, image centered, label 16/500 below.
  Two columns, 16px gap.

### Empty state
- 88px accent-soft circle with 40px accent outline icon, title 20/600, body 15/400
  gray-500 centered (max 320px wide), primary CTA pinned at the bottom.

### Progress steps (vertical)
- 40px accent circles with white check when complete, 2px gray-200 connector.
- Title 17/500 gray-900, subtitle 15/400 gray-500.

### Side drawer
- White, ~73% width, from the left, scrim on the rest. gray-50 profile block on top.
  Settings rows below. Footer "Drive with Jeeny" in purple-700.

## 6. Map & Booking Flow

### Map
- Muted light gray style, minimal POIs. Route: `--route` line.
- Pickup: blue current-location dot or pink pin (pink circle head, white center dot,
  thin stem). Drop-off: purple-600 pin.
- Driver app: car shown as a top-down white car icon, rotated to heading.
- Recenter button: 52px white rounded square radius 14px with accent navigation arrow
  (driver app: 56px white circle, black arrow).

### Floating address cards (on the map)
- White, radius 14px, shadow-md, padding 12px 16px.
- Line 1: "Pickup" (pink-500) or "Dropoff" (purple-600), 13/500.
- Line 2: address 17/500 gray-900, one line, truncated with "…". Trailing chevron.

### Ride option list (booking sheet)
- Caption centered gray-500 14px: "Prices shown are estimates and may vary".
- Rows ~76px, padding 16px 20px: vehicle image ~56px wide left; name 19/500 +
  description 15/400 gray-500 middle; price 18/500 + ETA 15/400 gray-500 right-aligned.
- **Selected:** accent-soft background, 4px accent bar on the left edge,
  price in accent, name weight 600.
- Inset 1px gray-200 dividers.
- **Our row:** name "Shared", description "Split the fare, same gender only",
  price "from JOD 1.30".

### Outstanding balance strip
- Full width, gray-25 background, 1px gray-200 top and bottom borders, ~52px tall.
- Amber warning circle 20px, "Outstanding balance JOD 1.00" 16/400 gray-700, chevron.
- Used for the 1 JD cancellation fee on the rider's next booking.

### Payment / promo row
- Two halves split by a 1px vertical gray-200 divider, ~60px tall.
- Left: cash-green icon + "Cash" 17/400 + chevron. Right: ticket icon + "Add promo" + chevron.
- Directly above the primary button.

### Status sheet (after booking)
- Map above with the pickup pin centered and **pulsing blue circles** (2 rings
  scaling out and fading, ~1.5s loop) while waiting or searching.
- Header: grab handle, status title 26/700, subtitle 17/400 gray-500.
- **3-segment progress bar:** 3 equal segments, 4px tall, radius pill, 8px gaps,
  filled = accent, empty = gray-200, one segment per stage, current one may shimmer.
- Shared Ride stages:
  1. "Waiting for riders" / "2 of 4 seats filled"
  2. "Finding your driver" / "Your ride is full"
  3. "Driver on the way" / "Omar · White Hyundai Elantra · 12-34567"

### Stacked info cards (below the status header)
- Sheet background gray-50. White cards, radius 20px, 8px gaps, full width.
- **Seat card:** the seat row (section 7).
- **Location card:** two rows, 24px pin icons (pink start, purple destination),
  label 15/400 gray-500 ("Start Location" / "Your Destination"), value 17/500,
  one line truncated, inset divider.
- **Booking Details card:** label 15/400 gray-500, rows of 40px icon + 18/400 label
  ("Shared", "Cash").
- **Cancel card:** red circled no-car icon + "Cancel Ride" 18/500 danger. Last card.

### Promo strip (optional, skip unless time allows)
- Teal strip above the booking sheet, top radius 24px, ~56px tall, white MAX pill +
  white text + close ×. The white sheet overlaps it with its own 24px radius.

## 7. Feature Components (new, designed in Jeeny's style)

### Seat row
- 4 slots in a row, 48px each, 12px gaps.
- Filled: avatar (radius 12px, white, gray-300 border, initials 16/600).
  Host has a small accent "Host" pill under the avatar.
- Empty: dashed 1.5px gray-300 border, radius 12px, gray-500 "+" icon.
- Below: "2 of 4 seats filled · JOD 3.10 each" 16/500, price in accent.
- Price change animates (number counts down 300ms) when someone joins.

### Matching ride card (joiner's list)
- White card, radius 20px, shadow-md, padding 16px.
- Top: host first name + mini seat row (24px slots) + "2 seats left" 14/500 accent.
- Middle: pickup and destination rows (pink and purple dots, 15/400, truncated).
- Bottom: "Arrives by 7:55" 15/400 gray-500 left, "JOD 1.65 each" 18/600 right.
- Full-width primary button "Join ride" inside the card.

### Trip offer sheet (driver)
- Bottom sheet over the driver map, top radius 24px, shadow-sheet.
- Header: "Shared Ride" pill (purple-50 background, purple-500 text 13/600) +
  "Scheduled · 7:20 AM" 15/400 gray-500.
- Fare "JOD 6.20" 32/700, under it "4 riders · cash" 15/400 gray-500.
- Stops list in order: pickup dots pink-500, drop-off dots purple-600, 2px gray-200
  connector. Each stop: first name 15/500 + short address 15/400 gray-500, truncated.
- "12.4 km · ~28 min" 15/400 gray-500.
- Buttons side by side, 52px, radius 14px: "Reject" secondary (1/3 width) and
  "Accept" primary in purple (2/3 width).
- "Respond by 6:50 AM" 14/400 gray-500 below. No seconds countdown for scheduled trips.

## 8. Icons
- Outline style, 1.75px stroke, rounded caps and joins, 24px default.
- Use **Lucide**. Default gray-700, accent for highlights.
- Vehicle images: 3/4-view white car on transparent background.

## 9. Motion
- Bottom sheets slide up 250ms ease-out, scrim fades in 200ms.
- Button press: accent-dark background, scale 0.98.
- Searching: pulsing circles on the map. Progress segment shimmer.
- Live updates (someone joins or leaves): seat slot fades in or out 200ms, price counts.
- No bouncy or decorative animation.

## 10. Do / Don't
- DO keep screens mostly white and gray. Accent only for actions and key highlights.
- DO pin the main action to the bottom of the screen.
- DO use pink for pickup and purple for destination everywhere.
- DON'T use gradients except promo banners, the MAX header and driver headers.
- DON'T use pill-shaped primary buttons (they're 14px radius).
- DON'T use dark or heavy shadows.
- DON'T use purple as an action color on rider screens, or pink on driver screens.
