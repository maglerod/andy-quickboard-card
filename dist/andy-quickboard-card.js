/**
 * Andy Quickboard Card
 * v1.0.2
 * ------------------------------------------------------------------
 * Developed by: Andreas ("AndyBonde") with some help from AI :).
 *
 * License / Disclaimer:
 * - Free to use, copy, modify, redistribute.
 * - Provided "AS IS" without warranty. No liability.
 * - Not affiliated with Home Assistant / Nabu Casa.
 * - Runs fully in the browser.
 *
 * Compatibility notes:
 * - Stats uses REST history endpoint via hass.callApi("GET", "history/period/...")
 *
 * Install: Se README.md in GITHUB
 *
 */

const CARD_TAG = "andy-quickboard-card";
const EDITOR_TAG = "andy-quickboard-card-editor";

console.info(
  `%c Andy Quickboard Card %c v1.0.2 loaded `,
  "color: white; background: #1565C0; padding: 4px 8px; border-radius: 4px 0 0 4px;",
  "color: white; background: #1E88E5; padding: 4px 8px; border-radius: 0 4px 4px 0;"
);

const fireEvent = (node, type, detail, options) => {
  options = options || {};
  detail = detail === null || detail === undefined ? {} : detail;
  const event = new Event(type, {
    bubbles: options.bubbles ?? true,
    cancelable: options.cancelable ?? false,
    composed: options.composed ?? true,
  });
  event.detail = detail;
  node.dispatchEvent(event);
  return event;
};

// ---------------- CARD (DISPLAY) --------------------

if (!customElements.get(CARD_TAG)) {
  class AndyQuickboardCard extends HTMLElement {
    constructor() {
      super();
      this._statsCache = {};
    }

    static getConfigElement() {
      return document.createElement(EDITOR_TAG);
    }

    static getStubConfig(hass, entities) {
      const first = entities && entities.length ? entities[0] : "sensor.example";
      return {
        type: `custom:${CARD_TAG}`,
        title: "Home quickboard",
        color_intervals: [
          {
            from: -50,
            to: 16,
            color_from: "#1565C0",
            color_to: "#1E88E5",
            text_color: "#FFFFFF",
            match_state: "",
            state_text: "",
            suffix_text: "",
          },
          {
            from: 16,
            to: 22,
            color_from: "#2E7D32",
            color_to: "#43A047",
            text_color: "#FFFFFF",
            match_state: "",
            state_text: "",
            suffix_text: "",
          },
          {
            from: 22,
            to: 26,
            color_from: "#F9A825",
            color_to: "#F57F17",
            text_color: "#FFFFFF",
            match_state: "",
            state_text: "",
            suffix_text: "",
          },
          {
            from: 26,
            to: 100,
            color_from: "#C62828",
            color_to: "#E53935",
            text_color: "#FFFFFF",
            match_state: "",
            state_text: "",
            suffix_text: "",
          },
        ],
        box_style: {
          border_radius: 18,
          padding_vertical: 12,
          padding_horizontal: 16,
          box_shadow: "0 4px 12px rgba(0,0,0,0.25)",
        },
        badge_style: "pill",
        dimmer_slider_color: "#FFFFFF",
        rows: [
          {
            label: "Main floor",
            label_position: "top-left",
            entities: [
              {
                entity: first,
                icon: "",
                icon_mode: "single",
                icon_states: [],
                name: "Living room",
                value_font_size: 1.0,
                label_font_size: 1.0,
                color_mode: "interval",
                color_from: "",
                color_to: "",
                badges: [],
              },
            ],
          },
        ],
      };
    }

    setConfig(config) {
      if (!config) throw new Error("Configuration is required");
      if (!config.rows || !Array.isArray(config.rows)) {
        throw new Error("You must define at least one row in 'rows'");
      }
      this._config = config;
      if (!this._statsCache) this._statsCache = {};
      if (this.shadowRoot) this._render();
    }

    set hass(hass) {
      this._hass = hass;
      if (this.shadowRoot) this._render();
    }

    getCardSize() {
      if (!this._config || !this._config.rows) return 4;
      return this._config.rows.length * 2;
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this._render();
    }

    _handlePrimaryAction(ev, entityId) {
      ev.stopPropagation();
      if (!this._hass || !entityId) return;
      const [domain] = entityId.split(".");

      if (domain === "script") {
        this._hass.callService("script", "turn_on", { entity_id: entityId });
        return;
      }

      if (["light", "switch", "fan", "input_boolean"].includes(domain)) {
        this._hass.callService(domain, "toggle", { entity_id: entityId });
        return;
      }

      fireEvent(this, "hass-more-info", { entityId });
    }

    _handleMediaAction(ev, badgeCfg, entityId) {
      ev.stopPropagation();
      if (!this._hass || !entityId) return;
      const action = badgeCfg.media_action || "play_pause";
      const stateObj = this._hass.states[entityId];
      const data = { entity_id: entityId };

      switch (action) {
        case "play":
          this._hass.callService("media_player", "media_play", data);
          break;
        case "pause":
          this._hass.callService("media_player", "media_pause", data);
          break;
        case "play_pause":
          this._hass.callService("media_player", "media_play_pause", data);
          break;
        case "stop":
          this._hass.callService("media_player", "media_stop", data);
          break;
        case "next":
          this._hass.callService("media_player", "media_next_track", data);
          break;
        case "previous":
          this._hass.callService("media_player", "media_previous_track", data);
          break;
        case "volume_up": {
          const vol = Number(stateObj?.attributes?.volume_level ?? 0);
          const nextVol = Math.min(vol + 0.05, 1);
          this._hass.callService("media_player", "volume_set", {
            entity_id: entityId,
            volume_level: nextVol,
          });
          break;
        }
        case "volume_down": {
          const vol = Number(stateObj?.attributes?.volume_level ?? 0);
          const nextVol = Math.max(vol - 0.05, 0);
          this._hass.callService("media_player", "volume_set", {
            entity_id: entityId,
            volume_level: nextVol,
          });
          break;
        }
        case "mute_toggle": {
          const muted = !!stateObj?.attributes?.is_volume_muted;
          this._hass.callService("media_player", "volume_mute", {
            entity_id: entityId,
            is_volume_muted: !muted,
          });
          break;
        }
        default:
          break;
      }
    }

    _handleAlarmAction(ev, badgeCfg, entityId) {
      ev.stopPropagation();
      if (!this._hass || !entityId) return;

      const action = badgeCfg.alarm_action || "arm_home";
      let service = "alarm_arm_home";
      switch (action) {
        case "arm_away":
          service = "alarm_arm_away";
          break;
        case "arm_night":
          service = "alarm_arm_night";
          break;
        case "disarm":
          service = "alarm_disarm";
          break;
        case "arm_home":
        default:
          service = "alarm_arm_home";
          break;
      }

      const data = { entity_id: entityId };
      if (badgeCfg.alarm_code) data.code = badgeCfg.alarm_code;

      this._hass.callService("alarm_control_panel", service, data);
    }

    _render() {
      if (!this._config || !this.shadowRoot) return;
      const root = this.shadowRoot;
      const style = document.createElement("style");
      style.textContent = this._css();
      root.innerHTML = "";
      root.appendChild(style);

      const haCard = document.createElement("ha-card");
      haCard.classList.add("quickboard-card");

      const wrapper = document.createElement("div");
      wrapper.classList.add("wrapper");

      if (this._config.title) {
        const titleEl = document.createElement("div");
        titleEl.classList.add("card-title");
        titleEl.textContent = this._config.title;
        wrapper.appendChild(titleEl);
      }

      (this._config.rows || []).forEach((row) => {
        const rowWrapper = document.createElement("div");
        rowWrapper.classList.add("row-wrapper");

        if (row.label && row.label_position && row.label_position.startsWith("top")) {
          const rowLabelTop = this._createRowLabel(row.label, row.label_position);
          rowWrapper.appendChild(rowLabelTop);
        }

        const tilesRow = document.createElement("div");
        tilesRow.classList.add("tiles-row");

        (row.entities || []).forEach((entCfg) => {
          const tile = this._createTile(entCfg);
          tilesRow.appendChild(tile);
        });

        rowWrapper.appendChild(tilesRow);

        if (row.label && row.label_position && row.label_position.startsWith("bottom")) {
          const rowLabelBottom = this._createRowLabel(row.label, row.label_position);
          rowWrapper.appendChild(rowLabelBottom);
        }

        wrapper.appendChild(rowWrapper);
      });

      haCard.appendChild(wrapper);
      root.appendChild(haCard);
    }

    _createRowLabel(text, position) {
      const el = document.createElement("div");
      el.classList.add("row-label");
      el.textContent = text;
      el.dataset.position = position;
      return el;
    }

    _applyBoxStyle(tile) {
      const boxStyle = this._config.box_style || {};

      if (boxStyle.border_radius !== undefined && boxStyle.border_radius !== null) {
        const br = boxStyle.border_radius;
        if (typeof br === "number" || /^[0-9.]+$/.test(String(br))) {
          tile.style.borderRadius = `${br}px`;
        } else {
          tile.style.borderRadius = br;
        }
      }

      if (
        boxStyle.padding_vertical !== undefined ||
        boxStyle.padding_horizontal !== undefined
      ) {
        const v = boxStyle.padding_vertical ?? 12;
        const h = boxStyle.padding_horizontal ?? 16;
        tile.style.padding = `${v}px ${h}px`;
      } else if (boxStyle.padding) {
        tile.style.padding = boxStyle.padding;
      }

      if (boxStyle.box_shadow) {
        tile.style.boxShadow = boxStyle.box_shadow;
      }
    }

    _resolveSuffix(template, stateObj, entityId) {
      if (!template) return "";
      const attrs = stateObj?.attributes || {};
      const state = stateObj?.state ?? "";
      const unit = attrs.unit_of_measurement || "";
      const domain = entityId ? entityId.split(".")[0] : "";
      let dimmerPct = "";
      if (domain === "light") {
        if (typeof attrs.brightness_pct === "number") {
          dimmerPct = `${attrs.brightness_pct}%`;
        } else if (typeof attrs.brightness === "number") {
          dimmerPct = `${Math.round((attrs.brightness / 255) * 100)}%`;
        }
      }

      const source = attrs.source || attrs.input_source || "";
      const title = attrs.media_title || "";
      const artist = attrs.media_artist || "";
      const album = attrs.media_album_name || attrs.media_album || "";
      let titleArtist = "";
      if (title && artist) titleArtist = `${title} – ${artist}`;
      else titleArtist = title || artist || "";

      let res = template;
      res = res.replaceAll("<state>", String(state));
      res = res.replaceAll("<unit>", unit);
      res = res.replaceAll("<dimmer_pct>", dimmerPct);
      res = res.replaceAll("<source>", source);
      res = res.replaceAll("<title>", title);
      res = res.replaceAll("<artist>", artist);
      res = res.replaceAll("<album>", album);
      res = res.replaceAll("<title_artist>", titleArtist);
      return res;
    }

    _createTile(entCfg) {
      const tile = document.createElement("div");
      tile.classList.add("tile");

      this._applyBoxStyle(tile);

      const entityId = entCfg.entity;
      const stateObj =
        this._hass && entityId ? this._hass.states[entityId] : undefined;

      const colorInfo = this._getColorForState(stateObj, entCfg);
      if (colorInfo.background) tile.style.background = colorInfo.background;
      if (colorInfo.text_color) tile.style.color = colorInfo.text_color;

      const suffix =
        colorInfo.suffix_text && stateObj
          ? this._resolveSuffix(colorInfo.suffix_text, stateObj, entityId)
          : "";

      if (entityId) {
        tile.addEventListener("click", (ev) =>
          this._handlePrimaryAction(ev, entityId)
        );
      }

      const valueStr = stateObj ? stateObj.state : "—";
      const unit = stateObj && (stateObj.attributes.unit_of_measurement || "");
      const valueNum = Number(valueStr);

      const topRow = document.createElement("div");
      topRow.classList.add("tile-top-row");

      const iconNameRow = document.createElement("div");
      iconNameRow.classList.add("tile-icon-name-row");

      const iconEl = document.createElement("ha-icon");

      let iconName = "";
      // 1) State-baserade ikoner om aktiverat
      if (
        stateObj &&
        entCfg.icon_mode === "state" &&
        Array.isArray(entCfg.icon_states)
      ) {
        const raw = String(stateObj.state ?? "");
        const lower = raw.toLowerCase();
        const match = entCfg.icon_states.find(
          (m) => String(m.state ?? "").toLowerCase() === lower
        );
        if (match && match.icon) {
          iconName = match.icon;
        }
      }

      // 2) Fallback: custom ikon / entitetens ikon
      if (!iconName) {
        iconName =
          entCfg.icon ||
          (stateObj ? stateObj.attributes.icon || "" : "");
      }

      // 3) Sista fallback
      if (iconName) {
        iconEl.setAttribute("icon", iconName);
      } else if (entityId) {
        iconEl.setAttribute("icon", "hass:thermometer");
      }

      iconEl.classList.add("tile-icon");
      iconNameRow.appendChild(iconEl);

      const nameEl = document.createElement("div");
      nameEl.classList.add("tile-name");
      nameEl.textContent =
        entCfg.name ||
        (stateObj ? stateObj.attributes.friendly_name || entityId : entityId);

      const baseLabelRem = 1.0;
      if (entCfg.label_font_size !== undefined && entCfg.label_font_size !== null) {
        const scale = Number(entCfg.label_font_size);
        if (!isNaN(scale) && scale > 0) {
          nameEl.style.fontSize = `${baseLabelRem * scale}rem`;
        } else if (entCfg.label_font_size) {
          nameEl.style.fontSize = entCfg.label_font_size;
        }
      }

      iconNameRow.appendChild(nameEl);
      topRow.appendChild(iconNameRow);
      tile.appendChild(topRow);

      const valueEl = document.createElement("div");
      valueEl.classList.add("tile-value");

      const baseValueRem = 1.8;
      if (entCfg.value_font_size !== undefined && entCfg.value_font_size !== null) {
        const scale = Number(entCfg.value_font_size);
        if (!isNaN(scale) && scale > 0) {
          valueEl.style.fontSize = `${baseValueRem * scale}rem`;
        } else if (entCfg.value_font_size) {
          valueEl.style.fontSize = entCfg.value_font_size;
        }
      }

      if (!isNaN(valueNum)) {
        let txt = `${valueNum.toFixed(1)}${unit ? unit : ""}`;
        if (suffix) txt += ` ${suffix}`;
        valueEl.textContent = txt;
      } else if (stateObj) {
        if (colorInfo.state_label) {
          let txt = colorInfo.state_label;
          if (suffix) txt += ` ${suffix}`;
          valueEl.textContent = txt;
        } else {
          const s = String(stateObj.state || "").toLowerCase();
          let base;
          if (s === "on") base = "On";
          else if (s === "off") base = "Off";
          else if (s) base = s.charAt(0).toUpperCase() + s.slice(1);
          else base = "—";

          if (suffix) base += ` ${suffix}`;
          valueEl.textContent = base;
        }
      } else {
        valueEl.textContent = "—";
      }

      tile.appendChild(valueEl);

      const badgeStyle = this._config.badge_style || "pill";

      if (entCfg.badges && entCfg.badges.length) {
        const badgesRow = document.createElement("div");
        badgesRow.classList.add("badges-row");
        //entCfg.badges.slice(0, 3).forEach((badgeCfg) => {
        entCfg.badges.forEach((badgeCfg) => {
          if (!badgeCfg.entity) return;
          const bState =
            this._hass ? this._hass.states[badgeCfg.entity] : undefined;
          const entityId = badgeCfg.entity;
          const type = badgeCfg.badge_type || "value";

          const bWrap = document.createElement("div");
          bWrap.classList.add("badge");

          switch (badgeStyle) {
            case "none":
              bWrap.classList.add("badge-none");
              break;
            case "chip":
              bWrap.classList.add("badge-chip");
              break;
            case "underline":
              bWrap.classList.add("badge-underline");
              break;
            case "pill-strong":
              bWrap.classList.add("badge-pill", "badge-strong");
              break;
            case "pill":
            default:
              bWrap.classList.add("badge-pill");
              break;
          }

          const showIcon = badgeCfg.show_icon !== false;

          let badgeIconName = "";
          if (showIcon) {
            badgeIconName =
              badgeCfg.icon ||
              (bState ? bState.attributes.icon || "" : "") ||
              "hass:information-outline";
          }

          if (showIcon && badgeIconName) {
            const iEl = document.createElement("ha-icon");
            iEl.setAttribute("icon", badgeIconName);
            iEl.classList.add("badge-icon");
            bWrap.appendChild(iEl);
          }

          const bTextWrap = document.createElement("div");
          bTextWrap.classList.add("badge-text");

          // label-rad för alla UTOM media/alarm (de använder label i value-raden)
          if (badgeCfg.label && type !== "media" && type !== "alarm") {
            const bLabel = document.createElement("div");
            bLabel.classList.add("badge-label");
            bLabel.textContent = badgeCfg.label;
            bTextWrap.appendChild(bLabel);
          }

          const bValue = document.createElement("div");
          bValue.classList.add("badge-value");

          if (type === "dimmer" && bState && entityId.startsWith("light.")) {
            let pct = 0;
            const attrs = bState.attributes || {};
            if (typeof attrs.brightness_pct === "number") {
              pct = attrs.brightness_pct;
            } else if (typeof attrs.brightness === "number") {
              pct = Math.round((attrs.brightness / 255) * 100);
            }

            bValue.textContent = `${pct}%`;

            bTextWrap.appendChild(bValue);
            bWrap.appendChild(bTextWrap);

            const slider = document.createElement("input");
            slider.type = "range";
            slider.min = "0";
            slider.max = "100";
            slider.step = "1";
            slider.value = String(pct);
            slider.classList.add("badge-dimmer-slider");
            const sliderColor =
              this._config.dimmer_slider_color || "#FFFFFF";
            try {
              slider.style.accentColor = sliderColor;
            } catch (e) {
              // ignore
            }
            slider.addEventListener("click", (ev) => ev.stopPropagation());
            slider.addEventListener("change", (ev) => {
              const newVal = Number(ev.target.value);
              if (!isNaN(newVal) && this._hass) {
                this._hass.callService("light", "turn_on", {
                  entity_id: entityId,
                  brightness_pct: newVal,
                });
              }
            });

            bWrap.appendChild(slider);
          } else if (type === "stats") {
            const txt = this._getStatsBadgeValue(
              badgeCfg,
              entityId,
              bState
            );
            bValue.textContent = txt;
            bTextWrap.appendChild(bValue);
            bWrap.appendChild(bTextWrap);

            bWrap.addEventListener("click", (ev) => {
              ev.stopPropagation();
              this._handlePrimaryAction(ev, entityId);
            });
          } else if (type === "media") {
            const action = badgeCfg.media_action || "play_pause";
            if (!badgeCfg.label) {
              let defaultLabel = "";
              switch (action) {
                case "play":
                  defaultLabel = "Play";
                  break;
                case "pause":
                  defaultLabel = "Pause";
                  break;
                case "play_pause":
                  defaultLabel = "Play/Pause";
                  break;
                case "stop":
                  defaultLabel = "Stop";
                  break;
                case "next":
                  defaultLabel = "Next";
                  break;
                case "previous":
                  defaultLabel = "Previous";
                  break;
                case "volume_up":
                  defaultLabel = "Vol +";
                  break;
                case "volume_down":
                  defaultLabel = "Vol -";
                  break;
                case "mute_toggle":
                  defaultLabel = "Mute";
                  break;
                default:
                  defaultLabel = "Media";
              }
              bValue.textContent = defaultLabel;
            } else {
              bValue.textContent = badgeCfg.label;
            }
            bTextWrap.appendChild(bValue);
            bWrap.appendChild(bTextWrap);

            bWrap.addEventListener("click", (ev) =>
              this._handleMediaAction(ev, badgeCfg, entityId)
            );
          } else if (type === "alarm") {
            const action = badgeCfg.alarm_action || "arm_home";
            if (!badgeCfg.label) {
              let defaultLabel = "";
              switch (action) {
                case "arm_home":
                  defaultLabel = "Arm home";
                  break;
                case "arm_away":
                  defaultLabel = "Arm away";
                  break;
                case "arm_night":
                  defaultLabel = "Arm night";
                  break;
                case "disarm":
                  defaultLabel = "Disarm";
                  break;
                default:
                  defaultLabel = "Alarm";
              }
              bValue.textContent = defaultLabel;
            } else {
              bValue.textContent = badgeCfg.label;
            }
            bTextWrap.appendChild(bValue);
            bWrap.appendChild(bTextWrap);

            bWrap.addEventListener("click", (ev) =>
              this._handleAlarmAction(ev, badgeCfg, entityId)
            );
          } else if (type === "media_info") {
            const mode = badgeCfg.media_info_mode || "title_artist";
            let txt = "—";
            if (bState) {
              const a = bState.attributes ||{};
              const title = a.media_title || "";
              const artist = a.media_artist || "";
              const album =
                a.media_album_name || a.media_album || "";
              const source = a.source || a.input_source || "";

              switch (mode) {
                case "title":
                  txt = title || "—";
                  break;
                case "artist":
                  txt = artist || "—";
                  break;
                case "album":
                  txt = album || "—";
                  break;
                case "source":
                  txt = source || "—";
                  break;
                case "title_artist":
                default:
                  if (title && artist) txt = `${title} – ${artist}`;
                  else txt = title || artist || "—";
                  break;
              }
            }
            bValue.textContent = txt;
            bTextWrap.appendChild(bValue);
            bWrap.appendChild(bTextWrap);

            bWrap.addEventListener("click", (ev) => {
              ev.stopPropagation();
              this._handlePrimaryAction(ev, entityId);
            });
          } else {
            if (bState) {
              const u = bState.attributes.unit_of_measurement || "";
              bValue.textContent = `${bState.state}${u ? u : ""}`;
            } else {
              bValue.textContent = "—";
            }
            bTextWrap.appendChild(bValue);
            bWrap.appendChild(bTextWrap);

            bWrap.addEventListener("click", (ev) => {
              ev.stopPropagation();
              this._handlePrimaryAction(ev, entityId);
            });
          }

          badgesRow.appendChild(bWrap);
        });
        tile.appendChild(badgesRow);
      }

      return tile;
    }

    _getStatsBadgeValue(badgeCfg, entityId, bState) {
      const mode = badgeCfg.stats_mode || "max";
      const hours = Number(badgeCfg.stats_hours || 24);
      const key = `${entityId}|${hours}`;

      const entry = this._statsCache ? this._statsCache[key] : undefined;
      const now = Date.now();

      if (
        !entry ||
        (!entry.loading && !entry.stats) ||
        (entry.fetched && now - entry.fetched > 600000)
      ) {
        this._fetchStatsForBadge(entityId, hours, key);
      }

      if (!entry || !entry.stats) {
        return "…";
      }

      const stats = entry.stats;
      const unit =
        bState && bState.attributes
          ? bState.attributes.unit_of_measurement || ""
          : "";

      if (mode === "min") {
        return stats.min != null
          ? `${stats.min.toFixed(1)}${unit}`
          : "—";
      }
      if (mode === "max") {
        return stats.max != null
          ? `${stats.max.toFixed(1)}${unit}`
          : "—";
      }
      if (mode === "avg") {
        return stats.avg != null
          ? `${stats.avg.toFixed(1)}${unit}`
          : "—";
      }
      if (mode === "last_on") {
        return stats.last_on ? this._formatTime(stats.last_on) : "—";
      }
      if (mode === "last_off") {
        return stats.last_off ? this._formatTime(stats.last_off) : "—";
      }
      if (mode === "last_changed") {
        return stats.last_changed
          ? this._formatTime(stats.last_changed)
          : "—";
      }

      return "—";
    }

    _fetchStatsForBadge(entityId, hours, key) {
      if (!this._hass || !entityId) return;
      if (!this._statsCache) this._statsCache = {};
      const existing = this._statsCache[key];
      if (existing && existing.loading) return;

      this._statsCache[key] = { loading: true };

      const startDate = new Date(Date.now() - hours * 3600000);
      const startIso = startDate.toISOString();

      this._hass
        .callApi(
          "GET",
          `history/period/${startIso}?filter_entity_id=${encodeURIComponent(
            entityId
          )}&significant_changes_only=0`
        )
        .then((res) => {
          let list = res;
          if (Array.isArray(res) && Array.isArray(res[0])) {
            list = res[0];
          }
          if (!Array.isArray(list)) list = [];

          let min = null;
          let max = null;
          let sum = 0;
          let count = 0;
          let last_on = null;
          let last_off = null;
          let last_changed = null;

          list.forEach((p) => {
            const st = String(p.state);
            const num = Number(st);
            if (!isNaN(num)) {
              if (min === null || num < min) min = num;
              if (max === null || num > max) max = num;
              sum += num;
              count += 1;
            }

            const tStr =
              p.last_updated ||
              p.last_changed ||
              (p.attributes &&
                (p.attributes.last_updated || p.attributes.last_changed));
            const t = tStr ? new Date(tStr) : null;
            if (t && !isNaN(t)) {
              last_changed = t;
              const low = st.toLowerCase();
              if (low === "on") last_on = t;
              else if (low === "off") last_off = t;
            }
          });

          const avg = count > 0 ? sum / count : null;

          this._statsCache[key] = {
            loading: false,
            fetched: Date.now(),
            stats: { min, max, avg, last_on, last_off, last_changed },
          };
          this._render();
        })
        .catch((err) => {
          console.error("Andy Quickboard stats fetch error", err);
          this._statsCache[key] = {
            loading: false,
            fetched: Date.now(),
            stats: {},
          };
        });
    }

    _formatTime(date) {
      try {
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch (e) {
        return date.toISOString().slice(11, 16);
      }
    }

    _getColorForState(stateObj, entCfg) {
      const result = {
        background: "",
        text_color: "",
        state_label: "",
        suffix_text: "",
      };
      const intervals = this._config.color_intervals || [];

      // Per-entity custom color mode (unchanged)
      if (entCfg && entCfg.color_mode === "custom") {
        const cf = entCfg.color_from || "#1E88E5";
        const ct = entCfg.color_to || cf;
        result.background =
          cf === ct ? cf : `linear-gradient(135deg, ${cf}, ${ct})`;
        result.text_color = "#FFFFFF";
        return result;
      }

      if (!stateObj) return result;

      const rawState = String(stateObj.state ?? "");
      const numericVal = Number(rawState);
      const hasNumeric = !isNaN(numericVal);

      // 1) Globala intervall – som tidigare
      for (const i of intervals) {
        const from = i.from ?? 0;
        const to = i.to ?? 0;
        const cf = i.color_from || "#1E88E5";
        const ct = i.color_to || cf;
        const bg =
          cf === ct ? cf : `linear-gradient(135deg, ${cf}, ${ct})`;
        const txt = i.text_color || "#FFFFFF";

        if (i.match_state) {
          if (
            rawState.toLowerCase() === String(i.match_state).toLowerCase()
          ) {
            result.background = bg;
            result.text_color = txt;
            result.state_label = i.state_text || "";
            result.suffix_text = i.suffix_text || "";
            // OBS: vi fortsätter inte return här – per-entity overrides kan
            // fortfarande få "sista ordet" nedan.
            break;
          }
          continue;
        }

        if (!hasNumeric) continue;
        if (numericVal >= from && numericVal < to) {
          result.background = bg;
          result.text_color = txt;
          result.state_label = "";
          result.suffix_text = i.suffix_text || "";
          break;
        }
      }

      // 2) Per-entity, per-state overrides via icon_states
      if (
        entCfg &&
        entCfg.icon_mode === "state" &&
        Array.isArray(entCfg.icon_states)
      ) {
        const lower = rawState.toLowerCase();
        const match = entCfg.icon_states.find(
          (m) => String(m.state ?? "").toLowerCase() === lower
        );
        if (match) {
          // Färg override
          if (match.color_from || match.color_to) {
            const cf = match.color_from || match.color_to || "#1E88E5";
            const ct = match.color_to || cf;
            result.background =
              cf === ct ? cf : `linear-gradient(135deg, ${cf}, ${ct})`;
          }
          if (match.text_color) {
            result.text_color = match.text_color;
          }

          // Label override
          if (typeof match.label === "string" && match.label.length > 0) {
            result.state_label = match.label;
          }

          // Suffix override (kan vara tom sträng för "inget suffix")
          if (typeof match.suffix_text === "string") {
            result.suffix_text = match.suffix_text;
          }
        }
      }

      return result;
    }

    _css() {
      return `
        :host {
          display: block;
        }
        ha-card.quickboard-card {
          overflow: hidden;
        }
        .wrapper {
          padding: 16px;
          box-sizing: border-box;
        }
        .card-title {
          font-weight: 600;
          font-size: 1.1rem;
          margin-bottom: 12px;
        }
        .row-wrapper {
          margin-bottom: 12px;
        }
        .row-label {
          font-size: 0.9rem;
          font-weight: 500;
          margin-bottom: 6px;
          opacity: 0.9;
        }
        .row-label[data-position="top-center"],
        .row-label[data-position="bottom-center"] {
          text-align: center;
        }
        .row-label[data-position="top-right"],
        .row-label[data-position="bottom-right"] {
          text-align: right;
        }
        .tiles-row {
          display: flex;
          flex-direction: row;
          gap: 12px;
        }
        .tiles-row > .tile {
          flex: 1 1 0;
        }
        .tile {
          position: relative;
          border-radius: 18px;
          background: linear-gradient(135deg, #1E3C72, #2A5298);
          color: #FFFFFF;
          padding: 12px 16px;
          box-sizing: border-box;
          box-shadow: 0 4px 10px rgba(0,0,0,0.25);
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .tile:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 14px rgba(0,0,0,0.35);
        }
        .tile-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .tile-icon-name-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tile-icon {
          width: 20px;
          height: 20px;
        }
        .tile-name {
          font-size: 1rem;
          font-weight: 600;
        }
        .tile-value {
          font-size: 1.8rem;
          font-weight: 700;
          margin-top: 4px;
        }
        .badges-row {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 8px;
          margin-top: 10px;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.7rem;
        }
        .badge-pill {
          background: rgba(0,0,0,0.22);
          border-radius: 999px;
          padding: 7px 16px;
        }
        .badge-strong {
          background: rgba(0,0,0,0.35);
          box-shadow: 0 2px 4px rgba(0,0,0,0.25);
        }
        .badge-chip {
          background: rgba(0,0,0,0.22);
          border-radius: 6px;
          padding: 7px 14px;
        }
        .badge-underline {
          background: none;
          padding: 2px 0;
          border-bottom: 2px solid rgba(255,255,255,0.7);
        }
        .badge-none {
          background: none;
          padding: 0;
        }
        .badge-icon {
          margin-bottom: 7px;
          width: 18px;
          height: 18px;
        }
        .badge-text {
          display: flex;
          flex-direction: column;
          justify-content: center;
          line-height: 1.1;
        }
        .badge-label {
          opacity: 0.9;
        }
        .badge-value {
          font-weight: 600;
        }
        .badge-dimmer-slider {
          margin-left: 8px;
          width: 100px;
        }
      `;
    }
  }

  customElements.define(CARD_TAG, AndyQuickboardCard);

  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === CARD_TAG)) {
    window.customCards.push({
      type: CARD_TAG,
      name: "Andy Quickboard Card",
      description: "Quickboard-style powerful multi-entity view with many features",
    });
  }
}

// --------------- EDITOR -------------------------

if (!customElements.get(EDITOR_TAG)) {
  const LitBase =
    customElements.get("hui-masonry-view") ||
    customElements.get("ha-panel-lovelace");
  const LitElement = Object.getPrototypeOf(LitBase);
  const html = LitElement.prototype.html;
  const css = LitElement.prototype.css;

  class AndyQuickboardCardEditor extends LitElement {
    static get properties() {
      return {
        hass: {},
        _config: {},
        _rowsCollapsed: {},
        _entitiesCollapsed: {},
      };
    }

    constructor() {
      super();
      this._config = {};
      this._rowsCollapsed = {};
      this._entitiesCollapsed = {};
    }

    setConfig(config) {
      this._config = {
        color_intervals: [],
        box_style: {},
        rows: [],
        badge_style: "pill",
        dimmer_slider_color: "#FFFFFF",
        ...config,
      };
    }

    _emitConfigChanged() {
      fireEvent(this, "config-changed", { config: this._config });
    }

    _ensureBoxStyle() {
      if (!this._config.box_style) this._config.box_style = {};
    }

    _stopPropagation(ev) {
      ev.stopPropagation();
    }

    _mkEntityControl(label, value, onChange) {
      const stop = (e) => e.stopPropagation();
      const hasSelector = !!customElements.get("ha-selector");

      if (hasSelector) {
        const sel = document.createElement("ha-selector");
        sel.label = label;
        sel.selector = { entity: {} };
        sel.value = value;
        sel.hass = this.hass;
        sel.addEventListener("value-changed", (e) => {
          const v = e.detail?.value ?? e.target.value;
          onChange(v);
        });
        sel.addEventListener("click", stop);
        return sel;
      }

      const ep = document.createElement("ha-entity-picker");
      ep.label = label;
      ep.allowCustomEntity = true;
      ep.value = value;
      ep.hass = this.hass;
      ep.addEventListener("value-changed", (e) => {
        const v = e.detail?.value ?? e.target.value;
        onChange(v);
      });
      ep.addEventListener("click", stop);
      return ep;
    }

    _openColorPicker(e, idx, field) {
      e.stopPropagation();
      const intervals = this._config.color_intervals || [];
      const current = intervals[idx]?.[field] || "#000000";

      const input = document.createElement("input");
      input.type = "color";
      input.value = current.startsWith("#") ? current : "#000000";
      input.style.position = "fixed";

      const rect = e.currentTarget.getBoundingClientRect();
      input.style.left = `${rect.left + rect.width / 2}px`;
      input.style.top = `${rect.top + rect.height / 2}px`;

      document.body.appendChild(input);

      const onInput = (ev2) => {
        const val = ev2.target.value;
        this._updateIntervalField(idx, field, val);
      };
      const onChange = () => {
        document.body.removeChild(input);
        input.removeEventListener("input", onInput);
        input.removeEventListener("change", onChange);
      };
      input.addEventListener("input", onInput);
      input.addEventListener("change", onChange);
      input.click();
    }

    _openEntityColorPicker(e, rowIdx, entIdx, field) {
      e.stopPropagation();
      const rows = this._config.rows || [];
      const ent = rows[rowIdx]?.entities?.[entIdx] || {};
      const current = ent[field] || "#000000";

      const input = document.createElement("input");
      input.type = "color";
      input.value = current.startsWith("#") ? current : "#000000";
      input.style.position = "fixed";

      const rect = e.currentTarget.getBoundingClientRect();
      input.style.left = `${rect.left + rect.width / 2}px`;
      input.style.top = `${rect.top + rect.height / 2}px`;

      document.body.appendChild(input);

      const onInput = (ev2) => {
        const val = ev2.target.value;
        this._updateEntityColorField(rowIdx, entIdx, field, val);
      };
      const onChange = () => {
        document.body.removeChild(input);
        input.removeEventListener("input", onInput);
        input.removeEventListener("change", onChange);
      };
      input.addEventListener("input", onInput);
      input.addEventListener("change", onChange);
      input.click();
    }

    // NEW: State-level color picker for icon_states
    _openStateColorPicker(e, rowIdx, entIdx, stateIdx, field) {
      e.stopPropagation();
      const rows = this._config.rows || [];
      const ent = rows[rowIdx]?.entities?.[entIdx] || {};
      const states = ent.icon_states || [];
      const st = states[stateIdx] || {};
      const current = st[field] || "#000000";

      const input = document.createElement("input");
      input.type = "color";
      input.value = current.startsWith("#") ? current : "#000000";
      input.style.position = "fixed";

      const rect = e.currentTarget.getBoundingClientRect();
      input.style.left = `${rect.left + rect.width / 2}px`;
      input.style.top = `${rect.top + rect.height / 2}px`;

      document.body.appendChild(input);

      const onInput = (ev2) => {
        const val = ev2.target.value;
        this._updateStateColorField(rowIdx, entIdx, stateIdx, field, val);
      };
      const onChange = () => {
        document.body.removeChild(input);
        input.removeEventListener("input", onInput);
        input.removeEventListener("change", onChange);
      };
      input.addEventListener("input", onInput);
      input.addEventListener("change", onChange);
      input.click();
    }

    _openGlobalColorPicker(e, field) {
      e.stopPropagation();
      const current = this._config[field] || "#FFFFFF";

      const input = document.createElement("input");
      input.type = "color";
      input.value = current.startsWith("#") ? current : "#FFFFFF";
      input.style.position = "fixed";

      const rect = e.currentTarget.getBoundingClientRect();
      input.style.left = `${rect.left + rect.width / 2}px`;
      input.style.top = `${rect.top + rect.height / 2}px`;

      document.body.appendChild(input);

      const onInput = (ev2) => {
        const val = ev2.target.value;
        this._updateGlobalColorField(field, val);
      };
      const onChange = () => {
        document.body.removeChild(input);
        input.removeEventListener("input", onInput);
        input.removeEventListener("change", onChange);
      };
      input.addEventListener("input", onInput);
      input.addEventListener("change", onChange);
      input.click();
    }

    _updateGlobalColorField(field, value) {
      this._config[field] = value;
      this.requestUpdate();
      this._emitConfigChanged();
    }

    _updateIntervalField(idx, field, value) {
      if (!this._config.color_intervals) this._config.color_intervals = [];
      if (!this._config.color_intervals[idx]) {
        this._config.color_intervals[idx] = {
          from: 0,
          to: 10,
          color_from: "#000000",
          color_to: "#000000",
          text_color: "#FFFFFF",
          match_state: "",
          state_text: "",
          suffix_text: "",
        };
      }
      this._config.color_intervals[idx][field] = value;
      this.requestUpdate();
      this._emitConfigChanged();
    }

    _updateEntityColorField(rowIdx, entIdx, field, value) {
      if (!this._config.rows) this._config.rows = [];
      if (!this._config.rows[rowIdx]) this._config.rows[rowIdx] = { entities: [] };
      if (!this._config.rows[rowIdx].entities)
        this._config.rows[rowIdx].entities = [];
      if (!this._config.rows[rowIdx].entities[entIdx]) {
        this._config.rows[rowIdx].entities[entIdx] = {
          entity: "",
          icon: "",
          name: "",
          value_font_size: 1.0,
          label_font_size: 1.0,
          color_mode: "interval",
          color_from: "",
          color_to: "",
          badges: [],
        };
      }
      this._config.rows[rowIdx].entities[entIdx][field] = value;
      this.requestUpdate();
      this._emitConfigChanged();
    }

    // NEW: update helper for icon_states color/text fields
    _updateStateColorField(rowIdx, entIdx, stateIdx, field, value) {
      if (!this._config.rows) this._config.rows = [];
      if (!this._config.rows[rowIdx]) this._config.rows[rowIdx] = { entities: [] };
      if (!this._config.rows[rowIdx].entities)
        this._config.rows[rowIdx].entities = [];
      if (!this._config.rows[rowIdx].entities[entIdx]) {
        this._config.rows[rowIdx].entities[entIdx] = {
          icon_states: [],
        };
      }
      if (!this._config.rows[rowIdx].entities[entIdx].icon_states) {
        this._config.rows[rowIdx].entities[entIdx].icon_states = [];
      }
      if (!this._config.rows[rowIdx].entities[entIdx].icon_states[stateIdx]) {
        this._config.rows[rowIdx].entities[entIdx].icon_states[stateIdx] = {
          state: "",
          icon: "",
          label: "",
          color_from: "",
          color_to: "",
          text_color: "",
          suffix_text: "",
        };
      }
      this._config.rows[rowIdx].entities[entIdx].icon_states[stateIdx][field] =
        value;
      this.requestUpdate();
      this._emitConfigChanged();
    }

    _shadowPresetFromCss(cssVal) {
      if (!cssVal || cssVal === "none") return "none";
      const v = cssVal.replace(/\s+/g, " ").toLowerCase();
      if (v.includes("0 2px 6px")) return "soft";
      if (v.includes("0 4px 12px")) return "medium";
      if (v.includes("0 8px 20px")) return "strong";
      return "medium";
    }

    _shadowCssFromPreset(preset) {
      switch (preset) {
        case "none":
          return "none";
        case "soft":
          return "0 2px 6px rgba(0,0,0,0.18)";
        case "strong":
          return "0 8px 20px rgba(0,0,0,0.35)";
        case "medium":
        default:
          return "0 4px 12px rgba(0,0,0,0.25)";
      }
    }

    updated() {
      const rows = this._config.rows || [];
      const root = this.renderRoot;

      rows.forEach((row, rowIdx) => {
        (row.entities || []).forEach((ent, entIdx) => {
          const entContainer = root.querySelector(
            `#entity-picker-${rowIdx}-${entIdx}`
          );
          if (entContainer && !entContainer._controlAttached) {
            entContainer.innerHTML = "";
            const ctrl = this._mkEntityControl("Entity", ent.entity || "", (val) => {
              this._config.rows[rowIdx].entities[entIdx].entity = val;
              this._emitConfigChanged();
            });
            entContainer.appendChild(ctrl);
            entContainer._controlAttached = true;
          }

          (ent.badges || []).forEach((b, bIdx) => {
            const badgeContainer = root.querySelector(
              `#badge-entity-picker-${rowIdx}-${entIdx}-${bIdx}`
            );
            if (badgeContainer && !badgeContainer._controlAttached) {
              badgeContainer.innerHTML = "";
              const ctrl = this._mkEntityControl(
                "Badge entity",
                b.entity || "",
                (val) => {
                  this._config.rows[rowIdx].entities[entIdx].badges[bIdx].entity =
                    val;
                  this._emitConfigChanged();
                }
              );
              badgeContainer.appendChild(ctrl);
              badgeContainer._controlAttached = true;
            }
          });
        });
      });
    }

    _setAllRowsCollapsed(collapsed) {
      const rows = this._config.rows || [];
      const map = {};
      rows.forEach((_, idx) => {
        map[idx] = collapsed;
      });
      this._rowsCollapsed = map;
      this.requestUpdate();
    }

    _toggleRow(idx) {
      const current = this._rowsCollapsed[idx] || false;
      this._rowsCollapsed = { ...this._rowsCollapsed, [idx]: !current };
      this.requestUpdate();
    }

    _toggleEntity(rowIdx, entIdx) {
      const key = `${rowIdx}-${entIdx}`;
      const current = this._entitiesCollapsed[key] || false;
      this._entitiesCollapsed = {
        ...this._entitiesCollapsed,
        [key]: !current,
      };
      this.requestUpdate();
    }

    render() {
      if (!this._config) return html``;

      const intervals = this._config.color_intervals || [];
      const boxStyle = this._config.box_style || {};
      const rows = this._config.rows || [];

      return html`
        <style>
          ${this._css()}
        </style>

        <div class="section">
          <div class="section-header">Basic</div>
          <ha-textfield
            label="Title"
            .value=${this._config.title || ""}
            @input=${(e) => {
              this._config = { ...this._config, title: e.target.value };
              this._emitConfigChanged();
            }}
          ></ha-textfield>
        </div>

        <div class="section">
          <div class="section-header">Box style</div>
          <div class="row-inline">
            <ha-textfield
              type="number"
              label="Border radius (px)"
              .value=${boxStyle.border_radius ?? 18}
              min="0"
              step="1"
              @input=${(e) => {
                this._ensureBoxStyle();
                const v = Number(e.target.value);
                this._config.box_style.border_radius = isNaN(v) ? 18 : v;
                this._emitConfigChanged();
              }}
            ></ha-textfield>

            <ha-textfield
              type="number"
              label="Vertical padding (px)"
              .value=${boxStyle.padding_vertical ?? 12}
              min="0"
              step="1"
              @input=${(e) => {
                this._ensureBoxStyle();
                const v = Number(e.target.value);
                this._config.box_style.padding_vertical = isNaN(v) ? 12 : v;
                this._emitConfigChanged();
              }}
            ></ha-textfield>

            <ha-textfield
              type="number"
              label="Horizontal padding (px)"
              .value=${boxStyle.padding_horizontal ?? 16}
              min="0"
              step="1"
              @input=${(e) => {
                this._ensureBoxStyle();
                const v = Number(e.target.value);
                this._config.box_style.padding_horizontal = isNaN(v) ? 16 : v;
                this._emitConfigChanged();
              }}
            ></ha-textfield>
          </div>

          <div class="row-inline">
            <ha-select
              label="Box shadow"
              .value=${this._shadowPresetFromCss(boxStyle.box_shadow)}
              @selected=${(e) => {
                this._ensureBoxStyle();
                const preset = e.target.value || "medium";
                this._config.box_style.box_shadow =
                  this._shadowCssFromPreset(preset);
                this._emitConfigChanged();
              }}
              @closed=${this._stopPropagation}
            >
              <mwc-list-item value="none">None</mwc-list-item>
              <mwc-list-item value="soft">Soft</mwc-list-item>
              <mwc-list-item value="medium">Medium</mwc-list-item>
              <mwc-list-item value="strong">Strong</mwc-list-item>
            </ha-select>
          </div>
        </div>

        <div class="section">
          <div class="section-header">Badges</div>
          <div class="row-inline">
            <ha-select
              label="Badge background style"
              .value=${this._config.badge_style || "pill"}
              @selected=${(e) => {
                const v = e.target.value || "pill";
                this._config.badge_style = v;
                this._emitConfigChanged();
              }}
              @closed=${this._stopPropagation}
            >
              <mwc-list-item value="pill">Pill background</mwc-list-item>
              <mwc-list-item value="pill-strong">Pill strong</mwc-list-item>
              <mwc-list-item value="chip">Chip / rectangle</mwc-list-item>
              <mwc-list-item value="underline">Underline</mwc-list-item>
              <mwc-list-item value="none">No background</mwc-list-item>
            </ha-select>
          </div>
          <div class="row-inline">
            <div class="color-group">
              <div
                class="color-preview border"
                style="background:${this._config.dimmer_slider_color || "#FFFFFF"}"
                @click=${(e) =>
                  this._openGlobalColorPicker(e, "dimmer_slider_color")}
              ></div>
              <ha-textfield
                label="Dimmer slider color"
                .value=${this._config.dimmer_slider_color || ""}
                @input=${(e) =>
                  this._updateGlobalColorField(
                    "dimmer_slider_color",
                    e.target.value
                  )}
              ></ha-textfield>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-header">Color intervals</div>
          ${intervals.map(
            (interval, idx) => html`
              <div class="interval-block">
                <div class="interval-line">
                  <ha-textfield
                    type="number"
                    label="From"
                    .value=${interval.from ?? ""}
                    @input=${(e) =>
                      this._updateIntervalField(
                        idx,
                        "from",
                        Number(e.target.value)
                      )}
                  ></ha-textfield>
                  <ha-textfield
                    type="number"
                    label="To"
                    .value=${interval.to ?? ""}
                    @input=${(e) =>
                      this._updateIntervalField(idx, "to", Number(e.target.value))}
                  ></ha-textfield>
                </div>

                <div class="interval-line">
                  <div class="color-group">
                    <div
                      class="color-preview"
                      style="background:${interval.color_from || "#000"}"
                      @click=${(e) =>
                        this._openColorPicker(e, idx, "color_from")}
                    ></div>
                    <ha-textfield
                      label="Gradient from"
                      .value=${interval.color_from || ""}
                      @input=${(e) =>
                        this._updateIntervalField(
                          idx,
                          "color_from",
                          e.target.value
                        )}
                    ></ha-textfield>
                  </div>

                  <div class="color-group">
                    <div
                      class="color-preview"
                      style="background:${interval.color_to || "#000"}"
                      @click=${(e) => this._openColorPicker(e, idx, "color_to")}
                    ></div>
                    <ha-textfield
                      label="Gradient to"
                      .value=${interval.color_to || ""}
                      @input=${(e) =>
                        this._updateIntervalField(
                          idx,
                          "color_to",
                          e.target.value
                        )}
                    ></ha-textfield>
                  </div>

                  <div class="color-group">
                    <div
                      class="color-preview border"
                      style="background:${interval.text_color || "#FFF"}"
                      @click=${(e) =>
                        this._openColorPicker(e, idx, "text_color")}
                    ></div>
                    <ha-textfield
                      label="Text color"
                      .value=${interval.text_color || ""}
                      @input=${(e) =>
                        this._updateIntervalField(
                          idx,
                          "text_color",
                          e.target.value
                        )}
                    ></ha-textfield>
                  </div>
                </div>

                <div class="row-inline">
                  <ha-textfield
                    label="Match state (optional, e.g. on/off)"
                    .value=${interval.match_state || ""}
                    @input=${(e) =>
                      this._updateIntervalField(
                        idx,
                        "match_state",
                        e.target.value
                      )}
                  ></ha-textfield>
                </div>
                <div class="row-inline">
                  <ha-textfield
                    label="Matched state label (optional)"
                    .value=${interval.state_text || ""}
                    @input=${(e) =>
                      this._updateIntervalField(
                        idx,
                        "state_text",
                        e.target.value
                      )}
                  ></ha-textfield>
                  <ha-textfield
                    label="Suffix text (optional, supports variables)"
                    .value=${interval.suffix_text || ""}
                    @input=${(e) =>
                      this._updateIntervalField(
                        idx,
                        "suffix_text",
                        e.target.value
                      )}
                  ></ha-textfield>
                </div>
                <div class="help-text">
                  Variables: &lt;state&gt;, &lt;unit&gt;, &lt;dimmer_pct&gt;,
                  &lt;source&gt;, &lt;title&gt;, &lt;artist&gt;, &lt;album&gt;,
                  &lt;title_artist&gt;
                </div>

                <mwc-button
                  raised
                  dense
                  class="danger"
                  @click=${(() => {
                    this._config.color_intervals.splice(idx, 1);
                    this.requestUpdate();
                    this._emitConfigChanged();
                  })}
                  >Delete</mwc-button
                >
              </div>
            `
          )}

          <mwc-button
            raised
            dense
            @click=${(() => {
              if (!this._config.color_intervals) this._config.color_intervals = [];
              this._config.color_intervals.push({
                from: 0,
                to: 10,
                color_from: "#1E88E5",
                color_to: "#1E88E5",
                text_color: "#FFFFFF",
                match_state: "",
                state_text: "",
                suffix_text: "",
              });
              this.requestUpdate();
              this._emitConfigChanged();
            })}
            >Add interval</mwc-button
          >
        </div>

        <div class="section">
          <div class="section-header-bar">
            <div class="section-header">Rows & entities</div>
            <div class="section-header-actions">
              <mwc-button
                dense
                @click=${() => this._setAllRowsCollapsed(false)}
                >Expand all</mwc-button
              >
              <mwc-button
                dense
                @click=${() => this._setAllRowsCollapsed(true)}
                >Collapse all</mwc-button
              >
            </div>
          </div>

          ${rows.map((row, rowIdx) => this._renderRow(row, rowIdx))}
          <mwc-button
            raised
            dense
            @click=${(() => {
              if (!this._config.rows) this._config.rows = [];
              this._config.rows.push({
                label: "",
                label_position: "none",
                entities: [],
              });
              this.requestUpdate();
              this._emitConfigChanged();
            })}
            >Add row</mwc-button
          >
        </div>
      `;
    }

    _renderRow(row, rowIdx) {
      const rows = this._config.rows || [];
      const entities = row.entities || [];
      const collapsed = this._rowsCollapsed[rowIdx] || false;

      return html`
        <div class="row-block">
          <div class="row-header">
            <div class="row-label-config">
              <ha-textfield
                label="Row label"
                .value=${row.label || ""}
                @input=${(e) => {
                  this._config.rows[rowIdx].label = e.target.value;
                  this._emitConfigChanged();
                }}
              ></ha-textfield>
              <ha-select
                label="Label position"
                .value=${row.label_position || "none"}
                @selected=${(e) => this._onLabelPosChanged(rowIdx, e)}
                @closed=${this._stopPropagation}
              >
                <mwc-list-item value="none">None</mwc-list-item>
                <mwc-list-item value="top-left">Top left</mwc-list-item>
                <mwc-list-item value="top-center">Top center</mwc-list-item>
                <mwc-list-item value="top-right">Top right</mwc-list-item>
                <mwc-list-item value="bottom-left">Bottom left</mwc-list-item>
                <mwc-list-item value="bottom-center">Bottom center</mwc-list-item>
                <mwc-list-item value="bottom-right">Bottom right</mwc-list-item>
              </ha-select>
            </div>
            <div class="row-buttons">
              <div class="button-group-label">Row</div>
              <mwc-button
                raised
                dense
                @click=${() => this._toggleRow(rowIdx)}
                >${collapsed ? "Expand" : "Collapse"}</mwc-button
              >
              <mwc-button
                raised
                dense
                @click=${(() => {
                  if (rowIdx <= 0) return;
                  [rows[rowIdx - 1], rows[rowIdx]] = [rows[rowIdx], rows[rowIdx - 1]];
                  this.requestUpdate();
                  this._emitConfigChanged();
                })}
                >Up</mwc-button
              >
              <mwc-button
                raised
                dense
                @click=${(() => {
                  if (rowIdx >= rows.length - 1) return;
                  [rows[rowIdx + 1], rows[rowIdx]] = [rows[rowIdx], rows[rowIdx + 1]];
                  this.requestUpdate();
                  this._emitConfigChanged();
                })}
                >Down</mwc-button
              >
              <mwc-button
                raised
                dense
                class="danger"
                @click=${(() => {
                  rows.splice(rowIdx, 1);
                  this.requestUpdate();
                  this._emitConfigChanged();
                })}
                >Delete</mwc-button
              >
            </div>
          </div>

          ${collapsed
            ? ""
            : html`
                <div class="entities-block">
                  ${entities.map((ent, entIdx) =>
                    this._renderEntity(rowIdx, ent, entIdx)
                  )}
                  <mwc-button
                    raised
                    dense
                    @click=${(() => {
                      if (!this._config.rows[rowIdx].entities)
                        this._config.rows[rowIdx].entities = [];
                      this._config.rows[rowIdx].entities.push({
                        entity: "",
                        icon: "",
                        icon_mode: "single",
                        icon_states: [],
                        name: "",
                        value_font_size: 1.0,
                        label_font_size: 1.0,
                        color_mode: "interval",
                        color_from: "",
                        color_to: "",
                        badges: [],
                      });

                      this.requestUpdate();
                      this._emitConfigChanged();
                    })}
                    >Add entity</mwc-button
                  >
                </div>
              `}
        </div>
      `;
    }

    _onLabelPosChanged(rowIdx, e) {
      const select = e.target;
      const value = select && select.value ? select.value : "none";
      this._config.rows[rowIdx].label_position = value;
      this._emitConfigChanged();
    }

    _renderEntity(rowIdx, ent, entIdx) {
      const entities = this._config.rows[rowIdx].entities;
      const badges = ent.badges || [];
      const colorMode = ent.color_mode || "interval";
      const key = `${rowIdx}-${entIdx}`;
      const collapsed = this._entitiesCollapsed[key] || false;

      return html`
        <div class="entity-block">
          <div class="entity-header">
            <div class="entity-title">Entity ${entIdx + 1}</div>
            <div class="row-buttons">
              <div class="button-group-label">${ent.name || "Entity"}</div>
              <mwc-button
                raised
                dense
                @click=${() => this._toggleEntity(rowIdx, entIdx)}
                >${collapsed ? "Expand" : "Collapse"}</mwc-button
              >
              <mwc-button
                raised
                dense
                @click=${(() => {
                  if (entIdx <= 0) return;
                  [entities[entIdx - 1], entities[entIdx]] = [
                    entities[entIdx],
                    entities[entIdx - 1],
                  ];
                  this.requestUpdate();
                  this._emitConfigChanged();
                })}
                >Up</mwc-button
              >
              <mwc-button
                raised
                dense
                @click=${(() => {
                  if (entIdx >= entities.length - 1) return;
                  [entities[entIdx + 1], entities[entIdx]] = [
                    entities[entIdx],
                    entities[entIdx + 1],
                  ];
                  this.requestUpdate();
                  this._emitConfigChanged();
                })}
                >Down</mwc-button
              >
              <mwc-button
                raised
                dense
                class="danger"
                @click=${(() => {
                  entities.splice(entIdx, 1);
                  this.requestUpdate();
                  this._emitConfigChanged();
                })}
                >Delete</mwc-button
              >
            </div>
          </div>

          ${collapsed
            ? ""
            : html`
                <div class="row-inline">
                  <span class="field-label">${ent.name || "Entity"}</span>
                  <div
                    class="entity-picker-placeholder full-width"
                    id=${`entity-picker-${rowIdx}-${entIdx}`}
                  ></div>
                </div>

                <div class="row-inline">
                  <ha-select
                    label="Icon mode"
                    .value=${ent.icon_mode || "single"}
                    @selected=${(e) => {
                      const v = e.target.value || "single";
                      this._config.rows[rowIdx].entities[entIdx].icon_mode = v;
                      this._emitConfigChanged();
                    }}
                    @closed=${this._stopPropagation}
                  >
                    <mwc-list-item value="single">Single icon</mwc-list-item>
                    <mwc-list-item value="state">By state</mwc-list-item>
                  </ha-select>

                  ${ (ent.icon_mode || "single") === "single"
                    ? html`
                        <ha-icon-picker
                          label="Icon"
                          .hass=${this.hass}
                          .value=${ent.icon || ""}
                          @value-changed=${(e) => {
                            this._config.rows[rowIdx].entities[entIdx].icon =
                              e.detail.value;
                            this._emitConfigChanged();
                          }}
                          @closed=${this._stopPropagation}
                        ></ha-icon-picker>
                      `
                    : html`` }

                  <ha-textfield
                    type="number"
                    label="Value font scale (1 = default)"
                    .value=${ent.value_font_size ?? 1.0}
                    min="0.1"
                    step="0.1"
                    @input=${(e) => {
                      const v = Number(e.target.value);
                      this._config.rows[rowIdx].entities[entIdx].value_font_size =
                        isNaN(v) ? 1.0 : v;
                      this._emitConfigChanged();
                    }}
                  ></ha-textfield>

                  <ha-textfield
                    type="number"
                    label="Label font scale (1 = default)"
                    .value=${ent.label_font_size ?? 1.0}
                    min="0.1"
                    step="0.1"
                    @input=${(e) => {
                      const v = Number(e.target.value);
                      this._config.rows[rowIdx].entities[entIdx].label_font_size =
                        isNaN(v) ? 1.0 : v;
                      this._emitConfigChanged();
                    }}
                  ></ha-textfield>
                </div>

                ${(ent.icon_mode || "single") === "state"
                  ? html`
                      <div class="state-icons-block">
                        ${(ent.icon_states || []).map((m, mIdx) => html`
                          <div class="interval-block">
                            <div class="row-inline">
                              <ha-textfield
                                label="State match (e.g. on, off)"
                                .value=${m.state || ""}
                                @input=${(e) => {
                                  const val = e.target.value;
                                  this._config.rows[rowIdx].entities[entIdx]
                                    .icon_states[mIdx].state = val;
                                  this._emitConfigChanged();
                                }}
                              ></ha-textfield>

                              <ha-icon-picker
                                label="Icon"
                                .hass=${this.hass}
                                .value=${m.icon || ""}
                                @value-changed=${(e) => {
                                  this._config.rows[rowIdx].entities[entIdx]
                                    .icon_states[mIdx].icon =
                                    e.detail.value;
                                  this._emitConfigChanged();
                                }}
                                @closed=${this._stopPropagation}
                              ></ha-icon-picker>

                              <mwc-button
                                dense
                                class="danger"
                                @click=${() => {
                                  this._config.rows[rowIdx].entities[entIdx]
                                    .icon_states.splice(mIdx,1);
                                  this.requestUpdate();
                                  this._emitConfigChanged();
                                }}
                              >Delete</mwc-button>
                            </div>

                            <div class="row-inline">
                              <ha-textfield
                                label="Label (optional)"
                                .value=${m.label || ""}
                                @input=${(e) => {
                                  const val = e.target.value;
                                  this._config.rows[rowIdx].entities[entIdx]
                                    .icon_states[mIdx].label = val;
                                  this._emitConfigChanged();
                                }}
                              ></ha-textfield>
                              <ha-textfield
                                label="Suffix text (optional, supports variables)"
                                .value=${m.suffix_text || ""}
                                @input=${(e) => {
                                  const val = e.target.value;
                                  this._config.rows[rowIdx].entities[entIdx]
                                    .icon_states[mIdx].suffix_text = val;
                                  this._emitConfigChanged();
                                }}
                              ></ha-textfield>
                            </div>
                            <div class="help-text">
                              Variables: &lt;state&gt;, &lt;unit&gt;, &lt;dimmer_pct&gt;,
                              &lt;source&gt;, &lt;title&gt;, &lt;artist&gt;, &lt;album&gt;,
                              &lt;title_artist&gt;
                            </div>

                            <div class="interval-line">
                              <div class="color-group">
                                <div
                                  class="color-preview"
                                  style="background:${m.color_from || "#000"}"
                                  @click=${(e) =>
                                    this._openStateColorPicker(
                                      e,
                                      rowIdx,
                                      entIdx,
                                      mIdx,
                                      "color_from"
                                    )}
                                ></div>
                                <ha-textfield
                                  label="Gradient from (optional)"
                                  .value=${m.color_from || ""}
                                  @input=${(e) => {
                                    this._updateStateColorField(
                                      rowIdx,
                                      entIdx,
                                      mIdx,
                                      "color_from",
                                      e.target.value
                                    );
                                  }}
                                ></ha-textfield>
                              </div>

                              <div class="color-group">
                                <div
                                  class="color-preview"
                                  style="background:${m.color_to || "#000"}"
                                  @click=${(e) =>
                                    this._openStateColorPicker(
                                      e,
                                      rowIdx,
                                      entIdx,
                                      mIdx,
                                      "color_to"
                                    )}
                                ></div>
                                <ha-textfield
                                  label="Gradient to (optional)"
                                  .value=${m.color_to || ""}
                                  @input=${(e) => {
                                    this._updateStateColorField(
                                      rowIdx,
                                      entIdx,
                                      mIdx,
                                      "color_to",
                                      e.target.value
                                    );
                                  }}
                                ></ha-textfield>
                              </div>

                              <div class="color-group">
                                <div
                                  class="color-preview border"
                                  style="background:${m.text_color || "#FFF"}"
                                  @click=${(e) =>
                                    this._openStateColorPicker(
                                      e,
                                      rowIdx,
                                      entIdx,
                                      mIdx,
                                      "text_color"
                                    )}
                                ></div>
                                <ha-textfield
                                  label="Text color (optional)"
                                  .value=${m.text_color || ""}
                                  @input=${(e) => {
                                    this._updateStateColorField(
                                      rowIdx,
                                      entIdx,
                                      mIdx,
                                      "text_color",
                                      e.target.value
                                    );
                                  }}
                                ></ha-textfield>
                              </div>
                            </div>
                          </div>
                        `)}
                        <mwc-button
                          dense
                          @click=${() => {
                            if (!this._config.rows[rowIdx].entities[entIdx].icon_states)
                              this._config.rows[rowIdx].entities[entIdx].icon_states = [];
                            this._config.rows[rowIdx].entities[entIdx].icon_states.push({
                              state: "",
                              icon: "",
                              label: "",
                              color_from: "",
                              color_to: "",
                              text_color: "",
                              suffix_text: "",
                            });
                            this.requestUpdate();
                            this._emitConfigChanged();
                          }}
                        >Add state icon</mwc-button>
                      </div>
                    `
                  : ""}

                <div class="row-inline">
                  <ha-textfield
                    label="Name"
                    .value=${ent.name || ""}
                    @input=${(e) => {
                      this._config.rows[rowIdx].entities[entIdx].name =
                        e.target.value;
                      this._emitConfigChanged();
                    }}
                  ></ha-textfield>
                </div>

                <div class="row-inline">
                  <ha-select
                    label="Color source"
                    .value=${colorMode}
                    @selected=${(e) => {
                      const v = e.target.value || "interval";
                      this._config.rows[rowIdx].entities[entIdx].color_mode = v;
                      this._emitConfigChanged();
                    }}
                    @closed=${this._stopPropagation}
                  >
                    <mwc-list-item value="interval">Color interval</mwc-list-item>
                    <mwc-list-item value="custom">Custom colors</mwc-list-item>
                  </ha-select>
                </div>

                ${colorMode === "custom"
                  ? html`
                      <div class="row-inline">
                        <div class="color-group">
                          <div
                            class="color-preview"
                            style="background:${ent.color_from || "#000"}"
                            @click=${(e) =>
                              this._openEntityColorPicker(
                                e,
                                rowIdx,
                                entIdx,
                                "color_from"
                              )}
                          ></div>
                          <ha-textfield
                            label="Gradient from"
                            .value=${ent.color_from || ""}
                            @input=${(e) =>
                              this._updateEntityColorField(
                                rowIdx,
                                entIdx,
                                "color_from",
                                e.target.value
                              )}
                          ></ha-textfield>
                        </div>

                        <div class="color-group">
                          <div
                            class="color-preview"
                            style="background:${ent.color_to || "#000"}"
                            @click=${(e) =>
                              this._openEntityColorPicker(
                                e,
                                rowIdx,
                                entIdx,
                                "color_to"
                              )}
                          ></div>
                          <ha-textfield
                            label="Gradient to"
                            .value=${ent.color_to || ""}
                            @input=${(e) =>
                              this._updateEntityColorField(
                                rowIdx,
                                entIdx,
                                "color_to",
                                e.target.value
                              )}
                          ></ha-textfield>
                        </div>
                      </div>
                    `
                  : ""}

                <div class="badges-block">
                  ${badges.map((b, bIdx) =>
                    this._renderBadge(rowIdx, entIdx, b, bIdx)
                  )}
                  <mwc-button
                    raised
                    dense
                    @click=${(() => {
                      if (!this._config.rows[rowIdx].entities[entIdx].badges)
                        this._config.rows[rowIdx].entities[entIdx].badges = [];
                      this._config.rows[rowIdx].entities[entIdx].badges.push({
                        entity: "",
                        icon: "",
                        label: "",
                        show_icon: true,
                        badge_type: "value",
                        stats_mode: "max",
                        stats_hours: 24,
                        media_action: "play_pause",
                        media_info_mode: "title_artist",
                        alarm_action: "arm_home",
                        alarm_code: "",
                      });
                      this.requestUpdate();
                      this._emitConfigChanged();
                    })}
                    >Add badge</mwc-button
                  >
                </div>
              `}
        </div>
      `;
    }

    _renderBadge(rowIdx, entIdx, b, bIdx) {
      const badges = this._config.rows[rowIdx].entities[entIdx].badges;
      const showIcon = b.show_icon !== false;
      const type = b.badge_type || "value";

      return html`
        <div class="badge-block">
          <div class="row-inline">
            <span class="field-label">Badge entity</span>
            <div
              class="badge-entity-picker-placeholder full-width"
              id=${`badge-entity-picker-${rowIdx}-${entIdx}-${bIdx}`}
            ></div>
          </div>

          <div class="row-inline">
            <ha-select
              label="Badge type"
              .value=${type}
              @selected=${(e) => {
                badges[bIdx].badge_type = e.target.value || "value";
                this._emitConfigChanged();
              }}
              @closed=${this._stopPropagation}
            >
              <mwc-list-item value="value">Value badge</mwc-list-item>
              <mwc-list-item value="dimmer">Dimmer (for lights)</mwc-list-item>
              <mwc-list-item value="stats">Stats (history)</mwc-list-item>
              <mwc-list-item value="media">Media control</mwc-list-item>
              <mwc-list-item value="media_info">Media info</mwc-list-item>
              <mwc-list-item value="alarm">Alarm control</mwc-list-item>
            </ha-select>
          </div>

          ${type === "stats"
            ? html`
                <div class="row-inline">
                  <ha-select
                    label="Stats mode"
                    .value=${b.stats_mode || "max"}
                    @selected=${(e) => {
                      badges[bIdx].stats_mode = e.target.value || "max";
                      this._emitConfigChanged();
                    }}
                    @closed=${this._stopPropagation}
                  >
                    <mwc-list-item value="min">Min</mwc-list-item>
                    <mwc-list-item value="max">Max</mwc-list-item>
                    <mwc-list-item value="avg">Average</mwc-list-item>
                    <mwc-list-item value="last_on">Last on</mwc-list-item>
                    <mwc-list-item value="last_off">Last off</mwc-list-item>
                    <mwc-list-item value="last_changed"
                      >Last changed</mwc-list-item
                    >
                  </ha-select>
                  <ha-textfield
                    type="number"
                    label="History window (hours)"
                    .value=${b.stats_hours ?? 24}
                    min="1"
                    step="1"
                    @input=${(e) => {
                      const v = Number(e.target.value);
                      badges[bIdx].stats_hours = isNaN(v) ? 24 : v;
                      this._emitConfigChanged();
                    }}
                  ></ha-textfield>
                </div>
              `
            : ""}

          ${type === "media"
            ? html`
                <div class="row-inline">
                  <ha-select
                    label="Media action"
                    .value=${b.media_action || "play_pause"}
                    @selected=${(e) => {
                      badges[bIdx].media_action = e.target.value || "play_pause";
                      this._emitConfigChanged();
                    }}
                    @closed=${this._stopPropagation}
                  >
                    <mwc-list-item value="play_pause">Play/Pause</mwc-list-item>
                    <mwc-list-item value="play">Play</mwc-list-item>
                    <mwc-list-item value="pause">Pause</mwc-list-item>
                    <mwc-list-item value="stop">Stop</mwc-list-item>
                    <mwc-list-item value="next">Next track</mwc-list-item>
                    <mwc-list-item value="previous"
                      >Previous track</mwc-list-item
                    >
                    <mwc-list-item value="volume_up">Volume up</mwc-list-item>
                    <mwc-list-item value="volume_down">Volume down</mwc-list-item>
                    <mwc-list-item value="mute_toggle">Mute toggle</mwc-list-item>
                  </ha-select>
                </div>
              `
            : ""}

          ${type === "media_info"
            ? html`
                <div class="row-inline">
                  <ha-select
                    label="Media info mode"
                    .value=${b.media_info_mode || "title_artist"}
                    @selected=${(e) => {
                      badges[bIdx].media_info_mode =
                        e.target.value || "title_artist";
                      this._emitConfigChanged();
                    }}
                    @closed=${this._stopPropagation}
                  >
                    <mwc-list-item value="title">Title</mwc-list-item>
                    <mwc-list-item value="artist">Artist</mwc-list-item>
                    <mwc-list-item value="album">Album</mwc-list-item>
                    <mwc-list-item value="source">Source</mwc-list-item>
                    <mwc-list-item value="title_artist"
                      >Title + artist</mwc-list-item
                    >
                  </ha-select>
                </div>
              `
            : ""}

          ${type === "alarm"
            ? html`
                <div class="row-inline">
                  <ha-select
                    label="Alarm action"
                    .value=${b.alarm_action || "arm_home"}
                    @selected=${(e) => {
                      badges[bIdx].alarm_action = e.target.value || "arm_home";
                      this._emitConfigChanged();
                    }}
                    @closed=${this._stopPropagation}
                  >
                    <mwc-list-item value="arm_home">Arm home</mwc-list-item>
                    <mwc-list-item value="arm_away">Arm away</mwc-list-item>
                    <mwc-list-item value="arm_night">Arm night</mwc-list-item>
                    <mwc-list-item value="disarm">Disarm</mwc-list-item>
                  </ha-select>
                  <ha-textfield
                    label="Alarm code (optional)"
                    .value=${b.alarm_code || ""}
                    @input=${(e) => {
                      badges[bIdx].alarm_code = e.target.value;
                      this._emitConfigChanged();
                    }}
                  ></ha-textfield>
                </div>
              `
            : ""}

          <div class="row-inline">
            <ha-switch
              .checked=${showIcon}
              @change=${(e) => {
                badges[bIdx].show_icon = e.target.checked;
                this._emitConfigChanged();
              }}
            ></ha-switch>
            <span class="field-label">Show icon</span>
          </div>

          <div class="row-inline">
            ${showIcon
              ? html`
                  <ha-icon-picker
                    label="Icon"
                    .hass=${this.hass}
                    .value=${b.icon || ""}
                    @value-changed=${(e) => {
                      badges[bIdx].icon = e.detail.value;
                      this._emitConfigChanged();
                    }}
                    @closed=${this._stopPropagation}
                  ></ha-icon-picker>
                `
              : ""}

            <ha-textfield
              label="Label"
              .value=${b.label || ""}
              @input=${(e) => {
                badges[bIdx].label = e.target.value;
                this._emitConfigChanged();
              }}
            ></ha-textfield>

            <mwc-button
              raised
              dense
              class="danger"
              @click=${(() => {
                badges.splice(bIdx, 1);
                this.requestUpdate();
                this._emitConfigChanged();
              })}
              >Delete</mwc-button
            >
          </div>
        </div>
      `;
    }

    _css() {
      return css`
        :host {
          display: block;
        }
        .section {
          margin-bottom: 16px;
        }
        .section-header {
          font-weight: 600;
          margin-bottom: 8px;
        }
        .section-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .section-header-actions {
          display: flex;
          gap: 4px;
        }
        .row-inline {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          margin-bottom: 6px;
        }
        ha-textfield,
        ha-select,
        ha-entity-picker,
        ha-icon-picker {
          min-width: 180px;
          flex: 1 1 160px;
        }
        .full-width {
          flex: 1 1 100%;
        }
        .field-label {
          font-size: 0.75rem;
          opacity: 0.8;
          min-width: 90px;
        }
        .interval-line {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          margin-bottom: 8px;
        }
        .color-group {
          display: flex;
          align-items: center;
          gap: 4px;
          flex: 1 1 180px;
        }
        .color-preview {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          cursor: pointer;
        }
        .color-preview.border {
          border: 1px solid rgba(0, 0, 0, 0.4);
        }
        .interval-block {
          border-radius: 8px;
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          background: var(--card-background-color, #fff);
          padding: 8px;
          margin-bottom: 10px;
        }
        .row-block {
          border-radius: 8px;
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          background: var(--card-background-color, #fff);
          padding: 8px;
          margin-bottom: 12px;
        }
        .row-header {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }
        .row-label-config {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          flex: 1;
        }
        .row-buttons {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 4px;
        }
        .button-group-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          opacity: 0.7;
          margin-right: 4px;
        }
        .entities-block {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .entity-block {
          border-radius: 6px;
          padding: 6px;
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          background: var(--card-background-color, #fff);
        }
        .entity-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .entity-title {
          font-weight: 500;
        }
        .badges-block {
          margin-top: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .badge-block {
          border-radius: 4px;
          padding: 4px;
          border: 1px dashed var(--divider-color, rgba(0,0,0,0.18));
          background: var(--card-background-color, #fff);
        }
        .help-text {
          font-size: 0.7rem;
          opacity: 0.7;
          margin-bottom: 4px;
        }
        mwc-button {
          --mdc-theme-primary: var(--primary-color);
          text-transform: none;
          font-weight: 500;
          display: inline-block;
          padding: 4px 10px;
          margin: 2px 0;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          font-size: 0.8rem;
          background: var(--primary-color, #03a9f4);
          color: #fff;
        }
        mwc-button.danger {
          --mdc-theme-primary: var(--error-color);
          background: var(--error-color, #ff5252);
        }
      `;
    }
  }

  customElements.define(EDITOR_TAG, AndyQuickboardCardEditor);
}
