# DESIGN.md: RideSync Design Language ("Converge")

RideSync's own look. It is **not** a Jeeny mockup: no pink, no purple, no Jeeny layouts.
Sizes are in CSS px. **Example text and numbers** (prices, times, names) follow SPEC.md and
are placeholders until regenerated from the demo snapshot. SPEC.md wins on any number or behavior.

## 0. The idea in three rules
1. **Lines that merge.** Each rider is a thin line, and a synced ride is one thick line.
   The same mark is the logo, the loader, the stop timeline and the seat row.
2. **Departure-board numbers.** Pickup times and prices are the biggest things on screen.
   They use a heavy display face with tabular figures, and change with a split-flap roll.
3. **Color = category, surface = role.** Economy, Comfort and Airport each tint the app with
   one accent. Riders get warm "Paper" light surfaces. Drivers get a dark "Cockpit".

If a screen doesn't use at least one of these, it isn't RideSync yet.

## 1. Language & Direction
- UI language: English. Direction: LTR only. No RTL mirroring.
- Arabic appears only inside data (street names, addresses, people's names, chat
  messages) and renders inline within the LTR layout.
- Font stacks include an Arabic fallback so mixed strings render cleanly.
- Chat bubbles use `dir="auto"`.

## 2. Color

### 2.1 Accent rule (most important)
Components use only `--accent`, `--accent-strong`, `--accent-soft` and `--accent-text`.
They never hard-code a hex value. The accent comes from the **category**, not the role:

```css
[data-category="economy"] { --accent: var(--tangerine-500); --accent-strong: var(--tangerine-600);
                            --accent-soft: var(--tangerine-100); --accent-text: var(--tangerine-700); }
[data-category="comfort"] { --accent: var(--glacier-500);   --accent-strong: var(--glacier-600);
                            --accent-soft: var(--glacier-100);   --accent-text: var(--glacier-700); }
[data-category="airport"] { --accent: var(--runway-500);    --accent-strong: var(--runway-600);
                            --accent-soft: var(--runway-100);    --accent-text: var(--runway-700); }
```
- Home and signup (no category yet) use Economy.
- Once a ride exists, its category sets the accent on every screen of that ride, for riders
  **and** the driver.
- **Text on an accent fill is always `--ink-900`.** All three accents are light enough for
  ink text (≥ 6:1). Never put white text on an accent.
- Accent-colored **text** on Paper uses `--accent-text` (≥ 4.5:1), never `--accent`.

### 2.2 Category accents
| Token | Hex | Use |
|---|---|---|
| `--tangerine-500` | #FF6A2B | Economy accent: primary buttons, selected tile, seat fill, own-pickup halo |
| `--tangerine-600` | #E4521A | Economy pressed state |
| `--tangerine-100` | #FFE4D6 | Economy soft: own chat bubbles, selected rows, badges |
| `--tangerine-700` | #B53E0C | Economy text on Paper (links, prices in accent) |
| `--glacier-500` | #7DB4FF | Comfort accent |
| `--glacier-600` | #5A98EE | Comfort pressed |
| `--glacier-100` | #E2EEFF | Comfort soft |
| `--glacier-700` | #1F5BB5 | Comfort text on Paper |
| `--runway-500` | #FFD23F | Airport accent (runway-marking yellow) |
| `--runway-600` | #EDBB14 | Airport pressed |
| `--runway-100` | #FFF4CC | Airport soft |
| `--runway-700` | #7A5C00 | Airport text on Paper |

### 2.3 Paper (rider surfaces, light)
| Token | Hex | Use |
|---|---|---|
| `--white` | #FFFFFF | Cards, sheets, the Sync Pass |
| `--paper-50` | #F6F3EE | Screen background, chat background |
| `--paper-100` | #EDE9E1 | Chips, switch track (off), others' chat bubbles, input fill |
| `--ink-200` | #DCD8D0 | Dividers, card borders, perforation dashes |
| `--ink-300` | #BDB9B1 | Empty-seat dashed ring, strong borders |
| `--ink-500` | #666970 | Secondary text, placeholders, system messages (≥4.5:1 on paper-50 and paper-100) |
| `--ink-700` | #3A3D45 | Body text, icons |
| `--ink-900` | #15171C | Headings, numbers, text on accent, pickup/destination marks, button keel |

### 2.4 Cockpit (driver surfaces, dark)
`[data-role="driver"]` remaps the surface tokens. Components use the same names.
| Token | Driver value | Use |
|---|---|---|
| `--surface` | #0D0F13 (rider: `--paper-50`) | Screen background |
| `--card` | #171A21 (rider: `--white`) | Cards, sheets |
| `--raised` | #232831 (rider: `--paper-100`) | Chips, tracks, bubbles |
| `--line` | #343A45 (rider: `--ink-200`) | Dividers, borders |
| `--text-2` | #9AA1AC (rider: `--ink-500`) | Secondary text |
| `--text-1` | #F1F2F4 (rider: `--ink-900`) | Primary text, marks |

Text on accent stays `--ink-900` in the Cockpit too.

### 2.5 Semantic and map
| Token | Hex | Use |
|---|---|---|
| `--success` | #1E9A55 | "Ready ✓", savings, "Completed", online dot |
| `--success-soft` | #DDF3E6 | Summary check circle, success banners |
| `--success-text` | #167A43 (Cockpit #4CC982) | Success-colored text ("Ready ✓", savings): `--success` is for fills only |
| `--danger` | #D93A3F | "Leave ride", late-leave amount, errors |
| `--danger-soft` | #FBE3E3 | Late-leave amount box |
| `--warn` | #B7791F | Outstanding balance icon, countdown under 1:00 (as text, not fill) |
| `--scrim` | rgba(21,23,28,0.45) | Behind sheets |

**Location rule (both roles):** locations are coded by **shape**, not color.
Pickup = **ring** (hollow circle, 3px stroke, `--text-1`). Destination = **filled square**
(`--text-1`). The rider's **own** pickup also gets the accent halo.

## 3. Typography
- **Display:** "Bricolage Grotesque" (Google Fonts), 700/800. Headings and every big number.
- **UI:** "Inter" (Google Fonts), 400/500/600. Everything else.
- Stacks: `"Bricolage Grotesque", "Noto Sans Arabic", system-ui, sans-serif` and
  `"Inter", "Noto Sans Arabic", system-ui, sans-serif`.
- All numbers use `font-variant-numeric: tabular-nums` so times and prices don't jitter.
- Money is always `JOD 2.30`: in big numbers, "JOD" is set in the Eyebrow style before
  the number. Times are always `7:02 AM` (12-hour, no leading zero).

| Style | Font · Size / Line · Weight | Example |
|---|---|---|
| Hero number | Display 52/52 800, letter-spacing −0.02em | "7:02" on the Sync Pass, "JOD 2.30" on the summary, countdown "4:32" |
| Big number | Display 32/36 800 | Trip offer fare "JOD 9.03", share on a matching card |
| H1 | Display 26/30 700 | "Rides going your way", "You're online" |
| H2 (sheet title) | Display 21/26 700 | "Ready to ride?" |
| Eyebrow | UI 12/16 600, uppercase, letter-spacing 0.08em | "CITY CENTER → JUST", "BE READY BY", "ECONOMY" |
| Body L | UI 17/24 400 | Addresses, list labels, chat messages (16) |
| Body | UI 15/22 400 | Descriptions, helper text |
| Caption | UI 13/18 500 | Times under chat, small meta |
| Button | UI 17/24 600 | "Join · JOD 4.00" |
| Link | UI 16/24 600, `--accent-text`, underline offset 3px | "Edit", "Change" |

## 4. Space, Shape, Depth
- Base unit 4px. Steps: 4, 8, 12, 16, 20, 24, 32, 40.
- Screen horizontal padding **20px**. List rows 16px vertical padding.

| Token | Value | Use |
|---|---|---|
| `--r-xs` | 6px | Badges inside dense rows |
| `--r-sm` | 10px | Inputs, chips inside cards, small buttons |
| `--r-md` | 16px | Category tiles, list cards, chat bubbles |
| `--r-lg` | 24px | The Sync Pass, info cards |
| `--r-sheet` | 28px | Bottom sheet top corners |
| `--r-pill` | 999px | **Primary and secondary buttons**, switches, seat meter, gender badges |

**Depth = borders, not shadows.** Cards are white with a 1px `--line` border and no shadow.
Only two things cast shadows:
- Bottom sheets: `0 -8px 24px rgba(21,23,28,0.10)`.
- Floating map controls: `0 2px 8px rgba(21,23,28,0.12)`.

## 5. Signature Components

### Merge mark (logo, loader)
- Three 3px lines enter from the left at different heights and merge into one 6px line
  that ends in a filled square (the destination). `--text-1` lines, the merged line in `--accent`.
- **Logo:** merge mark + "RideSync" in Display 22/700, "Sync" in `--accent-text`.
- **Loader** (searching, finding a driver): the three lines draw in, one after another,
  meet, the merged line extends, then repeats every 1.6s. Replaces any spinner.

### Sync Pass (the ride card)
A boarding-pass card. It is the rider's main status surface.
- White, radius 24px, 1px `--line` border, padding 20px.
- **Top half:**
  - Eyebrow row: "CITY CENTER → JUST" left, category badge right ("ECONOMY", accent-soft
    background, ink text, pill).
  - "BE READY BY" Eyebrow, then **"7:02"** Hero number with "AM" in Body L 600 beside it.
  - "Pickup 1 of 3 · Arrive by 8:00 AM" Body `--text-2`.
- **Perforation:** a dashed 1px `--line` rule with a 20px semicircle notch cut into each
  edge (`mask` with two radial gradients). The notches show the screen background.
- **Bottom half:** the Seat meter (below), then on one line "JOD 2.30 each" (number in
  Big number style) and the gender badge ("Women only" / "Men only" / "Mixed").
- The Pass sits at the top of the status sheet. While the ride is OPEN, the time and
  share roll (split-flap) when they change.

### Seat meter
- One row of seats: 4 for Economy, 3 for Comfort and Airport (SPEC §3.16).
- Each seat is a 44px circle on a shared 2px horizontal line (the merge line, `--line`).
- **Filled:** `--accent` fill, initials Inter 15/600 `--ink-900`. "You" seat has a 2px
  `--ink-900` ring outside it. The host has a small "HOST" Eyebrow under the circle.
- **Empty:** dashed 1.5px `--ink-300` ring on the surface color, no fill, a 16px "+" in `--text-2`.
  After the ready check starts, empty seats show a solid `--raised` fill and no "+"
  (joining closed).
- **Ready check:** a 16px badge on the bottom-right of each filled seat: `--success` with a
  white check = ready, `--raised` with `--text-2` dot = waiting.
- **+1 seat** (SPEC §3.17): filled like any seat with the friend's initials, joined to the
  bringer's seat by a short 4px `--accent` bridge instead of the thin line, with a "+1"
  Eyebrow under it. Your own +1 gets a dashed version of the "You" ring.
- Under it: "2 of 4 synced" Body 600 `--text-1`.
- Joining fills the next seat with a left-to-right accent sweep (300ms). The connecting
  line segment up to that seat thickens to 4px `--accent`.

### Split-flap number
- Any time or price that can change live (share, "Be ready by", seat count) rolls each
  changed digit vertically, old digit out the top, new digit in from below, 220ms,
  30ms stagger per digit. Only changed digits move.
- `prefers-reduced-motion`: swap instantly.

### Category tiles
- Three equal tiles in one row, 8px gaps, radius 16px, height ~128px, padding 14px.
- Each tile: category glyph (24px Lucide: `car` Economy, `armchair` Comfort, `plane`
  Airport), name Display 17/700, "from JOD 2.35" Body 15/600, "up to 4" Caption `--text-2`.
- Unselected: white, 1px `--line` border, and a 4px top edge in that category's accent
  (the only place all three accents show at once).
- Selected: that category's accent fill, ink text, no border. Selecting a tile re-tints
  the screen's `--accent` (200ms color transition).
- Airport tile sets the destination to Queen Alia International Airport (SPEC §3.16).
  Under the tiles, Caption `--text-2`: "Prices are estimates and may vary".

### Sync zone chip
- Shown in host setup. A 1px `--line` card, radius 16px, padding 12px 16px.
- Left: a 64×28 inline SVG: a 2px `--text-1` line (the route) inside a capsule filled
  with `--accent-soft` and stroked 1px `--accent`.
- Right: "Sync zone · 1.5 km" Body 600, under it Caption `--text-2`
  "Riders within 1.5 km of your route can join". The number comes from the server.

### Gender switch row
- Row ~64px: label "Same gender only" Body L 500, helper Caption `--text-2` under it:
  on → "Only women can join" (or "Only men can join"), off → "Anyone going your way can join".
- Switch on the right: 52×32 pill. **On:** `--ink-900` track, 26px white knob on the right
  with a 10px `--accent` dot in its center. **Off:** `--raised` track, knob on the left, no dot.
- Default **on** (SPEC §3.5 rule 1). Shown on the trip screen above the category tiles.

### Gender badge
- Pill, height 24px, padding 0 10px, Eyebrow style.
- "Women only" / "Men only": `--ink-900` background, `--white` text.
  "Mixed": `--raised` background, `--text-1` text.

## 6. Core Components

### Primary button
- Full width minus screen padding, height 56px, **pill**.
- `--accent` background, `--ink-900` text (Button style), centered.
- **Keel:** `box-shadow: 0 3px 0 var(--ink-900)`, plus 1px `--ink-900` border. It reads as
  a physical key.
- Pressed: `--accent-strong`, `translateY(2px)`, keel `0 1px 0`. 90ms.
- Disabled: `--raised` background, `--text-2` text, no keel.
- Label names the action and may carry the price: "Join · JOD 4.00", "Confirm · JOD 7.85".
- Pinned to the bottom of action screens, 16px above the safe area.

### Secondary button
- Same size and pill shape. Transparent background, 1.5px `--text-1` border, `--text-1` text.
- Danger variant: `--danger` border and text ("Leave anyway").

### Text link
- Link style. Never a bare accent color on Paper (use `--accent-text`).

### Icon button
- 44×44, radius 12px, `--card` fill, 1px `--line` border. 20px icon `--text-1`.
  Over a map: add the map-control shadow.

### Nav header
- Icon button (back) left, Eyebrow-styled title centered ("RIDES GOING YOUR WAY"), or an
  H1 left-aligned under it on top-level screens. No bottom border; content scrolls under a
  12px `--surface` fade.

### Trip input card (home and search)
- Card, radius 24px, padding 16px. Two rows joined by a 2px vertical `--line` connector:
  pickup row (ring mark) and destination row (square mark), each Body L, placeholder
  "Pickup" / "Where to?". Third row: "Arrive by 8:00 AM" with a `clock` icon and a "Change" link.
- Focused row: 2px `--accent` underline on the field, no glow.

### Quick-pick place chips (demo seed places)
- Horizontal scroll row under the active field. Height 36px, pill, `--raised` fill,
  Body 15/500 `--text-1`, 12px ring or square mark matching the field being filled.
- Labels: "Irbid City Center", "University Street", "Al-Hashmi Street",
  "Yarmouk University", "Arabella Mall", "JUST" (+ "Queen Alia Airport" when seeded, P1).

### Chips (filters, pickers)
- Height 36px, pill, padding 0 14px, Body 15/500. Selected: `--ink-900` fill, white text.
  Unselected: `--raised`, `--text-1`.

### Time picker
- Bottom sheet with three wheels (hour, minute in 5-min steps, AM/PM). The center row is
  set in Big number style with a 1px `--line` band above and below it.

### Phone/name inputs
- Height 56px, `--raised` fill, no border, radius 10px, Body L. Focus: 2px `--accent` bottom edge.

### Switch
- See Gender switch row (§5). Same component for any boolean.

### List row
- Leading 40px circle (`--raised`, 20px icon `--text-1`) or a mark, text block, trailing value
  or chevron. Divider 1px `--line`, inset to the text start.

### Bottom sheet
- `--card`, top radius 28px, sheet shadow, scrim behind.
- Grab handle 40×4px `--line`, centered, 10px from top. Title H2 left-aligned.
- Primary button pinned at the bottom.

### Card
- `--card`, radius 24px, 1px `--line` border, padding 20px, no shadow.

### In-app banner
- Slides down from the top, `--ink-900` background, white text Body 15/500, radius 16px,
  12px margin, padding 12px 16px, a 4px left edge in `--accent` (info), `--warn` or
  `--danger`. Auto-hides after 4s, tap to dismiss. Same dark style in both roles.
- Examples: "Your pickup moved to 7:02 AM", "Sara left the ride".

### Avatar
- Circle, `--raised` fill, initials Inter 600 `--text-1`. 64px profile, 44px seat meter,
  32px chat and lists. Seats in the meter use the accent fill instead (§5).

### Empty state
- The Merge mark at 96px, static, lines in `--line`, merged line in `--accent`.
  Title H2 centered, body Body `--text-2` centered (max 300px), primary CTA pinned.
- Matching list empty: title "No rides to sync yet", body "Start one and people going your
  way can join.", CTA "Start your own sync".

## 7. Map & Booking Flow

### Map
- Google Maps with a custom **Paper** style: land #EDE9E1, roads white, highways #DCD8D0,
  water #CBD9E0, labels `--ink-500`, POIs and transit icons off. Driver: **Cockpit** style:
  land #0D0F13, roads #232831, labels #6E737D.
- **Rider map (privacy, SPEC §3.14):** only the rider's **own pickup** (ring mark, 20px,
  with a pulsing `--accent` halo while waiting or searching) and **the destination**
  (square mark). Never other riders' marks, no route line, no zone band.
- **Driver map:** every stop in order. Pickups = 26px rings with the stop number inside
  (Inter 13/700), destination = square. The route line (P1) in `--accent`, 5px, rounded caps.
  The car as a small top-down `--text-1` arrowhead.
- Recenter: 44px icon button with a `locate-fixed` icon.
- **Map unavailable (P1):** the map area becomes a `--surface` panel with the Merge mark
  in `--line` and "Map unavailable" Body `--text-2`. Every sheet keeps working.

### Trip screen (home → trip set)
Top to bottom, in one bottom sheet over the map:
1. Trip input card (§6).
2. Gender switch row (§5).
3. Category tiles (§5), each with its "from" price (SPEC §4.5).
4. Primary button "Find rides". Tapping it opens the matching list for the selected
   category. It never creates a ride directly.

### Matching list ("Rides going your way")
- Nav header with Eyebrow title "RIDES GOING YOUR WAY".
- Trip strip: `--raised` band, padding 12px 20px. Eyebrow "UNIVERSITY STREET → JUST",
  Body "Arrive by 8:00 AM · Economy · Same gender", trailing "Edit" link.
- Matching cards (below), 12px gaps.
- Pinned at the bottom: secondary button **"Start your own sync"**.
- Empty state (§6) with the same CTA as a primary button.

### Matching card
- Card, radius 24px, padding 16px.
- Row 1: host first name Display 17/700 + gender badge, right: "2 seats left" Caption `--accent-text`.
- Row 2: mini Seat meter (28px seats).
- Row 3: two-line route with marks, **area names only**: ring "City Center area",
  square "JUST", joined by a 2px `--line` connector.
- Row 4: "Arrives by 8:00 AM · Pickup ~7:21 AM" Body `--text-2`.
- Row 5: "JOD 4.00" Big number + "each if you join" Body `--text-2`.
- Full-width primary button "Join · JOD 4.00". Tapping joins instantly.

### Host setup ("Start your own sync")
- Bottom sheet, title H2 "Start your own sync", category badge beside it.
- "Arrive by" row (opens the Time picker).
- Info card:
  - "BE READY BY" Eyebrow + "7:15 AM" Big number.
  - Price ladder: one row per rider count, the count as small seats, price right-aligned:
    "Just you · JOD 7.85", "2 riders · JOD 4.15 each", "3 riders · JOD 2.95 each",
    "4 riders · JOD 2.35 each" (Comfort and Airport stop at 3). The 1-rider row carries
    the label "If nobody joins".
- Sync zone chip (§5).
- Gender switch row (repeated, editable here; default from the trip screen).
- Primary button "Confirm · JOD 7.85" (the solo price, the most a host can pay).

### Outstanding balance strip
- Full width, `--raised` band, 52px. 20px `alert-circle` in `--warn`, "Outstanding balance
  JOD 2.30" Body L `--text-1`, chevron. Shown on the next booking after a late leave or no-show.

### Payment row
- 56px row: `banknote` icon in `--success`, "Cash" Body L. Directly above the primary button.

### Status sheet (after booking)
- Map above (rider map rules). Sheet background `--surface`.
- **Stage track:** 4 labelled stops on a horizontal merge line, Eyebrow labels under each:
  SYNCING · READY CHECK · FINDING DRIVER · DRIVER SET. Done stops: filled `--ink-900`
  squares; current: `--accent` ring that pulses; upcoming: `--line` rings.
- Status title H1 + subtitle Body `--text-2`:
  1. "Syncing riders" / "2 of 4 synced"
  2. "Ready check" / "3 of 4 ready · 4:32 left"
  3. "Finding your driver" / "Your ride is set" (Merge mark loader beside the title)
  4. "Driver on the way" / "Omar · White Hyundai Elantra · 12-34567" (plate in a white
     pill with a 1px `--ink-900` border, Inter 600, like a plate)
- **Host only, while syncing:** primary button "Find driver" pinned at the bottom, with
  Caption `--text-2` above it: "Starts automatically at 6:17 AM".

### Stacked cards (under the status header), 8px gaps
1. **Sync Pass** (§5).
2. **Chat card:** `message-circle` icon, "Group chat" Body L 600, unread count pill
   (`--accent` fill, ink text), chevron. Last message preview Body `--text-2`, one line.
3. **Locations card:** ring + "Start location" Caption + address Body L (one line, truncated);
   square + "Your destination" + address. 2px connector between the marks.
4. **Friends card** (P1, while syncing only): two list rows, `user-plus` "Add a friend (+1)"
   and `ticket` "Invite with a friend code". After adding: "Maya rides with you · JOD 2.30
   (pays own share)" with a "Remove" link. Pending invites: "Invited Noor · waiting".
   Hidden after the ready check.
5. **Booking details:** "Economy · Shared" and "Cash" rows.
6. **Leave row:** `log-out` icon + "Leave ride" Body L 600 `--danger`. Always last.

## 8. Feature Components

### Group chat screen
- **Header:** back button, Eyebrow title "TO JUST · 8:00 AM", the mini Seat meter (28px)
  centered under it.
- **Background:** `--surface`. Shows the last 100 messages.
- **Others' messages:** left-aligned, 32px avatar beside the first bubble of a group, sender
  first name Caption `--text-2` above. Bubble `--raised`, radius 16px with a 4px
  bottom-left corner, padding 10px 14px, Body L 16, max width 78%.
- **Own messages:** right-aligned, no avatar or name. Bubble `--accent-soft`, 4px
  bottom-right corner, `--ink-900` text.
- **Time:** Caption `--text-2` under the last bubble of a group ("6:12 AM").
- **System messages:** centered Eyebrow-styled pill, `--raised` fill, `--text-2`, 12px vertical
  margin: "SARA JOINED", "LINA STARTED THE READY CHECK", "DANA IS READY",
  "OMAR IS YOUR DRIVER", "PICKUP TIMES ARE NOW FIXED".
- **Masked text:** phone numbers and links show as "•••" in `--text-2`.
- **Input bar:** `--card`, 1px `--line` top border, padding 8px 12px. Field `--raised`,
  pill, 44px, placeholder "Message the group…". Send: 44px circle, `--accent` fill, `send`
  icon in `--ink-900`, disabled (`--raised`) when empty. Counter "280/300" Caption above 250.
- **Read-only** (completed or canceled): input replaced by a `--raised` strip,
  "This chat is closed" Body `--text-2` centered.

### Driver chat (P1)
- Same component, one-to-one. Rider side: title "OMAR · DRIVER", placeholder
  "Message your driver…". Driver side (Cockpit): title is the rider's first name,
  placeholder "Message Lina…". Each stop in the driver's trip has a `message-circle` icon button.

### Ready check sheet
- Opens on every rider's phone at the same moment.
- Title H2 "Ready to ride?". Body `--text-2`: "Lina started the ready check. No answer counts as ready."
- **Countdown:** "4:32" Hero number centered inside a 132px ring (6px, `--accent` draining
  over `--raised`). Under 1:00 the digits turn `--warn`. Freezes while the demo clock is paused.
- The Seat meter with ready badges, then one row per rider: 32px avatar, first name Body L 500,
  status right: "Ready ✓" `--success` 600, "Waiting…" `--text-2`, "Left" `--danger`.
- Buttons stacked: primary "I'm ready", secondary "Cancel ride for me". Caption under them:
  "Leaving now is free."
- After Ready: the primary button becomes a `--success-soft` pill with "You're ready.
  Waiting for others…" in `--success` 600. "Cancel ride for me" stays until dispatch.

### Leave sheet
- **Late leave** (after a driver accepts and < 30 min before pickup): title H2 "Leave this ride?".
  Body: "Your driver is already booked and pickup is in less than 30 minutes."
  Amount box `--danger-soft`, radius 16px, padding 16px: "You'll pay your share" Body left,
  "JOD 2.30" Big number `--danger` right. Caption under it: "Added as an outstanding
  balance on your next ride." Buttons: primary "Keep my seat", secondary danger "Leave anyway".
- **Free leave** (no driver assigned, including redispatch, or ≥ 30 min before pickup):
  title "Leave this ride?", body "Leaving now is free. Others' shares will update.",
  primary "Keep my seat", secondary danger "Leave ride". No amount box.

### Trip offer sheet (driver, Cockpit)
- Sheet `--card`, top radius 28px.
- Eyebrow row: category badge ("ECONOMY", accent fill, ink text) + gender badge, right:
  "FIRST PICKUP 7:02 AM".
- "JOD 9.03" Hero number, under it Body `--text-2` "4 riders · cash · collect JOD 9.20".
- **Merge timeline:** stops in order on a vertical line. Each pickup is a ring with a short
  side branch merging into the main line (the line thickens by 1px per rider on board).
  Destination is a square at the bottom. Each stop: time Inter 15/600 `--text-1`
  ("7:02"), first name + short area Body `--text-2` (truncated), and for pickups the share
  right-aligned ("JOD 2.30").
- "21.4 km · ~54 min" Body `--text-2`.
- Buttons side by side: secondary "Reject" (1/3) and primary "Accept" (2/3).
- Caption `--text-2`: "Respond by 6:47 AM". No seconds countdown for scheduled trips.

### Driver active trip
- Cockpit status sheet. Header H1 "Economy · 3 riders", subtitle Body `--text-2`
  "Collect JOD 6.60 cash · JOD 2.30 credit at trip end".
- The merge timeline, one row per stop, with actions (P1):
  - Pickup: small secondary button "Picked up" (36px, pill) + chat icon button.
  - Drop-off: small primary button "Dropped off · collected JOD 2.20".
  - Done rows: `--text-2` text with a `--success` check; their branch turns solid.
- **Rider-left banner** (§6, danger edge): "Sara canceled. Collect JOD 6.60 cash · JOD 2.30
  credit at trip end". Her branch un-merges and fades out over 300ms. Other times don't change.

### Trip summary screen (P0)
- Full screen, `--surface`. Top: the Merge mark animating once to completion (lines meet,
  square fills `--success`), 96px.
- Title H1 centered: "You've arrived" (rider) / "Trip complete" (driver).
  Subtitle Body `--text-2`: "To JUST · arrived 7:54 AM".
- **Rider card** (Sync Pass style with perforation):
  - Top: "YOU PAID" Eyebrow, "JOD 2.20" Hero number, "Cash" with `banknote` icon.
  - Bottom: Seat meter, "3 riders synced this ride", then "You saved JOD 5.65 vs riding solo"
    Body 600 `--success`. Outstanding balance strip if any.
- **Late leaver:** title "You left this ride", card shows "JOD 2.30 added to your next ride"
  in `--danger`.
- **Driver card:** one row per rider ("Lina · JOD 2.20 cash"), then "Credit from RideSync ·
  JOD 2.30", divider, "Total · JOD 8.90" Big number.
- Bottom: primary "Done". Chat is read-only from here.

### Add a friend sheet (+1, P1)
- Title H2 "Add a friend". Body `--text-2`: "They ride with you from your pickup and pay
  their own share in cash."
- First name input, then chips "Woman · Man". On a `same` ride only the ride's gender is
  selectable; the other is disabled with Caption "This ride is women only".
- Preview: the Seat meter with the new +1 seat dashed in, and "Everyone's share
  JOD 2.90 → JOD 2.30" (split-flap roll on confirm).
- Caption `--text-2`: "If you leave late, their share goes on your balance."
- Primary button "Add Maya · JOD 2.30".

### Invite sheet (friend code, P1)
- Title H2 "Invite a friend". Body: "Ask for the code on their RideSync profile."
- Code input: 6 boxes, 48×56 each, `--raised`, Display 24/800 uppercase, auto-advance.
- Primary "Send invite". On success the sheet closes, banner "Invite sent to Noor".
- **Profile** shows your own code in a Sync Pass-style mini card ("YOUR FRIEND CODE ·
  LINA26") with a `copy` icon button.

### Invite card (invitee side)
- On the invitee's home, above the trip input: a Sync Pass-style card with an
  `--accent-soft` top half: Eyebrow "INVITED BY LINA", "To JUST · arrive by 8:00 AM",
  category badge. Bottom half: primary "Set my pickup" and text link "Decline".
- "Set my pickup" opens the trip screen with destination, time and category locked.
  If a rule fails on Join, the reason appears as a danger-edge banner.

### Demand map (driver, P2)
- Driver home (Cockpit) while idle. Map in Cockpit style.
- **Spots:** circles at each spot center, radius = spot radius, `--accent` fill at 12%,
  1.5px `--accent` stroke at 60%. Opacity scales with per-hour count (min 40%).
  Never individual points.
- **Best spot:** solid 2px `--accent` stroke, a slow 2.4s pulse, and an Eyebrow tag
  "BEST SPOT" on its top edge.
- The driver is the top-down arrowhead (§7 Map). A dashed 2px `--text-2` straight line runs
  from the driver to the best spot (a hint, not a route).

### Best spot card (driver, P2)
- Bottom sheet, peek height ~200px.
- Eyebrow "BEST SPOT NEAR YOU", area name H1 ("University Street area"), then three
  Big-number stats with Caption labels: "2.1 km", "~6 min", "~9 /hr".
- Caption `--text-2`: "Busy until 8:00 AM · from 4 weeks of pickups".
- Already inside a spot: H1 "You're in a busy area", Body "Stay close." (no stats).
- Swipe up: other spots as rows (area, km, per-hour count, a mini `--accent` bar for
  relative demand).
- When the history is sample data: Caption "Sample data" in `--warn`.
- Hides when an offer arrives (the offer sheet takes over).

### Uni plans entry (P1)
- Home, under the trip input card: a full-width card with an `--accent-soft` fill, `graduation-cap`
  icon, "Uni plan · 20% off every campus ride" Body L 600, chevron. Subscribers see
  "Semester plan · next ride Mon 7:10 AM" instead.

### Plan picker
- H1 "Ride to campus for less". Two plan cards side by side (Sync Pass shape, perforated):
  - **Weekly:** Eyebrow "WEEKLY", "JOD 2.00" Big number, "3–5 rides this week · 1 replacement".
  - **Semester:** Eyebrow "SEMESTER", "JOD 1.60 /week" Big number, "2–5 rides every week ·
    replacements: 5% of rides". Small "Best value" chip.
- Selected card: `--accent` 2px border. Caption under both: "20% off your share on rides to
  or from campus. Others in the car don't need a plan."

### Plan builder
- **Week grid:** 7 day columns (Sun–Sat), two rows "To campus" / "From campus". Each cell
  is a 44px rounded square: empty `--raised`, picked `--accent` fill with the arrive-by in
  Inter 12/600 ink ("8:00"). Tapping opens the trip screen for that cell (pickup, campus,
  time, category Economy/Comfort, gender switch), prefilled from the last cell.
- Counter above the grid, split-flap: "4 rides / week", Caption "Pick 3–5" or "Pick 2–5".
  Out of range: the counter turns `--danger`, the CTA is disabled.
- Semester: Caption "Repeats every week until 31 Jan" and "2 replacements" (computed live).
- Sticky footer: total "JOD 20.80" Big number + primary "Pay with card".

### Demo card sheet
- Title H2 "Pay with card", Eyebrow badge "DEMO" in `--warn` text on `--raised`.
- Card number (4 groups), expiry, CVC inputs. Helper Caption: "Demo only. Use 4242 4242 4242 4242."
  A text link "Fill test card" fills it.
- Wrong number: input bottom edge `--danger`, Caption "Demo only: use a test card."
- Primary "Pay JOD 20.80". Success: the Merge mark completes, "You're subscribed", then
  My plan.

### My plan
- Header Sync Pass: Eyebrow "SEMESTER PLAN", "Until 31 Jan", replacements left as a small
  seat-style meter of filled dots ("2 replacements left").
- List of upcoming rides grouped by week. Each row: day + date Display 15/700, arrive-by,
  "AM → JUST", and a state chip: "Planned" (`--raised`), "Synced · 3 of 4" (`--accent-soft`,
  ink), "Couldn't plan" (`--danger` text). Placed rows open the ride status.
- Row action "Cancel": ≥ 12 h ahead → confirm sheet "Cancel Tuesday's ride? You'll get a
  replacement (2 left)." / over the limit "No replacements left. This ride will be gone."
  Under 12 h → opens the normal Leave sheet.
- "Plan a replacement" primary button appears while one is available.

### Uni discount display
- Wherever a subscriber's own price shows (Sync Pass, matching card, summary): the paid
  amount in the usual style, then a `--accent-soft` pill "−20% UNI" and the full share
  struck through in `--text-2` ("~~2.30~~"). Others in the car never see your discount.
- Driver: the stop's share shows the cash due ("JOD 1.85") with Caption "+ 0.45 from
  RideSync"; summary line "Uni plan credit from RideSync · JOD 0.45".

### Demo menu (hidden, not part of the RideSync look)
- Plain functional screen: system font, simple buttons, no RideSync styling needed.
- Shows build stamp, server health, clock time and whether it's paused, data source.
- Big buttons: +5 min, Next event, Jump to…, Pause/Resume, Simulate rider, Complete trip, Reset.
  P1: "Place tomorrow's planned rides". P2: driver position picker (seed places).

## 9. Icons
- **Lucide**, outline, 1.75px stroke, rounded caps, 24px default (20px in buttons and rows).
  Default `--text-1`. Never accent-colored on Paper unless inside an accent-soft surface.
- `car` Economy · `armchair` Comfort · `plane` Airport · `message-circle` chat · `send` ·
  `check-circle-2` ready · `clock` · `banknote` cash · `alert-circle` balance ·
  `log-out` leave · `locate-fixed` recenter · `user-plus` +1 · `ticket` invite · `copy` ·
  `radar` demand spots · `graduation-cap` uni plan · `credit-card` demo card · `map-off` (fallback only, prefer the Merge mark).
- Pickup ring and destination square are custom SVG marks, not icons.
- No car photos or 3D renders. Categories are glyph + color only.

## 10. Motion
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)` for everything that enters.
- Sheets slide up 280ms, scrim fades 200ms.
- Button press 90ms (keel compresses).
- Split-flap digits 220ms + 30ms stagger (§5).
- Seat fill sweep 300ms. Merge loader loop 1.6s.
- New chat bubble: fade + 8px rise, 150ms.
- Ready check: ring drains linearly; ready badges pop (scale 0.8 → 1, 150ms).
- Category change: `--accent` cross-fades 200ms.
- `prefers-reduced-motion: reduce`: no loops, no rolls, no slides; fades ≤ 120ms only.
- No bouncy springs, no confetti, no parallax.

## 11. Voice
- Short and literal. Verbs over nouns. "Sync" is the brand verb; use it sparingly and only
  where it means "riders joining one car": "2 of 4 synced", "Start your own sync",
  "3 riders synced this ride". Everything else is plain: "Find driver", "Leave ride".
- Never say "seat" when quoting money: prices are always "each" (one fare, split).

## 12. App Tours
How each app looks and feels end to end. One SPA serves both; the role picks the surface (§2.4).

### 12.1 Rider app (Paper, light)
**Feel:** a calm, warm ticket wallet. Big times, big prices, one bright accent, lots of
paper. Everything important sits within thumb reach at the bottom.

| Screen | What's on it | Main action |
|---|---|---|
| **Signup** | Merge mark logo, H1 "Ride together, pay less", first name, gender chips "Woman · Man", one-line consent (SPEC §3.2) | "Continue" |
| **Home** | Full-bleed Paper map with your own ring once a pickup is set. Sheet: Invite card (if any), Trip input card, quick-pick chips. Top bar: logo left, profile icon button right (friend code, outstanding balance) | Fill in the trip |
| **Trip screen** | Same sheet expanded: trip card, "Same gender only" switch, three category tiles with "from" prices. The screen re-tints to the selected category | "Find rides" |
| **Rides going your way** | Trip strip, matching cards (host, gender badge, mini seat meter, area names, "JOD 4.00 each if you join"), Merge-mark empty state | "Join · JOD 4.00" or "Start your own sync" |
| **Host setup** | Arrive-by, Be ready by, price ladder, sync zone chip, gender switch | "Confirm · JOD 7.85" |
| **Uni plans (P1)** | Plan picker (weekly / semester) → week grid builder → demo card → My plan (upcoming rides, states, replacements) | "Pay with card", "Plan a replacement" |
| **Ride status** | Map (own ring + destination square only). Sheet: stage track, status title, Sync Pass, chat card, friends card (while syncing), locations, booking details, leave row | Host: "Find driver" |
| **Ready check** | Countdown ring, seat meter with ready badges, rider rows | "I'm ready" |
| **Driver set** | Stage 4, driver, car and plate pill on the Sync Pass | Wait |
| **Group chat** | Paper background, raised bubbles, accent-soft own bubbles, Eyebrow system pills | Send |
| **Trip summary** | Merge mark completes, "You paid JOD 2.20", savings in success | "Done" |

**Journey:** Home → (Uni plan, once) → Trip screen → Rides going your way → (Join | Start your own sync) →
Ride status ⇄ Chat → Ready check → Driver set → Summary.

### 12.2 Driver app (Cockpit, dark)
**Feel:** a pre-dawn dashboard. Dark, quiet, high-contrast numbers that read at arm's
length on a car mount. Accent appears only for the trip's category and the best demand spot.

| Screen | What's on it | Main action |
|---|---|---|
| **Idle** | Cockpit map, "You're online" with a success dot, demand spots + best spot card (P2). Without P2: map + "Waiting for scheduled offers" with the Merge loader | Head to the best spot (advice) |
| **Trip offer** | Category + gender badges, "JOD 9.03" hero, collect total, merge timeline with per-stop shares ("Lina +1 · JOD 4.60" for a +1), km · min, respond-by | "Accept" / "Reject" |
| **Active trip** | "Economy · 3 riders", collect + credit line, numbered rings and the route line (P1), merge timeline with stop actions | "Picked up" / "Dropped off" (P1) |
| **Rider left** | Dark banner with danger edge, the branch un-merges, totals roll | — |
| **Driver chat (P1)** | Same chat component in Cockpit colors | Send |
| **Trip summary** | Riders and cash each, credit from RideSync, total | "Done" → idle with fresh spots |

**Journey:** Idle (demand spots) → Offer → Accept → Active trip → Summary → Idle.

### 12.3 What makes them one product
- Same Merge mark, same Sync Pass shapes, same marks (ring = pickup, square = destination).
- **The category accent follows the ride across both apps:** Lina's and Omar's phones show
  the same tangerine for the same Economy ride.
- Rider = Paper (planning, daylight). Driver = Cockpit (working, in the car).

## 13. Do / Don't
- DO make the time and the price the biggest things on every ride screen.
- DO use ink text on accent fills, and `--accent-text` for accent-colored text on Paper.
- DO code pickup as a ring and destination as a square, everywhere.
- DO pin the main action to the bottom, and put the price in its label when it costs money.
- DO show area names only (never exact addresses) to other riders.
- DO use borders for depth. Shadows only on sheets and map controls.
- DON'T show other riders' marks, the route line or the zone band on a rider's map.
- DON'T use more than one accent on a screen (except the category tiles).
- DON'T use white text on an accent, gradients, glassmorphism or drop-shadowed cards.
- DON'T use pink or purple anywhere (avoids reading as a Jeeny mockup).
- DON'T add chat extras (photos, voice, reactions, typing indicators, read receipts).
