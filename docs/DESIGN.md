# DESIGN.md: Jeeny Design Language

Sources: screenshots of the Jeeny rider app (Android, Nov 2026) and App Store images of
the Jeeny for Drivers app. Sizes are in CSS px.
`≈` = estimated from screenshots. Verify with a color picker before locking.
**Example text and numbers** (prices, times, names) follow SPEC.md v5 and are placeholders
until regenerated from the demo snapshot. SPEC.md wins on any number or behavior.

## 1. Language & Direction
- UI language: English. Direction: LTR only. No RTL mirroring.
- Arabic appears only inside data (street names, addresses, people's names, chat
  messages) and renders inline within the LTR layout.
- Font stacks must include an Arabic fallback so mixed strings render cleanly.
- Chat bubbles use `dir="auto"` so an Arabic message aligns correctly inside its bubble
  while the layout stays LTR.

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
| `--pink-50` | ≈ #FDEEF6 | Service tiles, icon circles, selected row background, own chat bubbles |

### Driver brand
| Token | Hex | Use |
|---|---|---|
| `--purple-500` | ≈ #7E35C0 | Driver accent: buttons, icons, selected states |
| `--purple-800` | ≈ #4A1E78 | Dark end of driver gradients |
| `--purple-200` | ≈ #D3A2EE | Secondary chart bars, legend dots |
| `--purple-50` | ≈ #F4ECFB | Soft backgrounds, icon circles, own chat bubbles (driver) |

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
| `--gray-25` | ≈ #F7F8FA | Secondary screen backgrounds, strips, chat background |
| `--gray-50` | ≈ #F1F2F5 | Header blocks, section gap bands, sheet backgrounds behind cards |
| `--gray-100` | ≈ #ECEDF0 | Icon tiles, filled search bar, unselected chips, segmented track, others' chat bubbles |
| `--gray-200` | ≈ #E4E6EA | Dividers, card borders, secondary button border |
| `--gray-300` | ≈ #D3D5DA | Selected chip, grab handle, radio border, chevrons |
| `--gray-500` | ≈ #8A8F98 | Secondary text, placeholders, system messages |
| `--gray-700` | ≈ #4A4F57 | Icons, body text |
| `--gray-900` | ≈ #1C1E21 | Headings, primary text |

### Semantic and map
| Token | Hex | Use |
|---|---|---|
| `--success` | ≈ #1E9E4F | "Completed", positive amounts, online dot, "Ready ✓", savings |
| `--success-50` | ≈ #E8F9EC | "Active" banner background |
| `--danger` | ≈ #E5393B | "Expired", negative amounts, "Leave ride", late-leave amount |
| `--amber-500` | ≈ #F5A623 | Warning icon (outstanding balance), ready-check countdown under 1 min |
| `--cash-green` | ≈ #22A447 | Cash payment icon |
| `--tooltip` | ≈ #1F2933 | Dark tooltips (white text) |
| `--route` | ≈ #2B2B2B | Route line on the driver's map (4px, rounded caps) |
| `--search-pulse` | ≈ #4A90E2 at 20–40% | Pulsing circles while waiting or searching |
| `--scrim` | rgba(0,0,0,0.35) | Overlay behind sheets and the drawer |

## 3. Typography
- Font: **Poppins** (Google Fonts), weights 400/500/600/700.
- Stack: `"Poppins", "Noto Sans Arabic", system-ui, sans-serif`.
- Money is always `JOD 1.25`: currency code first, 2 decimals.
- Times are always `7:02 AM` (12-hour, no leading zero).

| Style | Size / Line height | Weight | Example |
|---|---|---|---|
| Display | 32 / 40 | 700 | "JOD 9.03" (trip offer), ready-check countdown "4:32", summary amount |
| Status title | 26 / 34 | 700 | "Waiting for riders" |
| H1 | 22 / 30 | 600 | "Shared rides", "You're Online" |
| H2 (sheet title) | 20 / 28 | 600 | "Ready to find a driver?" |
| Nav title | 18 / 24 | 500 | "To JUST · 8:00 AM" (centered) |
| Option name | 19 / 26 | 500 | "Shared" (600 when selected) |
| Body L | 16–17 / 24 | 400 | List labels, addresses, chat messages (16) |
| Body | 15 / 22 | 400 | Descriptions, labels in gray |
| Caption | 14 / 20 | 400 | Times, small secondary text |
| Small label | 13 / 18 | 500 | "Pickup"/"Dropoff" labels, badges, chat sender names |
| Button | 17 / 24 | 600 | "Confirm Shared Ride" |
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
| `--radius-bubble` | 16px | Chat bubbles |
| `--radius-xl` | 20px | Info cards in sheets, service tiles, chat input field |
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
- Pressed: `--accent-dark` background, scale 0.98. Disabled: gray-200 background, gray-500 text.
- Optional leading icon. Label names the action ("Confirm Shared Ride", "Find driver").
- Pinned to the bottom of action screens, 16px from the bottom edge.

### Secondary button
- Same size. White, 1.5px gray-200 border, gray-900 text 17/500.
- Optional leading accent-colored icon ("Set on Map").
- Danger variant: same, but text in `--danger` ("Leave anyway").

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

### Quick-pick place chips (demo seed places)
- A horizontal row of chips directly under the search field, same style as Chips below,
  each with a 16px pin icon in pink (pickup screen) or purple (destination screen).
- Labels: "Irbid City Center", "University Street", "Al-Hashmi Street",
  "Yarmouk University", "Arabella Mall", "JUST".

### Phone input
- Height 56px, white, 1px gray-200 border, radius 14px.
- Flag (24px circle) + small chevron + "+962" 17/400, then the number.

### Chips
- Height 36px, radius pill, padding 0 16px, 15/500, 8px gaps, horizontal scroll.
- Selected: gray-300 background, gray-900 text. Unselected: gray-100, gray-500 text.

### Segmented control
- Track gray-100, radius pill, height 44px, padding 4px.
- Segments equal width, 15/400 gray-500. Selected: white pill, shadow-sm, 15/500 gray-900.
- Used for gender at signup ("Male | Female").

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
  Also used for unread chat counts.
- MAX badge: teal-500 background, white text and logo, radius 8px.
- Online: 8px success dot + "You're Online" 22/600 + chevron.
- "Active" banner: success-50 background, success dot + text 17/500, centered.

### In-app banner
- Slides down from the top, white, radius 14px, shadow-md, 12px margin, padding 12px 16px.
- 20px icon (accent, amber or danger) + text 15/500 gray-900. Auto-hides after 4 s, tap to dismiss.
- Examples: "Your pickup moved to 7:02 AM", "Sara left the ride".

### Avatar
- Rounded square, radius 16px (12px when small), white, 1px gray-300 border,
  initials 600 gray-900. 72px on profiles, 56px in the drawer, 48px in the seat row,
  32px in chat.

### Service tile
- accent-soft background, radius 20px, ~170px tall, image centered, label 16/500 below.
  Two columns, 16px gap.

### Empty state
- 88px accent-soft circle with 40px accent outline icon, title 20/600, body 15/400
  gray-500 centered (max 320px wide), primary CTA pinned at the bottom.
- Shared rides list empty: title "No shared rides yet", body "Start one and others going
  your way can join.", CTA "Start your own shared ride".

### Progress steps (vertical)
- 40px accent circles with white check when complete, 2px gray-200 connector.
- Title 17/500 gray-900, subtitle 15/400 gray-500.

### Side drawer
- White, ~73% width, from the left, scrim on the rest. gray-50 profile block on top.
  Settings rows below. Footer "Drive with Jeeny" in purple-700.

## 6. Map & Booking Flow

### Map
- Google Maps, muted light gray style, minimal POIs.
- **Rider map (privacy, SPEC §3.14):** only the rider's **own pickup** (pink pin: pink
  circle head, white center dot, thin stem) and **the destination** (purple-600 pin).
  Never other riders' pins, no route line. Pulsing circles around the own pickup while
  waiting or searching.
- **Driver map:** every stop as a numbered pin in stop order (white 13/600 number in a
  20px pink circle for pickups, purple pin for the destination), the route line in
  `--route` (P1), and the car as a top-down white car icon.
- Recenter button: 52px white rounded square radius 14px with accent navigation arrow
  (driver app: 56px white circle, black arrow).
- **Map unavailable (P1):** if the map can't load, the map area becomes a gray-25 panel
  with a 40px gray-500 map icon and "Map unavailable" 15/400 gray-500, centered. Every
  sheet keeps working.

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
  price "from JOD 2.35", ETA replaced by "Scheduled". Tapping it opens the
  **Shared rides list** (below), not host setup.

### Shared rides list (joiner first)
- Nav header: back button, title "Shared rides" (18/500).
- Trip strip under the header: gray-25 background, padding 12px 20px. Line 1:
  "University Street → JUST" 16/500 gray-900. Line 2: "Arrive by 8:00 AM" 14/400 gray-500.
  Trailing "Edit" text link.
- List of **matching ride cards** (§7), 12px gaps, 20px screen padding.
- Pinned at the bottom: secondary button **"Start your own shared ride"**.
- Empty state: see Empty state (§5); its CTA is the same "Start your own shared ride".

### Shared ride setup (host, from "Start your own shared ride")
- Bottom sheet, title "Arrive by", a time picker (hour, minute, AM/PM wheels, 5-min steps).
- Under it, a white info card:
  - "Be ready by 7:15 AM" 17/500 with a clock icon.
  - "If nobody joins: JOD 7.85" 15/400 gray-500.
  - Estimate rows: "2 riders · JOD 4.15 each", "3 riders · JOD 2.95 each",
    "4 riders · JOD 2.35 each" (15/400, price right-aligned in gray-900).
- Primary button "Confirm Shared Ride".

### Outstanding balance strip
- Full width, gray-25 background, 1px gray-200 top and bottom borders, ~52px tall.
- Amber warning circle 20px, "Outstanding balance JOD 2.30" 16/400 gray-700, chevron.
- Shown on the next booking after a late leave or no-show. The amount is the rider's share
  at the time they left.

### Payment / promo row
- Two halves split by a 1px vertical gray-200 divider, ~60px tall.
- Left: cash-green icon + "Cash" 17/400 + chevron. Right: ticket icon + "Add promo" + chevron.
- Directly above the primary button.

### Status sheet (after booking)
- Map above (rider map rules apply). Pulsing circles around the own pickup while waiting
  or searching.
- Header: grab handle, status title 26/700, subtitle 17/400 gray-500.
- **4-segment progress bar:** 4 equal segments, 4px tall, radius pill, 8px gaps,
  filled = accent, empty = gray-200, one segment per stage, current one may shimmer.
- Shared Ride stages:
  1. "Waiting for riders" / "2 of 4 seats filled"
  2. "Ready check" / "3 of 4 ready · 4:32 left"
  3. "Finding your driver" / "Your ride is set"
  4. "Driver on the way" / "Omar · White Hyundai Elantra · 12-34567"
- **Host only, while waiting for riders:** primary button "Find driver" pinned at the
  bottom of the sheet, with helper text 14/400 gray-500 above it:
  "Starts automatically at 6:17 AM".

### Stacked info cards (below the status header)
- Sheet background gray-50. White cards, radius 20px, 8px gaps, full width. Order:
1. **Seat card:** the seat row (§7).
2. **Chat card:** chat entry (§7).
3. **Location card:** three rows:
   - "Be ready by 7:02 AM · Pickup 1 of 3" 17/500 with a 24px clock icon in accent.
   - Start location: 24px pink pin, label 15/400 gray-500 "Start Location", value 17/500, one line truncated.
   - Destination: 24px purple pin, label "Your Destination", value 17/500.
   - Inset dividers between rows.
4. **Booking Details card:** label 15/400 gray-500, rows of 40px icon + 18/400 label
   ("Shared", "Cash").
5. **Leave card:** red circled no-car icon + "Leave ride" 18/500 danger. Last card.

### Promo strip (optional, skip unless time allows)
- Teal strip above the booking sheet, top radius 24px, ~56px tall, white MAX pill +
  white text + close ×. The white sheet overlaps it with its own 24px radius.

## 7. Feature Components (new, designed in Jeeny's style)

### Seat row
- 4 slots in a row, 48px each, 12px gaps.
- Filled: avatar (radius 12px, white, gray-300 border, initials 16/600).
  Host has a small accent "Host" pill under the avatar.
  During the ready check, a 16px status dot sits on the avatar's bottom-right corner:
  success with a white check = ready, gray-300 = waiting.
- Empty: dashed 1.5px gray-300 border, radius 12px, gray-500 "+" icon.
  After the ready check starts, empty slots show a gray-100 fill and no "+" (joining closed).
- Below: "2 of 4 seats filled · JOD 4.00 each" 16/500, price in accent.
- Price change animates (number counts 300ms) when someone joins or leaves.

### Matching ride card (Shared rides list)
- White card, radius 20px, shadow-md, padding 16px.
- Top: host first name 17/600 + mini seat row (24px slots) + "2 seats left" 14/500 accent.
- Middle: pickup and destination rows (pink and purple dots, 15/400), **area names only**:
  "City Center area" → "JUST".
- Info line 15/400 gray-500: "Arrives by 8:00 AM · Pickup ~7:21 AM".
- Bottom right: "JOD 4.00 each if you join" 18/600 gray-900 ("JOD 4.00" in accent).
- Full-width primary button "Join" inside the card. Tapping it joins instantly.

### Chat card (entry point on the status sheet)
- White info card, radius 20px, padding 16px.
- Row: 24px chat icon in accent + "Group chat" 17/500 + unread badge (count pill) + chevron.
- Second line: last message preview 15/400 gray-500, one line truncated,
  e.g. "Dana: I'll be at the main gate".

### Group chat screen
- **Header:** back button, centered title "To JUST · 8:00 AM" 18/500, under it the mini seat
  row (24px slots) centered. 1px gray-200 bottom border.
- **Background:** gray-25. Shows the last 100 messages.
- **Others' messages:** left-aligned. 32px avatar on the left of the first bubble in a group.
  Sender first name 13/500 gray-500 above the bubble. Bubble gray-100, radius 16px with the
  bottom-left corner 4px, padding 10px 14px, text 16/400 gray-900, max width 75%.
- **Own messages:** right-aligned, no avatar, no name. Bubble `--accent-soft`, radius 16px
  with the bottom-right corner 4px, text 16/400 gray-900.
- **Time:** 12/400 gray-500 under the last bubble of a group ("6:12 AM").
- **System messages:** centered, 13/400 gray-500, no bubble, 12px vertical margin:
  "Sara joined", "Lina started the ready check", "Dana is ready", "Omar is your driver",
  "Pickup times are now fixed".
- **Masked text:** phone numbers and links appear as "•••" in gray-500.
- **Input bar:** pinned to the bottom, white, 1px gray-200 top border, padding 8px 12px.
  Field: gray-100 fill, radius 20px, height 44px, 16px text, placeholder "Message the group…".
  Send button: 44px circle, `--accent` fill, white send icon. Disabled (gray-200) when empty.
  Character counter "280/300" 12/400 gray-500 appears only above 250 characters.
- **Read-only state** (ride completed or canceled): the input bar is replaced by a gray-50
  strip with "This chat is closed" 14/400 gray-500, centered.

### Driver chat (P1)
- Same chat screen component, one-to-one.
- Rider side: title "Omar · Driver" with a 32px avatar, placeholder "Message your driver…".
- Driver side: purple accent, title is the rider's first name, placeholder
  "Message Lina…". The driver's active trip has a "Chat" icon button next to each stop.

### Ready check sheet
- Bottom sheet over the status screen, opens on every rider's phone at the same moment.
- Title H2: "Ready to find a driver?"
- Subtitle 15/400 gray-500: "Lina started the ready check. No answer counts as ready."
- Countdown "4:32" Display 32/700 in accent (amber under 1:00), centered, with a thin
  circular progress ring (4px, accent on gray-200) around it, 96px. Freezes while the
  demo clock is paused.
- Rider list: one row per rider, 32px avatar + first name 16/500 + status right-aligned:
  "Ready ✓" in success 15/500, "Waiting…" in gray-500, "Left" in danger.
- Buttons stacked: primary "I'm ready", then secondary "Cancel ride for me".
  Footnote 13/400 gray-500 under them: "Leaving now is free."
- After answering, buttons are replaced by "You're ready. Waiting for others…" 15/500
  success, centered. The sheet closes automatically when the ride goes to drivers.

### Leave sheet
- **Late leave** (after a driver accepts and < 30 min before pickup): title H2
  "Leave this ride?". Body 15/400 gray-700: "Your driver is already booked and pickup is
  in less than 30 minutes." Amount row in a gray-25 box, radius 14px, padding 16px:
  "You'll pay your share" 15/400 gray-700 left, "JOD 2.30" 20/700 danger right. Under it
  13/400 gray-500: "Added as an outstanding balance on your next ride." Buttons stacked:
  primary "Keep my seat", then secondary danger "Leave anyway".
- **Free leave** (before a driver accepts, or ≥ 30 min before pickup): title
  "Leave this ride?", body "Leaving now is free. Others' shares will update.", buttons
  primary "Keep my seat" and secondary danger "Leave ride". No amount box.

### Trip offer sheet (driver)
- Bottom sheet over the driver map, top radius 24px, shadow-sheet.
- Header: "Shared Ride" pill (purple-50 background, purple-500 text 13/600) +
  "First pickup · 7:02 AM" 15/400 gray-500.
- Fare "JOD 9.03" 32/700, under it "4 riders · cash · collect JOD 9.20" 15/400 gray-500.
- Stops list in order: pickup dots pink-500, drop-off dots purple-600, 2px gray-200
  connector. Each stop: time 15/500 gray-900 ("7:02") + first name 15/500 + short area
  15/400 gray-500, truncated. Pickups also show the rider's share right-aligned
  ("JOD 2.30", 15/500).
- "21.4 km · ~54 min" 15/400 gray-500.
- Buttons side by side, 52px, radius 14px: "Reject" secondary (1/3 width) and
  "Accept" primary in purple (2/3 width).
- "Respond by 6:47 AM" 14/400 gray-500 below. No seconds countdown for scheduled trips.

### Driver active trip (stops list)
- Status sheet in the driver app, purple accent, same stacked-card layout.
- Header: "Shared Ride · 3 riders" 22/600, subtitle
  "Collect JOD 6.60 cash · JOD 2.30 credit at trip end".
- One row per stop, in order: time, first name, short address (full address visible to
  the driver), share, and actions (P1):
  - Pickup row: secondary small button "Picked up" (height 36px, radius 10px) and a
    44px chat icon button.
  - Drop-off row: small primary button "Dropped off · collected JOD 2.20".
  - Done rows: gray-500 text with a success check.
- **Rider-left banner** (in-app banner, danger icon): "Sara canceled. Collect JOD 6.60
  cash · JOD 2.30 credit at trip end". Her stops fade out over 300ms. Other stop times
  don't change.

### Trip summary screen (P0)
- Full screen, white. Top: 88px success-50 circle with a 40px success check icon, centered.
- Title 22/600 centered: "You've arrived" (rider) / "Trip complete" (driver).
- Subtitle 15/400 gray-500 centered: "To JUST · arrived 7:54 AM".
- **Rider card** (white, radius 20px, 1px gray-200 border, padding 20px):
  - "You paid" 15/400 gray-500, "JOD 2.20" Display 32/700 gray-900, "Cash" with cash-green icon.
  - "3 riders shared this ride" 15/400 gray-700 with the mini seat row.
  - "You saved JOD 5.65 vs riding solo" 15/500 success.
  - Outstanding balance strip if the rider owes anything.
- **Late leaver variant:** title "You left this ride", card shows "JOD 2.30 added to your
  next ride" in danger.
- **Driver card:** one row per rider (first name, "JOD 2.20 cash"), then "Credit from
  Jeeny · JOD 2.30", divider, "Total · JOD 8.90" 20/700.
- Bottom: primary button "Done" (back to home). Chat is read-only from here.

### Demo menu (hidden, not part of the Jeeny look)
- Plain functional screen: system font, simple buttons, no Jeeny styling needed.
- Shows build stamp, server health, clock time and whether it's paused, data source.
- Big buttons, one per action: +5 min, Next event, Jump to…, Pause/Resume,
  Simulate rider, Complete trip, Reset.

## 8. Icons
- Outline style, 1.75px stroke, rounded caps and joins, 24px default.
- Use **Lucide**. Default gray-700, accent for highlights.
- Chat: `message-circle`. Send: `send`. Ready: `check-circle-2`. Clock: `clock`.
  Map unavailable: `map-off`. Summary: `circle-check`.
- Vehicle images: 3/4-view white car on transparent background.

## 9. Motion
- Bottom sheets slide up 250ms ease-out, scrim fades in 200ms.
- Button press: accent-dark background, scale 0.98.
- Waiting and searching: pulsing circles on the map. Progress segment shimmer.
- Live updates (someone joins or leaves): seat slot fades in or out 200ms, price counts.
- New chat message: bubble fades and slides up 8px, 150ms.
- Ready check: countdown ring drains smoothly. Status dots pop in (scale 0.8 → 1, 150ms).
- No bouncy or decorative animation.

## 10. Do / Don't
- DO keep screens mostly white and gray. Accent only for actions and key highlights.
- DO pin the main action to the bottom of the screen.
- DO use pink for pickup and purple for destination everywhere.
- DO show area names only (never exact addresses) to other riders.
- DON'T show other riders' pins or the route line on a rider's map.
- DON'T use gradients except promo banners, the MAX header and driver headers.
- DON'T use pill-shaped primary buttons (they're 14px radius).
- DON'T use dark or heavy shadows.
- DON'T use purple as an action color on rider screens, or pink on driver screens.
- DON'T add chat extras (photos, voice, reactions, typing indicators, read receipts).
