/**
 * Andy Quickboard Card
 * v1.2.2
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
const NAVIGATE_EVENT = "andy-quickboard-navigate";
const NAVIGATION_STATE_EVENT = "andy-quickboard-navigation-state";
const NAVIGATION_STATE_STORE = "__andyQuickboardNavigationState";
const NAVIGATION_DEFAULT_STORE = "__andyQuickboardNavigationDefaults";

const createQuickboardCardId = () => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `quickboard_${uuid}`;
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 12);
  return `quickboard_${timestamp}_${random}`;
};

console.info(
  `%c Andy Quickboard Card %c v1.2.2 loaded `,
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
      this._mainMenuStack = [{ id: "", show_back: false, show_close: false }];
      this._popupMenuStack = [];
      this._hoveredTileKey = "";
      this._hoverContinuityTargets = [];
      this._selectedButtonKey = "";
      this._instanceToken = createQuickboardCardId();
      this._publishedDefaultTargets = new Set();
      this._appliedExternalDefaultKey = "";
      this._boundExternalNavigation = (ev) => this._handleExternalNavigation(ev);
      this._boundNavigationState = (ev) => this._handleNavigationState(ev);
      this._boundLocationChanged = () => this._handleLocationChanged();
    }

    static getConfigElement() {
      return document.createElement(EDITOR_TAG);
    }

    static getStubConfig(hass, entities) {
      const first = entities && entities.length ? entities[0] : "sensor.example";
      return {
        type: `custom:${CARD_TAG}`,
        card_id: createQuickboardCardId(),
        title: "Home quickboard",
        color_intervals: [
          {
            from: -50,
            to: 16,
            color_from: "#1565C0",
            color_to: "#1E88E5",
            text_color: "#FFFFFF",
            override_theme_colors: true,
            override_theme_text_color: true,
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
            override_theme_colors: true,
            override_theme_text_color: true,
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
            override_theme_colors: true,
            override_theme_text_color: true,
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
            override_theme_colors: true,
            override_theme_text_color: true,
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
          shadow_strength: 60,
          shadow_color_mode: "ha",
          shadow_color: "#FF9800",
        },
        badge_style: "pill",
        button_style: "raised",
        flat_layout: "rail",
        dimmer_slider_color: "#FFFFFF",
        button_themes: [],
        default_theme_id: "",
        main_menu_theme_id: "",
        default_menu_id: "",
        show_button_type_indicator: false,
        menus: [],
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
                icon_size: 20,
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
      const previousDefaultMenuId = this._configuredDefaultMenuId;
      this._runtimeCardId =
        String(config.card_id || "").trim() ||
        this._runtimeCardId ||
        createQuickboardCardId();
      this._config = {
        ...config,
        card_id: this._runtimeCardId,
        rows: Array.isArray(config.rows) ? config.rows : [],
      };
      this._configuredDefaultMenuId = this._rootMenuId();
      if (!this._statsCache) this._statsCache = {};
      if (
        previousDefaultMenuId !== this._configuredDefaultMenuId ||
        !this._mainMenuStack ||
        !this._mainMenuStack.length
      ) {
        this._resetMainMenu();
        this._appliedExternalDefaultKey = "";
      }
      const currentMain = this._mainMenuStack[this._mainMenuStack.length - 1]?.id || "";
      if (currentMain && !this._findMenu(currentMain)) {
        this._resetMainMenu();
        this._appliedExternalDefaultKey = "";
      }
      if (this._popupMenuStack?.some((entry) => entry.id && !this._findMenu(entry.id))) {
        this._popupMenuStack = [];
      }
      this._applyPendingExternalDefault();
      this._publishDefaultExternalNavigations();
      if (this.shadowRoot) {
        this._render();
        this._announceNavigationState();
      }
    }

    set hass(hass) {
      this._hass = hass;
      if (this.shadowRoot) this._render();
    }

    getCardSize() {
      if (!this._config || !this._config.rows) return 4;
      const rowCounts = [
        this._config.rows.length,
        ...(this._config.menus || []).map((menu) => (menu.rows || []).length),
      ];
      return Math.max(1, ...rowCounts) * 2;
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      window.addEventListener(NAVIGATE_EVENT, this._boundExternalNavigation);
      window.addEventListener(NAVIGATION_STATE_EVENT, this._boundNavigationState);
      window.addEventListener("location-changed", this._boundLocationChanged);
      window.addEventListener("popstate", this._boundLocationChanged);
      this._applyPendingExternalDefault();
      this._publishDefaultExternalNavigations();
      this._render();
      this._announceNavigationState();
    }

    disconnectedCallback() {
      window.removeEventListener(NAVIGATE_EVENT, this._boundExternalNavigation);
      window.removeEventListener(NAVIGATION_STATE_EVENT, this._boundNavigationState);
      window.removeEventListener("location-changed", this._boundLocationChanged);
      window.removeEventListener("popstate", this._boundLocationChanged);
      this._clearPublishedDefaultNavigations();
    }

    _findMenu(menuId) {
      return (this._config?.menus || []).find((menu) => menu.id === menuId);
    }

    _rootMenuId() {
      const configured = String(this._config?.default_menu_id || "").trim();
      if (configured && this._findMenu(configured)) return configured;
      const hasExplicitDefault = Object.prototype.hasOwnProperty.call(
        this._config || {},
        "default_menu_id"
      );
      if (!hasExplicitDefault && !(this._config?.rows || []).length) {
        return this._config?.menus?.[0]?.id || "";
      }
      return "";
    }

    _rootMenuEntry() {
      return { id: this._rootMenuId(), show_back: false, show_close: false };
    }

    _resetMainMenu() {
      this._popupMenuStack = [];
      this._mainMenuStack = [this._rootMenuEntry()];
    }

    _findTheme(themeId) {
      return (this._config?.button_themes || []).find((theme) => theme.id === themeId);
    }

    _resolveTheme(entCfg, menuId = "", rowCfg = null) {
      const buttonChoice = entCfg?.theme_id;
      if (buttonChoice === "__none__") return null;
      if (buttonChoice) return this._findTheme(buttonChoice) || null;

      const rowChoice = rowCfg?.theme_id;
      if (rowChoice === "__none__") return null;
      if (rowChoice) return this._findTheme(rowChoice) || null;

      const scopeChoice = menuId
        ? this._findMenu(menuId)?.theme_id
        : this._config?.main_menu_theme_id;
      if (scopeChoice === "__none__") return null;
      if (scopeChoice) return this._findTheme(scopeChoice) || null;

      return this._findTheme(this._config?.default_theme_id) || null;
    }

    _resolveButtonStyle(entCfg, theme = null) {
      const buttonChoice = entCfg?.button_style;
      if (buttonChoice && buttonChoice !== "inherit") return buttonChoice;
      const themeChoice = theme?.button_style;
      if (themeChoice && themeChoice !== "inherit") return themeChoice;
      return this._config?.button_style || "raised";
    }

    _usesFlatRail(entCfg, menuId = "", rowCfg = null) {
      const theme = this._resolveTheme(entCfg, menuId, rowCfg);
      return (
        this._resolveButtonStyle(entCfg, theme) === "flat" &&
        (this._config?.flat_layout || "rail") === "rail"
      );
    }

    _isFlatRailMenu(menuId = "") {
      const rows = this._menuRows(menuId);
      const buttons = [];
      rows.forEach((row) => (row.entities || []).forEach((ent) =>
        buttons.push({ ent, row })
      ));
      return buttons.length > 0 && buttons.every(({ ent, row }) =>
        this._usesFlatRail(ent, menuId, row)
      );
    }

    _normalizeNavigationPath(path) {
      const raw = String(path || "").trim();
      if (!raw) return "";
      try {
        const origin = window.location?.origin || "http://homeassistant.local";
        const pathname = new URL(raw, origin).pathname || "/";
        return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
      } catch (_) {
        const pathname = raw.split(/[?#]/, 1)[0] || "/";
        const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
        return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
      }
    }

    _currentNavigationPath() {
      return this._normalizeNavigationPath(window.location?.pathname || "/");
    }

    _navigationPathMatches(entCfg) {
      if (entCfg?.button_type !== "navigation" || !entCfg.navigation_path) return false;
      const current = this._currentNavigationPath();
      const target = this._normalizeNavigationPath(entCfg.navigation_path);
      if (!target) return false;
      if ((entCfg.active_path_match || "exact") === "prefix") {
        return current === target || current.startsWith(`${target}/`);
      }
      return current === target;
    }

    _defaultNavigationButton(menuId = "") {
      for (const row of this._menuRows(menuId)) {
        const found = (row.entities || []).find((ent) =>
          ent.button_type === "navigation" && ent.navigation_default === true
        );
        if (found) return found;
      }
      return null;
    }

    _menuHasNavigationPathMatch(menuId = "") {
      return this._menuRows(menuId).some((row) =>
        (row.entities || []).some((ent) => this._navigationPathMatches(ent))
      );
    }

    _isNavigationButtonActive(entCfg, menuId = "") {
      if (this._navigationPathMatches(entCfg)) return true;
      if (this._menuHasNavigationPathMatch(menuId)) return false;
      return this._defaultNavigationButton(menuId) === entCfg;
    }

    _handleLocationChanged() {
      if (this.shadowRoot) this._render();
    }

    _buttonKey(menuId, rowIdx, entIdx) {
      return `${menuId || "__root__"}:${rowIdx}:${entIdx}`;
    }

    _forEachConfiguredButton(callback) {
      const visit = (rows, menuId) => (rows || []).forEach((row, rowIdx) =>
        (row.entities || []).forEach((ent, entIdx) =>
          callback(ent, this._buttonKey(menuId, rowIdx, entIdx), menuId, row)
        )
      );
      visit(this._config?.rows, "");
      (this._config?.menus || []).forEach((menu) => visit(menu.rows, menu.id));
    }

    _navigationStateStore() {
      if (typeof window === "undefined") return {};
      if (!window[NAVIGATION_STATE_STORE] || typeof window[NAVIGATION_STATE_STORE] !== "object") {
        window[NAVIGATION_STATE_STORE] = Object.create(null);
      }
      return window[NAVIGATION_STATE_STORE];
    }

    _navigationDefaultStore() {
      if (typeof window === "undefined") return {};
      if (!window[NAVIGATION_DEFAULT_STORE] || typeof window[NAVIGATION_DEFAULT_STORE] !== "object") {
        window[NAVIGATION_DEFAULT_STORE] = Object.create(null);
      }
      return window[NAVIGATION_DEFAULT_STORE];
    }

    _defaultExternalMenuRequests() {
      const requests = [];
      const seenTargets = new Set();
      this._forEachConfiguredButton((ent) => {
        if (
          ent.button_type !== "menu" ||
          ent.menu_target_scope !== "external" ||
          ent.menu_default !== true
        ) return;
        const targetCardId = String(ent.menu_target_card || "").trim();
        const menuId = String(ent.menu_target || "").trim();
        if (!targetCardId || !menuId || seenTargets.has(targetCardId)) return;
        seenTargets.add(targetCardId);
        requests.push({
          owner: this._instanceToken,
          requestKey: `${this._instanceToken}:${targetCardId}:${menuId}`,
          sourceCardId: String(this._config?.card_id || "").trim(),
          targetCardId,
          menuId,
          displayMode: "replace",
          showBack: ent.menu_show_back === true,
          showClose: false,
        });
      });
      return requests;
    }

    _publishDefaultExternalNavigations() {
      const store = this._navigationDefaultStore();
      const requests = this._defaultExternalMenuRequests();
      const activeTargets = new Set(requests.map((request) => request.targetCardId));

      for (const oldTarget of this._publishedDefaultTargets || []) {
        if (!activeTargets.has(oldTarget) && store[oldTarget]?.owner === this._instanceToken) {
          delete store[oldTarget];
        }
      }

      requests.forEach((request) => {
        const changed = store[request.targetCardId]?.requestKey !== request.requestKey;
        store[request.targetCardId] = request;
        if (changed) fireEvent(window, NAVIGATE_EVENT, request);
      });
      this._publishedDefaultTargets = activeTargets;
    }

    _clearPublishedDefaultNavigations() {
      const store = this._navigationDefaultStore();
      for (const targetCardId of this._publishedDefaultTargets || []) {
        if (store[targetCardId]?.owner === this._instanceToken) delete store[targetCardId];
      }
      this._publishedDefaultTargets = new Set();
    }

    _applyPendingExternalDefault() {
      const ownCardId = String(this._config?.card_id || "").trim();
      if (!ownCardId) return false;
      const request = this._navigationDefaultStore()[ownCardId];
      if (!request || request.requestKey === this._appliedExternalDefaultKey) return false;
      const target = String(request.menuId || "").trim();
      if (
        target !== "__root__" &&
        target !== "" &&
        !this._findMenu(target)
      ) return false;

      this._resetMainMenu();
      if (target && target !== "__root__" && target !== this._rootMenuId()) {
        this._mainMenuStack.push({
          id: target,
          show_back: request.showBack === true,
          show_close: false,
        });
      }
      this._appliedExternalDefaultKey = request.requestKey;
      return true;
    }

    _matchingExternalButtonKey(cardId, menuId, isRoot = false) {
      let match = "";
      this._forEachConfiguredButton((ent, key) => {
        const target = String(ent.menu_target || "");
        if (
          !match &&
          ent.button_type === "menu" &&
          ent.menu_target_scope === "external" &&
          String(ent.menu_target_card || "").trim() === String(cardId || "").trim() &&
          (target === String(menuId || "") || (isRoot && target === "__root__"))
        ) {
          match = key;
        }
      });
      return match;
    }

    _isExternalMenuButtonActive(entCfg) {
      if (entCfg?.button_type !== "menu" || entCfg.menu_target_scope !== "external") return false;
      const cardId = String(entCfg.menu_target_card || "").trim();
      if (!cardId) return false;
      const state = this._navigationStateStore()[cardId];
      if (!state) return entCfg.menu_default === true;
      const target = String(entCfg.menu_target || "");
      return target === String(state.menuId || "") || (target === "__root__" && state.isRoot === true);
    }

    _setSelectedButton(key, entCfg, tile, menuId = "", rowCfg = null) {
      const theme = this._resolveTheme(entCfg, menuId, rowCfg);
      if (this._resolveButtonStyle(entCfg, theme) !== "flat") return;
      this._selectedButtonKey = key || "";
      this.shadowRoot?.querySelectorAll?.(".tile.is-selected").forEach((item) =>
        item.classList.remove("is-selected")
      );
      tile?.classList?.add("is-selected");
    }

    _announceNavigationState() {
      const cardId = String(this._config?.card_id || "").trim();
      if (!cardId) return;
      const popupEntry = this._popupMenuStack?.[this._popupMenuStack.length - 1];
      const mainEntry = this._mainMenuStack?.[this._mainMenuStack.length - 1];
      const menuId = popupEntry?.id ?? mainEntry?.id ?? this._rootMenuId();
      const state = {
        cardId,
        menuId,
        rootMenuId: this._rootMenuId(),
        isRoot: !popupEntry && menuId === this._rootMenuId(),
        displayMode: popupEntry ? "popup" : "replace",
      };
      this._navigationStateStore()[cardId] = state;
      fireEvent(window, NAVIGATION_STATE_EVENT, state);
    }

    _handleNavigationState(ev) {
      const detail = ev?.detail || {};
      const cardId = String(detail.cardId || "").trim();
      if (!cardId) return;
      this._navigationStateStore()[cardId] = {
        cardId,
        menuId: detail.menuId || "",
        rootMenuId: detail.rootMenuId || "",
        isRoot: detail.isRoot === true,
        displayMode: detail.displayMode || "replace",
      };
      const key = this._matchingExternalButtonKey(cardId, detail.menuId, detail.isRoot === true);
      if (key === this._selectedButtonKey) return;
      if (!key && this._selectedButtonKey) {
        let selectedIsForCard = false;
        this._forEachConfiguredButton((ent, buttonKey) => {
          if (
            buttonKey === this._selectedButtonKey &&
            ent.menu_target_scope === "external" &&
            String(ent.menu_target_card || "").trim() === cardId
          ) {
            selectedIsForCard = true;
          }
        });
        if (!selectedIsForCard) return;
      }
      this._selectedButtonKey = key;
      if (this.shadowRoot) this._render();
    }

    _handleExternalNavigation(ev) {
      const detail = ev?.detail || {};
      const ownCardId = String(this._config?.card_id || "").trim();
      if (!ownCardId || String(detail.targetCardId || "").trim() !== ownCardId) return;
      if (detail.requestKey) this._appliedExternalDefaultKey = detail.requestKey;
      const target = detail.menuId || "";
      if (target === "__back__") {
        this._goBackMenu();
        return;
      }
      if (target === "__root__" || target === "") {
        this._resetMainMenu();
        this._render();
        this._announceNavigationState();
        return;
      }
      if (!this._findMenu(target)) {
        console.warn(`Andy Quickboard: menu "${target}" was not found in card "${ownCardId}".`);
        return;
      }
      const displayMode = detail.displayMode || "replace";
      if (displayMode !== "popup") {
        this._resetMainMenu();
        if (target === this._rootMenuId()) {
          this._render();
          this._announceNavigationState();
          return;
        }
      }
      this._openMenuTarget(target, {
        displayMode,
        showBack: detail.showBack === true,
        showClose: detail.showClose === true,
      });
    }

    _menuRows(menuId) {
      if (menuId === "__root__") menuId = this._rootMenuId();
      if (!menuId) return this._config?.rows || [];
      return this._findMenu(menuId)?.rows || [];
    }

    _menuTitle(menuId) {
      if (menuId === "__back__") return "Back";
      if (menuId === "__root__") {
        const rootMenuId = this._rootMenuId();
        return rootMenuId ? this._menuTitle(rootMenuId) : (this._config?.title || "Main menu");
      }
      if (!menuId) return this._config?.title || "";
      const menu = this._findMenu(menuId);
      return menu?.title || menu?.name || menuId;
    }

    _isActiveState(state) {
      const value = String(state ?? "").trim().toLowerCase();
      return !["", "0", "off", "closed", "idle", "standby", "unavailable", "unknown", "disarmed"].includes(value);
    }

    _collectMenuStats(menuId, visited = new Set(), countedEntities = new Set()) {
      if (!menuId || menuId === "__root__") menuId = "";
      const visitKey = menuId || "__root__";
      if (visited.has(visitKey)) return { active: 0, total: 0 };
      visited.add(visitKey);

      let active = 0;
      let total = 0;
      this._menuRows(menuId).forEach((row) => {
        (row.entities || []).forEach((item) => {
          if (item.button_type === "menu" && item.menu_target_scope !== "external" && item.menu_target && !String(item.menu_target).startsWith("__")) {
            const nested = this._collectMenuStats(item.menu_target, visited, countedEntities);
            active += nested.active;
            total += nested.total;
            return;
          }
          if (!item.entity || !this._hass?.states?.[item.entity]) return;
          if (countedEntities.has(item.entity)) return;
          countedEntities.add(item.entity);
          total += 1;
          if (this._isActiveState(this._hass.states[item.entity].state)) active += 1;
        });
      });
      return { active, total };
    }

    _resolveTileState(entCfg) {
      const entityId = entCfg?.entity || "";
      if (entCfg?.button_type === "navigation") {
        return { entityId: "", stateObj: undefined, menuStats: null };
      }
      if (entCfg?.button_type !== "menu") {
        return {
          entityId,
          stateObj: this._hass && entityId ? this._hass.states[entityId] : undefined,
          menuStats: null,
        };
      }

      const statusMode = entCfg.menu_state_mode || "none";
      if (statusMode === "none") {
        return { entityId, stateObj: undefined, menuStats: null };
      }
      if (statusMode === "entity") {
        return {
          entityId,
          stateObj: entityId ? this._hass?.states?.[entityId] : undefined,
          menuStats: null,
        };
      }

      if (entCfg.menu_target === "__back__" || entCfg.menu_target === "__root__") {
        const state = entCfg.menu_target === "__back__" ? "back" : "home";
        return {
          entityId,
          stateObj: {
            entity_id: `quickboard_menu.${state}`,
            state,
            attributes: { friendly_name: this._menuTitle(entCfg.menu_target), unit_of_measurement: "" },
          },
          menuStats: null,
        };
      }

      const stats = entCfg.menu_target_scope === "external"
        ? { active: 0, total: 0 }
        : this._collectMenuStats(entCfg.menu_target || "");
      return {
        entityId,
        stateObj: {
          entity_id: `quickboard_menu.${entCfg.menu_target || "menu"}`,
          state: String(stats.active),
          attributes: {
            friendly_name: entCfg.name || this._menuTitle(entCfg.menu_target),
            unit_of_measurement: `/${stats.total}`,
          },
        },
        menuStats: stats,
      };
    }

    _handleMenuAction(ev, entCfg) {
      ev?.stopPropagation?.();
      const target = entCfg?.menu_target || "";
      if (!target) return;
      if (entCfg?.menu_target_scope === "external") {
        const targetCardId = String(entCfg.menu_target_card || "").trim();
        if (!targetCardId) return;
        fireEvent(window, NAVIGATE_EVENT, {
          sourceCardId: String(this._config?.card_id || "").trim(),
          targetCardId,
          menuId: target,
          displayMode: entCfg.menu_display || "replace",
          showBack: entCfg.menu_show_back === true,
          showClose: (entCfg.menu_display || "replace") === "popup" || entCfg.menu_show_close === true,
        });
        return;
      }
      if (target === "__back__") {
        this._goBackMenu();
        return;
      }
      if (target === "__root__") {
        this._resetMainMenu();
        this._render();
        this._announceNavigationState();
        return;
      }
      if (!this._findMenu(target)) return;

      this._openMenuTarget(target, {
        displayMode: entCfg.menu_display || "replace",
        showBack: entCfg.menu_show_back === true,
        showClose: entCfg.menu_show_close === true,
      });
    }

    _openMenuTarget(target, { displayMode = "replace", showBack = false, showClose = false } = {}) {
      const entry = {
        id: target,
        show_back: showBack,
        show_close: displayMode === "popup" || showClose,
      };
      if (displayMode === "popup") {
        this._popupMenuStack.push(entry);
      } else if (this._popupMenuStack.length) {
        this._popupMenuStack.push(entry);
      } else {
        this._mainMenuStack.push(entry);
      }
      this._render();
      this._announceNavigationState();
    }

    _goBackMenu() {
      if (this._popupMenuStack.length) {
        this._popupMenuStack.pop();
      } else if (this._mainMenuStack.length > 1) {
        this._mainMenuStack.pop();
      }
      this._render();
      this._announceNavigationState();
    }

    _closeMenu() {
      if (this._popupMenuStack.length) {
        this._popupMenuStack = [];
      } else {
        this._resetMainMenu();
      }
      this._render();
      this._announceNavigationState();
    }

    _handlePrimaryAction(ev, entityId, entCfg, sourceMenuId = "", buttonKey = "", tile = null, rowCfg = null) {
      ev.stopPropagation();
      if (
        entCfg?.button_type === "menu" &&
        (
          !entCfg.menu_target ||
          (entCfg.menu_target_scope === "external" && !String(entCfg.menu_target_card || "").trim()) ||
          (
            entCfg.menu_target_scope !== "external" &&
            !String(entCfg.menu_target).startsWith("__") &&
            !this._findMenu(entCfg.menu_target)
          )
        )
      ) {
        return;
      }
      this._setSelectedButton(buttonKey, entCfg, tile, sourceMenuId, rowCfg);
      if (entCfg?.button_type === "navigation") {
        this._handleNavigationButtonAction(entCfg);
        return;
      }
      if (entCfg?.button_type === "menu") {
        this._handleMenuAction(ev, entCfg);
        return;
      }
      if (!this._hass || !entityId) return;

      if (entCfg && entCfg.tap_action && entCfg.tap_action.action) {
        this._executeTapAction(entCfg.tap_action, entityId);
      } else {
        this._handleDefaultAction(entityId);
      }
      this._handleMenuActionAfterTap(entCfg, sourceMenuId);
    }

    _handleNavigationButtonAction(entCfg) {
      const navigationPath = String(entCfg?.navigation_path || "").trim();
      if (!navigationPath) return;
      if (entCfg.navigation_replace === true && typeof window.history?.replaceState === "function") {
        window.history.replaceState(null, "", navigationPath);
      } else {
        window.history.pushState(null, "", navigationPath);
      }
      fireEvent(window, "location-changed");
    }

    _handleMenuActionAfterTap(entCfg, sourceMenuId = "") {
      if (!sourceMenuId) return;
      const sourceMenu = this._findMenu(sourceMenuId);
      const action = entCfg?.menu_action_after_tap || sourceMenu?.action_after_tap || "stay";
      if (action === "stay") return;
      if (action === "back") this._goBackMenu();
      else if (action === "close") this._closeMenu();
    }

    _handleDefaultAction(entityId) {
      const [domain] = entityId.split(".");
      const stateObj = this._hass.states[entityId];

      if (domain === "script") {
        this._hass.callService("script", "turn_on", { entity_id: entityId });
      } else if (["light", "switch", "fan", "input_boolean"].includes(domain)) {
        this._hass.callService(domain, "toggle", { entity_id: entityId });
      } else if (domain === "cover") {
        const state = stateObj?.state;
        if (state === "open" || state === "opening") {
          this._hass.callService("cover", "close_cover", { entity_id: entityId });
        } else {
          this._hass.callService("cover", "open_cover", { entity_id: entityId });
        }
      } else if (domain === "lock") {
        const state = stateObj?.state;
        if (state === "locked") {
          this._hass.callService("lock", "unlock", { entity_id: entityId });
        } else if (state === "unlocked") {
          this._hass.callService("lock", "lock", { entity_id: entityId });
        } else {
          fireEvent(this, "hass-more-info", { entityId });
        }
      } else if (domain === "scene") {
        this._hass.callService("scene", "turn_on", { entity_id: entityId });
      } else if (domain === "button" || domain === "input_button") {
        this._hass.callService(domain, "press", { entity_id: entityId });
      } else if (domain === "automation") {
        this._hass.callService("automation", "trigger", { entity_id: entityId });
      } else {
        fireEvent(this, "hass-more-info", { entityId });
      }
    }

    _executeTapAction(tapAction, entityId) {
      const action = tapAction.action;
      switch (action) {
        case "toggle":
          this._handleDefaultAction(entityId);
          break;
        case "more-info":
          fireEvent(this, "hass-more-info", { entityId });
          break;
        case "navigate":
          if (tapAction.navigation_path) {
            if (tapAction.navigation_replace === true && typeof window.history?.replaceState === "function") {
              window.history.replaceState(null, "", tapAction.navigation_path);
            } else {
              window.history.pushState(null, "", tapAction.navigation_path);
            }
            fireEvent(window, "location-changed");
          }
          break;
        case "url":
          if (tapAction.url_path) {
            window.open(tapAction.url_path, "_blank", "noopener,noreferrer");
          }
          break;
        case "call-service": {
          if (tapAction.service) {
            const [svcDomain, svcName] = tapAction.service.split(".");
            let serviceData = {};
            if (tapAction.service_data) {
              try {
                serviceData = typeof tapAction.service_data === "object"
                  ? tapAction.service_data
                  : JSON.parse(tapAction.service_data);
              } catch (_) {
                serviceData = {};
              }
            }
            if (!serviceData.entity_id) serviceData.entity_id = entityId;
            this._hass.callService(svcDomain, svcName, serviceData);
          }
          break;
        }
        case "none":
        default:
          break;
      }
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
      const hoveredSlot = root.querySelector?.(".tile-slot:hover");
      if (hoveredSlot?.dataset?.hoverKey) this._hoveredTileKey = hoveredSlot.dataset.hoverKey;
      this._hoverContinuityTargets = [];
      const style = document.createElement("style");
      style.textContent = this._css();
      root.innerHTML = "";
      root.appendChild(style);

      const cardModStyle = this._config?.card_mod?.style;
      if (typeof cardModStyle === "string" && cardModStyle.trim()) {
        const cardModCompatibilityStyle = document.createElement("style");
        cardModCompatibilityStyle.setAttribute("data-andy-card-mod", "true");
        cardModCompatibilityStyle.textContent = cardModStyle;
        root.appendChild(cardModCompatibilityStyle);
      }

      const haCard = document.createElement("ha-card");
      haCard.classList.add("quickboard-card");

      const wrapper = document.createElement("div");
      wrapper.classList.add("wrapper");

      const mainEntry = this._mainMenuStack[this._mainMenuStack.length - 1] || this._rootMenuEntry();
      const mainIsFlatRail =
        this._isFlatRailMenu(mainEntry.id || "") &&
        !mainEntry.show_back &&
        !mainEntry.show_close;
      if (mainIsFlatRail) {
        haCard.classList.add("flat-rail-card");
        wrapper.classList.add("flat-rail-view");
      }
      this._renderMenuView(wrapper, mainEntry, false);
      haCard.appendChild(wrapper);

      if (this._popupMenuStack.length) {
        const popupEntry = this._popupMenuStack[this._popupMenuStack.length - 1];
        const backdrop = document.createElement("div");
        backdrop.classList.add("menu-popup-backdrop");
        const popup = document.createElement("div");
        popup.classList.add("menu-popup");
        popup.addEventListener("click", (ev) => ev.stopPropagation());
        this._renderMenuView(popup, popupEntry, true);
        backdrop.appendChild(popup);
        haCard.appendChild(backdrop);
      }

      root.appendChild(haCard);
      const continuityTargets = this._hoverContinuityTargets;
      if (continuityTargets.length && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => {
          continuityTargets.forEach(({ slot, tile, key }) => {
            if (typeof slot.matches === "function" && !slot.matches(":hover")) {
              tile.classList.remove("hover-continuity");
              if (this._hoveredTileKey === key) this._hoveredTileKey = "";
            }
          });
        });
      }
    }

    _renderMenuView(container, entry, isPopup) {
      const menuId = entry?.id || "";
      const title = this._menuTitle(menuId);
      const resolvedMenuId = menuId === "__root__" ? this._rootMenuId() : menuId;
      const menuConfig = resolvedMenuId ? this._findMenu(resolvedMenuId) : null;
      const showTitle = menuConfig ? menuConfig.show_title !== false : true;
      const showClose = isPopup || entry?.show_close;
      const isFlatRail =
        !isPopup &&
        this._isFlatRailMenu(menuId) &&
        !entry?.show_back &&
        !showClose;
      if (!isFlatRail && ((showTitle && title) || entry?.show_back || showClose)) {
        const header = document.createElement("div");
        header.classList.add("menu-view-header");
        if (showTitle && title) {
          const titleEl = document.createElement("div");
          titleEl.classList.add("card-title");
          titleEl.textContent = title;
          header.appendChild(titleEl);
        }
        const actions = document.createElement("div");
        actions.classList.add("menu-view-actions");
        if (entry?.show_back) {
          actions.appendChild(this._createMenuControl("mdi:arrow-left", "Back", () => this._goBackMenu()));
        }
        if (showClose) {
          actions.appendChild(this._createMenuControl("mdi:close", "Close", () => this._closeMenu()));
        }
        if (actions.childElementCount) header.appendChild(actions);
        container.appendChild(header);
      }

      const rowsContainer = document.createElement("div");
      rowsContainer.classList.add("menu-rows");
      if (isPopup) rowsContainer.classList.add("popup-rows");
      if (isFlatRail) rowsContainer.classList.add("flat-rail-menu");
      this._menuRows(menuId).forEach((row, rowIdx) => {
        const rowWrapper = document.createElement("div");
        rowWrapper.classList.add("row-wrapper");

        if (row.label && row.label_position && row.label_position.startsWith("top")) {
          const rowLabelTop = this._createRowLabel(row.label, row.label_position);
          rowWrapper.appendChild(rowLabelTop);
        }

        const tilesRow = document.createElement("div");
        tilesRow.classList.add("tiles-row");

        (row.entities || []).forEach((entCfg, entIdx) => {
          const buttonKey = this._buttonKey(menuId, rowIdx, entIdx);
          const tile = this._createTile(entCfg, menuId, row, buttonKey);
          const slot = document.createElement("div");
          slot.classList.add("tile-slot");
          if (tile.classList.contains("flat-layout-rail")) {
            slot.classList.add("flat-rail-slot");
            const configuredIconSize = Number(entCfg.icon_size);
            const railSize = Math.max(
              48,
              (Number.isFinite(configuredIconSize) && configuredIconSize > 0 ? configuredIconSize : 20) + 20
            );
            slot.style.setProperty("--flat-rail-size", `${railSize}px`);
          }
          const hoverKey = `${isPopup ? "popup" : "main"}:${menuId || "root"}:${rowIdx}:${entIdx}`;
          slot.dataset.hoverKey = hoverKey;
          slot.addEventListener("pointerenter", () => {
            this._hoveredTileKey = hoverKey;
          });
          slot.addEventListener("pointerleave", () => {
            if (this._hoveredTileKey === hoverKey) this._hoveredTileKey = "";
            tile.classList.remove("hover-continuity");
          });
          if (this._hoveredTileKey === hoverKey) {
            tile.classList.add("hover-continuity");
            this._hoverContinuityTargets.push({ slot, tile, key: hoverKey });
          }
          slot.appendChild(tile);
          tilesRow.appendChild(slot);
        });

        rowWrapper.appendChild(tilesRow);

        if (row.label && row.label_position && row.label_position.startsWith("bottom")) {
          const rowLabelBottom = this._createRowLabel(row.label, row.label_position);
          rowWrapper.appendChild(rowLabelBottom);
        }

        rowsContainer.appendChild(rowWrapper);
      });
      container.appendChild(rowsContainer);
    }

    _createMenuControl(icon, label, handler) {
      const button = document.createElement("button");
      button.type = "button";
      button.classList.add("menu-control");
      button.setAttribute("aria-label", label);
      button.title = label;
      const iconEl = document.createElement("ha-icon");
      iconEl.setAttribute("icon", icon);
      button.appendChild(iconEl);
      const text = document.createElement("span");
      text.textContent = label;
      button.appendChild(text);
      button.addEventListener("click", (ev) => {
        ev.stopPropagation();
        handler();
      });
      return button;
    }

    _createRowLabel(text, position) {
      const el = document.createElement("div");
      el.classList.add("row-label");
      el.textContent = text;
      el.dataset.position = position;
      return el;
    }

    _applyBoxStyle(tile, theme = null) {
      const boxStyle = this._config.box_style || {};

      const radius = theme?.border_radius !== undefined && theme?.border_radius !== null && theme?.border_radius !== ""
        ? theme.border_radius
        : boxStyle.border_radius;
      if (radius !== undefined && radius !== null) {
        const br = radius;
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

      const borderWidth = Number(theme?.border_width || 0);
      if (borderWidth > 0) {
        tile.style.border = `${borderWidth}px solid ${theme?.border_color || "rgba(255,255,255,.3)"}`;
      }
    }

    _shadowPresetCss(preset) {
      switch (preset) {
        case "none": return "none";
        case "soft": return "0 2px 6px rgba(0,0,0,0.18)";
        case "strong": return "0 8px 20px rgba(0,0,0,0.35)";
        case "glow": return "0 0 18px rgba(0,0,0,0.45)";
        case "medium": return "0 4px 12px rgba(0,0,0,0.25)";
        default: return "";
      }
    }

    _recolorShadow(shadow, color) {
      if (!shadow || shadow === "none") return shadow || "none";
      const match = String(shadow).match(/^\s*((?:-?[\d.]+px|0)\s+(?:-?[\d.]+px|0)\s+(?:[\d.]+px|0)(?:\s+(?:[\d.]+px|0))?)/i);
      const geometry = match?.[1] || "0 4px 12px";
      return `${geometry} ${color}`;
    }

    _resolveShadowStrength(...values) {
      for (const value of values) {
        if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) continue;
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return Math.min(100, Math.max(0, parsed));
      }
      return 60;
    }

    _applyShadowStyle(tile, entCfg, theme, colorInfo) {
      const boxStyle = this._config.box_style || {};
      const buttonPreset = entCfg?.shadow_preset || "inherit";
      let shadow = buttonPreset !== "inherit"
        ? this._shadowPresetCss(buttonPreset)
        : (theme?.box_shadow || boxStyle.box_shadow || "0 4px 12px rgba(0,0,0,0.25)");
      if (!shadow || shadow === "none") {
        tile.style.boxShadow = "none";
        return;
      }

      let mode = "";
      let customColor = "";
      if (entCfg?.shadow_color_mode && entCfg.shadow_color_mode !== "inherit") {
        mode = entCfg.shadow_color_mode;
        customColor = entCfg.shadow_color || "";
      } else if (theme?.shadow_color_mode && theme.shadow_color_mode !== "inherit") {
        mode = theme.shadow_color_mode;
        customColor = theme.shadow_color || "";
      } else {
        mode = boxStyle.shadow_color_mode || "ha";
        customColor = boxStyle.shadow_color || "";
      }

      const strength = this._resolveShadowStrength(
        entCfg?.shadow_strength,
        theme?.shadow_strength,
        boxStyle.shadow_strength,
        60
      );
      let color = mode === "default" ? "#000000" : "var(--primary-color, #03a9f4)";
      if (mode === "custom") color = customColor || color;
      if (mode === "active") {
        color = colorInfo?.shadow_color || colorInfo?.active_color || theme?.color_from || customColor || color;
      }
      tile.style.boxShadow = this._recolorShadow(
        shadow,
        `color-mix(in srgb, ${color} ${strength}%, transparent)`
      );
    }

    _resolveSuffix(template, stateObj, entityId, customUnit) {
      if (!template) return "";
      const attrs = stateObj?.attributes || {};
      const state = stateObj?.state ?? "";
      const unit = customUnit !== undefined ? customUnit : (attrs.unit_of_measurement || "");
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

    _createTile(entCfg, menuId = "", rowCfg = null, buttonKey = "") {
      const tile = document.createElement("div");
      tile.classList.add("tile");

      const theme = this._resolveTheme(entCfg, menuId, rowCfg);
      const buttonStyle = this._resolveButtonStyle(entCfg, theme);
      tile.classList.add(`button-style-${buttonStyle}`);
      const isFlatRail =
        buttonStyle === "flat" &&
        (this._config?.flat_layout || "rail") === "rail";
      if (isFlatRail) tile.classList.add("flat-layout-rail");
      if (
        buttonStyle === "flat" &&
        (
          this._selectedButtonKey === buttonKey ||
          (entCfg.button_type === "navigation" && this._isNavigationButtonActive(entCfg, menuId)) ||
          this._isExternalMenuButtonActive(entCfg)
        )
      ) {
        tile.classList.add("is-selected");
      }
      this._applyBoxStyle(tile, theme);

      const { entityId, stateObj, menuStats } = this._resolveTileState(entCfg);
      const hideButtonStatus =
        entCfg.button_type === "navigation" ||
        (entCfg.button_type === "menu" && (entCfg.menu_state_mode || "none") === "none");
      const showTileLabel = entCfg.show_label !== false;
      const showTileState = entCfg.show_state !== false && !hideButtonStatus;

      const colorInfo = this._getColorForState(stateObj, entCfg, theme);
      if (buttonStyle === "flat") {
        tile.style.setProperty(
          "--flat-selected-background",
          colorInfo.background || "color-mix(in srgb, var(--primary-color, #03a9f4) 22%, transparent)"
        );
        tile.style.setProperty(
          "--flat-selected-text",
          colorInfo.text_color || "var(--primary-text-color)"
        );
        tile.style.setProperty(
          "--flat-accent-color",
          colorInfo.active_color || "var(--primary-color, #03a9f4)"
        );
        tile.style.setProperty(
          "--flat-rail-selected-background",
          `color-mix(in srgb, ${colorInfo.active_color || "var(--primary-color, #03a9f4)"} 24%, var(--card-background-color, #1c1c1c))`
        );
        tile.style.boxShadow = "none";
      } else {
        if (colorInfo.background) tile.style.background = colorInfo.background;
        if (colorInfo.text_color) tile.style.color = colorInfo.text_color;
        this._applyShadowStyle(tile, entCfg, theme, colorInfo);
      }

      const missingStateText = entityId ? "Unavailable" : "No entity";
      const valueStr = stateObj ? stateObj.state : missingStateText;
      const unit = entCfg.unit !== undefined
        ? entCfg.unit
        : (stateObj && (stateObj.attributes.unit_of_measurement || ""));

      
      const suffix =
        colorInfo.suffix_text && stateObj
          ? this._resolveSuffix(colorInfo.suffix_text, stateObj, entityId, unit)
          : "";

      if (entityId || entCfg.button_type === "menu" || entCfg.button_type === "navigation") {
        tile.addEventListener("click", (ev) =>
          this._handlePrimaryAction(ev, entityId, entCfg, menuId, buttonKey, tile, rowCfg)
        );
      }

      const valueNum = Number(valueStr);
      const decimalPlaces = menuStats
        ? 0
        : (entCfg.decimal_places ?? this._config.decimal_places ?? 1);

      const topRow = document.createElement("div");
      topRow.classList.add("tile-top-row");

      const iconNameRow = document.createElement("div");
      iconNameRow.classList.add("tile-icon-name-row");

      // Resolve show_icon: per-entity overrides global; global defaults to true
      const globalShowIcon = this._config.show_icon !== false;
      const showTileIcon = entCfg.show_icon !== undefined ? entCfg.show_icon !== false : globalShowIcon;
      if (!showTileLabel) tile.classList.add("hide-label");
      if (!showTileState) tile.classList.add("hide-state");
      if (showTileIcon && !showTileLabel && !showTileState) {
        tile.classList.add("icon-only");
      }

      let iconName = "";
      if (showTileIcon) {
        // 1) State-based icons if enabled
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

        // 2) Fallback: custom icon / entity icon
        if (!iconName) {
          iconName =
            entCfg.icon ||
            (stateObj ? stateObj.attributes.icon || "" : "");
        }

        const iconEl = document.createElement("ha-icon");
        // 3) Last fallback
        if (iconName) {
          iconEl.setAttribute("icon", iconName);
        } else if (entCfg.button_type === "menu") {
          iconEl.setAttribute("icon", "mdi:view-grid-plus-outline");
        } else if (entCfg.button_type === "navigation") {
          iconEl.setAttribute("icon", "mdi:view-dashboard-outline");
        } else if (entityId) {
          iconEl.setAttribute("icon", "mdi:thermometer");
        }

        iconEl.classList.add("tile-icon");
        const iconSize = Number(entCfg.icon_size);
        if (Number.isFinite(iconSize) && iconSize > 0) {
          iconEl.style.width = `${iconSize}px`;
          iconEl.style.height = `${iconSize}px`;
          iconEl.style.setProperty("--mdc-icon-size", `${iconSize}px`);
        }
        iconNameRow.appendChild(iconEl);
      }

      const buttonLabel =
        entCfg.name ||
        (entCfg.button_type === "menu"
          ? (entCfg.menu_target_scope === "external"
            ? entCfg.menu_target || entCfg.menu_target_card || "Menu"
            : this._menuTitle(entCfg.menu_target))
          : entCfg.button_type === "navigation"
            ? entCfg.navigation_path || "Page"
          : "") ||
        (stateObj ? stateObj.attributes.friendly_name || entityId : entityId);
      if (isFlatRail || !showTileLabel) {
        tile.title = buttonLabel || "Quickboard button";
        tile.setAttribute("aria-label", buttonLabel || "Quickboard button");
      }

      if (showTileLabel) {
        const nameEl = document.createElement("div");
        nameEl.classList.add("tile-name");
        nameEl.textContent = buttonLabel;

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
      }

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
        let txt = `${valueNum.toFixed(decimalPlaces)}${unit ? unit : ""}`;
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
        valueEl.textContent = missingStateText;
      }

      if (showTileState) tile.appendChild(valueEl);

      const badgeStyle = entCfg.badge_style && entCfg.badge_style !== "inherit"
        ? entCfg.badge_style
        : theme?.badge_style && theme.badge_style !== "inherit"
          ? theme.badge_style
          : (this._config.badge_style || "pill");

      if (entCfg.badges && entCfg.badges.length) {
        const badgesRow = document.createElement("div");
        badgesRow.classList.add("badges-row");
        entCfg.badges.forEach((badgeCfg) => {
          if (!badgeCfg.entity) return;
          const bState =
            this._hass ? this._hass.states[badgeCfg.entity] : undefined;
          const entityId = badgeCfg.entity;
          const type = badgeCfg.badge_type || "value";
          const badgeDecimalPlaces = badgeCfg.decimal_places ?? decimalPlaces;

          const bWrap = document.createElement("div");
          bWrap.classList.add("badge");
          if (badgeCfg.font_size !== undefined && badgeCfg.font_size !== null && badgeCfg.font_size !== "") {
            const badgeFontSize = Number(badgeCfg.font_size);
            bWrap.style.fontSize = Number.isFinite(badgeFontSize) && badgeFontSize > 0
              ? `${badgeFontSize}px`
              : String(badgeCfg.font_size);
          }

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

          // Per-badge show_icon overrides global when explicitly set; global defaults to true
          const showIcon = badgeCfg.show_icon !== undefined
            ? badgeCfg.show_icon !== false
            : this._config.show_icon !== false;

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
            const badgeIconSize = Number(badgeCfg.icon_size);
            if (Number.isFinite(badgeIconSize) && badgeIconSize > 0) {
              iEl.style.width = `${badgeIconSize}px`;
              iEl.style.height = `${badgeIconSize}px`;
              iEl.style.setProperty("--mdc-icon-size", `${badgeIconSize}px`);
            }
            bWrap.appendChild(iEl);
          }

          const bTextWrap = document.createElement("div");
          bTextWrap.classList.add("badge-text");

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
              bState,
              badgeDecimalPlaces
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
              const a = bState.attributes || {};
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
              const u = badgeCfg.unit !== undefined
                ? badgeCfg.unit
                : (bState.attributes.unit_of_measurement || "");
              const bNum = Number(bState.state);
              bValue.textContent = !isNaN(bNum)
                ? `${bNum.toFixed(badgeDecimalPlaces)}${u}`
                : `${bState.state}${u ? u : ""}`;
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

      if (this._config.show_button_type_indicator === true) {
        tile.classList.add("has-button-type-mark");
        const typeMark = document.createElement("div");
        typeMark.classList.add("button-type-mark");
        typeMark.title = entCfg.button_type === "menu"
          ? "Menu button"
          : entCfg.button_type === "navigation"
            ? "Navigation button"
            : "Entity button";
        const typeIcon = document.createElement("ha-icon");
        typeIcon.setAttribute(
          "icon",
          entCfg.button_type === "menu"
            ? "mdi:menu"
            : entCfg.button_type === "navigation"
              ? "mdi:page-next-outline"
              : "mdi:flash-outline"
        );
        typeMark.appendChild(typeIcon);
        tile.appendChild(typeMark);
      }

      return tile;
    }

    _getStatsBadgeValue(badgeCfg, entityId, bState, decimalPlaces = 1) {
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
      const unit = badgeCfg.unit !== undefined
        ? badgeCfg.unit
        : (bState && bState.attributes ? bState.attributes.unit_of_measurement || "" : "");

      if (mode === "min") {
        return stats.min != null
          ? `${stats.min.toFixed(decimalPlaces)}${unit}`
          : "—";
      }
      if (mode === "max") {
        return stats.max != null
          ? `${stats.max.toFixed(decimalPlaces)}${unit}`
          : "—";
      }
      if (mode === "avg") {
        return stats.avg != null
          ? `${stats.avg.toFixed(decimalPlaces)}${unit}`
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

    _findColorInterval(stateObj, entCfg) {
      if (!stateObj) return null;
      const intervals = (entCfg && Array.isArray(entCfg.color_intervals) && entCfg.color_intervals.length > 0)
        ? entCfg.color_intervals
        : (this._config.color_intervals || []);
      const rawState = String(stateObj.state ?? "");
      const numericVal = Number(rawState);
      const hasNumeric = !isNaN(numericVal);
      for (const interval of intervals) {
        if (interval.match_state) {
          if (rawState.toLowerCase() === String(interval.match_state).toLowerCase()) return interval;
          continue;
        }
        if (hasNumeric && numericVal >= (interval.from ?? 0) && numericVal < (interval.to ?? 0)) return interval;
      }
      return null;
    }

    _isIntervalOverrideEnabled(interval, field) {
      const value = interval?.[field];
      if (value !== undefined && value !== null) return value !== false && value !== "false";
      const legacyValue = interval?.override_theme;
      if (legacyValue !== undefined && legacyValue !== null) return legacyValue !== false && legacyValue !== "false";
      return true;
    }

    _getColorForState(stateObj, entCfg, theme = null) {
      const result = {
        background: "",
        text_color: "",
        state_label: "",
        suffix_text: "",
        active_color: "",
        shadow_color: "",
      };
      const matchedInterval = this._findColorInterval(stateObj, entCfg);
      const applyMatchedInterval = ({ buttonColors = true, textColor = true, textContent = true } = {}) => {
        const cf = matchedInterval.color_from || "#1E88E5";
        const ct = matchedInterval.color_to || cf;
        if (buttonColors) {
          result.background = cf === ct ? cf : `linear-gradient(135deg, ${cf}, ${ct})`;
          result.active_color = cf;
          result.shadow_color = matchedInterval.shadow_color || "";
        }
        if (textColor) result.text_color = matchedInterval.text_color || "#FFFFFF";
        if (textContent) {
          result.state_label = matchedInterval.match_state ? (matchedInterval.state_text || "") : "";
          result.suffix_text = matchedInterval.suffix_text || "";
        }
        return result;
      };
      if (theme) {
        const cf = theme.color_from || "#1E88E5";
        const ct = theme.color_to || cf;
        result.background = cf === ct ? cf : `linear-gradient(135deg, ${cf}, ${ct})`;
        result.text_color = theme.text_color || "#FFFFFF";
        result.active_color = cf;
        if (matchedInterval) {
          return applyMatchedInterval({
            buttonColors: this._isIntervalOverrideEnabled(matchedInterval, "override_theme_colors"),
            textColor: this._isIntervalOverrideEnabled(matchedInterval, "override_theme_text_color"),
            textContent: true,
          });
        }
        return result;
      }

      if (entCfg && entCfg.color_mode === "custom") {
        const cf = entCfg.color_from || "#1E88E5";
        const ct = entCfg.color_to || cf;
        result.background =
          cf === ct ? cf : `linear-gradient(135deg, ${cf}, ${ct})`;
        result.text_color = "#FFFFFF";
        result.active_color = cf;
        result.shadow_color = matchedInterval?.shadow_color || "";
        return result;
      }

      if (!matchedInterval) return result;
      return applyMatchedInterval();
    }

    _css() {
      return `
        :host {
          display: block;
        }
        :where(ha-card.quickboard-card) {
          overflow: visible;
          position: relative;
          background: var(
            --andy-quickboard-card-background,
            var(--ha-card-background, var(--card-background-color, #fff))
          );
        }
        :where(ha-card.quickboard-card.flat-rail-card) {
          width: max-content;
          min-width: 60px;
          margin-inline: auto;
          border-radius: 24px;
          background: var(
            --andy-quickboard-card-background,
            color-mix(
              in srgb,
              var(--primary-color, #03a9f4) 7%,
              var(--ha-card-background, var(--card-background-color, #1c1c1c))
            )
          );
          box-shadow: 0 6px 18px rgba(0,0,0,.22);
        }
        .wrapper {
          padding: 16px;
          box-sizing: border-box;
        }
        .wrapper.flat-rail-view {
          padding: 6px;
        }
        .card-title {
          font-weight: 600;
          font-size: 1.1rem;
          margin: 0;
          flex: 1 1 auto;
        }
        .menu-view-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }
        .menu-view-actions {
          display: flex;
          gap: 6px;
          flex: 0 0 auto;
        }
        .menu-control {
          appearance: none;
          border: 1px solid var(--divider-color, rgba(127,127,127,.3));
          border-radius: 10px;
          background: color-mix(in srgb, var(--primary-color, #03a9f4) 12%, var(--card-background-color, #fff));
          color: var(--primary-text-color);
          min-height: 36px;
          padding: 6px 10px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          font: inherit;
          font-size: .82rem;
        }
        .menu-control ha-icon {
          width: 18px;
          height: 18px;
        }
        .menu-popup-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 14px;
          box-sizing: border-box;
          background: rgba(0,0,0,.48);
          backdrop-filter: blur(2px);
        }
        .menu-popup {
          width: min(calc(100vw - 28px), 720px);
          max-height: calc(100vh - 28px);
          overflow: auto;
          box-sizing: border-box;
          padding: 16px;
          border-radius: 18px;
          border: 1px solid var(--divider-color, rgba(127,127,127,.3));
          background: var(--ha-card-background, var(--card-background-color, #fff));
          color: var(--primary-text-color);
          box-shadow: 0 16px 50px rgba(0,0,0,.45);
        }
        .row-wrapper {
          margin-bottom: 12px;
        }
        .flat-rail-menu .row-wrapper {
          margin-bottom: 4px;
        }
        .flat-rail-menu .row-wrapper:last-child {
          margin-bottom: 0;
        }
        .flat-rail-menu .row-label {
          display: none;
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
        .tiles-row > .tile-slot {
          flex: 1 1 0;
          min-width: 0;
          display: flex;
        }
        .flat-rail-menu .tiles-row {
          gap: 4px;
        }
        .flat-rail-menu .tiles-row > .tile-slot.flat-rail-slot {
          flex: 0 0 var(--flat-rail-size, 48px);
          width: var(--flat-rail-size, 48px);
          min-width: var(--flat-rail-size, 48px);
          justify-content: center;
        }
        .tile-slot > .tile {
          flex: 1 1 auto;
          min-width: 0;
          width: 100%;
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
          transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.1s ease;
        }
        .tile.button-style-flat {
          min-height: 48px;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          column-gap: 12px;
          row-gap: 5px;
          border: 0 !important;
          border-radius: 10px !important;
          background: transparent !important;
          color: var(--primary-text-color) !important;
          box-shadow: none !important;
          transition: background-color .14s ease, color .14s ease, filter .1s ease;
        }
        .tile.button-style-flat::before {
          content: "";
          position: absolute;
          left: 0;
          top: 10px;
          bottom: 10px;
          width: 3px;
          border-radius: 999px;
          background: var(--flat-accent-color, var(--primary-color, #03a9f4));
          opacity: 0;
          transform: scaleY(.4);
          transition: opacity .14s ease, transform .14s ease;
        }
        .tile.button-style-flat.is-selected {
          background: var(--flat-selected-background) !important;
          color: var(--flat-selected-text) !important;
        }
        .tile.button-style-flat.is-selected::before {
          opacity: 1;
          transform: scaleY(1);
        }
        .tile.button-style-flat .tile-top-row {
          flex: 1 1 auto;
          min-width: 0;
        }
        .tile.button-style-flat .tile-value {
          margin: 0 0 0 auto;
          font-size: .95rem;
          line-height: 1.2;
        }
        .tile.button-style-flat .badges-row {
          flex-basis: 100%;
          margin-top: 2px;
          padding-left: 30px;
        }
        .tile.hide-label .tile-top-row,
        .tile.hide-label .tile-icon-name-row {
          width: 100%;
          justify-content: center;
        }
        .tile.hide-label .tile-value {
          width: 100%;
          text-align: center;
        }
        .tile.button-style-flat.hide-label .tile-value {
          margin: 0 auto;
        }
        .tile.button-style-flat.hide-label .badges-row {
          width: 100%;
          padding-left: 0;
          justify-content: center;
        }
        .tile.icon-only {
          min-height: 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .tile.icon-only .tile-top-row,
        .tile.icon-only .tile-icon-name-row {
          width: 100%;
          justify-content: center;
        }
        .tile.icon-only .tile-icon {
          margin: 0;
        }
        .tile.button-style-flat.icon-only {
          flex-wrap: nowrap;
          column-gap: 0;
          row-gap: 0;
        }
        .tile.icon-only.has-button-type-mark .tile-top-row {
          padding-right: 0;
        }
        .tile.button-style-flat.flat-layout-rail {
          flex: 0 0 var(--flat-rail-size, 48px) !important;
          width: var(--flat-rail-size, 48px) !important;
          min-width: var(--flat-rail-size, 48px) !important;
          min-height: var(--flat-rail-size, 48px);
          padding: 0 !important;
          justify-content: center;
          border-radius: 14px !important;
        }
        .tile.button-style-flat.flat-layout-rail::before {
          display: none;
        }
        .tile.button-style-flat.flat-layout-rail.is-selected {
          background: var(--flat-rail-selected-background) !important;
        }
        .tile.button-style-flat.flat-layout-rail .tile-top-row,
        .tile.button-style-flat.flat-layout-rail .tile-icon-name-row {
          width: 100%;
          flex: 1 1 100%;
          justify-content: center;
        }
        .tile.button-style-flat.flat-layout-rail .tile-name,
        .tile.button-style-flat.flat-layout-rail .tile-value,
        .tile.button-style-flat.flat-layout-rail .badges-row {
          display: none;
        }
        .tile.button-style-flat.flat-layout-rail .tile-icon {
          margin: 0;
        }
        .button-type-mark {
          position: absolute;
          top: 7px;
          right: 7px;
          width: 12px;
          height: 12px;
          display: grid;
          place-items: center;
          background: transparent;
          border: 0;
          color: inherit;
          opacity: .28;
          filter: saturate(.7);
          overflow: hidden;
          contain: paint;
          pointer-events: none;
        }
        .button-type-mark ha-icon {
          display: block;
          width: 9px;
          height: 9px;
          --mdc-icon-size: 9px;
          line-height: 9px;
        }
        .tile.has-button-type-mark .tile-top-row { padding-right: 8px; }
        .tile-slot:hover > .tile:not(.button-style-flat),
        .tile.hover-continuity:not(.button-style-flat) {
          filter: brightness(1.15);
        }
        .tile-slot:hover > .tile.button-style-flat {
          background: color-mix(in srgb, var(--flat-accent-color, var(--primary-color, #03a9f4)) 10%, transparent) !important;
        }
        .tile-slot:hover > .tile.button-style-flat.is-selected {
          background: var(--flat-selected-background) !important;
          filter: brightness(1.08);
        }
        .tile-slot:hover > .tile.button-style-flat.flat-layout-rail {
          background: color-mix(
            in srgb,
            var(--flat-accent-color, var(--primary-color, #03a9f4)) 11%,
            transparent
          ) !important;
        }
        .tile-slot:hover > .tile.button-style-flat.flat-layout-rail.is-selected {
          background: var(--flat-rail-selected-background) !important;
        }
        .tile-slot > .tile:active {
          filter: brightness(0.85);
        }
        .tile.hover-continuity {
          transition: none;
        }
        ${this._config && this._config.hover_motion !== false ? `
        .tile-slot:hover > .tile:not(.button-style-flat),
        .tile.hover-continuity:not(.button-style-flat) {
          transform: translateY(-2px);
          box-shadow: 0 6px 14px rgba(0,0,0,0.35);
        }` : ``}
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
          color: inherit !important;
          --icon-primary-color: currentColor;
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
      description: "Quickboard with reusable buttons, badges, color intervals and nested menus",
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
        _pendingDelete: {},
      };
    }

    constructor() {
      super();
      this._config = {};
      this._pendingDelete = null;
    }

    setConfig(config) {
      const cloned = this._cloneConfig(config || {});
      const generatedCardId = !String(cloned.card_id || "").trim();
      const migratedDefaultMenu =
        !Object.prototype.hasOwnProperty.call(cloned, "default_menu_id") &&
        !(cloned.rows || []).length &&
        (cloned.menus || []).length > 0;
      this._config = {
        color_intervals: [],
        box_style: {},
        rows: [],
        menus: [],
        button_themes: [],
        default_theme_id: "",
        main_menu_theme_id: "",
        default_menu_id: "",
        show_button_type_indicator: false,
        badge_style: "pill",
        button_style: "raised",
        flat_layout: "rail",
        dimmer_slider_color: "#FFFFFF",
        ...cloned,
        card_id: String(cloned.card_id || "").trim() || createQuickboardCardId(),
        default_menu_id: migratedDefaultMenu
          ? cloned.menus[0].id
          : (cloned.default_menu_id || ""),
      };
      if (generatedCardId || migratedDefaultMenu) {
        const migratedConfig = this._config;
        Promise.resolve().then(() => {
          if (this._config === migratedConfig) this._emitConfigChanged();
        });
      }
    }

    _cloneConfig(config) {
      if (!config || typeof config !== "object") return {};
      if (typeof structuredClone === "function") {
        try {
          return structuredClone(config);
        } catch (_) {}
      }
      try {
        return JSON.parse(JSON.stringify(config));
      } catch (_) {
        return { ...config };
      }
    }

    _rowsForScope(menuId = "") {
      if (!menuId) {
        if (!Array.isArray(this._config.rows)) this._config.rows = [];
        return this._config.rows;
      }
      const menu = (this._config.menus || []).find((item) => item.id === menuId);
      if (!menu) return [];
      if (!Array.isArray(menu.rows)) menu.rows = [];
      return menu.rows;
    }

    _scopeKey(menuId = "") {
      if (!menuId) return "root";
      const index = (this._config.menus || []).findIndex((item) => item.id === menuId);
      return `menu${Math.max(index, 0)}`;
    }

    _entityAt(menuId, rowIdx, entIdx) {
      return this._rowsForScope(menuId)?.[rowIdx]?.entities?.[entIdx];
    }

    _newEntity() {
      return {
        button_type: "entity",
        entity: "", icon: "", icon_mode: "single", icon_states: [],
        name: "", icon_size: 20, value_font_size: 1.0, label_font_size: 1.0,
        show_label: true, show_state: true,
        button_style: "inherit",
        menu_state_mode: "none",
        navigation_path: "", active_path_match: "exact", navigation_default: false,
        color_mode: "interval", color_from: "", color_to: "", badges: [],
      };
    }

    _duplicateButton(rowIdx, entIdx, menuId = "") {
      const entities = this._rowsForScope(menuId)?.[rowIdx]?.entities;
      const source = entities?.[entIdx];
      if (!Array.isArray(entities) || !source) return;
      entities.splice(entIdx + 1, 0, this._cloneConfig(source));
      this._emitConfigChanged();
    }

    _duplicateBadge(badges, bIdx) {
      const source = badges?.[bIdx];
      if (!Array.isArray(badges) || !source) return;
      badges.splice(bIdx + 1, 0, this._cloneConfig(source));
      this._emitConfigChanged();
    }

    _newRow() {
      return { label: "", label_position: "none", theme_id: "", entities: [] };
    }

    _makeMenuId() {
      const used = new Set((this._config.menus || []).map((menu) => menu.id));
      let number = used.size + 1;
      let id = `menu_${number}`;
      while (used.has(id)) id = `menu_${++number}`;
      return id;
    }

    _makeThemeId() {
      const used = new Set((this._config.button_themes || []).map((theme) => theme.id));
      let number = used.size + 1;
      let id = `theme_${number}`;
      while (used.has(id)) id = `theme_${++number}`;
      return id;
    }

    _newTheme() {
      const id = this._makeThemeId();
      return {
        id,
        name: `Theme ${(this._config.button_themes || []).length + 1}`,
        color_from: "#1565C0",
        color_to: "#1E88E5",
        text_color: "#FFFFFF",
        border_color: "#FFFFFF",
        border_width: 0,
        border_radius: 18,
        box_shadow: "0 4px 12px rgba(0,0,0,0.25)",
        shadow_strength: 60,
        shadow_color_mode: "active",
        shadow_color: "#FF9800",
        badge_style: "inherit",
        button_style: "inherit",
      };
    }

    _themeOptions(mode = "global") {
      const themes = (this._config.button_themes || []).map((theme) => [theme.id, theme.name || theme.id]);
      if (mode === "global") return [["", "None (use button colors)"], ...themes];
      return [
        ["", "Inherit from parent/global"],
        ["__none__", "No theme (use button colors)"],
        ...themes,
      ];
    }

    _renameTheme(themeIdx, requestedId) {
      const themes = this._config.button_themes || [];
      const theme = themes[themeIdx];
      if (!theme) return;
      const oldId = theme.id;
      const cleaned = String(requestedId || "").trim().toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
      if (!cleaned || themes.some((item, idx) => idx !== themeIdx && item.id === cleaned)) {
        this.requestUpdate();
        return;
      }
      theme.id = cleaned;
      if (this._config.default_theme_id === oldId) this._config.default_theme_id = cleaned;
      if (this._config.main_menu_theme_id === oldId) this._config.main_menu_theme_id = cleaned;
      (this._config.menus || []).forEach((menu) => {
        if (menu.theme_id === oldId) menu.theme_id = cleaned;
      });
      this._walkRows((row) => {
        if (row.theme_id === oldId) row.theme_id = cleaned;
      });
      this._walkEntities((entity) => {
        if (entity.theme_id === oldId) entity.theme_id = cleaned;
      });
      this.requestUpdate();
      this._emitConfigChanged();
    }

    _themeUsage(themeId) {
      const usages = [];
      if (this._config.default_theme_id === themeId) usages.push("Global default");
      if (this._config.main_menu_theme_id === themeId) usages.push("Main menu");
      (this._config.menus || []).forEach((menu) => {
        if (menu.theme_id === themeId) usages.push(`Menu: ${menu.title || menu.id}`);
      });
      const scanRows = (rows, location) => (rows || []).forEach((row, rowIdx) =>
        {
          if (row.theme_id === themeId) usages.push(`${location}, row ${rowIdx + 1}`);
          (row.entities || []).forEach((entity, entIdx) => {
          if (entity.theme_id === themeId) usages.push(`${location}, row ${rowIdx + 1}, ${entity.name || `button ${entIdx + 1}`}`);
          });
        }
      );
      scanRows(this._config.rows, "Main menu");
      (this._config.menus || []).forEach((menu) => scanRows(menu.rows, menu.title || menu.id));
      return usages;
    }

    _clearThemeReferences(themeId) {
      if (this._config.default_theme_id === themeId) this._config.default_theme_id = "";
      if (this._config.main_menu_theme_id === themeId) this._config.main_menu_theme_id = "";
      (this._config.menus || []).forEach((menu) => {
        if (menu.theme_id === themeId) menu.theme_id = "";
      });
      this._walkRows((row) => {
        if (row.theme_id === themeId) row.theme_id = "";
      });
      this._walkEntities((entity) => {
        if (entity.theme_id === themeId) entity.theme_id = "";
      });
    }

    _emitConfigChanged() {
      const snapshot = this._cloneConfig(this._config);
      this.requestUpdate();
      fireEvent(this, "config-changed", { config: snapshot });
    }

    async _copyQuickboardCardId() {
      const cardId = String(this._config?.card_id || "").trim();
      if (!cardId) return;
      try {
        if (typeof globalThis.navigator?.clipboard?.writeText !== "function") throw new Error("Clipboard unavailable");
        await globalThis.navigator.clipboard.writeText(cardId);
        fireEvent(this, "hass-notification", { message: "Quickboard card ID copied" });
      } catch (_) {
        if (typeof window.prompt === "function") window.prompt("Copy Quickboard card ID", cardId);
      }
    }

    _ensureBoxStyle() {
      if (!this._config.box_style) this._config.box_style = {};
    }

    _stopPropagation(ev) {
      ev.stopPropagation();
    }

    _requestDelete(item, details, action) {
      this._pendingDelete = {
        item,
        details: details || "",
        action,
      };
      this.requestUpdate();
    }

    _cancelDelete(ev) {
      ev?.stopPropagation?.();
      this._pendingDelete = null;
      this.requestUpdate();
    }

    _confirmPendingDelete(ev) {
      ev?.stopPropagation?.();
      const pending = this._pendingDelete;
      this._pendingDelete = null;
      if (typeof pending?.action === "function") pending.action();
      this.requestUpdate();
    }

    _renderDeleteConfirmation() {
      if (!this._pendingDelete) return "";
      return html`
        <div class="editor-confirm-backdrop" role="presentation" @click=${(e) => this._cancelDelete(e)}>
          <div class="editor-confirm-dialog" role="alertdialog" aria-modal="true"
            aria-labelledby="quickboard-confirm-title" @click=${this._stopPropagation}>
            <ha-icon icon="mdi:alert-outline"></ha-icon>
            <div class="editor-confirm-copy">
              <div id="quickboard-confirm-title">Delete ${this._pendingDelete.item}?</div>
              ${this._pendingDelete.details
                ? html`<p>${this._pendingDelete.details}</p>`
                : ""}
              <small>This cannot be undone.</small>
            </div>
            <div class="editor-confirm-actions">
              <ha-button @click=${(e) => this._cancelDelete(e)}>Cancel</ha-button>
              <ha-button class="danger" @click=${(e) => this._confirmPendingDelete(e)}>Delete</ha-button>
            </div>
          </div>
        </div>
      `;
    }

    _selectOptions(options) {
      return (options || []).map((opt) => {
        if (Array.isArray(opt)) {
          return {
            value: String(opt[0] ?? ""),
            label: String(opt[1] ?? opt[0] ?? ""),
          };
        }
        return {
          value: String(opt?.value ?? ""),
          label: String(opt?.label ?? opt?.value ?? ""),
        };
      });
    }

    _selectValue(ev, fallback = "") {
      return ev?.detail?.value ?? ev?.target?.value ?? fallback;
    }

    _renderSelect(label, value, options, onChange) {
      return html`
        <ha-selector
          .hass=${this.hass}
          .label=${label}
          .selector=${{ select: { mode: "dropdown", options: this._selectOptions(options) } }}
          .value=${value ?? ""}
          @value-changed=${(e) => {
            this._stopPropagation(e);
            onChange(this._selectValue(e, value ?? ""));
          }}
          @click=${this._stopPropagation}
        ></ha-selector>
      `;
    }

    _mkEntityControl(label, value, onChange) {
      const stop = (e) => e.stopPropagation();

      // IMPORTANT:
      // Do NOT create/use ha-entity-picker as fallback. In newer HA versions with
      // Scoped Custom Element Registry, mixing pickers across multiple loaded
      // custom cards can trigger "define ... ha-entity-picker already used".
      //
      // Instead, always use ha-selector. If it's not defined yet, the element
      // will upgrade once HA finishes lazy-loading it.
      const sel = document.createElement("ha-selector");
      sel.label = label;
      sel.selector = { entity: {} };
      sel.value = value;
      sel.hass = this.hass;

      sel.addEventListener("value-changed", (e) => {
        const v = e.detail?.value ?? e.target?.value;
        onChange(v);
      });
      sel.addEventListener("click", stop);

      // Ensure props are re-applied after upgrade (when HA defines ha-selector)
      if (!customElements.get("ha-selector") && customElements.whenDefined) {
        customElements.whenDefined("ha-selector").then(() => {
          try {
            sel.label = label;
            sel.selector = { entity: {} };
            sel.value = value;
            sel.hass = this.hass;
          } catch (_) {}
        });
      }

      return sel;
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
          shadow_color: "",
          override_theme_colors: true,
          override_theme_text_color: true,
          match_state: "",
          state_text: "",
          suffix_text: "",
        };
      }
      this._config.color_intervals[idx][field] = value;
      this.requestUpdate();
      this._emitConfigChanged();
    }

    _updateEntityColorField(rowIdx, entIdx, field, value, menuId = "") {
      const rows = this._rowsForScope(menuId);
      if (!rows[rowIdx]) rows[rowIdx] = this._newRow();
      if (!rows[rowIdx].entities) rows[rowIdx].entities = [];
      if (!rows[rowIdx].entities[entIdx]) rows[rowIdx].entities[entIdx] = this._newEntity();
      rows[rowIdx].entities[entIdx][field] = value;
      this.requestUpdate();
      this._emitConfigChanged();
    }

    _updateEntityIntervalField(rowIdx, entIdx, iIdx, field, value, menuId = "") {
      const ent = this._entityAt(menuId, rowIdx, entIdx);
      if (!ent) return;
      if (!ent.color_intervals) ent.color_intervals = [];
      if (!ent.color_intervals[iIdx]) {
        ent.color_intervals[iIdx] = {
          from: 0, to: 10,
          color_from: "#000000", color_to: "#000000",
          text_color: "#FFFFFF",
          shadow_color: "",
          override_theme_colors: true,
          override_theme_text_color: true,
          match_state: "", state_text: "", suffix_text: "",
        };
      }
      ent.color_intervals[iIdx][field] = value;
      this.requestUpdate();
      this._emitConfigChanged();
    }

    _shadowPresetFromCss(cssVal) {
      if (!cssVal || cssVal === "none") return "none";
      const v = cssVal.replace(/\s+/g, " ").toLowerCase();
      if (v.includes("0 2px 6px")) return "soft";
      if (v.includes("0 4px 12px")) return "medium";
      if (v.includes("0 8px 20px")) return "strong";
      if (v.includes("0 0 18px")) return "glow";
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
        case "glow":
          return "0 0 18px rgba(0,0,0,0.45)";
        case "medium":
        default:
          return "0 4px 12px rgba(0,0,0,0.25)";
      }
    }

    _resolveShadowStrength(...values) {
      for (const value of values) {
        if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) continue;
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return Math.min(100, Math.max(0, parsed));
      }
      return 60;
    }

    _previewShadowCss(shadow, mode, customColor, activeColor, strength) {
      if (!shadow || shadow === "none") return "none";
      let resolvedMode = mode || "inherit";
      let resolvedCustom = customColor || "";
      if (resolvedMode === "inherit") {
        resolvedMode = this._config.box_style?.shadow_color_mode || "ha";
        resolvedCustom = this._config.box_style?.shadow_color || "";
      }
      const resolvedStrength = this._resolveShadowStrength(
        strength,
        this._config.box_style?.shadow_strength,
        60
      );
      let color = resolvedMode === "default" ? "#000000" : "var(--primary-color, #03a9f4)";
      if (resolvedMode === "custom") color = resolvedCustom || color;
      if (resolvedMode === "active") color = activeColor || color;
      const match = String(shadow).match(/^\s*((?:-?[\d.]+px|0)\s+(?:-?[\d.]+px|0)\s+(?:[\d.]+px|0)(?:\s+(?:[\d.]+px|0))?)/i);
      return `${match?.[1] || "0 4px 12px"} color-mix(in srgb, ${color} ${resolvedStrength}%, transparent)`;
    }

    updated() {
      const root = this.renderRoot;
      const scopes = [
        { menuId: "", rows: this._config.rows || [] },
        ...(this._config.menus || []).map((menu) => ({ menuId: menu.id, rows: menu.rows || [] })),
      ];

      scopes.forEach(({ menuId, rows }) => rows.forEach((row, rowIdx) => {
        const scopeKey = this._scopeKey(menuId);
        (row.entities || []).forEach((ent, entIdx) => {
          const entContainer = root.querySelector(
            `#entity-picker-${scopeKey}-${rowIdx}-${entIdx}`
          );
          if (entContainer && !entContainer._controlAttached) {
            entContainer.innerHTML = "";
            const label = ent.button_type === "menu" ? "Status entity (optional)" : "Entity";
            const ctrl = this._mkEntityControl(label, ent.entity || "", (val) => {
              const target = this._entityAt(menuId, rowIdx, entIdx);
              if (!target) return;
              target.entity = val;
              this._emitConfigChanged();
            });
            entContainer.appendChild(ctrl);
            entContainer._controlAttached = true;
          }

          (ent.badges || []).forEach((b, bIdx) => {
            const badgeContainer = root.querySelector(
              `#badge-entity-picker-${scopeKey}-${rowIdx}-${entIdx}-${bIdx}`
            );
            if (badgeContainer && !badgeContainer._controlAttached) {
              badgeContainer.innerHTML = "";
              const ctrl = this._mkEntityControl(
                "Badge entity",
                b.entity || "",
                (val) => {
                  const target = this._entityAt(menuId, rowIdx, entIdx);
                  if (!target?.badges?.[bIdx]) return;
                  target.badges[bIdx].entity = val;
                  this.requestUpdate();
                  this._emitConfigChanged();
                }
              );
              badgeContainer.appendChild(ctrl);
              badgeContainer._controlAttached = true;
            }
          });
        });
      }));
    }

    render() {
      if (!this._config) return html``;

      const intervals = this._config.color_intervals || [];
      const boxStyle = this._config.box_style || {};
      const rows = this._config.rows || [];

      return html`
        <style>${this._css()}</style>
        <div class="editor-wrap">
        <div class="editor-top-title">
          <div>Andy Quickboard Card v1.2.2</div>
          <a class="editor-doc-link"
             href="https://github.com/maglerod/andy-quickboard-card/blob/main/README.md"
             target="_blank" rel="noopener noreferrer">
            <ha-icon icon="mdi:book-open-page-variant-outline"></ha-icon>
            Documentation, examples and setup guide
          </a>
        </div>
        ${this._renderDeleteConfirmation()}

        <details class="section editor-section" open>
          <summary class="section-summary">${this._renderSectionTitle("mdi:tune-variant", "Basic")}</summary>
          <div class="section-body">
          <ha-selector
            .hass=${this.hass}
            .label=${"Title"}
            .value=${this._config.title || ""}
            .selector=${{text: {}}}
            @value-changed=${(e) => {
              this._config = { ...this._config, title: e.detail.value };
              this._emitConfigChanged();
            }}
          ></ha-selector>
          ${this._renderFieldHelp(
            "Number formatting",
            "Sets the default number of decimal places shown on entity values. A button or badge can override this value."
          )}
          <ha-selector
            .hass=${this.hass}
            .label=${"Decimal places (global default)"}
            .value=${this._config.decimal_places ?? 1}
            .selector=${{number: {min: 0, max: 6, step: 1, mode: "box"}}}
            @value-changed=${(e) => {
              this._config = { ...this._config, decimal_places: Number(e.detail.value) };
              this._emitConfigChanged();
            }}
          ></ha-selector>
          <div class="conditional-settings-title">
            <ha-icon icon="mdi:identifier"></ha-icon>
            <div>
              <b>Quickboard card ID</b>
              <span>
                Automatically generated and saved for this card. A Menu button in another Quickboard uses this ID
                together with a Menu ID to open the correct menu here.
              </span>
            </div>
          </div>
          <div class="quickboard-id-box">
            <code>${this._config.card_id}</code>
            <ha-button @click=${() => this._copyQuickboardCardId()}>Copy card ID</ha-button>
          </div>
          <div class="conditional-settings-title">
            <ha-icon icon="mdi:home-import-outline"></ha-icon>
            <div>
              <b>Initial content</b>
              <span>
                Select the menu shown before any Navbar button is pressed. Choose a menu to use Quickboard as a menu-only
                content card; Main menu rows &amp; buttons may then remain empty.
              </span>
            </div>
          </div>
          ${this._renderSelect(
            "Default displayed menu",
            this._config.default_menu_id || "",
            this._defaultMenuOptions(),
            (value) => {
              this._config.default_menu_id = value || "";
              this.requestUpdate();
              this._emitConfigChanged();
            }
          )}
          <div class="toggle-row">
            <span class="picker-label">Show icons (global default)</span>
            <ha-switch .checked=${this._config.show_icon !== false}
              @change=${(e) => {
                this._config = { ...this._config, show_icon: e.target.checked };
                this._emitConfigChanged();
              }}
            ></ha-switch>
          </div>
          </div>
        </details>

        <details class="section editor-section">
          <summary class="section-summary">${this._renderSectionTitle("mdi:palette-outline", "Appearance", `${(this._config.button_themes || []).length} theme${(this._config.button_themes || []).length === 1 ? "" : "s"}`)}</summary>
          <div class="section-body">
          ${this._renderFieldHelp(
            "Button style and Flat layout",
            "Raised gives every button the classic card appearance. Flat is only a visual style and works with Entity, Menu and Navigation buttons. Compact icon rail creates the narrow vertical design; Full-width keeps icon and text visible on ordinary cards."
          )}
          ${this._renderSelect("Default button style", this._config.button_style || "raised",
            [["raised","Raised (classic Quickboard)"],["flat","Flat"]],
            (value) => {
              this._config.button_style = value || "raised";
              this._emitConfigChanged();
            }
          )}
          ${this._renderSelect("Flat button layout", this._config.flat_layout || "rail",
            [["rail","Compact icon rail"],["label","Full-width icon and label"]],
            (value) => {
              this._config.flat_layout = value || "rail";
              this._emitConfigChanged();
            }
          )}
          <div class="three-col">
            <ha-selector
              .hass=${this.hass}
              .label=${"Border radius (px)"}
              .value=${boxStyle.border_radius ?? 18}
              .selector=${{number: {min: 0, step: 1, mode: "box"}}}
              @value-changed=${(e) => {
                this._ensureBoxStyle();
                this._config.box_style.border_radius = Number(e.detail.value);
                this._emitConfigChanged();
              }}
            ></ha-selector>
            <ha-selector
              .hass=${this.hass}
              .label=${"Vertical padding (px)"}
              .value=${boxStyle.padding_vertical ?? 12}
              .selector=${{number: {min: 0, step: 1, mode: "box"}}}
              @value-changed=${(e) => {
                this._ensureBoxStyle();
                this._config.box_style.padding_vertical = Number(e.detail.value);
                this._emitConfigChanged();
              }}
            ></ha-selector>
            <ha-selector
              .hass=${this.hass}
              .label=${"Horizontal padding (px)"}
              .value=${boxStyle.padding_horizontal ?? 16}
              .selector=${{number: {min: 0, step: 1, mode: "box"}}}
              @value-changed=${(e) => {
                this._ensureBoxStyle();
                this._config.box_style.padding_horizontal = Number(e.detail.value);
                this._emitConfigChanged();
              }}
            ></ha-selector>
          </div>
          ${this._renderFieldHelp(
            "Default button shadow",
            "Sets the shadow used when a theme or individual button does not override it. Strength controls opacity. The color source can follow Home Assistant, the active theme or matched color interval, a custom color, or classic black."
          )}
          <div class="three-col">
            ${this._renderSelect("Default button shadow", this._shadowPresetFromCss(boxStyle.box_shadow),
              [["none","None"],["soft","Soft"],["medium","Medium"],["strong","Strong"],["glow","Glow"]],
              (preset) => {
                this._ensureBoxStyle();
                this._config.box_style.box_shadow = this._shadowCssFromPreset(preset || "medium");
                this._emitConfigChanged();
              }
            )}
            <ha-selector
              .hass=${this.hass}
              .label=${"Shadow strength (%)"}
              .value=${boxStyle.shadow_strength ?? 60}
              .selector=${{number: {min: 0, max: 100, step: 5, mode: "box"}}}
              @value-changed=${(e) => {
                this._ensureBoxStyle();
                this._config.box_style.shadow_strength = Number(e.detail.value);
                this._emitConfigChanged();
              }}
            ></ha-selector>
            ${this._renderSelect("Shadow color source", boxStyle.shadow_color_mode || "ha",
              [["ha","Home Assistant theme color"],["active","Active theme / color interval"],["custom","Custom color"],["default","Classic black"]],
              (value) => {
                this._ensureBoxStyle();
                this._config.box_style.shadow_color_mode = value || "ha";
                this.requestUpdate();
                this._emitConfigChanged();
              }
            )}
          </div>
          ${(boxStyle.shadow_color_mode || "ha") === "custom" ? html`
            ${this._renderShadowColorControl(boxStyle, "shadow_color", "Shadow color", "#FF9800")}
          ` : ""}
          ${this._renderFieldHelp(
            "Default badge style",
            "Sets the appearance of badges unless a reusable theme or individual button selects another style. None keeps badge content but removes its decorative container."
          )}
          ${this._renderSelect("Badge style", this._config.badge_style || "pill",
            [["pill","Pill"],["pill-strong","Pill strong"],["chip","Chip"],["underline","Underline"],["none","None"]],
            (v) => { this._config.badge_style = v || "pill"; this._emitConfigChanged(); }
          )}
          <div class="toggle-row">
            <span class="picker-label">Hover lift effect</span>
            <ha-switch .checked=${this._config.hover_motion !== false}
              @change=${(e) => {
                this._config = { ...this._config, hover_motion: e.target.checked };
                this._emitConfigChanged();
              }}
            ></ha-switch>
          </div>
          ${this._renderFieldHelp(
            "Button-type symbol",
            "The visual editor always shows a small symbol so Entity, Menu and Navigation buttons are easy to distinguish. Enable this only if the symbol should also appear on the live dashboard card."
          )}
          <div class="toggle-row">
            <div class="picker-label">Show button-type symbol on the live card</div>
            <ha-switch .checked=${this._config.show_button_type_indicator === true}
              @change=${(e) => {
                this._config.show_button_type_indicator = e.target.checked;
                this._emitConfigChanged();
              }}
            ></ha-switch>
          </div>
          ${this._renderFieldHelp(
            "Dimmer badge slider",
            "Controls the slider accent color used by badges whose Badge type is Dimmer."
          )}
          <div class="color-row">
            <input type="color" class="color-swatch"
              .value=${this._config.dimmer_slider_color || "#FFFFFF"}
              @input=${(e) => this._updateGlobalColorField("dimmer_slider_color", e.target.value)}
              @click=${this._stopPropagation}
            />
            <ha-selector
              .hass=${this.hass}
              .label=${"Dimmer slider color"}
              .value=${this._config.dimmer_slider_color || ""}
              .selector=${{text: {}}}
              @value-changed=${(e) => this._updateGlobalColorField("dimmer_slider_color", e.detail.value)}
            ></ha-selector>
          </div>
          ${this._renderThemes()}
          </div>
        </details>

        <details class="section editor-section">
          <summary class="section-summary">${this._renderSectionTitle("mdi:gradient-horizontal", "Color intervals", `${intervals.length} interval${intervals.length === 1 ? "" : "s"}`)}</summary>
          <div class="section-body">
          <div class="section-note">
            Color intervals control each button’s background, text, optional shadow glow and state/suffix text.
            Numeric entities match the From/To range; non-numeric entities can match an exact state.
            Buttons with their own intervals override these global defaults. Automatic menu buttons use
            the number of active entities in their destination menu. When a button has an active reusable theme,
            the two theme-override switches independently control its button colors and text/icon color. Without an active theme, those switches have no effect.
          </div>
          ${intervals.map((interval, idx) => html`
            <ha-expansion-panel class="interval-editor-panel color-preview-panel"
              style=${this._editorPanelColorStyle(interval, "#1E88E5", "#FFFFFF")}>
              <div slot="header" class="color-preview-header">
                <span>${interval.match_state
                  ? `Interval ${idx + 1} — state: ${interval.match_state}`
                  : `Interval ${idx + 1} — ${interval.from ?? 0} to ${interval.to ?? 0}`}</span>
              </div>
              <div class="expansion-content">
                <div class="two-col">
                  <ha-selector
                    .hass=${this.hass} .label=${"From"}
                    .value=${interval.from ?? 0}
                    .selector=${{number: {step: 1, mode: "box"}}}
                    @value-changed=${(e) => this._updateIntervalField(idx, "from", Number(e.detail.value))}
                  ></ha-selector>
                  <ha-selector
                    .hass=${this.hass} .label=${"To"}
                    .value=${interval.to ?? 0}
                    .selector=${{number: {step: 1, mode: "box"}}}
                    @value-changed=${(e) => this._updateIntervalField(idx, "to", Number(e.detail.value))}
                  ></ha-selector>
                </div>
                ${this._renderIntervalThemeToggles(
                  interval,
                  (checked) => this._updateIntervalField(idx, "override_theme_colors", checked),
                  (checked) => this._updateIntervalField(idx, "override_theme_text_color", checked)
                )}
                <div class="four-col">
                  <div class="color-row">
                    <input type="color" class="color-swatch"
                      .value=${interval.color_from || "#000000"}
                      @input=${(e) => this._updateIntervalField(idx, "color_from", e.target.value)}
                      @click=${this._stopPropagation}
                    />
                    <ha-selector .hass=${this.hass} .label=${"Gradient from"}
                      .value=${interval.color_from || ""}
                      .selector=${{text: {}}}
                      @value-changed=${(e) => this._updateIntervalField(idx, "color_from", e.detail.value)}
                    ></ha-selector>
                  </div>
                  <div class="color-row">
                    <input type="color" class="color-swatch"
                      .value=${interval.color_to || "#000000"}
                      @input=${(e) => this._updateIntervalField(idx, "color_to", e.target.value)}
                      @click=${this._stopPropagation}
                    />
                    <ha-selector .hass=${this.hass} .label=${"Gradient to"}
                      .value=${interval.color_to || ""}
                      .selector=${{text: {}}}
                      @value-changed=${(e) => this._updateIntervalField(idx, "color_to", e.detail.value)}
                    ></ha-selector>
                  </div>
                  <div class="color-row">
                    <input type="color" class="color-swatch"
                      .value=${interval.text_color || "#FFFFFF"}
                      @input=${(e) => this._updateIntervalField(idx, "text_color", e.target.value)}
                      @click=${this._stopPropagation}
                    />
                    <ha-selector .hass=${this.hass} .label=${"Text color"}
                      .value=${interval.text_color || ""}
                      .selector=${{text: {}}}
                      @value-changed=${(e) => this._updateIntervalField(idx, "text_color", e.detail.value)}
                    ></ha-selector>
                  </div>
                  ${this._renderShadowColorControl(interval, "shadow_color", "Active shadow color", interval.color_from || "#FF9800")}
                </div>
                ${this._renderFieldHelp(
                  "Exact state matching",
                  "Use Match state for non-numeric states such as on, off, home or playing. When filled in, this interval matches that exact state instead of the numeric From/To range."
                )}
                <ha-selector .hass=${this.hass} .label=${"Match state (optional, e.g. on, off)"}
                  .value=${interval.match_state || ""}
                  .selector=${{text: {}}}
                  @value-changed=${(e) => this._updateIntervalField(idx, "match_state", e.detail.value)}
                ></ha-selector>
                ${this._renderFieldHelp(
                  "Displayed state text",
                  "State label replaces the value shown on the button. Suffix text is appended to the value and may use the variables listed here: <state>, <unit>, <dimmer_pct>, <source>, <title>, <artist>, <album>, <title_artist>."
                )}
                <div class="two-col">
                  <ha-selector .hass=${this.hass} .label=${"State label (optional)"}
                    .value=${interval.state_text || ""}
                    .selector=${{text: {}}}
                    @value-changed=${(e) => this._updateIntervalField(idx, "state_text", e.detail.value)}
                  ></ha-selector>
                  <ha-selector .hass=${this.hass} .label=${"Suffix text (supports variables)"}
                    .value=${interval.suffix_text || ""}
                    .selector=${{text: {}}}
                    @value-changed=${(e) => this._updateIntervalField(idx, "suffix_text", e.detail.value)}
                  ></ha-selector>
                </div>
                <div class="action-row">
                  <ha-button class="danger" @click=${() => {
                    this._requestDelete(`global color interval ${idx + 1}`, "", () => {
                      this._config.color_intervals.splice(idx, 1);
                      this._emitConfigChanged();
                    });
                  }}>Delete interval</ha-button>
                </div>
              </div>
            </ha-expansion-panel>
          `)}
          <div class="action-row">
            <ha-button @click=${() => {
              if (!this._config.color_intervals) this._config.color_intervals = [];
              this._config.color_intervals.push({
                from: 0, to: 10,
                color_from: "#1E88E5", color_to: "#1E88E5",
                text_color: "#FFFFFF",
                shadow_color: "",
                override_theme_colors: true,
                override_theme_text_color: true,
                match_state: "", state_text: "", suffix_text: "",
              });
              this.requestUpdate(); this._emitConfigChanged();
            }}>Add interval</ha-button>
          </div>
          </div>
        </details>

        <details class="section editor-section">
          <summary class="section-summary">${this._renderSectionTitle("mdi:view-grid-outline", "Main menu rows & buttons", `${rows.length} row${rows.length === 1 ? "" : "s"}`)}</summary>
          <div class="section-body">
          <div class="section-note">
            Each expandable item below is a live-style preview of the button you are configuring.
            This section may remain empty when a menu is selected under <b>Default displayed menu</b>.
          </div>
          ${rows.map((row, rowIdx) => this._renderRow(row, rowIdx, ""))}
          <div class="action-row">
            <ha-button @click=${() => {
              if (!this._config.rows) this._config.rows = [];
              this._config.rows.push(this._newRow());
              this.requestUpdate(); this._emitConfigChanged();
            }}>Add row</ha-button>
          </div>
          </div>
        </details>
        ${this._renderMenus()}
        <div class="support-card">
          <div class="support-title">☕ Support the project</div>
          <div class="support-text">
            I’m a Home Automation enthusiast who spends late nights building custom cards and tools for Home Assistant.
            If you enjoy my work or use any of my cards, your support helps me keep improving and maintaining everything.
          </div>
          <a class="support-link" href="https://www.buymeacoffee.com/AndyBonde" target="_blank"
             rel="noopener noreferrer" aria-label="Buy me a coffee">
            <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" width="140" alt="Buy me a coffee" />
          </a>
        </div>
        </div>
      `;
    }

    _renderSectionTitle(icon, label, meta = "") {
      return html`
        <span class="section-title">
          <ha-icon .icon=${icon}></ha-icon>
          <span class="section-title-label">${label}</span>
          ${meta ? html`<span class="section-count">${meta}</span>` : ""}
          <ha-icon class="section-chevron" icon="mdi:chevron-down"></ha-icon>
        </span>
      `;
    }

    _renderThemes() {
      const themes = this._config.button_themes || [];
      return html`
        <div class="theme-manager">
          <div class="subsection-title">Reusable button themes</div>
          <div class="helper-text">
            A theme can be inherited by every button, overridden for the main menu or a submenu, then per row and finally per button.
            Priority is button → row → menu → global. Select “No theme” at any override level to use Color intervals or Custom colors instead.
          </div>
          <div class="two-col">
            ${this._renderSelect("Global default theme", this._config.default_theme_id || "",
              this._themeOptions("global"),
              (value) => { this._config.default_theme_id = value || ""; this._emitConfigChanged(); }
            )}
            ${this._renderSelect("Main menu theme override", this._config.main_menu_theme_id || "",
              this._themeOptions("override"),
              (value) => { this._config.main_menu_theme_id = value || ""; this._emitConfigChanged(); }
            )}
          </div>
          <div class="theme-list">
            ${themes.map((theme, themeIdx) => this._renderThemeEditor(theme, themeIdx))}
          </div>
          <div class="action-row">
            <ha-button @click=${() => {
              if (!Array.isArray(this._config.button_themes)) this._config.button_themes = [];
              this._config.button_themes.push(this._newTheme());
              this.requestUpdate();
              this._emitConfigChanged();
            }}>Add theme</ha-button>
          </div>
        </div>
      `;
    }

    _renderThemeEditor(theme, themeIdx) {
      const themes = this._config.button_themes || [];
      const usage = this._themeUsage(theme.id);
      const themeStrengthInherited = theme.shadow_strength === null || theme.shadow_strength === undefined || String(theme.shadow_strength).trim() === "";
      const effectiveThemeStrength = this._resolveShadowStrength(
        theme.shadow_strength,
        this._config.box_style?.shadow_strength,
        60
      );
      return html`
        <ha-expansion-panel class="theme-editor-panel color-preview-panel"
          style=${this._editorPanelColorStyle(theme, "#1565C0", "#FFFFFF")}>
          <div slot="header" class="color-preview-header theme-preview-header">
            <ha-icon icon="mdi:palette"></ha-icon>
            <span>${theme.name || theme.id} — used by ${usage.length}</span>
          </div>
          <div class="expansion-content">
            ${this._renderFieldHelp(
              "Theme identity",
              "Theme name is the friendly label shown in the editor. Theme ID is the internal reference used by menus, rows and buttons; renaming it updates existing links automatically."
            )}
            <div class="three-col">
              <ha-selector .hass=${this.hass} .label=${"Theme name"}
                .value=${theme.name || ""} .selector=${{text: {}}}
                @value-changed=${(e) => { theme.name = e.detail.value; this._emitConfigChanged(); }}></ha-selector>
              <ha-selector .hass=${this.hass} .label=${"Theme ID"}
                .value=${theme.id || ""} .selector=${{text: {}}}
                @value-changed=${(e) => this._renameTheme(themeIdx, e.detail.value)}></ha-selector>
            </div>
            <div class="three-col">
              ${this._renderThemeColor(theme, "color_from", "Gradient from", "#1565C0")}
              ${this._renderThemeColor(theme, "color_to", "Gradient to", "#1E88E5")}
              ${this._renderThemeColor(theme, "text_color", "Text color", "#FFFFFF")}
            </div>
            <div class="three-col">
              <ha-selector .hass=${this.hass} .label=${"Border radius (px)"}
                .value=${theme.border_radius ?? 18}
                .selector=${{number: {min: 0, step: 1, mode: "box"}}}
                @value-changed=${(e) => { theme.border_radius = Number(e.detail.value); this._emitConfigChanged(); }}></ha-selector>
              <ha-selector .hass=${this.hass} .label=${"Border width (px)"}
                .value=${theme.border_width ?? 0}
                .selector=${{number: {min: 0, step: 1, mode: "box"}}}
                @value-changed=${(e) => { theme.border_width = Number(e.detail.value); this._emitConfigChanged(); }}></ha-selector>
              ${this._renderThemeColor(theme, "border_color", "Border color", "#FFFFFF")}
            </div>
            ${this._renderFieldHelp(
              "Theme behavior",
              "Button style, shadow and badge style become reusable defaults wherever this theme is assigned. Inherit uses the corresponding global Appearance setting; Theme / active interval color lets a matched interval supply the shadow color."
            )}
            <div class="four-col">
              ${this._renderSelect("Button style", theme.button_style || "inherit",
                [["inherit","Inherit global"],["raised","Raised"],["flat","Flat"]],
                (value) => { theme.button_style = value || "inherit"; this._emitConfigChanged(); }
              )}
              ${this._renderSelect("Box shadow", this._shadowPresetFromCss(theme.box_shadow),
                [["none","None"],["soft","Soft"],["medium","Medium"],["strong","Strong"],["glow","Glow"]],
                (value) => { theme.box_shadow = this._shadowCssFromPreset(value || "medium"); this._emitConfigChanged(); }
              )}
              <ha-selector .hass=${this.hass} .label=${themeStrengthInherited ? "Shadow strength (%) — inherited" : "Shadow strength (%)"}
                .value=${effectiveThemeStrength}
                .selector=${{number: {min: 0, max: 100, step: 5, mode: "box"}}}
                @value-changed=${(e) => {
                  const raw = e.detail.value;
                  if (raw === "" || raw === null || raw === undefined) delete theme.shadow_strength;
                  else theme.shadow_strength = Number(raw);
                  this._emitConfigChanged();
                }}></ha-selector>
              ${this._renderSelect("Shadow color source", theme.shadow_color_mode || "inherit",
                [["inherit","Inherit global"],["ha","Home Assistant theme color"],["active","Theme / active interval color"],["custom","Custom color"],["default","Classic black"]],
                (value) => { theme.shadow_color_mode = value || "inherit"; this.requestUpdate(); this._emitConfigChanged(); }
              )}
              ${this._renderSelect("Badge style", theme.badge_style || "inherit",
                [["inherit","Inherit global"],["pill","Pill"],["pill-strong","Pill strong"],["chip","Chip"],["underline","Underline"],["none","None"]],
                (value) => { theme.badge_style = value || "inherit"; this._emitConfigChanged(); }
              )}
            </div>
            ${theme.shadow_color_mode === "custom"
              ? this._renderShadowColorControl(theme, "shadow_color", "Theme shadow color", "#FF9800")
              : ""}
            <div class="theme-usage"><b>Used by:</b> ${usage.length ? usage.join(" · ") : "Not currently assigned"}</div>
            <div class="action-row">
              <ha-button class="danger" @click=${() => {
                const currentUsage = this._themeUsage(theme.id);
                this._requestDelete(`theme “${theme.name || theme.id}”`,
                  currentUsage.length ? `It is currently used by: ${currentUsage.join(", ")}. Those locations will return to inherited/button colors.` : "",
                  () => {
                    this._clearThemeReferences(theme.id);
                    themes.splice(themeIdx, 1);
                    this._emitConfigChanged();
                  });
              }}>Delete theme</ha-button>
            </div>
          </div>
        </ha-expansion-panel>
      `;
    }

    _renderThemeColor(theme, field, label, fallback) {
      return html`
        <div class="color-row">
          <input type="color" class="color-swatch" .value=${theme[field] || fallback}
            @input=${(e) => { theme[field] = e.target.value; this.requestUpdate(); this._emitConfigChanged(); }}
            @click=${this._stopPropagation} />
          <ha-selector .hass=${this.hass} .label=${label}
            .value=${theme[field] || ""} .selector=${{text: {}}}
            @value-changed=${(e) => { theme[field] = e.detail.value; this._emitConfigChanged(); }}></ha-selector>
        </div>
      `;
    }

    _editorPanelColorStyle(source, fallbackFrom = "#1E88E5", fallbackText = "#FFFFFF") {
      const from = source?.color_from || fallbackFrom;
      const to = source?.color_to || from;
      const textColor = source?.text_color || fallbackText;
      return `--panel-preview-from:${from};--panel-preview-to:${to};--panel-preview-text:${textColor};`;
    }

    _renderShadowColorControl(target, field, label, fallback = "#FF9800") {
      return html`
        <div class="color-row shadow-color-control">
          <input type="color" class="color-swatch" .value=${target[field] || fallback}
            @input=${(e) => { target[field] = e.target.value; this.requestUpdate(); this._emitConfigChanged(); }}
            @click=${this._stopPropagation} />
          <ha-selector .hass=${this.hass} .label=${label}
            .value=${target[field] || ""} .selector=${{text: {}}}
            @value-changed=${(e) => { target[field] = e.detail.value; this.requestUpdate(); this._emitConfigChanged(); }}></ha-selector>
        </div>
      `;
    }

    _isIntervalOverrideEnabled(interval, field) {
      const value = interval?.[field];
      if (value !== undefined && value !== null) return value !== false && value !== "false";
      const legacyValue = interval?.override_theme;
      if (legacyValue !== undefined && legacyValue !== null) return legacyValue !== false && legacyValue !== "false";
      return true;
    }

    _renderIntervalThemeToggles(interval, onButtonColorsChange, onTextColorChange) {
      const buttonColorsEnabled = this._isIntervalOverrideEnabled(interval, "override_theme_colors");
      const textColorEnabled = this._isIntervalOverrideEnabled(interval, "override_theme_text_color");
      return html`
        <div class="interval-theme-overrides">
          <div class="interval-theme-context">
            <ha-icon icon="mdi:palette-outline"></ha-icon>
            <div><b>Override active theme</b><span>These switches only have an effect when the button has an active reusable theme. Without a theme, the interval already controls its colors normally.</span></div>
          </div>
          <div class="toggle-row compact-toggle interval-theme-toggle">
            <span class="picker-label">Button color</span>
            <ha-switch .checked=${buttonColorsEnabled}
              @change=${(e) => onButtonColorsChange(e.target.checked)}></ha-switch>
          </div>
          <div class="toggle-row compact-toggle interval-theme-toggle">
            <span class="picker-label">Text color</span>
            <ha-switch .checked=${textColorEnabled}
              @change=${(e) => onTextColorChange(e.target.checked)}></ha-switch>
          </div>
        </div>
      `;
    }

    _renderMenus() {
      const menus = this._config.menus || [];
      const grouped = new Map();
      menus.forEach((menu, menuIdx) => {
        const group = String(menu.group || "").trim() || "Ungrouped";
        if (!grouped.has(group)) grouped.set(group, []);
        grouped.get(group).push({ menu, menuIdx });
      });
      return html`
        <details class="section editor-section">
          <summary class="section-summary">${this._renderSectionTitle("mdi:folder-multiple-outline", "Menus & submenus", `${menus.length} menu${menus.length === 1 ? "" : "s"}`)}</summary>
          <div class="section-body">
          <div class="section-note">
            Build reusable destination menus here, then change any button’s type to Menu button and link it to one.
            Menus can be opened as a popup or replace the current menu. There is no fixed menu-depth limit;
            groups, notes, the menu index and usage references help keep larger structures manageable.
          </div>
          <div class="helper-text">
            For a dedicated content Quickboard, create all content here and select its starting menu under
            <b>Basic → Default displayed menu</b>. If the card has no main rows, its first menu is selected automatically.
            A separate Navbar can then open a specific Menu ID in this card.
          </div>
          <details class="menu-help-details">
            <summary><ha-icon icon="mdi:help-circle-outline"></ha-icon><span>Setup guide &amp; menu help</span><small>Show instructions</small><ha-icon class="help-chevron" icon="mdi:chevron-down"></ha-icon></summary>
            <div class="menu-guide">
              <div class="menu-guide-title"><ha-icon icon="mdi:information-outline"></ha-icon> Quick setup</div>
              <ol>
              <li><b>Create the destination:</b> Select <b>Add menu</b>, give it a title, then add rows and the buttons that should appear inside it.</li>
              <li><b>Choose the opening button:</b> Under <b>Main menu rows &amp; buttons</b>, open a button preview and change <b>Button type</b> to <b>Menu button</b>.</li>
              <li><b>Link it:</b> Select your new menu under <b>Destination</b>.</li>
              <li><b>Choose how it opens:</b> <b>Replace current menu</b> changes the contents inside the card; <b>Popup</b> opens the menu above the dashboard.</li>
              <li><b>Control another Quickboard:</b> Copy the receiving card’s automatically generated <b>Quickboard card ID</b>. On a <b>Menu button</b>, choose <b>Another Quickboard card</b>, then paste that card ID and enter the destination Menu ID.</li>
              <li><b>External default menu:</b> Enable <b>Default menu for target card</b> on one Navbar Menu button to show that destination automatically when the Navbar loads.</li>
              <li><b>Navigation controls:</b> <b>Back</b> is optional. <b>Close</b> is always shown for popups so they can never trap navigation; for an in-place menu it remains optional.</li>
              <li><b>After an entity tap:</b> Set the menuâ€™s <b>Action after tap</b> to stay, return one step or close the complete menu flow.</li>
              </ol>
              <div class="menu-guide-tip">
                <b>More navigation:</b> A Menu button can also target <b>Previous menu (Back)</b>, <b>Main menu</b>, or any other existing menu.
                Menu buttons support the same badges and color intervals as entity buttons. Automatic status shows active/total and uses the active count for its color interval;
                alternatively select a status entity or use Custom colors.
              </div>
            </div>
          </details>
          ${menus.length ? html`
            <div class="menu-index">
              <div class="menu-index-title"><ha-icon icon="mdi:link-variant"></ha-icon> Menu index</div>
              <div class="menu-quicklinks">
                ${menus.map((menu) => html`
                  <button type="button" title=${`Open ${menu.title || menu.id} · ${this._menuUsage(menu.id).length} reference(s)`}
                    @click=${() => this._scrollToMenuEditor(menu.id)}>
                    <ha-icon icon="mdi:menu"></ha-icon>
                    <span>${menu.title || menu.id}</span>
                    <small>${this._menuUsage(menu.id).length}</small>
                  </button>
                `)}
              </div>
            </div>
          ` : ""}
          ${Array.from(grouped.entries()).map(([group, entries]) => html`
            <div class="menu-group">
              <div class="menu-group-title"><ha-icon icon="mdi:folder-outline"></ha-icon>${group}<span>${entries.length}</span></div>
              ${entries.map(({ menu, menuIdx }) => this._renderMenuEditor(menu, menuIdx))}
            </div>
          `)}
          <div class="action-row">
            <ha-button @click=${() => {
               if (!Array.isArray(this._config.menus)) this._config.menus = [];
               const id = this._makeMenuId();
               this._config.menus.push({ id, title: `Menu ${this._config.menus.length + 1}`, show_title: true, description: "", group: "", theme_id: "", action_after_tap: "stay", rows: [] });
               if (!(this._config.rows || []).length && !this._config.default_menu_id) {
                 this._config.default_menu_id = id;
               }
               this.requestUpdate();
              this._emitConfigChanged();
            }}>Add menu</ha-button>
          </div>
          </div>
        </details>
      `;
    }

    _renderMenuEditor(menu, menuIdx) {
      const menus = this._config.menus || [];
      const title = menu.title || menu.id || `Menu ${menuIdx + 1}`;
      const rows = menu.rows || [];
      const usage = this._menuUsage(menu.id);
      const headerBase = menu.description
        ? `${title} — ${menu.description} (${menu.id})`
        : `${title} — ${menu.id}`;
      const header = `${headerBase} · ${rows.length} row${rows.length === 1 ? "" : "s"}`;
      return html`
        <ha-expansion-panel id=${`menu-editor-${this._scopeKey(menu.id)}`} class="menu-editor-panel" .header=${header}>
          <div class="expansion-content menu-editor-content">
            ${this._renderFieldHelp(
              "Menu name and ID",
              "The title identifies this menu in the editor and is used as its default button label. Show menu title controls whether it appears as a heading on the live card. Menu ID is the destination used by Menu buttons and external Quickboards; renaming it updates links inside this card automatically."
            )}
            <div class="two-col">
              <ha-selector .hass=${this.hass} .label=${"Menu title"}
                .value=${menu.title || ""}
                .selector=${{text: {}}}
                @value-changed=${(e) => {
                  menus[menuIdx].title = e.detail.value;
                  this._emitConfigChanged();
                }}
              ></ha-selector>
              <ha-selector .hass=${this.hass} .label=${"Menu ID"}
                .value=${menu.id || ""}
                .selector=${{text: {}}}
                @value-changed=${(e) => this._renameMenu(menuIdx, e.detail.value)}
              ></ha-selector>
            </div>
            <div class="toggle-row compact-toggle menu-title-toggle">
              <span class="picker-label">Show menu title on card</span>
              <ha-switch .checked=${menu.show_title !== false}
                @change=${(e) => {
                  menus[menuIdx].show_title = e.target.checked;
                  this._emitConfigChanged();
                }}
              ></ha-switch>
            </div>
            ${this._renderFieldHelp(
              "Menu organization and behavior",
              "Group only organizes menus in the editor. Theme override controls this menu’s buttons. Action after tap decides whether an ordinary entity tap stays here, returns one step, or closes the current menu flow."
            )}
            <div class="four-col">
              ${this._renderSelect("Choose existing group", menu.group || "", this._menuGroupOptions(),
                (value) => { menu.group = value || ""; this.requestUpdate(); this._emitConfigChanged(); }
              )}
              <ha-selector .hass=${this.hass} .label=${"Group name (type new or edit)"}
                .value=${menu.group || ""} .selector=${{text: {}}}
                @value-changed=${(e) => { menu.group = e.detail.value; this.requestUpdate(); this._emitConfigChanged(); }}></ha-selector>
              ${this._renderSelect("Theme override", menu.theme_id || "", this._themeOptions("override"),
                (value) => { menu.theme_id = value || ""; this._emitConfigChanged(); }
              )}
              ${this._renderSelect("Action after tap", menu.action_after_tap || "stay",
                [["stay","Stay in current menu"],["back","Go back one menu"],["close","Close menu / popup"]],
                (value) => { menu.action_after_tap = value || "stay"; this._emitConfigChanged(); }
              )}
            </div>
            ${this._renderFieldHelp(
              "Editor note",
              "This note is only for organizing your configuration. It appears in the menu’s collapsed editor header and is not shown on the live card."
            )}
            <ha-selector .hass=${this.hass} .label=${"Editor note / description"}
              .value=${menu.description || ""} .selector=${{text: {multiline: true}}}
              @value-changed=${(e) => { menu.description = e.detail.value; this._emitConfigChanged(); }}></ha-selector>
            <div class="menu-usage-box">
              <div class="menu-usage-title"><ha-icon icon="mdi:source-branch"></ha-icon> Used by ${usage.length} reference${usage.length === 1 ? "" : "s"}</div>
              ${usage.length
                ? html`<div class="menu-usage-links">${usage.map((item) => html`<span>${item}</span>`)}</div>`
                : html`<div class="inline-note">No button or default menu currently links to this menu.</div>`}
            </div>
            ${rows.map((row, rowIdx) => this._renderRow(row, rowIdx, menu.id))}
            <div class="action-row">
              <ha-button @click=${() => {
                if (!Array.isArray(menus[menuIdx].rows)) menus[menuIdx].rows = [];
                menus[menuIdx].rows.push(this._newRow());
                this.requestUpdate();
                this._emitConfigChanged();
              }}>Add row</ha-button>
              <ha-button class="danger" @click=${() => {
                const deletedId = menus[menuIdx].id;
                const usageCount = this._menuUsage(deletedId).length;
                this._requestDelete(`menu “${menus[menuIdx].title || deletedId}”`,
                  `${(menus[menuIdx].rows || []).length} row(s) will be removed.${usageCount ? ` ${usageCount} linked reference(s) will be cleared.` : ""}`,
                  () => {
                    menus.splice(menuIdx, 1);
                    if (this._config.default_menu_id === deletedId) {
                      this._config.default_menu_id =
                        !(this._config.rows || []).length ? (menus[0]?.id || "") : "";
                    }
                    this._walkEntities((entity) => {
                      if (entity.menu_target_scope !== "external" && entity.menu_target === deletedId) entity.menu_target = "";
                    });
                    this._emitConfigChanged();
                  });
              }}>Delete menu</ha-button>
            </div>
          </div>
        </ha-expansion-panel>
      `;
    }

    _menuUsage(menuId) {
      const usage = [];
      if (this._config.default_menu_id === menuId) usage.push("Default displayed menu");
      const scan = (rows, location) => (rows || []).forEach((row, rowIdx) =>
        (row.entities || []).forEach((entity, entIdx) => {
          if (entity.button_type === "menu" && entity.menu_target_scope !== "external" && entity.menu_target === menuId) {
            usage.push(`${location} · Row ${rowIdx + 1} · ${entity.name || `Button ${entIdx + 1}`}`);
          }
        })
      );
      scan(this._config.rows, "Main menu");
      (this._config.menus || []).forEach((menu) => scan(menu.rows, menu.title || menu.id));
      return usage;
    }

    _scrollToMenuEditor(menuId) {
      const panel = this.renderRoot?.querySelector?.(`#menu-editor-${this._scopeKey(menuId)}`);
      if (!panel) return;
      try {
        panel.expanded = true;
        panel.setAttribute("expanded", "");
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (_) {}
    }

    _walkRows(callback) {
      (this._config.rows || []).forEach((row) => callback(row, ""));
      (this._config.menus || []).forEach((menu) =>
        (menu.rows || []).forEach((row) => callback(row, menu.id))
      );
    }

    _walkEntities(callback) {
      const visitRows = (rows) => (rows || []).forEach((row) =>
        (row.entities || []).forEach((entity) => callback(entity))
      );
      visitRows(this._config.rows);
      (this._config.menus || []).forEach((menu) => visitRows(menu.rows));
    }

    _setDefaultNavigationButton(target, enabled) {
      this._walkEntities((entity) => {
        if (entity.button_type === "navigation") delete entity.navigation_default;
      });
      if (enabled && target?.button_type === "navigation") {
        target.navigation_default = true;
      }
      this._emitConfigChanged();
    }

    _setDefaultExternalMenuButton(target, enabled) {
      const targetCardId = String(target?.menu_target_card || "").trim();
      if (enabled && targetCardId) {
        this._walkEntities((entity) => {
          if (
            entity !== target &&
            entity.button_type === "menu" &&
            entity.menu_target_scope === "external" &&
            String(entity.menu_target_card || "").trim() === targetCardId
          ) {
            delete entity.menu_default;
          }
        });
        target.menu_default = true;
      } else if (target) {
        delete target.menu_default;
      }
      this.requestUpdate();
      this._emitConfigChanged();
    }

    _renameMenu(menuIdx, requestedId) {
      const menus = this._config.menus || [];
      const menu = menus[menuIdx];
      if (!menu) return;
      const oldId = menu.id;
      const cleaned = String(requestedId || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "");
      if (!cleaned || menus.some((item, idx) => idx !== menuIdx && item.id === cleaned)) {
        this.requestUpdate();
        return;
      }
      menu.id = cleaned;
      if (this._config.default_menu_id === oldId) this._config.default_menu_id = cleaned;
      this._walkEntities((entity) => {
        if (entity.menu_target_scope !== "external" && entity.menu_target === oldId) entity.menu_target = cleaned;
      });
      this.requestUpdate();
      this._emitConfigChanged();
    }

    _renderRow(row, rowIdx, menuId = "") {
      const rows = this._rowsForScope(menuId);
      const entities = row.entities || [];
      const rowName = row.label ? `Row ${rowIdx + 1} — ${row.label}` : `Row ${rowIdx + 1}`;
      const header = `${rowName} · ${entities.length} button${entities.length === 1 ? "" : "s"}`;

      return html`
        <ha-expansion-panel class="row-editor-panel" .header=${header}>
          <div class="expansion-content">
            ${this._renderFieldHelp(
              "Row settings",
              "Row label and position control the optional text around this row. Row theme override applies one reusable theme to every button in the row unless an individual button overrides it."
            )}
            <div class="three-col">
              <ha-selector .hass=${this.hass} .label=${"Row label"}
                .value=${row.label || ""}
                .selector=${{text: {}}}
                @value-changed=${(e) => {
                  row.label = e.detail.value;
                  this._emitConfigChanged();
                }}
              ></ha-selector>
              ${this._renderSelect("Label position", row.label_position || "none",
                [["none","None"],["top-left","Top left"],["top-center","Top center"],["top-right","Top right"],
                 ["bottom-left","Bottom left"],["bottom-center","Bottom center"],["bottom-right","Bottom right"]],
                (value) => this._onLabelPosChanged(rowIdx, value, menuId)
              )}
              ${this._renderSelect("Row theme override", row.theme_id || "", this._themeOptions("override"),
                (value) => { row.theme_id = value || ""; this.requestUpdate(); this._emitConfigChanged(); }
              )}
            </div>

            <div class="row-buttons-label">Buttons in this row</div>
            ${entities.map((ent, entIdx) => this._renderEntity(rowIdx, ent, entIdx, menuId))}

            <div class="action-row">
              <ha-button @click=${() => {
                if (!row.entities) row.entities = [];
                row.entities.push(this._newEntity());
                this.requestUpdate(); this._emitConfigChanged();
              }}>Add button</ha-button>
              ${rowIdx > 0 ? html`<ha-button @click=${() => {
                [rows[rowIdx - 1], rows[rowIdx]] = [rows[rowIdx], rows[rowIdx - 1]];
                this.requestUpdate(); this._emitConfigChanged();
              }}>Move up</ha-button>` : ""}
              ${rowIdx < rows.length - 1 ? html`<ha-button @click=${() => {
                [rows[rowIdx + 1], rows[rowIdx]] = [rows[rowIdx], rows[rowIdx + 1]];
                this.requestUpdate(); this._emitConfigChanged();
              }}>Move down</ha-button>` : ""}
              <ha-button class="danger" @click=${() => {
                this._requestDelete(`row ${rowIdx + 1}`, `${entities.length} button(s) will also be removed.`, () => {
                  rows.splice(rowIdx, 1);
                  this._emitConfigChanged();
                });
              }}>Delete row</ha-button>
            </div>
          </div>
        </ha-expansion-panel>
      `;
    }

    _onLabelPosChanged(rowIdx, e, menuId = "") {
      const value = typeof e === "string" ? e : this._selectValue(e, "none") || "none";
      const row = this._rowsForScope(menuId)[rowIdx];
      if (row) row.label_position = value;
      this._emitConfigChanged();
    }

    _menuTargetOptions() {
      return [
        ["", "Select a destination"],
        ["__back__", "Previous menu (Back)"],
        ["__root__", "Main menu"],
        ...(this._config.menus || []).map((menu) => [
          menu.id,
          menu.group ? `${menu.group} · ${menu.title || menu.id}` : (menu.title || menu.id),
        ]),
      ];
    }

    _defaultMenuOptions() {
      return [
        ["", "Main menu rows (standard)"],
        ...(this._config.menus || []).map((menu) => [
          menu.id,
          menu.group ? `${menu.group} · ${menu.title || menu.id}` : (menu.title || menu.id),
        ]),
      ];
    }

    _menuGroupOptions() {
      const groups = Array.from(new Set(
        (this._config.menus || []).map((menu) => String(menu.group || "").trim()).filter(Boolean)
      )).sort((a, b) => a.localeCompare(b));
      return [["", "Ungrouped / type a new group"], ...groups.map((group) => [group, group])];
    }

    _renderMenuButtonSettings(ent) {
      const isExternal = ent.menu_target_scope === "external";
      const targetIsMenu = isExternal
        ? Boolean(ent.menu_target && ent.menu_target_card)
        : Boolean(ent.menu_target && !String(ent.menu_target).startsWith("__"));
      const stateMode = ent.menu_state_mode || "none";
      const isPopup = (ent.menu_display || "replace") === "popup";
      return html`
        <div class="menu-settings">
          <div class="conditional-settings-title">
            <ha-icon icon="mdi:link-variant"></ha-icon>
            <div>
              <b>Menu destination</b>
              <span>Open a menu in this card or control another Quickboard.</span>
            </div>
          </div>
          ${this._renderSelect("Open menu in", isExternal ? "external" : "local",
            [["local","This Quickboard card"],["external","Another Quickboard card"]],
            (value) => {
              ent.menu_target_scope = value === "external" ? "external" : "local";
              if (ent.menu_target_scope === "external" && !ent.entity) ent.menu_state_mode = "none";
              if (ent.menu_target_scope !== "external") delete ent.menu_default;
              this.requestUpdate();
              this._emitConfigChanged();
            }
          )}
          ${isExternal ? html`
            ${this._renderFieldHelp(
              "External destination",
              "Copy the receiving card’s automatically generated Quickboard card ID and paste it here. Menu ID must exactly match a menu there; use __root__ for its initial content or __back__ for one step back."
            )}
            <div class="two-col">
              <ha-selector .hass=${this.hass} .label=${"Target Quickboard card ID"}
                .value=${ent.menu_target_card || ""} .selector=${{text: {}}}
                @value-changed=${(e) => {
                  ent.menu_target_card = String(e.detail.value || "").trim();
                  if (ent.menu_default) this._setDefaultExternalMenuButton(ent, true);
                  else this._emitConfigChanged();
                }}></ha-selector>
              <ha-selector .hass=${this.hass} .label=${"Menu ID in target card"}
                .value=${ent.menu_target || ""} .selector=${{text: {}}}
                @value-changed=${(e) => {
                  ent.menu_target = String(e.detail.value || "").trim();
                  if (ent.menu_default) this._setDefaultExternalMenuButton(ent, true);
                  else this._emitConfigChanged();
                }}></ha-selector>
            </div>
          ` : html`
            ${this._renderFieldHelp(
              "Destination",
              "Choose a menu in this card. Previous menu goes back one step; Main menu returns directly to the card’s configured initial content."
            )}
            ${this._renderSelect("Destination", ent.menu_target || "", this._menuTargetOptions(), (value) => {
              ent.menu_target = value;
              this._emitConfigChanged();
            })}
          `}
          ${targetIsMenu ? html`
            ${isExternal ? html`
              ${this._renderFieldHelp(
                "Default external menu",
                "Enable this on one Navbar Menu button to open its destination automatically when the Navbar loads. Only one default is kept for each target Quickboard."
              )}
              <div class="toggle-row">
                <div class="picker-label">Default menu for target card</div>
                <ha-switch .checked=${ent.menu_default === true}
                  @change=${(e) => this._setDefaultExternalMenuButton(ent, e.target.checked)}
                ></ha-switch>
              </div>
            ` : ""}
            ${this._renderFieldHelp(
              "Opening mode and status",
              isExternal
                ? "Replace shows the destination inside the target card; Popup opens it above the dashboard. External automatic counts are not shared, so use None or a status entity. None is the default and hides the value."
                : "Replace swaps the content inside this card; Popup opens above the dashboard. Automatic status shows active/total entities and lets color intervals use the active count. None hides the value."
            )}
            <div class="two-col">
              ${this._renderSelect("Open menu as", ent.menu_display || "replace",
                [["replace", "Replace current menu"], ["popup", "Popup"]],
                (value) => {
                  ent.menu_display = value || "replace";
                  if (ent.menu_display === "popup") ent.menu_show_close = true;
                  this.requestUpdate();
                  this._emitConfigChanged();
                }
              )}
              ${this._renderSelect("Menu status", stateMode,
                [["auto", "Automatic: active/total"], ["entity", "Use status entity"], ["none", "None (hide status)"]],
                (value) => {
                  ent.menu_state_mode = value || "none";
                  if (ent.menu_state_mode === "none") ent.entity = "";
                  this.requestUpdate();
                  this._emitConfigChanged();
                }
              )}
            </div>
            <div class="two-col menu-toggle-grid">
              <div class="toggle-row compact-toggle">
                <span class="picker-label">Show Back button</span>
                <ha-switch .checked=${ent.menu_show_back === true}
                  @change=${(e) => { ent.menu_show_back = e.target.checked; this._emitConfigChanged(); }}></ha-switch>
              </div>
              ${isPopup ? html`
                <div class="toggle-row compact-toggle">
                  <span class="picker-label">Close button</span>
                  <span class="required-control"><ha-icon icon="mdi:lock-outline"></ha-icon>Always shown</span>
                </div>
              ` : html`
                <div class="toggle-row compact-toggle">
                  <span class="picker-label">Show Close button</span>
                  <ha-switch .checked=${ent.menu_show_close === true}
                    @change=${(e) => { ent.menu_show_close = e.target.checked; this._emitConfigChanged(); }}></ha-switch>
                </div>
              `}
            </div>
          ` : ""}
        </div>
      `;
    }

    _renderFieldHelp(title, text) {
      return html`
        <div class="field-help">
          <ha-icon icon="mdi:information-outline"></ha-icon>
          <div>
            ${title ? html`<b>${title}</b>` : ""}
            <span>${text}</span>
          </div>
        </div>
      `;
    }

    _renderNavigationButtonSettings(ent) {
      return html`
        <div class="navigation-settings">
          <div class="conditional-settings-title">
            <ha-icon icon="mdi:page-next-outline"></ha-icon>
            <div>
              <b>Home Assistant page navigation</b>
              <span>Open a dashboard view and keep the correct Navbar button selected.</span>
            </div>
          </div>
          ${this._renderFieldHelp(
            "Dashboard destination",
            "Enter the Home Assistant dashboard path beginning with /. Example: /dashboard-tablet/lights."
          )}
          <ha-selector .hass=${this.hass} .label=${"Navigation path"}
            .value=${ent.navigation_path || ""}
            .selector=${{text: {}}}
            @value-changed=${(e) => {
              ent.navigation_path = String(e.detail.value || "").trim();
              this._emitConfigChanged();
            }}
          ></ha-selector>
          ${this._renderFieldHelp(
            "Active matching and browser history",
            "Exact path selects the button only on that page. Path and subpaths also selects it on pages below that path. Replace browser history avoids adding a new Back-button entry."
          )}
          <div class="two-col">
            ${this._renderSelect("Active path matching", ent.active_path_match || "exact",
              [["exact","Exact path"],["prefix","Path and subpaths"]],
              (value) => {
                ent.active_path_match = value || "exact";
                this._emitConfigChanged();
              }
            )}
            <div class="toggle-row compact-toggle">
              <span class="picker-label">Replace browser history entry</span>
              <ha-switch .checked=${ent.navigation_replace === true}
                @change=${(e) => {
                  ent.navigation_replace = e.target.checked;
                  this._emitConfigChanged();
                }}
              ></ha-switch>
            </div>
          </div>
          ${this._renderFieldHelp(
            "Fallback selection",
            "Default active button is used only when none of this card’s Navigation buttons matches the current page URL. A URL match always has priority."
          )}
          <div class="toggle-row compact-toggle navigation-default-toggle">
            <div class="picker-label">Default active button</div>
            <ha-switch .checked=${ent.navigation_default === true}
              @change=${(e) => this._setDefaultNavigationButton(ent, e.target.checked)}
            ></ha-switch>
          </div>
        </div>
      `;
    }

    _editorResolveTheme(ent, menuId = "", rowCfg = null) {
      if (ent?.theme_id === "__none__") return null;
      let themeId = ent?.theme_id || "";
      if (!themeId && rowCfg?.theme_id === "__none__") return null;
      if (!themeId && rowCfg?.theme_id) themeId = rowCfg.theme_id;
      if (!themeId) {
        const scopeTheme = menuId
          ? (this._config.menus || []).find((menu) => menu.id === menuId)?.theme_id
          : this._config.main_menu_theme_id;
        if (scopeTheme === "__none__") return null;
        themeId = scopeTheme || this._config.default_theme_id || "";
      }
      return (this._config.button_themes || []).find((theme) => theme.id === themeId) || null;
    }

    _editorResolveButtonStyle(ent, theme = null) {
      if (ent?.button_style && ent.button_style !== "inherit") return ent.button_style;
      if (theme?.button_style && theme.button_style !== "inherit") return theme.button_style;
      return this._config.button_style || "raised";
    }

    _editorResolvePreviewState(ent) {
      const entityId = ent?.entity || "";
      if (ent?.button_type === "navigation") {
        return { stateObj: undefined, menuStats: null };
      }
      if (ent?.button_type !== "menu") {
        return {
          stateObj: entityId ? this.hass?.states?.[entityId] : undefined,
          menuStats: null,
        };
      }

      const stateMode = ent.menu_state_mode || "none";
      if (stateMode === "none") return { stateObj: undefined, menuStats: null };
      if (stateMode === "entity") {
        return {
          stateObj: entityId ? this.hass?.states?.[entityId] : undefined,
          menuStats: null,
        };
      }

      if (ent.menu_target === "__back__" || ent.menu_target === "__root__") {
        const state = ent.menu_target === "__back__" ? "back" : "home";
        return {
          stateObj: {
            entity_id: `quickboard_menu.${state}`,
            state,
            attributes: { unit_of_measurement: "" },
          },
          menuStats: null,
        };
      }

      const menuStats = ent.menu_target_scope === "external"
        ? { active: 0, total: 0 }
        : this._previewMenuStats(ent.menu_target || "");
      return {
        stateObj: {
          entity_id: `quickboard_menu.${ent.menu_target || "menu"}`,
          state: String(menuStats.active),
          attributes: { unit_of_measurement: `/${menuStats.total}` },
        },
        menuStats,
      };
    }

    _editorFindColorInterval(stateObj, ent) {
      if (!stateObj) return null;
      const intervals = ent?.color_intervals?.length
        ? ent.color_intervals
        : (this._config.color_intervals || []);
      const rawState = String(stateObj.state ?? "");
      const numericValue = Number(rawState);
      const hasNumericValue = !Number.isNaN(numericValue);
      for (const interval of intervals) {
        if (interval.match_state) {
          if (rawState.toLowerCase() === String(interval.match_state).toLowerCase()) return interval;
          continue;
        }
        if (hasNumericValue && numericValue >= (interval.from ?? 0) && numericValue < (interval.to ?? 0)) {
          return interval;
        }
      }
      return null;
    }

    _renderButtonPreview(ent, entIdx, menuId = "", rowCfg = null) {
      const isMenu = ent.button_type === "menu";
      const isNavigation = ent.button_type === "navigation";
      const theme = this._editorResolveTheme(ent, menuId, rowCfg);
      const buttonStyle = this._editorResolveButtonStyle(ent, theme);
      const previewIsFlatRail =
        buttonStyle === "flat" &&
        (this._config.flat_layout || "rail") === "rail";
      const previewBadgeStyle = ent.badge_style && ent.badge_style !== "inherit"
        ? ent.badge_style
        : theme?.badge_style && theme.badge_style !== "inherit"
          ? theme.badge_style
          : (this._config.badge_style || "pill");
      const { stateObj: previewStateObj, menuStats: previewMenuStats } = this._editorResolvePreviewState(ent);
      const matchedPreviewInterval = this._editorFindColorInterval(previewStateObj, ent);
      const previewInterval = matchedPreviewInterval || {};
      const previewOverridesButtonColors = Boolean(
        theme && matchedPreviewInterval && this._isIntervalOverrideEnabled(previewInterval, "override_theme_colors")
      );
      const previewOverridesTextColor = Boolean(
        theme && matchedPreviewInterval && this._isIntervalOverrideEnabled(previewInterval, "override_theme_text_color")
      );
      const previewUsesThemeColors = Boolean(theme && !previewOverridesButtonColors);
      const previewUsesThemeTextColor = Boolean(theme && !previewOverridesTextColor);
      const from = previewUsesThemeColors
        ? (theme.color_from || "#1E88E5")
        : previewOverridesButtonColors
        ? (previewInterval.color_from || "#1E88E5")
        : ent.color_mode === "custom"
        ? (ent.color_from || "#1E88E5")
        : matchedPreviewInterval
        ? (previewInterval.color_from || "#1E88E5")
        : "#1E3C72";
      const to = previewUsesThemeColors
        ? (theme.color_to || from)
        : previewOverridesButtonColors
        ? (previewInterval.color_to || from)
        : ent.color_mode === "custom"
        ? (ent.color_to || from)
        : matchedPreviewInterval
        ? (previewInterval.color_to || from)
        : "#2A5298";
      const textColor = previewUsesThemeTextColor
        ? (theme.text_color || "#FFFFFF")
        : previewOverridesTextColor
        ? (previewInterval.text_color || "#FFFFFF")
        : ent.color_mode === "custom"
        ? "#FFFFFF"
        : matchedPreviewInterval
        ? (previewInterval.text_color || "#FFFFFF")
        : "#FFFFFF";
      const buttonShadowPreset = ent.shadow_preset || "inherit";
      const baseShadow = buttonShadowPreset !== "inherit"
        ? this._shadowCssFromPreset(buttonShadowPreset)
        : (theme?.box_shadow || this._config.box_style?.box_shadow || "0 4px 12px rgba(0,0,0,.25)");
      let shadowMode = ent.shadow_color_mode || "inherit";
      let shadowCustom = ent.shadow_color || "";
      if (shadowMode === "inherit" && theme?.shadow_color_mode && theme.shadow_color_mode !== "inherit") {
        shadowMode = theme.shadow_color_mode;
        shadowCustom = theme.shadow_color || "";
      }
      const previewStrength = this._resolveShadowStrength(
        ent.shadow_strength,
        theme?.shadow_strength,
        this._config.box_style?.shadow_strength,
        60
      );
      const previewShadow = this._previewShadowCss(
        baseShadow,
        shadowMode,
        shadowCustom,
        ((!theme || previewOverridesButtonColors) && matchedPreviewInterval ? previewInterval.shadow_color : "") || from,
        previewStrength
      );
      const name = ent.name || (isMenu
        ? "Menu button"
        : isNavigation
          ? "Navigation button"
          : (previewStateObj?.attributes?.friendly_name || ent.entity || `Button ${entIdx + 1}`));
      const subtitle = isMenu
        ? (ent.menu_target_scope === "external"
          ? `${ent.menu_target_card || "Target card"} → ${ent.menu_target || "Menu ID"}${ent.menu_default ? " · Default" : ""}`
          : ent.menu_target === "__back__" ? "Previous menu"
          : ent.menu_target === "__root__" ? "Main menu"
          : ((this._config.menus || []).find((menu) => menu.id === ent.menu_target)?.title || ent.menu_target || "Choose destination"))
        : isNavigation
          ? `${ent.navigation_path || "Choose navigation path"}${ent.navigation_default ? " · Default active" : ""}`
          : (ent.entity || "Choose entity");
      const previewShowIcon =
        ent.show_icon !== undefined ? ent.show_icon !== false : this._config.show_icon !== false;
      const previewShowLabel = ent.show_label !== false;
      const menuStateMode = ent.menu_state_mode || "none";
      const previewShowState =
        ent.show_state !== false &&
        !isNavigation &&
        !(isMenu && menuStateMode === "none");
      let icon = "";
      if (
        previewShowIcon &&
        previewStateObj &&
        ent.icon_mode === "state" &&
        Array.isArray(ent.icon_states)
      ) {
        const previewState = String(previewStateObj.state ?? "").toLowerCase();
        const stateIcon = ent.icon_states.find(
          (mapping) => String(mapping.state ?? "").toLowerCase() === previewState
        );
        if (stateIcon?.icon) icon = stateIcon.icon;
      }
      if (previewShowIcon && !icon) {
        icon = ent.icon ||
          previewStateObj?.attributes?.icon ||
          (isMenu
            ? "mdi:view-grid-plus-outline"
            : isNavigation
              ? "mdi:view-dashboard-outline"
              : "mdi:gesture-tap-button");
      }
      let previewValue = "";
      if (previewShowState && isMenu && menuStateMode === "auto") {
        if (ent.menu_target === "__back__") previewValue = "Back";
        else if (ent.menu_target === "__root__") previewValue = "Home";
        else {
          previewValue = `${previewMenuStats?.active ?? 0}/${previewMenuStats?.total ?? 0}`;
        }
      } else if (previewShowState && previewStateObj) {
        previewValue = `${previewStateObj.state}${previewStateObj.attributes?.unit_of_measurement || ""}`;
      } else if (previewShowState) {
        previewValue = ent.entity ? "Unavailable" : "No entity";
      }
      const previewHasBadges = Boolean(ent.badges?.length);
      const previewIsIconOnly =
        previewShowIcon && !previewShowLabel && !previewShowState && !previewHasBadges;
      const previewIconSize = Number(ent.icon_size);
      const previewStyle = `--preview-from:${from};--preview-to:${to};--preview-text:${textColor};--preview-radius:${Number(theme?.border_radius ?? 12)}px;--preview-border-width:${Number(theme?.border_width || 0)}px;--preview-border:${theme?.border_color || "transparent"};--preview-shadow:${previewShadow};--preview-icon-size:${Number.isFinite(previewIconSize) && previewIconSize > 0 ? previewIconSize : 20}px;`;
      return html`
        <div
          class=${`button-preview button-preview-${buttonStyle}${previewIsFlatRail ? " button-preview-rail" : ""}${!previewShowLabel ? " button-preview-no-label" : ""}${previewIsIconOnly ? " button-preview-icon-only" : ""}`}
          style=${previewStyle}
          title=${!previewShowLabel ? name : ""}
        >
          <div class="button-preview-type" title=${isMenu ? "Menu button" : isNavigation ? "Navigation button" : "Entity button"}>
            <ha-icon .icon=${isMenu
              ? "mdi:menu"
              : isNavigation
                ? "mdi:page-next-outline"
                : "mdi:flash-outline"}></ha-icon>
          </div>
          ${previewShowIcon ? html`<ha-icon class="button-preview-main-icon" .icon=${icon}></ha-icon>` : ""}
          ${previewShowLabel || previewHasBadges ? html`
            <div class="button-preview-copy">
              ${previewShowLabel ? html`
                <div class="button-preview-name">${name}</div>
                <div class="button-preview-subtitle">${isMenu ? "Menu" : isNavigation ? "Navigation" : "Entity"} · ${subtitle}</div>
              ` : ""}
            ${ent.badges?.length ? html`
              <div class=${`button-preview-badges preview-badge-${previewBadgeStyle}`}>
                ${ent.badges.slice(0, 3).map((badge) => html`
                  <span style=${Number.isFinite(Number(badge.font_size)) && Number(badge.font_size) > 0
                    ? `font-size:${Number(badge.font_size)}px`
                    : ""}>
                    ${badge.label || badge.entity || "Badge"}
                  </span>
                `)}
                ${ent.badges.length > 3 ? html`<span>+${ent.badges.length - 3}</span>` : ""}
              </div>
            ` : ""}
            </div>
          ` : ""}
          ${previewValue ? html`<div class="button-preview-value">${previewValue}</div>` : ""}
          <ha-icon class="preview-chevron" icon="mdi:chevron-down"></ha-icon>
        </div>
      `;
    }

    _previewMenuStats(menuId, visited = new Set(), counted = new Set()) {
      if (!menuId || String(menuId).startsWith("__") || visited.has(menuId)) return { active: 0, total: 0 };
      visited.add(menuId);
      const menu = (this._config.menus || []).find((item) => item.id === menuId);
      let active = 0;
      let total = 0;
      (menu?.rows || []).forEach((row) => (row.entities || []).forEach((item) => {
        if (item.button_type === "menu" && item.menu_target_scope !== "external" && item.menu_target && !String(item.menu_target).startsWith("__")) {
          const nested = this._previewMenuStats(item.menu_target, visited, counted);
          active += nested.active;
          total += nested.total;
          return;
        }
        if (!item.entity || counted.has(item.entity) || !this.hass?.states?.[item.entity]) return;
        counted.add(item.entity);
        total += 1;
        const state = String(this.hass.states[item.entity].state ?? "").trim().toLowerCase();
        if (!["", "0", "off", "closed", "idle", "standby", "unavailable", "unknown", "disarmed"].includes(state)) active += 1;
      }));
      return { active, total };
    }

    _renderEntity(rowIdx, ent, entIdx, menuId = "") {
      const entities = this._rowsForScope(menuId)[rowIdx].entities;
      const badges = ent.badges || [];
      const colorMode = ent.color_mode || "interval";
      const scopeKey = this._scopeKey(menuId);
      const isMenu = ent.button_type === "menu";
      const isNavigation = ent.button_type === "navigation";
      const rowCfg = this._rowsForScope(menuId)[rowIdx];
      const activeTheme = this._editorResolveTheme(ent, menuId, rowCfg);
      const buttonStrengthInherited = ent.shadow_strength === null || ent.shadow_strength === undefined || String(ent.shadow_strength).trim() === "";
      const effectiveButtonStrength = this._resolveShadowStrength(
        ent.shadow_strength,
        activeTheme?.shadow_strength,
        this._config.box_style?.shadow_strength,
        60
      );

      return html`
        <details class="button-details">
          <summary>${this._renderButtonPreview(ent, entIdx, menuId, rowCfg)}</summary>
          <div class="expansion-content">
            ${this._renderFieldHelp(
              "Button function",
              "Entity controls or displays a Home Assistant entity. Menu opens Quickboard menus locally or in another card. Navigation opens a Home Assistant dashboard page."
            )}
            ${this._renderSelect("Button type", isMenu ? "menu" : isNavigation ? "navigation" : "entity",
              [
                ["entity", "Entity button"],
                ["menu", "Menu button — Quickboard menu"],
                ["navigation", "Navigation button — Home Assistant page"],
              ],
              (value) => {
                const previousType = ent.button_type || "entity";
                ent.button_type = value || "entity";
                if (ent.button_type === "menu") {
                  if (!ent.menu_target) ent.menu_target = this._config.menus?.[0]?.id || "";
                  if (previousType !== "menu") {
                    ent.entity = "";
                    ent.menu_state_mode = "none";
                  }
                } else {
                  delete ent.menu_default;
                }
                if (ent.button_type === "navigation") {
                  ent.active_path_match = ent.active_path_match || "exact";
                  ent.navigation_path = ent.navigation_path || "";
                } else {
                  delete ent.navigation_default;
                }
                this.requestUpdate();
                this._emitConfigChanged();
              }
            )}
            ${isMenu ? this._renderMenuButtonSettings(ent) : ""}
            ${isNavigation ? this._renderNavigationButtonSettings(ent) : ""}

            ${this._renderFieldHelp(
              "Button appearance",
              "Inherit uses the active row, menu or global theme/style. Raised is the classic card-like button. Flat removes the raised surface and can be used on any button type."
            )}
            ${this._renderSelect("Button style", ent.button_style || "inherit",
              [["inherit","Inherit theme/global"],["raised","Raised"],["flat","Flat"]],
              (value) => {
                ent.button_style = value || "inherit";
                this._emitConfigChanged();
              }
            )}

            ${(!isMenu && !isNavigation) || (isMenu && (ent.menu_state_mode || "none") === "entity") ? html`
              <div class="picker-label">${isMenu ? "Status entity (optional)" : "Entity"}</div>
              <div class="entity-picker-placeholder" id=${`entity-picker-${scopeKey}-${rowIdx}-${entIdx}`}></div>
            ` : ""}

            <ha-selector .hass=${this.hass} .label=${"Name"}
              .value=${ent.name || ""}
              .selector=${{text: {}}}
              @value-changed=${(e) => {
                ent.name = e.detail.value;
                this._emitConfigChanged();
              }}
            ></ha-selector>

            ${this._renderFieldHelp(
              "Icon behavior",
              "Single icon always uses one icon. By state lets you map exact entity states such as on and off to different icons."
            )}
            <div class="two-col">
              ${this._renderSelect("Icon mode", ent.icon_mode || "single",
                [["single","Single icon"],["state","By state"]],
                (v) => {
                  ent.icon_mode = v || "single";
                  this._emitConfigChanged();
                }
              )}
              ${(ent.icon_mode || "single") === "single" ? html`
                <ha-icon-picker label="Icon" .hass=${this.hass} .value=${ent.icon || ""}
                  @value-changed=${(e) => {
                    ent.icon = e.detail.value;
                    this._emitConfigChanged();
                  }}
                  @closed=${this._stopPropagation}
                ></ha-icon-picker>
              ` : ""}
            </div>

            ${(ent.icon_mode || "single") === "state" ? html`
              <div class="state-icons-block">
                ${(ent.icon_states || []).map((m, mIdx) => html`
                  <div class="two-col">
                    <ha-selector .hass=${this.hass} .label=${"State (e.g. on, off)"}
                      .value=${m.state || ""}
                      .selector=${{text: {}}}
                      @value-changed=${(e) => {
                        ent.icon_states[mIdx].state = e.detail.value;
                        this._emitConfigChanged();
                      }}
                    ></ha-selector>
                    <ha-icon-picker label="Icon" .hass=${this.hass} .value=${m.icon || ""}
                      @value-changed=${(e) => {
                        ent.icon_states[mIdx].icon = e.detail.value;
                        this._emitConfigChanged();
                      }}
                      @closed=${this._stopPropagation}
                    ></ha-icon-picker>
                  </div>
                  <div class="action-row">
                    <ha-button class="danger" @click=${() => {
                      this._requestDelete(`state icon “${m.state || mIdx + 1}”`, "", () => {
                        ent.icon_states.splice(mIdx, 1);
                        this._emitConfigChanged();
                      });
                    }}>Remove</ha-button>
                  </div>
                `)}
                <div class="action-row">
                  <ha-button @click=${() => {
                    if (!ent.icon_states) ent.icon_states = [];
                    ent.icon_states.push({ state: "", icon: "" });
                    this.requestUpdate(); this._emitConfigChanged();
                  }}>Add state icon</ha-button>
                </div>
              </div>
            ` : ""}

            ${this._renderFieldHelp(
              "Visible button content",
              "Show label controls both a custom name and the automatic entity name. Show state controls the value or status line. Turn off both Label and State for a centered icon-only button. State-based icons still follow the entity when the state text is hidden."
            )}
            <div class="three-col content-toggle-grid">
              <div class="toggle-row compact-toggle">
                <span class="picker-label">Show icon</span>
                <ha-switch .checked=${ent.show_icon !== undefined ? ent.show_icon !== false : this._config.show_icon !== false}
                  @change=${(e) => {
                    const globalDefault = this._config.show_icon !== false;
                    const newValue = e.target.checked;
                    ent.show_icon = newValue === globalDefault ? undefined : newValue;
                    this._emitConfigChanged();
                  }}
                ></ha-switch>
              </div>
              <div class="toggle-row compact-toggle">
                <span class="picker-label">Show label</span>
                <ha-switch .checked=${ent.show_label !== false}
                  @change=${(e) => {
                    ent.show_label = e.target.checked;
                    this._emitConfigChanged();
                  }}
                ></ha-switch>
              </div>
              ${!isNavigation && !(isMenu && (ent.menu_state_mode || "none") === "none") ? html`
                <div class="toggle-row compact-toggle">
                  <span class="picker-label">Show state</span>
                  <ha-switch .checked=${ent.show_state !== false}
                    @change=${(e) => {
                      ent.show_state = e.target.checked;
                      this._emitConfigChanged();
                    }}
                  ></ha-switch>
                </div>
              ` : ""}
            </div>

            ${this._renderFieldHelp(
              "Button sizing and value formatting",
              "Icon size is measured in pixels. Value and label font scales use 1.0 as normal size. Decimal places and Unit override the global/entity values only for this button."
            )}
            <div class="three-col">
              <ha-selector .hass=${this.hass} .label=${"Icon size (px)"}
                .value=${ent.icon_size ?? 20}
                .selector=${{number: {min: 8, max: 96, step: 1, mode: "box"}}}
                @value-changed=${(e) => {
                  const raw = e.detail.value;
                  ent.icon_size = raw === "" || raw === null || raw === undefined ? undefined : Number(raw);
                  this._emitConfigChanged();
                }}
              ></ha-selector>
              <ha-selector .hass=${this.hass} .label=${"Value font scale"}
                .value=${ent.value_font_size ?? 1.0}
                .selector=${{number: {min: 0.1, step: 0.1, mode: "box"}}}
                @value-changed=${(e) => {
                  ent.value_font_size = Number(e.detail.value);
                  this._emitConfigChanged();
                }}
              ></ha-selector>
              <ha-selector .hass=${this.hass} .label=${"Label font scale"}
                .value=${ent.label_font_size ?? 1.0}
                .selector=${{number: {min: 0.1, step: 0.1, mode: "box"}}}
                @value-changed=${(e) => {
                  ent.label_font_size = Number(e.detail.value);
                  this._emitConfigChanged();
                }}
              ></ha-selector>
            </div>
            <div class="two-col">
              <ha-selector .hass=${this.hass} .label=${"Decimal places (leave blank to use global)"}
                .value=${ent.decimal_places ?? ""}
                .selector=${{number: {min: 0, max: 6, step: 1, mode: "box"}}}
                @value-changed=${(e) => {
                  const raw = e.detail.value;
                  ent.decimal_places = raw === "" || raw === null || raw === undefined ? undefined : Number(raw);
                  this._emitConfigChanged();
                }}
              ></ha-selector>
              <ha-selector .hass=${this.hass} .label=${"Unit (leave blank to use entity unit)"}
                .value=${ent.unit !== undefined ? ent.unit : ""}
                .selector=${{text: {}}}
                @value-changed=${(e) => {
                  const raw = e.detail.value;
                  ent.unit = raw === "" ? undefined : raw;
                  this._emitConfigChanged();
                }}
              ></ha-selector>
            </div>

            ${this._renderFieldHelp(
              "Theme override",
              "Choose a reusable theme for this button, inherit from its row/menu/global settings, or select No theme to let this button use Color intervals or Custom colors directly."
            )}
            ${activeTheme ? html`
              <div class="theme-active-note"><ha-icon icon="mdi:palette"></ha-icon>
                Active theme: <b>${activeTheme.name || activeTheme.id}</b>. It overrides the color source below; select “No theme” to use intervals or custom colors for this button.
              </div>
            ` : ""}
            ${this._renderSelect("Theme override", ent.theme_id || "", this._themeOptions("override"),
              (value) => { ent.theme_id = value || ""; this.requestUpdate(); this._emitConfigChanged(); }
            )}

            <div class="subsection-title">Shadow</div>
            ${this._renderFieldHelp(
              "Button shadow",
              "Inherit follows the active theme or global Appearance setting. Active theme / color interval uses the matched interval’s Active shadow color; if empty, it falls back to the current theme or button color."
            )}
            <div class="three-col">
              ${this._renderSelect("Shadow type", ent.shadow_preset || "inherit",
                [["inherit","Inherit theme/global"],["none","None"],["soft","Soft"],["medium","Medium"],["strong","Strong"],["glow","Glow"]],
                (value) => { ent.shadow_preset = value || "inherit"; this._emitConfigChanged(); }
              )}
              <ha-selector .hass=${this.hass} .label=${buttonStrengthInherited ? "Shadow strength (%) — inherited" : "Shadow strength (%)"}
                .value=${effectiveButtonStrength}
                .selector=${{number: {min: 0, max: 100, step: 5, mode: "box"}}}
                @value-changed=${(e) => {
                  const raw = e.detail.value;
                  if (raw === "" || raw === null || raw === undefined) delete ent.shadow_strength;
                  else ent.shadow_strength = Number(raw);
                  this._emitConfigChanged();
                }}></ha-selector>
              ${this._renderSelect("Shadow color source", ent.shadow_color_mode || "inherit",
                [["inherit","Inherit theme/global"],["ha","Home Assistant theme color"],["active","Active theme / color interval"],["custom","Custom color"],["default","Classic black"]],
                (value) => { ent.shadow_color_mode = value || "inherit"; this.requestUpdate(); this._emitConfigChanged(); }
              )}
            </div>
            ${ent.shadow_color_mode === "custom"
              ? this._renderShadowColorControl(ent, "shadow_color", "Button shadow color", "#FF9800")
              : ""}

            ${this._renderFieldHelp(
              "Button color source",
              "Color interval reacts to the button’s entity state and uses per-button intervals first, then global intervals. Custom colors use the selected gradient unless an active theme overrides them."
            )}
            ${this._renderSelect("Color source", colorMode,
              [["interval","Color interval"],["custom","Custom colors"]],
              (v) => {
                ent.color_mode = v || "interval";
                this._emitConfigChanged();
              }
            )}

            ${colorMode === "custom" ? html`
              <div class="two-col">
                <div class="color-row">
                  <input type="color" class="color-swatch"
                    .value=${ent.color_from || "#000000"}
                    @input=${(e) => this._updateEntityColorField(rowIdx, entIdx, "color_from", e.target.value, menuId)}
                    @click=${this._stopPropagation}
                  />
                  <ha-selector .hass=${this.hass} .label=${"Gradient from"}
                    .value=${ent.color_from || ""}
                    .selector=${{text: {}}}
                    @value-changed=${(e) => this._updateEntityColorField(rowIdx, entIdx, "color_from", e.detail.value, menuId)}
                  ></ha-selector>
                </div>
                <div class="color-row">
                  <input type="color" class="color-swatch"
                    .value=${ent.color_to || "#000000"}
                    @input=${(e) => this._updateEntityColorField(rowIdx, entIdx, "color_to", e.target.value, menuId)}
                    @click=${this._stopPropagation}
                  />
                  <ha-selector .hass=${this.hass} .label=${"Gradient to"}
                    .value=${ent.color_to || ""}
                    .selector=${{text: {}}}
                    @value-changed=${(e) => this._updateEntityColorField(rowIdx, entIdx, "color_to", e.detail.value, menuId)}
                  ></ha-selector>
                </div>
              </div>
            ` : ""}

            ${colorMode === "interval" ? html`
              <div class="subsection-title">Per-button color intervals</div>
              <div class="helper-text">Leave empty to use global color intervals. For an automatic menu button, From/To matches its active-entity count.</div>
              ${(ent.color_intervals || []).map((interval, iIdx) => html`
                <ha-expansion-panel class="interval-editor-panel color-preview-panel"
                  style=${this._editorPanelColorStyle(interval, "#1E88E5", "#FFFFFF")}>
                  <div slot="header" class="color-preview-header">
                    <span>${interval.match_state
                      ? `Interval ${iIdx + 1} — state: ${interval.match_state}`
                      : `Interval ${iIdx + 1} — ${interval.from ?? 0} to ${interval.to ?? 0}`}</span>
                  </div>
                  <div class="expansion-content">
                    <div class="two-col">
                      <ha-selector .hass=${this.hass} .label=${"From"}
                        .value=${interval.from ?? 0}
                        .selector=${{number: {step: 1, mode: "box"}}}
                        @value-changed=${(e) => this._updateEntityIntervalField(rowIdx, entIdx, iIdx, "from", Number(e.detail.value), menuId)}
                      ></ha-selector>
                      <ha-selector .hass=${this.hass} .label=${"To"}
                        .value=${interval.to ?? 0}
                        .selector=${{number: {step: 1, mode: "box"}}}
                        @value-changed=${(e) => this._updateEntityIntervalField(rowIdx, entIdx, iIdx, "to", Number(e.detail.value), menuId)}
                      ></ha-selector>
                    </div>
                    ${this._renderIntervalThemeToggles(
                      interval,
                      (checked) => this._updateEntityIntervalField(rowIdx, entIdx, iIdx, "override_theme_colors", checked, menuId),
                      (checked) => this._updateEntityIntervalField(rowIdx, entIdx, iIdx, "override_theme_text_color", checked, menuId)
                    )}
                    <div class="four-col">
                      <div class="color-row">
                        <input type="color" class="color-swatch"
                          .value=${interval.color_from || "#000000"}
                          @input=${(e) => this._updateEntityIntervalField(rowIdx, entIdx, iIdx, "color_from", e.target.value, menuId)}
                          @click=${this._stopPropagation}
                        />
                        <ha-selector .hass=${this.hass} .label=${"Gradient from"}
                          .value=${interval.color_from || ""}
                          .selector=${{text: {}}}
                          @value-changed=${(e) => this._updateEntityIntervalField(rowIdx, entIdx, iIdx, "color_from", e.detail.value, menuId)}
                        ></ha-selector>
                      </div>
                      <div class="color-row">
                        <input type="color" class="color-swatch"
                          .value=${interval.color_to || "#000000"}
                          @input=${(e) => this._updateEntityIntervalField(rowIdx, entIdx, iIdx, "color_to", e.target.value, menuId)}
                          @click=${this._stopPropagation}
                        />
                        <ha-selector .hass=${this.hass} .label=${"Gradient to"}
                          .value=${interval.color_to || ""}
                          .selector=${{text: {}}}
                          @value-changed=${(e) => this._updateEntityIntervalField(rowIdx, entIdx, iIdx, "color_to", e.detail.value, menuId)}
                        ></ha-selector>
                      </div>
                      <div class="color-row">
                        <input type="color" class="color-swatch"
                          .value=${interval.text_color || "#FFFFFF"}
                          @input=${(e) => this._updateEntityIntervalField(rowIdx, entIdx, iIdx, "text_color", e.target.value, menuId)}
                          @click=${this._stopPropagation}
                        />
                        <ha-selector .hass=${this.hass} .label=${"Text color"}
                          .value=${interval.text_color || ""}
                          .selector=${{text: {}}}
                          @value-changed=${(e) => this._updateEntityIntervalField(rowIdx, entIdx, iIdx, "text_color", e.detail.value, menuId)}
                        ></ha-selector>
                      </div>
                      ${this._renderShadowColorControl(interval, "shadow_color", "Active shadow color", interval.color_from || "#FF9800")}
                    </div>
                    ${this._renderFieldHelp(
                      "Exact state matching",
                      "Use Match state for non-numeric states such as on, off, home or playing. It replaces the numeric From/To match for this interval."
                    )}
                    <ha-selector .hass=${this.hass} .label=${"Match state (optional, e.g. on, off)"}
                      .value=${interval.match_state || ""}
                      .selector=${{text: {}}}
                      @value-changed=${(e) => this._updateEntityIntervalField(rowIdx, entIdx, iIdx, "match_state", e.detail.value, menuId)}
                    ></ha-selector>
                    ${this._renderFieldHelp(
                      "Displayed state text",
                      "State label replaces the displayed value. Suffix text is appended and supports: <state>, <unit>, <dimmer_pct>, <source>, <title>, <artist>, <album>, <title_artist>."
                    )}
                    <div class="two-col">
                      <ha-selector .hass=${this.hass} .label=${"State label (optional)"}
                        .value=${interval.state_text || ""}
                        .selector=${{text: {}}}
                        @value-changed=${(e) => this._updateEntityIntervalField(rowIdx, entIdx, iIdx, "state_text", e.detail.value, menuId)}
                      ></ha-selector>
                      <ha-selector .hass=${this.hass} .label=${"Suffix text (supports variables)"}
                        .value=${interval.suffix_text || ""}
                        .selector=${{text: {}}}
                        @value-changed=${(e) => this._updateEntityIntervalField(rowIdx, entIdx, iIdx, "suffix_text", e.detail.value, menuId)}
                      ></ha-selector>
                    </div>
                    <div class="action-row">
                      <ha-button class="danger" @click=${() => {
                        this._requestDelete(`button color interval ${iIdx + 1}`, "", () => {
                          ent.color_intervals.splice(iIdx, 1);
                          this._emitConfigChanged();
                        });
                      }}>Delete interval</ha-button>
                    </div>
                  </div>
                </ha-expansion-panel>
              `)}
              <div class="action-row">
                <ha-button @click=${() => {
                  if (!ent.color_intervals) ent.color_intervals = [];
                  ent.color_intervals.push({
                    from: 0, to: 10,
                    color_from: "#1E88E5", color_to: "#1E88E5",
                    text_color: "#FFFFFF",
                    shadow_color: "",
                    override_theme_colors: true,
                    override_theme_text_color: true,
                    match_state: "", state_text: "", suffix_text: "",
                  });
                  this.requestUpdate(); this._emitConfigChanged();
                }}>Add interval</ha-button>
              </div>
            ` : ""}

            ${!isMenu && !isNavigation ? html`
              <div class="subsection-title">Tap action</div>
              ${this._renderFieldHelp(
                "Tap action",
                "Default chooses a sensible action from the entity domain. Override it to toggle, show More info, navigate, open a URL, call a service, or deliberately do nothing."
              )}
              ${this._renderTapActionEditor(ent, ent.tap_action)}
            ` : ""}

            <div class="subsection-title">Badges</div>
            ${this._renderFieldHelp(
              "Button badges",
              "Badges add compact secondary information or controls below the main button value. Each badge can use its own entity, type, icon, label and text/icon size."
            )}
            ${badges.length ? this._renderSelect("Badge style for this button", ent.badge_style || "inherit",
              [["inherit","Inherit theme/global"],["pill","Pill"],["pill-strong","Pill strong"],["chip","Chip"],["underline","Underline"],["none","None"]],
              (value) => {
                ent.badge_style = value || "inherit";
                this.requestUpdate();
                this._emitConfigChanged();
              }
            ) : ""}
            ${badges.map((b, bIdx) => this._renderBadge(badges, b, bIdx, scopeKey, rowIdx, entIdx))}
            <div class="action-row">
              <ha-button @click=${() => {
                if (!ent.badges) ent.badges = [];
                ent.badges.push({
                  entity: "", icon: "", label: "", show_icon: true,
                  font_size: 11, icon_size: 18,
                  badge_type: "value", stats_mode: "max", stats_hours: 24,
                  media_action: "play_pause", media_info_mode: "title_artist",
                  alarm_action: "arm_home", alarm_code: "",
                });
                this.requestUpdate(); this._emitConfigChanged();
              }}>Add badge</ha-button>
            </div>

            <div class="action-row">
              <ha-button @click=${() => this._duplicateButton(rowIdx, entIdx, menuId)}>
                Duplicate button
              </ha-button>
              ${entIdx > 0 ? html`<ha-button @click=${() => {
                [entities[entIdx - 1], entities[entIdx]] = [entities[entIdx], entities[entIdx - 1]];
                this.requestUpdate(); this._emitConfigChanged();
              }}>Move up</ha-button>` : ""}
              ${entIdx < entities.length - 1 ? html`<ha-button @click=${() => {
                [entities[entIdx + 1], entities[entIdx]] = [entities[entIdx], entities[entIdx + 1]];
                this.requestUpdate(); this._emitConfigChanged();
              }}>Move down</ha-button>` : ""}
              <ha-button class="danger" @click=${() => {
                this._requestDelete(`button “${ent.name || ent.entity || entIdx + 1}”`, `${badges.length} badge(s) will also be removed.`, () => {
                  entities.splice(entIdx, 1);
                  this._emitConfigChanged();
                });
              }}>Delete button</ha-button>
            </div>
          </div>
        </details>
      `;
    }

    _renderTapActionEditor(ent, tapAction) {
      const action = tapAction?.action || "default";
      const update = (field, value) => {
        if (!ent.tap_action) ent.tap_action = {};
        if (value === "" || value === undefined || value === null) {
          delete ent.tap_action[field];
        } else {
          ent.tap_action[field] = value;
        }
        if (ent.tap_action.action === "default") {
          delete ent.tap_action;
        }
        this._emitConfigChanged();
      };

      return html`
        ${this._renderSelect("Action", action,
          [
            ["default", "Default (auto by domain)"],
            ["toggle", "Toggle"],
            ["more-info", "More info"],
            ["navigate", "Navigate"],
            ["url", "Open URL"],
            ["call-service", "Call service"],
            ["none", "None"],
          ],
          (v) => update("action", v)
        )}
        ${action === "navigate" ? html`
          <ha-selector .hass=${this.hass} .label=${"Navigation path (e.g. /lovelace/home)"}
            .value=${tapAction?.navigation_path || ""}
            .selector=${{text: {}}}
            @value-changed=${(e) => update("navigation_path", e.detail.value)}
          ></ha-selector>
        ` : ""}
        ${action === "url" ? html`
          <ha-selector .hass=${this.hass} .label=${"URL"}
            .value=${tapAction?.url_path || ""}
            .selector=${{text: {}}}
            @value-changed=${(e) => update("url_path", e.detail.value)}
          ></ha-selector>
        ` : ""}
        ${action === "call-service" ? html`
          ${this._renderFieldHelp(
            "Service call",
            "Enter a service such as light.turn_on. Service data must be valid JSON; the button entity_id is added automatically unless your JSON supplies other targets."
          )}
          <ha-selector .hass=${this.hass} .label=${"Service (e.g. light.turn_on)"}
            .value=${tapAction?.service || ""}
            .selector=${{text: {}}}
            @value-changed=${(e) => update("service", e.detail.value)}
          ></ha-selector>
          <ha-selector .hass=${this.hass} .label=${"Service data (JSON, entity_id added automatically)"}
            .value=${tapAction?.service_data
              ? (typeof tapAction.service_data === "object"
                  ? JSON.stringify(tapAction.service_data)
                  : tapAction.service_data)
              : ""}
            .selector=${{text: {}}}
            @value-changed=${(e) => {
              const raw = e.detail.value;
              if (!raw) { update("service_data", undefined); return; }
              try { update("service_data", JSON.parse(raw)); }
              catch (_) { update("service_data", raw); }
            }}
          ></ha-selector>
        ` : ""}
      `;
    }

    _renderBadge(badges, b, bIdx, scopeKey, rowIdx, entIdx) {
      const showIcon = b.show_icon !== false;
      const type = b.badge_type || "value";
      const typeLabels = {
        value: "Value",
        dimmer: "Dimmer",
        stats: "Statistics",
        media: "Media control",
        media_info: "Media information",
        alarm: "Alarm control",
      };
      const mediaActionLabels = {
        play_pause: "Play/Pause",
        play: "Play",
        pause: "Pause",
        stop: "Stop",
        next: "Next track",
        previous: "Previous track",
        volume_up: "Volume up",
        volume_down: "Volume down",
        mute_toggle: "Mute toggle",
      };
      const mediaActionIcons = {
        play_pause: "mdi:play-pause",
        play: "mdi:play",
        pause: "mdi:pause",
        stop: "mdi:stop",
        next: "mdi:skip-next",
        previous: "mdi:skip-previous",
        volume_up: "mdi:volume-plus",
        volume_down: "mdi:volume-minus",
        mute_toggle: "mdi:volume-mute",
      };
      const typeIcons = {
        value: "mdi:numeric",
        dimmer: "mdi:brightness-6",
        stats: "mdi:chart-line",
        media: mediaActionIcons[b.media_action || "play_pause"] || "mdi:play-circle-outline",
        media_info: "mdi:music-note",
        alarm: "mdi:shield-home-outline",
      };
      const humanize = (value) => String(value || "")
        .replaceAll("_", " ")
        .replace(/^./, (letter) => letter.toUpperCase());
      const variantLabel = type === "media"
        ? mediaActionLabels[b.media_action || "play_pause"]
        : type === "stats"
          ? `${humanize(b.stats_mode || "max")} · ${b.stats_hours ?? 24} h`
          : type === "media_info"
            ? humanize(b.media_info_mode || "title_artist").replaceAll(" ", " + ")
            : type === "alarm"
              ? humanize(b.alarm_action || "arm_home")
              : "";
      const friendlyName = b.entity
        ? this.hass?.states?.[b.entity]?.attributes?.friendly_name || ""
        : "";
      const primaryLabel = b.label || friendlyName || b.entity || typeLabels[type] || `Badge ${bIdx + 1}`;
      const detailParts = [typeLabels[type] || type, variantLabel, b.entity || "No entity selected"].filter(Boolean);
      const editorIcon = b.icon || typeIcons[type] || "mdi:label-outline";

      return html`
        <ha-expansion-panel class="badge-editor-panel">
          <div slot="header" class="badge-editor-header">
            <ha-icon .icon=${editorIcon}></ha-icon>
            <div class="badge-editor-header-copy">
              <b>Badge ${bIdx + 1} — ${primaryLabel}</b>
              <span>${detailParts.join(" · ")}</span>
            </div>
          </div>
          <div class="expansion-content">
            ${this._renderFieldHelp(
              "Badge source and type",
              "Select the entity the badge reads or controls. Value displays its state; Dimmer controls light brightness; Stats reads history; Media and Alarm provide specialized controls or information."
            )}
            <div class="picker-label">Badge entity</div>
            <div class="badge-entity-picker-placeholder" id=${`badge-entity-picker-${scopeKey}-${rowIdx}-${entIdx}-${bIdx}`}></div>

            ${this._renderSelect("Badge type", type,
              [["value","Value"],["dimmer","Dimmer (lights)"],["stats","Stats (history)"],
               ["media","Media control"],["media_info","Media info"],["alarm","Alarm control"]],
              (v) => { badges[bIdx].badge_type = v || "value"; this.requestUpdate(); this._emitConfigChanged(); }
            )}

            ${type === "stats" ? html`
              ${this._renderFieldHelp(
                "Statistics badge",
                "Choose which historical value to calculate and how many previous hours should be included."
              )}
              <div class="two-col">
                ${this._renderSelect("Stats mode", b.stats_mode || "max",
                  [["min","Min"],["max","Max"],["avg","Average"],
                   ["last_on","Last on"],["last_off","Last off"],["last_changed","Last changed"]],
                  (v) => { badges[bIdx].stats_mode = v || "max"; this.requestUpdate(); this._emitConfigChanged(); }
                )}
                <ha-selector .hass=${this.hass} .label=${"History window (hours)"}
                  .value=${b.stats_hours ?? 24}
                  .selector=${{number: {min: 1, step: 1, mode: "box"}}}
                  @value-changed=${(e) => {
                    badges[bIdx].stats_hours = Number(e.detail.value);
                    this.requestUpdate();
                    this._emitConfigChanged();
                  }}
                ></ha-selector>
              </div>
            ` : ""}

            ${type === "media" ? html`
              ${this._renderSelect("Media action", b.media_action || "play_pause",
                [["play_pause","Play/Pause"],["play","Play"],["pause","Pause"],["stop","Stop"],
                 ["next","Next track"],["previous","Previous track"],
                 ["volume_up","Volume up"],["volume_down","Volume down"],["mute_toggle","Mute toggle"]],
                (v) => { badges[bIdx].media_action = v || "play_pause"; this.requestUpdate(); this._emitConfigChanged(); }
              )}
            ` : ""}

            ${type === "media_info" ? html`
              ${this._renderSelect("Media info mode", b.media_info_mode || "title_artist",
                [["title","Title"],["artist","Artist"],["album","Album"],
                 ["source","Source"],["title_artist","Title + artist"]],
                (v) => { badges[bIdx].media_info_mode = v || "title_artist"; this.requestUpdate(); this._emitConfigChanged(); }
              )}
            ` : ""}

            ${type === "alarm" ? html`
              <div class="two-col">
                ${this._renderSelect("Alarm action", b.alarm_action || "arm_home",
                  [["arm_home","Arm home"],["arm_away","Arm away"],
                   ["arm_night","Arm night"],["disarm","Disarm"]],
                  (v) => { badges[bIdx].alarm_action = v || "arm_home"; this.requestUpdate(); this._emitConfigChanged(); }
                )}
                <ha-selector .hass=${this.hass} .label=${"Alarm code (optional)"}
                  .value=${b.alarm_code || ""}
                  .selector=${{text: {}}}
                  @value-changed=${(e) => { badges[bIdx].alarm_code = e.detail.value; this._emitConfigChanged(); }}
                ></ha-selector>
              </div>
            ` : ""}

            <div class="toggle-row">
              <span class="picker-label">Show icon</span>
              <ha-switch .checked=${showIcon}
                @change=${(e) => { badges[bIdx].show_icon = e.target.checked; this._emitConfigChanged(); }}
              ></ha-switch>
            </div>

            ${this._renderFieldHelp(
              "Badge appearance and formatting",
              "Icon size and Font size are measured in pixels. Decimal places and Unit override the entity or global formatting only for this badge."
            )}
            <div class="three-col">
              ${showIcon ? html`
                <ha-icon-picker label="Icon" .hass=${this.hass} .value=${b.icon || ""}
                  @value-changed=${(e) => { badges[bIdx].icon = e.detail.value; this.requestUpdate(); this._emitConfigChanged(); }}
                  @closed=${this._stopPropagation}
                ></ha-icon-picker>
              ` : ""}
              <ha-selector .hass=${this.hass} .label=${"Label"}
                .value=${b.label || ""}
                .selector=${{text: {}}}
                @value-changed=${(e) => { badges[bIdx].label = e.detail.value; this.requestUpdate(); this._emitConfigChanged(); }}
              ></ha-selector>
              ${showIcon ? html`
                <ha-selector .hass=${this.hass} .label=${"Icon size (px)"}
                  .value=${b.icon_size ?? 18}
                  .selector=${{number: {min: 8, max: 64, step: 1, mode: "box"}}}
                  @value-changed=${(e) => {
                    const raw = e.detail.value;
                    badges[bIdx].icon_size =
                      raw === "" || raw === null || raw === undefined ? undefined : Number(raw);
                    this._emitConfigChanged();
                  }}
                ></ha-selector>
              ` : ""}
            </div>

            <div class="three-col">
              <ha-selector .hass=${this.hass} .label=${"Decimal places (leave blank to use entity/global)"}
                .value=${b.decimal_places ?? ""}
                .selector=${{number: {min: 0, max: 6, step: 1, mode: "box"}}}
                @value-changed=${(e) => {
                  const raw = e.detail.value;
                  badges[bIdx].decimal_places =
                    raw === "" || raw === null || raw === undefined ? undefined : Number(raw);
                  this._emitConfigChanged();
                }}
              ></ha-selector>
              <ha-selector .hass=${this.hass} .label=${"Unit (leave blank to use entity unit)"}
                .value=${b.unit !== undefined ? b.unit : ""}
                .selector=${{text: {}}}
                @value-changed=${(e) => {
                  const raw = e.detail.value;
                  badges[bIdx].unit = raw === "" ? undefined : raw;
                  this._emitConfigChanged();
                }}
              ></ha-selector>
              <ha-selector .hass=${this.hass} .label=${"Font size (px)"}
                .value=${b.font_size ?? 11}
                .selector=${{number: {min: 7, max: 40, step: 1, mode: "box"}}}
                @value-changed=${(e) => {
                  const raw = e.detail.value;
                  badges[bIdx].font_size =
                    raw === "" || raw === null || raw === undefined ? undefined : Number(raw);
                  this._emitConfigChanged();
                }}
              ></ha-selector>
            </div>

            <div class="action-row">
              <ha-button @click=${() => this._duplicateBadge(badges, bIdx)}>
                Duplicate badge
              </ha-button>
              <ha-button class="danger" @click=${() => {
                this._requestDelete(`badge “${b.label || b.entity || bIdx + 1}”`, "", () => {
                  badges.splice(bIdx, 1);
                  this._emitConfigChanged();
                });
              }}>Delete badge</ha-button>
            </div>
          </div>
        </ha-expansion-panel>
      `;
    }

    _css() {
      return css`
        :host { display: block; }
        .editor-wrap {
          display:flex;
          flex-direction:column;
          gap:10px;
          padding:8px 0;
          container-type:inline-size;
        }

        .editor-top-title {
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid color-mix(in srgb, var(--warning-color, #ff9800) 55%, transparent);
          background: color-mix(in srgb, var(--warning-color, #ff9800) 22%, transparent);
          color: var(--primary-text-color);
          font-weight: 800;
          letter-spacing: .2px;
        }
        .editor-doc-link {
          display:inline-flex;
          align-items:center;
          gap:6px;
          width:fit-content;
          margin-top:5px;
          color:var(--primary-color, #03a9f4);
          font-size:11px;
          font-weight:600;
          line-height:1.3;
          text-decoration:none;
        }
        .editor-doc-link:hover { text-decoration:underline; }
        .editor-doc-link ha-icon {
          width:15px;
          height:15px;
          --mdc-icon-size:15px;
        }

        ha-selector {
          display:block;
          min-width:0;
          max-width:100%;
          box-sizing:border-box;
          margin-bottom:12px;
        }
        ha-icon-picker { display: block; margin-bottom: 12px; }
        ha-expansion-panel { display: block; margin-bottom: 8px; }

        .section {
          display:block;
          padding:0;
          border:0;
          border-radius:13px;
        }
        .section-summary {
          display:block;
          list-style:none;
          cursor:pointer;
          border-radius:12px;
        }
        .section-summary::-webkit-details-marker { display:none; }
        .section-summary:focus-visible {
          outline:2px solid var(--primary-color, #03a9f4);
          outline-offset:2px;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          background: color-mix(in srgb, var(--warning-color, #ff9800) 22%, transparent);
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid color-mix(in srgb, var(--warning-color, #ff9800) 55%, transparent);
          font-weight: 800;
          opacity: .98;
          color: var(--primary-text-color);
          letter-spacing: .2px;
          transition:background .16s ease, border-color .16s ease, box-shadow .16s ease;
        }
        .section-summary:hover .section-title {
          background:color-mix(in srgb, var(--warning-color, #ff9800) 29%, transparent);
        }
        .editor-section[open] > .section-summary .section-title {
          border-color:color-mix(in srgb, var(--warning-color, #ff9800) 72%, transparent);
          box-shadow:0 4px 14px rgba(0,0,0,.12);
        }
        .section-title ha-icon {
          width: 20px;
          height: 20px;
          color: var(--warning-color, #ff9800);
        }
        .section-title-label {
          flex:1 1 auto;
          min-width:0;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .section-count {
          margin-left:auto;
          padding:2px 7px;
          border-radius:999px;
          background:rgba(127,127,127,.16);
          color:var(--secondary-text-color);
          font-size:10px;
          font-weight:700;
          white-space:nowrap;
        }
        .section-title .section-chevron {
          width:18px;
          height:18px;
          --mdc-icon-size:18px;
          color:var(--secondary-text-color);
          transition:transform .18s ease;
        }
        .editor-section[open] > .section-summary .section-chevron { transform:rotate(180deg); }
        .section-body {
          display:flex;
          flex-direction:column;
          gap:10px;
          padding:11px 4px 2px;
        }
        .section-note {
          font-size: 12px;
          color: var(--secondary-text-color);
          line-height: 1.5;
        }

        .subsection-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--primary-text-color);
          margin: 20px 0 10px 0;
          padding-left: 8px;
          border-left: 3px solid var(--primary-color);
        }

        .expansion-content { padding: 12px; }
        .row-buttons-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--secondary-text-color);
          letter-spacing: .04em;
          text-transform: uppercase;
          margin: 4px 0 8px;
        }

        .button-details {
          display: block;
          margin: 0 0 10px;
          border: 1px solid var(--divider-color, rgba(127,127,127,.25));
          border-radius: 15px;
          overflow: hidden;
          background: color-mix(in srgb, var(--card-background-color, #fff) 96%, var(--primary-color, #03a9f4));
        }
        .button-details > summary {
          display: block;
          cursor: pointer;
          list-style: none;
          padding: 8px;
        }
        .button-details > summary::-webkit-details-marker { display:none; }
        .button-details[open] > summary {
          border-bottom: 1px solid var(--divider-color, rgba(127,127,127,.25));
        }
        .button-preview {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 52px;
          padding: 10px 12px;
          box-sizing: border-box;
          border-radius: var(--preview-radius, 12px);
          border: var(--preview-border-width, 0px) solid var(--preview-border, transparent);
          color: var(--preview-text, #fff);
          background: linear-gradient(135deg, var(--preview-from, #1E88E5), var(--preview-to, #1E88E5));
          box-shadow: var(--preview-shadow, 0 3px 10px rgba(0,0,0,.22));
        }
        .button-preview > ha-icon {
          width:var(--preview-icon-size, 20px);
          height:var(--preview-icon-size, 20px);
          --mdc-icon-size:var(--preview-icon-size, 20px);
          flex:0 0 var(--preview-icon-size, 20px);
          color:inherit !important;
          --icon-primary-color:currentColor;
        }
        .button-preview-flat {
          border:0;
          border-radius:10px;
          color:var(--primary-text-color);
          background:transparent;
          box-shadow:none;
          box-shadow:inset 3px 0 0 color-mix(in srgb, var(--preview-from, var(--primary-color, #03a9f4)) 75%, transparent);
        }
        .button-preview-flat .button-preview-badges span {
          background:rgba(127,127,127,.12);
          border-color:rgba(127,127,127,.18);
        }
        .button-preview-flat.button-preview-rail > ha-icon {
          box-sizing:content-box;
          padding:9px;
          border-radius:12px;
          background:color-mix(
            in srgb,
            var(--preview-from, var(--primary-color, #03a9f4)) 24%,
            var(--card-background-color, #1c1c1c)
          );
        }
        .button-preview-type {
          position: absolute;
          top: 7px;
          right: 7px;
          width: 12px;
          height: 12px;
          display: grid;
          place-items: center;
          background: transparent;
          border: 0;
          color: inherit;
          opacity: .28;
          filter: saturate(.7);
          overflow: hidden;
          contain: paint;
          pointer-events: none;
        }
        .button-preview-type ha-icon {
          display: block;
          width: 9px;
          height: 9px;
          --mdc-icon-size: 9px;
          line-height: 9px;
        }
        .button-preview-copy { flex: 1 1 auto; min-width: 0; }
        .button-preview-name { font-size: 14px; font-weight: 800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .button-preview-subtitle { font-size: 11px; opacity: .86; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .button-preview-badges { display:flex; flex-wrap:wrap; gap:4px; margin-top:5px; }
        .button-preview-badges span {
          font-size: 9px;
          padding: 2px 6px;
          border-radius: 999px;
          background: rgba(255,255,255,.18);
          border: 1px solid rgba(255,255,255,.2);
        }
        .preview-badge-pill-strong span {
          background:rgba(0,0,0,.34);
          box-shadow:0 1px 3px rgba(0,0,0,.25);
        }
        .preview-badge-chip span { border-radius:4px; }
        .preview-badge-underline span {
          padding:1px 0;
          border:0;
          border-bottom:1px solid currentColor;
          border-radius:0;
          background:transparent;
        }
        .preview-badge-none span {
          padding:0;
          border:0;
          border-radius:0;
          background:transparent;
        }
        .button-preview-value {
          flex: 0 0 auto;
          font-size: 16px;
          font-weight: 800;
          white-space: nowrap;
          margin-right: 13px;
        }
        .button-preview-no-label {
          justify-content:center;
        }
        .button-preview-no-label .button-preview-copy {
          flex:0 1 auto;
        }
        .button-preview-no-label .button-preview-value {
          margin-right:0;
          text-align:center;
        }
        .button-preview-icon-only .button-preview-main-icon {
          margin-inline:auto;
        }
        .button-preview-icon-only .preview-chevron {
          position:absolute;
          right:12px;
        }
        .preview-chevron { transition: transform .18s ease; }
        .button-details[open] .preview-chevron { transform: rotate(180deg); }

        .menu-settings,
        .navigation-settings {
          margin: 0 0 12px;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid color-mix(in srgb, var(--primary-color, #03a9f4) 35%, transparent);
          background: color-mix(in srgb, var(--primary-color, #03a9f4) 8%, transparent);
        }
        .navigation-default-toggle {
          margin-bottom:10px;
        }
        .conditional-settings-title {
          display:flex;
          align-items:flex-start;
          gap:9px;
          padding:0 0 10px;
          margin:0 0 11px;
          border-bottom:1px solid color-mix(in srgb, var(--primary-color, #03a9f4) 24%, transparent);
        }
        .conditional-settings-title > ha-icon {
          width:20px;
          height:20px;
          --mdc-icon-size:20px;
          flex:0 0 20px;
          color:var(--primary-color, #03a9f4);
        }
        .conditional-settings-title > div {
          display:flex;
          flex-direction:column;
          gap:2px;
          min-width:0;
        }
        .conditional-settings-title b {
          color:var(--primary-text-color);
          font-size:13px;
        }
        .conditional-settings-title span {
          color:var(--secondary-text-color);
          font-size:10px;
          line-height:1.4;
        }
        .field-help {
          display:flex;
          align-items:flex-start;
          gap:7px;
          margin:11px 0 6px;
          padding:7px 9px;
          border-left:3px solid color-mix(in srgb, var(--primary-color, #03a9f4) 75%, transparent);
          border-radius:7px;
          background:color-mix(in srgb, var(--primary-color, #03a9f4) 7%, transparent);
          color:var(--secondary-text-color);
          font-size:10px;
          line-height:1.45;
        }
        .field-help > ha-icon {
          width:16px;
          height:16px;
          --mdc-icon-size:16px;
          flex:0 0 16px;
          color:var(--primary-color, #03a9f4);
        }
        .field-help > div {
          display:flex;
          flex-direction:column;
          gap:1px;
          min-width:0;
        }
        .field-help b {
          color:var(--primary-text-color);
          font-size:10px;
        }
        .quickboard-id-box {
          display:grid;
          grid-template-columns:minmax(0, 1fr) auto;
          align-items:center;
          gap:8px;
          margin:-3px 0 16px;
          padding:8px 10px;
          border:1px solid var(--divider-color);
          border-radius:10px;
          background:rgba(127,127,127,.07);
        }
        .quickboard-id-box code {
          min-width:0;
          overflow-wrap:anywhere;
          color:var(--primary-text-color);
          font-size:11px;
          user-select:all;
        }
        .quickboard-id-box ha-button {
          zoom:.84;
          --mdc-typography-button-font-size:11px;
        }
        .menu-help-details {
          display:block;
          overflow:hidden;
          border:1px solid color-mix(in srgb, var(--info-color, #039be5) 34%, transparent);
          border-radius:12px;
          background:color-mix(in srgb, var(--info-color, #039be5) 5%, transparent);
        }
        .menu-help-details > summary {
          display:flex;
          align-items:center;
          gap:8px;
          min-height:38px;
          padding:7px 10px;
          box-sizing:border-box;
          list-style:none;
          cursor:pointer;
          color:var(--primary-text-color);
          font-size:12px;
          font-weight:800;
        }
        .menu-help-details > summary::-webkit-details-marker { display:none; }
        .menu-help-details > summary:hover { background:color-mix(in srgb, var(--info-color, #039be5) 10%, transparent); }
        .menu-help-details > summary > ha-icon:first-child {
          width:17px;
          height:17px;
          --mdc-icon-size:17px;
          color:var(--info-color, #039be5);
          flex:0 0 17px;
        }
        .menu-help-details > summary small {
          margin-left:auto;
          color:var(--secondary-text-color);
          font-size:10px;
          font-weight:600;
        }
        .menu-help-details .help-chevron {
          width:16px;
          height:16px;
          --mdc-icon-size:16px;
          color:var(--secondary-text-color);
          transition:transform .18s ease;
        }
        .menu-help-details[open] .help-chevron { transform:rotate(180deg); }
        .menu-help-details[open] > summary small { display:none; }
        .menu-guide {
          padding: 13px 14px;
          border-radius: 14px;
          border: 1px solid color-mix(in srgb, var(--info-color, #039be5) 38%, transparent);
          background: color-mix(in srgb, var(--info-color, #039be5) 10%, transparent);
          color: var(--primary-text-color);
          font-size: 12px;
          line-height: 1.5;
        }
        .menu-help-details .menu-guide {
          border:0;
          border-top:1px solid color-mix(in srgb, var(--info-color, #039be5) 25%, transparent);
          border-radius:0;
        }
        .menu-guide-title {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 14px;
          font-weight: 800;
          margin-bottom: 7px;
        }
        .menu-guide-title ha-icon { width:20px; height:20px; color:var(--info-color, #039be5); }
        .menu-guide ol { margin: 0; padding-left: 21px; }
        .menu-guide li { margin: 0 0 5px; }
        .menu-guide-tip {
          margin-top: 9px;
          padding-top: 9px;
          border-top: 1px solid color-mix(in srgb, var(--info-color, #039be5) 28%, transparent);
          color: var(--secondary-text-color);
        }
        .menu-index {
          padding: 11px;
          border-radius: 13px;
          border: 1px solid var(--divider-color, rgba(127,127,127,.22));
          background: rgba(127,127,127,.05);
        }
        .menu-index-title, .menu-usage-title {
          display:flex;
          align-items:center;
          gap:8px;
          font-weight:800;
          font-size:12px;
          margin-bottom:8px;
        }
        .menu-index-title ha-icon, .menu-usage-title ha-icon {
          display:block;
          width:16px;
          height:16px;
          --mdc-icon-size:16px;
          flex:0 0 16px;
          opacity:.78;
        }
        .menu-quicklinks { display:flex; flex-wrap:wrap; gap:7px; }
        .menu-quicklinks button {
          appearance:none;
          border:1px solid color-mix(in srgb, var(--primary-color, #03a9f4) 35%, transparent);
          background:color-mix(in srgb, var(--primary-color, #03a9f4) 10%, transparent);
          color:var(--primary-text-color);
          border-radius:999px;
          padding:6px 10px;
          display:inline-flex;
          align-items:center;
          gap:7px;
          font:inherit;
          font-size:11px;
          cursor:pointer;
        }
        .menu-quicklinks button ha-icon {
          display:block;
          width:14px;
          height:14px;
          --mdc-icon-size:14px;
          flex:0 0 14px;
          opacity:.72;
        }
        .menu-quicklinks button small {
          min-width:16px;
          height:16px;
          border-radius:999px;
          display:grid;
          place-items:center;
          background:rgba(127,127,127,.18);
          font-size:9px;
        }
        .menu-group {
          padding:10px;
          border-radius:14px;
          border:1px solid var(--divider-color, rgba(127,127,127,.22));
          background:rgba(127,127,127,.035);
        }
        .menu-group-title {
          display:flex;
          align-items:center;
          gap:7px;
          font-size:12px;
          font-weight:800;
          color:var(--secondary-text-color);
          margin-bottom:10px;
          padding-bottom:8px;
          border-bottom:1px solid var(--divider-color, rgba(127,127,127,.18));
        }
        .menu-group-title ha-icon {
          display:block;
          width:18px;
          height:18px;
          --mdc-icon-size:18px;
          flex:0 0 18px;
        }
        .menu-group-title span { margin-left:auto; padding:2px 7px; border-radius:999px; background:rgba(127,127,127,.12); }
        .menu-editor-panel,
        .row-editor-panel,
        .interval-editor-panel,
        .theme-editor-panel,
        .badge-editor-panel {
          display:block;
          overflow:hidden;
          border:1px solid color-mix(in srgb, var(--primary-color, #03a9f4) 28%, var(--divider-color, rgba(127,127,127,.22)));
          border-left:3px solid color-mix(in srgb, var(--primary-color, #03a9f4) 72%, transparent);
          border-radius:12px;
          background:color-mix(in srgb, var(--card-background-color, #fff) 97%, var(--primary-color, #03a9f4));
          box-shadow:0 2px 8px rgba(0,0,0,.07);
          margin:0 0 10px;
        }
        .menu-editor-panel + .menu-editor-panel,
        .row-editor-panel + .row-editor-panel,
        .interval-editor-panel + .interval-editor-panel,
        .theme-editor-panel + .theme-editor-panel,
        .badge-editor-panel + .badge-editor-panel { margin-top:10px; }
        .row-editor-panel {
          border-color:color-mix(in srgb, var(--warning-color, #ff9800) 25%, var(--divider-color, rgba(127,127,127,.22)));
          border-left-color:color-mix(in srgb, var(--warning-color, #ff9800) 70%, transparent);
          background:color-mix(in srgb, var(--card-background-color, #fff) 98%, var(--warning-color, #ff9800));
        }
        .interval-editor-panel {
          border-color:color-mix(in srgb, var(--info-color, #039be5) 28%, var(--divider-color, rgba(127,127,127,.22)));
          border-left-color:color-mix(in srgb, var(--info-color, #039be5) 75%, transparent);
          background:color-mix(in srgb, var(--card-background-color, #fff) 98%, var(--info-color, #039be5));
        }
        .theme-editor-panel {
          border-color:color-mix(in srgb, var(--warning-color, #ff9800) 30%, var(--divider-color, rgba(127,127,127,.22)));
          border-left-color:color-mix(in srgb, var(--warning-color, #ff9800) 76%, transparent);
          background:color-mix(in srgb, var(--card-background-color, #fff) 96%, var(--warning-color, #ff9800));
        }
        .badge-editor-panel {
          border-color:color-mix(in srgb, var(--accent-color, #7e57c2) 30%, var(--divider-color, rgba(127,127,127,.22)));
          border-left-color:color-mix(in srgb, var(--accent-color, #7e57c2) 76%, transparent);
          background:color-mix(in srgb, var(--card-background-color, #fff) 97%, var(--accent-color, #7e57c2));
        }
        .menu-editor-panel:hover,
        .row-editor-panel:hover,
        .interval-editor-panel:hover,
        .theme-editor-panel:hover,
        .badge-editor-panel:hover { box-shadow:0 4px 13px rgba(0,0,0,.11); }
        .menu-usage-box {
          padding:10px;
          margin:0 0 12px;
          border-radius:12px;
          border:1px solid color-mix(in srgb, var(--primary-color, #03a9f4) 26%, transparent);
          background:color-mix(in srgb, var(--primary-color, #03a9f4) 6%, transparent);
        }
        .menu-usage-links { display:flex; flex-wrap:wrap; gap:6px; }
        .menu-usage-links span { padding:4px 7px; border-radius:8px; background:rgba(127,127,127,.11); font-size:10px; }
        .menu-color-help { margin: -2px 0 6px; }
        .compact-toggle { margin: 0; padding: 8px 0; }
        .content-toggle-grid {
          margin-bottom:12px;
        }
        .content-toggle-grid .toggle-row {
          min-width:0;
          margin:0;
          padding:6px 0;
          border-bottom:0;
          gap:8px;
        }
        .content-toggle-grid .picker-label {
          margin:0;
        }
        .interval-theme-overrides {
          display:grid;
          grid-template-columns:repeat(2, minmax(0, 1fr));
          gap:8px;
          margin:2px 0 12px;
        }
        .interval-theme-context {
          grid-column:1 / -1;
          display:flex;
          align-items:flex-start;
          gap:8px;
          padding:9px 10px;
          border-radius:10px;
          background:color-mix(in srgb, var(--warning-color, #ff9800) 10%, transparent);
          color:var(--secondary-text-color);
          font-size:10px;
          line-height:1.4;
        }
        .interval-theme-context ha-icon {
          display:block;
          width:17px;
          height:17px;
          --mdc-icon-size:17px;
          flex:0 0 17px;
          color:var(--warning-color, #ff9800);
        }
        .interval-theme-context div { display:flex; flex-direction:column; gap:2px; }
        .interval-theme-context b { color:var(--primary-text-color); font-size:11px; }
        .toggle-row.interval-theme-toggle {
          gap:10px;
          margin:0;
          padding:7px 2px;
          border:0;
          border-radius:0;
          background:transparent;
        }
        .interval-theme-toggle .picker-label {
          margin:0;
          color:var(--primary-text-color);
          font-size:12px;
          font-weight:700;
        }
        .required-control {
          display:inline-flex;
          align-items:center;
          gap:5px;
          padding:4px 8px;
          border-radius:999px;
          background:color-mix(in srgb, var(--primary-color, #03a9f4) 12%, transparent);
          color:var(--secondary-text-color);
          font-size:11px;
          font-weight:700;
          white-space:nowrap;
        }
        .required-control ha-icon {
          display:block;
          width:13px;
          height:13px;
          --mdc-icon-size:13px;
          flex:0 0 13px;
        }
        .menu-editor-content { border-left:0; }
        .menu-editor-panel > .expansion-content,
        .row-editor-panel > .expansion-content,
        .interval-editor-panel > .expansion-content,
        .theme-editor-panel > .expansion-content,
        .badge-editor-panel > .expansion-content {
          border-top:1px solid var(--divider-color, rgba(127,127,127,.2));
        }

        .theme-manager {
          padding:12px;
          border-radius:14px;
          border:1px solid color-mix(in srgb, var(--warning-color, #ff9800) 35%, transparent);
          background:color-mix(in srgb, var(--warning-color, #ff9800) 6%, transparent);
        }
        .theme-manager > .subsection-title { margin-top:0; }
        .theme-list { display:flex; flex-direction:column; gap:0; }
        .color-preview-panel::part(summary) {
          color:var(--panel-preview-text, #fff);
          background:linear-gradient(
            135deg,
            var(--panel-preview-from, #1E88E5),
            var(--panel-preview-to, var(--panel-preview-from, #1E88E5))
          );
        }
        .color-preview-header {
          display:flex;
          align-items:center;
          gap:8px;
          flex:1 1 auto;
          min-width:0;
          width:100%;
          color:var(--panel-preview-text, #fff) !important;
          font-weight:800;
        }
        .color-preview-header span {
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .theme-preview-header ha-icon {
          display:block;
          width:18px;
          height:18px;
          --mdc-icon-size:18px;
          flex:0 0 18px;
          color:inherit;
        }
        .badge-editor-header {
          display:flex;
          align-items:center;
          gap:9px;
          flex:1 1 auto;
          min-width:0;
          width:100%;
        }
        .badge-editor-header > ha-icon {
          display:block;
          width:20px;
          height:20px;
          --mdc-icon-size:20px;
          flex:0 0 20px;
          color:var(--accent-color, #7e57c2);
        }
        .badge-editor-header-copy {
          display:flex;
          flex-direction:column;
          gap:2px;
          flex:1 1 auto;
          min-width:0;
        }
        .badge-editor-header-copy b,
        .badge-editor-header-copy span {
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .badge-editor-header-copy b {
          color:var(--primary-text-color);
          font-size:12px;
          line-height:1.25;
        }
        .badge-editor-header-copy span {
          color:var(--secondary-text-color);
          font-size:10px;
          font-weight:500;
          line-height:1.25;
        }
        .theme-usage, .theme-active-note, .inline-note { font-size:11px; color:var(--secondary-text-color); line-height:1.45; }
        .theme-usage { margin:7px 0; }
        .theme-active-note {
          display:flex;
          align-items:flex-start;
          gap:6px;
          padding:8px 10px;
          margin:-4px 0 10px;
          border-radius:10px;
          background:color-mix(in srgb, var(--warning-color, #ff9800) 10%, transparent);
        }
        .theme-active-note ha-icon { width:17px; height:17px; flex:0 0 auto; }

        .two-col {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 0;
        }

        .three-col {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }
        .four-col {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }

        .color-row {
          display: grid;
          grid-template-columns: 36px minmax(0, 1fr);
          gap: 8px;
          align-items: center;
          min-width:0;
          width:100%;
          margin-bottom: 0;
        }
        .two-col > *,
        .three-col > *,
        .four-col > *,
        .color-row > * { min-width:0; }
        .color-row ha-selector { width:100%; min-width:0; }

        .color-swatch {
          width: 36px;
          height: 36px;
          padding: 2px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          cursor: pointer;
          background: none;
        }

        .toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          margin-bottom: 10px;
          border-bottom: 1px solid var(--divider-color);
        }

        .picker-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--secondary-text-color);
          margin-bottom: 6px;
        }

        .helper-text {
          font-size: 12px;
          color: var(--secondary-text-color);
          margin-bottom: 12px;
          line-height: 1.5;
        }

        .entity-picker-placeholder,
        .badge-entity-picker-placeholder {
          display: block;
          margin-bottom: 12px;
        }

        .action-row {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--divider-color);
        }
        .action-row ha-button {
          zoom: .86;
          --mdc-typography-button-font-size: 11px;
          --mdc-button-horizontal-padding: 8px;
          --mdc-button-height: 30px;
          --md-filled-button-container-height: 30px;
          --md-outlined-button-container-height: 30px;
          letter-spacing: .01em;
        }

        .state-icons-block { margin-bottom: 8px; }

        .state-icon-row { align-items: center; margin-bottom: 4px; }

        ha-button.danger {
          --primary-color: var(--error-color);
          --mdc-theme-primary: var(--error-color);
        }

        .editor-confirm-backdrop {
          position:fixed;
          inset:0;
          z-index:100000;
          display:grid;
          place-items:center;
          padding:18px;
          box-sizing:border-box;
          background:rgba(0,0,0,.58);
          backdrop-filter:blur(2px);
        }
        .editor-confirm-dialog {
          width:min(420px, 100%);
          display:grid;
          grid-template-columns:auto minmax(0, 1fr);
          gap:12px;
          padding:18px;
          box-sizing:border-box;
          border:1px solid color-mix(in srgb, var(--error-color, #db4437) 45%, var(--divider-color));
          border-radius:16px;
          background:var(--ha-card-background, var(--card-background-color, #fff));
          color:var(--primary-text-color);
          box-shadow:0 18px 55px rgba(0,0,0,.48);
        }
        .editor-confirm-dialog > ha-icon {
          width:26px;
          height:26px;
          --mdc-icon-size:26px;
          color:var(--error-color, #db4437);
        }
        .editor-confirm-copy > div {
          font-size:16px;
          font-weight:800;
          line-height:1.3;
        }
        .editor-confirm-copy p {
          margin:8px 0 5px;
          color:var(--secondary-text-color);
          font-size:12px;
          line-height:1.45;
        }
        .editor-confirm-copy small {
          color:var(--error-color, #db4437);
          font-weight:700;
        }
        .editor-confirm-actions {
          grid-column:1 / -1;
          display:flex;
          justify-content:flex-end;
          gap:8px;
          padding-top:4px;
        }

        .support-card {
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,.08);
          background: rgba(0,0,0,.18);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .support-title { font-weight: 800; }
        .support-text { font-size: 13px; opacity: .9; line-height: 1.35; }
        .support-link { display:flex; width:max-content; }
        .support-link img { border-radius:12px; box-shadow:0 6px 20px rgba(0,0,0,.35); }

        @container (max-width: 520px) {
          .three-col { grid-template-columns:repeat(2, minmax(0, 1fr)); }
        }

        @container (max-width: 380px) {
          .two-col, .three-col, .four-col { grid-template-columns:1fr; }
          .interval-theme-overrides { grid-template-columns:1fr; }
        }

        @media (max-width: 600px) {
          .two-col, .three-col, .four-col { grid-template-columns: 1fr; }
          .menu-toggle-grid { grid-template-columns: 1fr; }
          .interval-theme-overrides { grid-template-columns:1fr; }
        }
      `;
    }
  }

  customElements.define(EDITOR_TAG, AndyQuickboardCardEditor);
}
