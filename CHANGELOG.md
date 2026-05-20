# Changelog

## v1.0.6
- Fixed visual editor: replaced deprecated `mwc-select`/`mwc-list-item` elements with `ha-select`/`ha-list-item` for compatibility with current Home Assistant versions
- Fixed visual editor rendering issues caused by incorrect LitElement base class resolution
- Added per-entity color intervals with global fallback: entities can now define their own `color_intervals` array, falling back to the card-level intervals when not set
- Added global and per-entity decimal place rounding (`decimal_places`), with per-badge override support
- Added global and per-entity/badge icon visibility (`show_icon`): hide icons globally or override per entity or badge
- Added `hover_motion` option to toggle the tile lift/shadow effect on hover (enabled by default)
- Added brightness filter hover and active feedback on tiles: tiles brighten on hover and darken on click, working in all browsers
- Added per-entity `tap_action` config (`toggle`, `more-info`, `navigate`, `url`, `call-service`, `none`) with visual editor support; default auto-action expanded to cover `cover` (state-aware open/close), `lock` (state-aware lock/unlock), `scene`, `button`, `input_button`, and `automation`
- Added per-entity and per-badge `unit` override: replaces the entity's native unit of measurement in displayed values and the `<unit>` suffix template variable; set to empty string to suppress the unit
- Improved visual editor text styling: larger section/subsection titles, better contrast, left accent bar on subsection headers, increased picker label and helper text sizes
- Improved visual editor entity panel layout: icon controls grouped together, unit and decimal places side by side, logical top-to-bottom ordering (identity, icon, display, color, action, badges)

## v1.0.4
- Fixed colorpicker so it works on mobile devices

## v1.0.3
- Added support for scaling automatically

## v1.0.2
- Added support for state-matched rules: dynamic colors, custom state labels and suffix text are now applied when entity state matches defined values. If not using state-matched rules, then rules based on intervals are used instead as a generic setting.

## v1.0.1
- Fixed mobile layout: entities now stay on the same row on mobile devices

## v1.0.0
- Initial release
