# Andy Quickboard Card v1.2.3

Andy Quickboard Card is a flexible Home Assistant Lovelace card for building compact dashboards, button panels and complete navigation systems.

Quickboard is a full-scale controller. A card can control entities, open nested menus, switch the visible menu in another Quickboard, or navigate between Home Assistant dashboard pages. Build a vertical icon Navbar, a horizontal tab bar, a central menu-only control panel, or combine all of them.

The visual editor supports the complete workflow, while YAML remains available for reusable configurations and advanced layouts.

> Developed by **Andreas “AndyBonde”**, author of
> [`andy-temperature-card`](https://github.com/maglerod/andy-temperature-card) and
> [`andy-segment-display-card`](https://github.com/maglerod/andy-segment-display-card).

## Screenshots

![Andy Quickboard Card — light theme](images/preview_1_white.png)
![Andy Quickboard Card — dark theme](images/preview_1_dark.png)

## What is new in v1.2.3?

- Color intervals now accept negative values and decimals globally and per button.
- Interval limits can be entered in either order. For example, `-5 → -10` is normalized to the same effective range as `-10 → -5`.
- The live card and visual-editor previews now use the same normalized interval matching.

See the complete [v1.2.3 changelog](CHANGELOG.md#v123--2026-08-12).

## What was added in v1.2.2?

- New **Flat** button style for clean navigation rails, toolbars and modern button panels.
- Build vertical or horizontal Navbars with any number of buttons.
- New **Navigation button** type for opening Home Assistant dashboard pages.
- Menu buttons can now control menus in another Quickboard card.
- Automatic Quickboard card IDs make cross-card connections easy to configure.
- Use a Quickboard as a menu-only content panel with a configurable default menu.
- Keep the correct Flat Navbar button selected from the active menu or current dashboard URL.
- Configure exact or prefix URL matching and a fallback default Navigation button.
- Configure a default external Menu button for each target Quickboard.
- Set button icon size and independently show or hide its icon, label and state.
- Create centered icon-only buttons while state-based icon rules continue working.
- Set badge font size and icon size independently.
- Show or hide each menu title on the live card.
- Deep-duplicate complete buttons and badges from the visual editor.

See the complete [v1.2.2 changelog](CHANGELOG.md#v122--2026-07-24).

## Features

### Full-scale controller and Navbar

- Control entities, local menus, external Quickboards and Home Assistant pages from one card.
- Arrange one button per row for a vertical Navbar.
- Place several buttons in the same row for a horizontal Navbar.
- Use as many rows and buttons as the dashboard requires.
- Use Flat icon-only buttons for a compact rail or Flat icon-and-label buttons for a wider menu.
- Keep the selected Flat button highlighted after a tap.
- Synchronize an external Navbar with the menu currently displayed by its target Quickboard.
- Match the selected page button against the current Home Assistant URL.
- Choose a default menu, default external menu button or fallback page button.

### Rows and buttons

- Build every board and menu row by row.
- Add any number of buttons to a row; buttons share the available width.
- Add an optional row label above or below the row, aligned left, center or right.
- Mix Entity, Menu and Navigation buttons in the same card.
- Choose **Raised** for the classic Quickboard appearance or **Flat** for a clean navigation style.
- Set icon size per button.
- Independently show or hide the icon, label and state.
- Leave the Name empty to use the Home Assistant entity friendly name.
- Hide Label and State to create a centered icon-only button.
- Use one fixed icon or exact `state → icon` mappings.
- Missing entity selections are clearly shown as **No entity**.
- Optionally show a subtle button-type symbol on the live card.
- Deep-duplicate a complete button, including nested intervals, state icons, actions and badges.

### Menus and submenus

- Create any number of reusable menus.
- Nest menus without a fixed card-level depth limit.
- Open a menu by replacing the current Quickboard content or as a popup.
- Link several buttons to the same existing menu.
- Navigate to another menu, the previous menu or the main board.
- Open a menu in another Quickboard on the same dashboard view.
- Use a Quickboard with no main rows as a dedicated menu-only content panel.
- Choose the menu initially displayed by a content panel.
- Show or hide each menu title without losing its editor name.
- Optionally show built-in Back and Close controls.
- Popup menus always include Close so the user cannot become trapped.
- Choose what happens after an entity button is tapped: stay, go back or close.

Menu buttons can display status in three ways:

- **Automatic active/total** recursively counts active entities in a local destination menu.
- **Status entity** uses a selected Home Assistant entity.
- **None** hides menu status completely and is the default.

### Reusable themes and color intervals

- Create reusable themes with gradients, text color, border, radius, shadow, button style and badge style.
- Assign themes globally, to the main menu, to a submenu, to a row or to one button.
- Theme priority is **button → row → menu → global**.
- Select **No theme** at an override level to return to intervals or custom button colors.
- Define global or per-button numeric ranges and exact state matches.
- Use positive or negative range limits, including decimals, in either order; `-10 → -5` and `-5 → -10` resolve to the same interval.
- Configure background, gradient, text/icon color, state label, suffix and active shadow color per interval.
- Independently choose whether an interval overrides an active theme's button color and/or text/icon color.
- Use template variables such as `<state>`, `<unit>`, `<dimmer_pct>`, `<source>`, `<title>`, `<artist>`, `<album>` and `<title_artist>`.

### Shadows and appearance

- Configure the default button radius and horizontal/vertical padding.
- Choose None, Soft, Medium, Strong or Glow shadows.
- Set shadow strength globally or override it in a theme or individual button.
- Use the Home Assistant theme color, active theme/interval color, custom color or classic black.
- Use interval colors for state-dependent glow effects.
- Enable or disable the hover lift effect.
- Style the card background with `card-mod` through `--andy-quickboard-card-background`.

### Badges

Every Entity or Menu button can contain multiple badges. Badge style can inherit from the global setting or theme, or be overridden on one button.

- **Value** — display another entity's current value.
- **Dimmer** — display and control a light's brightness.
- **Statistics** — min, max, average, last on, last off or last changed.
- **Media control** — play/pause, play, pause, stop, next, previous, volume or mute.
- **Media information** — title, artist, album, source or title + artist.
- **Alarm control** — arm or disarm with an optional code.
- Configure icon, label, unit, decimal places, font size and icon size per badge.
- Use Pill, Pill strong, Chip, Underline or None styles.
- Deep-duplicate a badge and then change only the entity or value that differs.

> Statistics use Home Assistant's history REST endpoint through `hass.callApi()`.

### Tap actions

Entity buttons support:

- `default`
- `toggle`
- `more-info`
- `navigate`
- `url`
- `call-service`
- `none`

The default behavior toggles lights, switches, fans and input booleans; runs scripts; opens or closes covers; locks or unlocks locks; activates scenes, buttons, input buttons and automations; and opens the standard More info dialog for other domains.

### Home Assistant integration

- Complete visual editor; YAML is optional.
- Uses a normal `ha-card` and works with `card-mod`.
- Runs fully in the browser with no custom backend integration.
- Includes confirmation before destructive delete actions.
- Includes live-style previews for buttons, themes and color intervals.

## Controller and navigation modes

One Quickboard button can have three different destination types:

| Button type | Destination | Typical use |
| --- | --- | --- |
| Entity | Home Assistant entity or action | Lights, scenes, scripts, climate and status |
| Menu | A local menu or a menu in another Quickboard | Nested control panels and external Navbars |
| Navigation | Home Assistant dashboard path | Persistent page navigation |

### Vertical or horizontal — you decide

Quickboard does not impose a Navbar direction:

- **Vertical:** create several rows with one button in each row.
- **Horizontal:** create one row containing several buttons.
- **Grid or mixed:** combine multiple rows and button counts.

Set `button_style: flat` and `flat_layout: rail` for a compact icon rail. Use `flat_layout: label` for Flat buttons that retain their icon and label. Flat is only a visual style and works with Entity, Menu and Navigation buttons.

### Controlling another Quickboard

Each card created in the visual editor receives a persistent Quickboard card ID. The ID is shown in **Basic → Quickboard card ID** and can be copied with one click.

To build a Navbar and separate content panel:

1. Create the content Quickboard and add the menus it should display.
2. Copy its Quickboard card ID.
3. Create a second Quickboard for the Navbar.
4. Change a Navbar button to **Menu button**.
5. Select **Another Quickboard card**.
6. Paste the target card ID and enter its Menu ID.
7. Repeat for the other destination menus.
8. Enable **Default menu for target card** on one Navbar button if it should open automatically.

The target card may leave **Main menu rows & buttons** empty. Set **Default displayed menu** to make it a dedicated menu-only button panel.

Cross-card control works between Quickboards loaded on the same dashboard view. The target announces its active menu, allowing the correct Flat Navbar button to remain selected.

#### Cross-card YAML options

| Option | Description |
| --- | --- |
| `card_id` | Persistent ID of a Quickboard. Generated automatically in the visual editor. |
| `default_menu_id` | Menu initially displayed by a menu-only content card. |
| `menu_target_scope: external` | Makes the Menu button target another Quickboard. |
| `menu_target_card` | `card_id` of the receiving Quickboard. |
| `menu_target` | Menu ID in the receiving Quickboard. |
| `menu_display` | `replace` or `popup`. |
| `menu_default` | Opens this destination automatically and marks it as the default for that target. |

### Navigating between Home Assistant pages

A Navigation button opens a dashboard path such as `/dashboard-tablet/lights`.

When the same Navbar is placed on several views:

- **Exact path** selects a button only when its complete path matches.
- **Path and subpaths** also selects it on pages below that path.
- **Default active button** is the fallback when no configured path matches.
- A real URL match always has priority over the fallback.
- **Replace browser history entry** can avoid adding another browser Back entry.

#### Navigation YAML options

| Option | Description |
| --- | --- |
| `button_type: navigation` | Marks the button as a Home Assistant page button. |
| `navigation_path` | Dashboard path beginning with `/`. |
| `active_path_match` | `exact` or `prefix`. |
| `navigation_default` | Fallback selected button when no path matches. |
| `navigation_replace` | Replaces instead of adding a browser history entry. |

## Complete navigation examples

The examples use four vertical Flat icon buttons and can be pasted into a Manual card. Replace the example entity IDs, paths and card IDs with values from your setup.

- [Vertical Flat Navbar controlling four menus in another Quickboard](examples/vertical-navbar-controls-quickboard.yaml)

  Includes a left icon rail and a central menu-only panel with four menus and four buttons per menu.

- [Vertical Flat Navbar navigating between Home Assistant pages](examples/vertical-navbar-home-assistant-pages.yaml)

  Includes exact URL matching, automatic active-page selection and a fallback default button.

To convert either Navbar to horizontal, move all four button definitions into a single row.

## Local menu buttons explained

A local menu is a reusable collection of rows and buttons inside the same Quickboard.

For example, the main board can contain a **Lights** button. It opens a menu containing **Bedroom**, **Kitchen** and **Bathroom**. Bedroom can then open another menu containing the individual bedroom lights.

### Local navigation modes

| Mode | Behavior |
| --- | --- |
| Replace current menu | Opens the destination in the current Quickboard and adds it to its menu history. |
| Popup | Opens the destination above the current board. Close is always available. |
| Previous menu | Uses `__back__` to return one level. |
| Main menu | Uses `__root__` to return to the configured initial content. |

### Menu YAML options

| Option | Description |
| --- | --- |
| `id` | Unique destination ID. |
| `title` | Name used by the card and editor. |
| `show_title` | Shows or hides the title on the live card. |
| `rows` | Rows and buttons contained in the menu. |
| `action_after_tap` | `stay`, `back` or `close`. |
| `theme_id` | Optional theme override. |
| `group` | Optional visual-editor organization group. |
| `description` | Optional editor-only note. |

Local Menu button options:

| Option | Description |
| --- | --- |
| `button_type: menu` | Marks the button as a Menu button. |
| `menu_target` | Destination Menu ID, `__back__` or `__root__`. |
| `menu_display` | `replace` or `popup`. |
| `menu_show_back` | Shows the built-in Back control. |
| `menu_show_close` | Shows Close in a replaced menu. Popup Close is always enabled. |
| `menu_state_mode` | `auto`, `entity` or `none`. |
| `entity` | Optional status entity when `menu_state_mode: entity` is used. |

Menu buttons support the same badges, themes, color intervals, shadows, icons and display controls as Entity buttons.

## Installation

### Option A — HACS

1. Open **HACS** in Home Assistant.
2. Go to **Frontend**.
3. Search for **Andy Quickboard Card**.
4. Open the card and select **Download**.
5. Reload the frontend or restart Home Assistant if required.

HACS normally adds the Lovelace resource automatically.

### Option B — HACS custom repository

1. Open **HACS** and select **Custom repositories**.
2. Add `https://github.com/maglerod/andy-quickboard-card`.
3. Select **Lovelace** as the category.
4. Install **Andy Quickboard Card** from HACS Frontend.

### Option C — Manual installation

1. Download [`dist/andy-quickboard-card.js`](dist/andy-quickboard-card.js).
2. Copy it to `/config/www/andy-quickboard-card.js`.
3. Go to **Settings → Dashboards → Resources**.
4. Add `/local/andy-quickboard-card.js?v=1.2.3` as a **JavaScript Module**.
5. Save and perform a hard refresh (`Ctrl+F5` or `Cmd+Shift+R`).

## Add the card

### Visual editor

1. Edit a Home Assistant dashboard.
2. Select **Add card**.
3. Search for **Andy Quickboard Card**.
4. Configure rows, buttons, menus and appearance, then save.

The editor header links back to this documentation and the complete examples.

### Basic YAML example

```yaml
type: custom:andy-quickboard-card
title: Home quickboard
button_style: raised
color_intervals:
  - from: 0
    to: 21
    color_from: "#C62828"
    color_to: "#E53935"
    text_color: "#FFFFFF"
  - from: 21
    to: 66
    color_from: "#F9A825"
    color_to: "#F57F17"
    text_color: "#FFFFFF"
  - from: 66
    to: 101
    color_from: "#2E7D32"
    color_to: "#43A047"
    text_color: "#FFFFFF"
rows:
  - label: Batteries
    label_position: top-left
    entities:
      - entity: sensor.phone_battery
        name: Phone
        icon: mdi:cellphone
      - entity: sensor.watch_battery
        name: Watch
        icon: mdi:watch
```

### Button display YAML options

| Option | Description |
| --- | --- |
| `button_style` | `raised`, `flat` or `inherit` where supported. |
| `icon_size` | Button icon size in pixels. |
| `show_icon` | Shows or hides the icon. |
| `show_label` | Shows or hides the custom/friendly name. |
| `show_state` | Shows or hides the state/value line. |
| `icon_mode` | `single` or `state`. |
| `icon_states` | Exact state-to-icon mappings. |

## card-mod

Quickboard uses a regular `ha-card`. The card background can be overridden without changing the button colors:

```yaml
card_mod:
  style: |
    ha-card {
      --andy-quickboard-card-background: rgba(20, 20, 24, 0.88);
    }
```

## Updating

After replacing the JavaScript file or installing a HACS release, reload Home Assistant's frontend and perform a hard refresh. If the browser still uses an older file, update the version query in the manual resource URL.

See [CHANGELOG.md](CHANGELOG.md) for release changes.

## Support the project

I build and maintain Home Assistant cards in my spare time and share them freely with the community. If Andy Quickboard Card is useful in your setup, you can support continued development here:

<a href="https://www.buymeacoffee.com/AndyBonde" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" width="160" alt="Buy Me a Coffee">
</a>
