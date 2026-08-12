# Changelog

All notable changes to Andy Quickboard Card are documented in this file.

## v1.2.3 — 2026-08-12

Version 1.2.3 adds generic negative-value support to numeric color intervals while retaining all features from the latest v1.2.2.1 release.

### Added

- Added negative and decimal limits to global and per-button color intervals.
- Added unrestricted number-box input for interval From and To values in the visual editor.

### Changed

- Reversed interval limits are normalized automatically, so `-5 → -10` behaves as the effective range `-10 → -5`.
- Collapsed interval headers display the effective normalized range.
- The live card and visual-editor preview now share the same interval matching logic.

## v1.2.2 — 2026-07-24

Version 1.2.2 expands Quickboard from an in-card menu system into a full controller and navigation platform. The items below describe the final result compared with v1.2.1.

### Added

- Added **Flat** button styling alongside the classic Raised style.
- Added two Flat layouts:
  - Compact icon rail for narrow vertical or horizontal Navbars.
  - Full-width icon and label for Flat control panels.
- Added per-button icon sizing.
- Added independent per-button controls for showing the icon, label and state.
- Added centered icon-only buttons. State-based icon mappings continue to follow the entity even when its state text is hidden.
- Added persistent selected styling for tapped Flat buttons.
- Added a dedicated **Navigation button** type for opening Home Assistant dashboard pages.
- Added exact and prefix URL matching so the button for the current dashboard page is selected automatically.
- Added a fallback default Navigation button and optional browser-history replacement.
- Added automatic persistent Quickboard card IDs with a Copy button in the visual editor.
- Added cross-card Menu buttons that can open a specific menu in another Quickboard loaded on the same dashboard view.
- Added active-menu synchronization so an external Flat Navbar follows the menu displayed by its target Quickboard.
- Added one configurable default external Menu button per target Quickboard.
- Added `default_menu_id`, allowing a Quickboard with no main rows to work as a dedicated menu-only content panel.
- Added per-badge font size and icon size.
- Added `show_title` per menu so its live heading can be hidden without removing its editor name.
- Added deep **Duplicate button** and **Duplicate badge** actions. Copies include every nested setting, including intervals, state icons, actions and badges.

### Changed

- Flat styling now works with Entity, Menu and Navigation buttons; it is not limited to Navbar use.
- Menu status defaults to None, avoiding an unintended status entity selection on new Menu buttons.
- A missing entity selection now displays **No entity** instead of a dash. A configured entity that cannot be resolved displays **Unavailable**.
- The visual editor now includes clearer field guidance, collapsible sections and a direct link to the README.
- Button previews now follow the live card's theme, interval, icon, label and state behavior more closely.

### Fixed

- Improved visual-editor event handling and rerender safety for editing, moving, adding and deleting rows, buttons and badges across supported desktop and mobile Home Assistant frontends.
- Fixed selected external Navbar state when the target Quickboard loads before or after the controller.
- Fixed default external menu delivery so it works regardless of card connection order.
- Fixed menu-only cards so their configured default menu renders even when Main menu rows & buttons is empty.

## v1.2.1 — 2026-07-21

Version 1.2.1 expands Quickboard from a row-based entity board into a reusable navigation and styling system. The items below describe the final result compared with v1.2.0.

### Added

- Added reusable menus and submenus. Any menu can contain its own rows, entity buttons and menu buttons, and several buttons can link to the same menu.
- Added nested navigation with no fixed card-level depth limit, including destinations for an existing menu, the previous menu and the main board.
- Added two menu presentation modes: replace the current Quickboard view or open the destination as a popup.
- Added optional built-in Back and Close controls. Popup menus always include Close to guarantee an exit path.
- Added menu status modes:
  - Automatic active/total status, recursively calculated from entities in the destination menu.
  - Status from a selected Home Assistant entity.
  - No status display.
- Added per-menu action-after-tap behavior for ordinary entity buttons: stay in the current menu, go back one level or close the menu flow.
- Added reusable button themes with gradient, text color, border, radius, shadow and badge style.
- Added hierarchical theme assignment with button, row, menu and global scopes. The effective priority is button → row → menu → global, with an explicit No theme override.
- Added independent interval controls for overriding an active theme's button color and text/icon color.
- Added configurable shadow color sources: Home Assistant theme color, active theme/interval color, custom color or classic black.
- Added shadow strength inheritance and overrides at global, theme and individual-button levels.
- Added state-dependent shadow colors through each color interval's active shadow color.
- Added per-button badge style overrides with theme/global inheritance.
- Added an optional subtle Entity/Menu type indicator on the live card.
- Added a project support section with a Buy Me a Coffee link.

### Changed

- Menu buttons now support the same badges, color intervals, themes and shadow behavior as entity buttons.
- Text color resolution now also controls the main button icon, regardless of whether the color comes from a theme, interval or custom button styling.
- Popup navigation always provides a Close control, including configurations created before this version.
- Hover lift behavior now activates once per pointer entry and remains stable when the card rerenders.
- The visual editor now provides configuration and state-aware previews for menus, buttons, intervals, themes and badges.

### Fixed

- Fixed empty button or theme shadow strength values so they correctly inherit and display the effective parent/default strength.
- Fixed editor button previews so their colors use the entity's current state and the same matching interval as the live card.
- Fixed theme and interval previews so their configured gradient and text color are visible directly in their editor entries.

## v1.2.0

- Fixed visual editor: replaced deprecated `mwc-select`/`mwc-list-item` elements with `ha-select`/`ha-list-item` for compatibility with current Home Assistant versions.
- Fixed visual editor rendering issues caused by incorrect LitElement base class resolution.
- Added per-entity color intervals with global fallback: entities can define their own `color_intervals` array, falling back to card-level intervals when not set.
- Added global and per-entity decimal place rounding (`decimal_places`), with per-badge override support.
- Added global and per-entity/badge icon visibility (`show_icon`): hide icons globally or override per entity or badge.
- Added the `hover_motion` option to toggle the tile lift/shadow effect on hover; enabled by default.
- Added brightness-filter hover and active feedback on tiles across supported browsers.
- Added per-entity `tap_action` configuration (`toggle`, `more-info`, `navigate`, `url`, `call-service`, `none`) with visual editor support.
- Expanded default automatic actions to cover `cover` (state-aware open/close), `lock` (state-aware lock/unlock), `scene`, `button`, `input_button` and `automation`.
- Added per-entity and per-badge `unit` overrides. The override replaces the native unit in displayed values and the `<unit>` suffix variable; an empty value suppresses the unit.
- Improved visual editor typography and entity configuration layout.

## v1.0.4

- Fixed the color picker on mobile devices.

## v1.0.3

- Added automatic scaling support.

## v1.0.2

- Added exact state matching for dynamic colors, custom state labels and suffix text. Numeric interval rules remain available as the general fallback.

## v1.0.1

- Fixed the mobile layout so entities remain on the same row.

## v1.0.0

- Initial release.
