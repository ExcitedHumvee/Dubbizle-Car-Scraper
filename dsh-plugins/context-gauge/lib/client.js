/**
 * Browser half of the context-gauge plugin.
 *
 * Registers one occupant into `conversation.session.header.utilities` — a
 * compact "context remaining" badge for the current Session's header. The
 * numbers arrive through the token-meter session projections:
 *
 * - `contextPressure` carries the provider-anchored occupancy
 *   (`projectedTokens` first, `pressureTokens` as the fallback) plus the route
 *   capacity (`contextWindow`).
 * - `contextBreakdown` carries the heuristic composition of that context.
 *
 * The badge measures REMAINING headroom (`contextWindow - used`) — the inverse
 * reading of the composer's built-in ContextMeter ring, which reports used
 * occupancy. Both read the same fold, so they always agree.
 *
 * Nothing renders until a provider has reported both a prompt size and a route
 * capacity: before the first successful model call there is no numerator to
 * subtract, and a route with no advertised capacity has no denominator.
 *
 * @module dsh-context-gauge/client
 */

window.__ModuleLoader__.load({
  id: "dsh-context-gauge",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const react = require("react");
    const { jsx, jsxs } = require("react/jsx-runtime");
    const { Tooltip } = require("@deepseek-ai/dsh-client-ui-primitives");

    // ── styles ───────────────────────────────────────────────────────────────
    // One scoped stylesheet, keyed by plugin id so a reload cannot duplicate it.
    const css = `
.dsh-context-gauge{position:relative;display:inline-flex;align-items:center;flex:none}
.dsh-context-gauge__trigger{box-sizing:border-box;display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 9px;cursor:pointer;background:0 0;border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums;line-height:20px;white-space:nowrap}
.dsh-context-gauge__trigger:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-context-gauge__trigger:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
.dsh-context-gauge--warn .dsh-context-gauge__trigger{color:var(--dsw-alias-state-warn-label)}
.dsh-context-gauge--critical .dsh-context-gauge__trigger{color:var(--dsw-alias-state-error-primary)}
.dsh-context-gauge__glyph{flex:none;display:inline-flex}
.dsh-context-gauge__track{flex:none;display:block;width:36px;height:4px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);overflow:hidden}
.dsh-context-gauge__fill{display:block;height:100%;border-radius:999px;background:var(--dsw-alias-state-success-primary);transition:width .18s ease}
.dsh-context-gauge--warn .dsh-context-gauge__fill{background:var(--dsw-alias-state-warn-primary)}
.dsh-context-gauge--critical .dsh-context-gauge__fill{background:var(--dsw-alias-state-error-primary)}
.dsh-context-gauge__value{color:var(--dsw-alias-label-primary);font-weight:500}
.dsh-context-gauge--warn .dsh-context-gauge__value{color:var(--dsw-alias-state-warn-primary)}
.dsh-context-gauge--critical .dsh-context-gauge__value{color:var(--dsw-alias-state-error-primary)}
.dsh-context-gauge__panel{position:absolute;top:calc(100% + 8px);right:0;z-index:60;box-sizing:border-box;width:268px;padding:12px;border-radius:12px;border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-menu,var(--dsw-alias-bg-base));box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:20px;text-align:left}
.dsh-context-gauge__head{display:flex;align-items:baseline;gap:8px}
.dsh-context-gauge__headline{color:var(--dsw-alias-label-primary);font-weight:500}
.dsh-context-gauge__figures{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.dsh-context-gauge__caption{margin-top:2px;color:var(--dsw-alias-label-caption)}
.dsh-context-gauge__rows{margin:8px 0 0;padding:0;list-style:none}
.dsh-context-gauge__row{display:flex;align-items:center;gap:12px;justify-content:space-between;padding:2px 0}
.dsh-context-gauge__row strong{color:var(--dsw-alias-label-primary);font-weight:500;font-variant-numeric:tabular-nums}
.dsh-context-gauge__swatch{display:inline-block;width:8px;height:8px;margin-right:6px;border-radius:2px;vertical-align:baseline}
.dsh-context-gauge__swatch--system{background:var(--dsw-static-neutral-bluish-400,var(--dsw-alias-label-tertiary))}
.dsh-context-gauge__swatch--tools{background:#a78bfa}
.dsh-context-gauge__swatch--messages{background:var(--dsw-static-blue-450,var(--dsw-alias-label-tertiary))}
`;
    const tagId = "dsh-context-gauge/context-gauge.css";
    if (
      typeof document !== "undefined" &&
      document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null
    ) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-context-gauge";
      tag.dataset.pluginCss = tagId;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    // ── reading the fold ─────────────────────────────────────────────────────
    /** Warn below this share of headroom left. */
    const WARN_BELOW = 25;
    /** Critical below this share of headroom left. */
    const CRITICAL_BELOW = 10;

    /**
     * Resolve remaining headroom from independently updated pressure fields.
     * @param pressure - latest token-meter `contextPressure` projection.
     * @returns headroom, or null until numerator and capacity are both known.
     */
    function contextHeadroom(pressure) {
      const usedTokens = pressure?.projectedTokens ?? pressure?.pressureTokens;
      const contextWindow = pressure?.contextWindow;
      if (usedTokens === undefined || contextWindow === undefined || contextWindow <= 0) return null;
      const remainingTokens = Math.max(0, contextWindow - usedTokens);
      return {
        usedTokens,
        remainingTokens,
        contextWindow,
        remainingPercent: Math.max(0, Math.min(100, Math.round((remainingTokens / contextWindow) * 100))),
        usedPercent: Math.min(100, Math.round((usedTokens / contextWindow) * 100)),
      };
    }

    /**
     * Severity bucket for one headroom percentage.
     * @param remainingPercent - bounded headroom percentage.
     * @returns the modifier suffix, or an empty string for the healthy band.
     */
    function severityOf(remainingPercent) {
      if (remainingPercent < CRITICAL_BELOW) return "critical";
      if (remainingPercent < WARN_BELOW) return "warn";
      return "";
    }

    /**
     * Compact token count (1.2K, 152K, 1.1M).
     * @param value - token count.
     * @returns the compact decimal string.
     */
    function formatTokens(value) {
      const scaled = (n) => (n >= 100 ? String(Math.round(n)) : String(Math.round(n * 10) / 10));
      if (value < 1000) return String(value);
      if (value < 1000000) return `${scaled(value / 1000)}K`;
      return `${scaled(value / 1000000)}M`;
    }

    /** Glyph: a rounded gauge/arc with a needle, 16px grid. */
    function GaugeGlyph() {
      return jsxs("svg", {
        width: 16,
        height: 16,
        viewBox: "0 0 16 16",
        "aria-hidden": true,
        fill: "none",
        children: [
          jsx("path", {
            d: "M2.6 11.4a5.9 5.9 0 1 1 10.8 0",
            stroke: "currentColor",
            strokeWidth: 1.4,
            strokeLinecap: "round",
            opacity: 0.45,
          }),
          jsx("path", {
            d: "M8 11.2 11 6.6",
            stroke: "currentColor",
            strokeWidth: 1.4,
            strokeLinecap: "round",
          }),
          jsx("circle", { cx: 8, cy: 11.8, r: 1.25, fill: "currentColor" }),
        ],
      });
    }

    // ── copy ─────────────────────────────────────────────────────────────────
    /** Dictionary namespace owned by this plugin. */
    const NS = "context-gauge";
    /** Simplified Chinese dictionary (the key-set source of truth). */
    const zh = {
      "gauge.aria": "上下文剩余 {percent}%（{remaining} / {window} token）",
      "gauge.track": "上下文窗口剩余 {percent}%",
      "gauge.remaining": "{percent}% 剩余",
      "panel.aria": "上下文窗口详情",
      "panel.inUse": "下一次请求将占用 {tokens} token",
      "panel.system": "系统提示",
      "panel.tools": "工具定义",
      "panel.messages": "对话内容",
      "panel.approximate": "构成比例为估算值；剩余数值以最近一次服务商上报为基准。",
    };
    /** English dictionary, checked complete against the zh key set. */
    const en = {
      "gauge.aria": "Context left: {percent}% — {remaining} of {window} tokens remaining",
      "gauge.track": "{percent}% of the context window remaining",
      "gauge.remaining": "{percent}% left",
      "panel.aria": "Context window details",
      "panel.inUse": "{tokens} tokens in use by the next request",
      "panel.system": "System prompt",
      "panel.tools": "Tool schemas",
      "panel.messages": "Conversation",
      "panel.approximate":
        "Composition is an approximation; the remaining figure is anchored to the last provider report.",
    };

    // ── the badge ────────────────────────────────────────────────────────────
    /** Composition legend rows, mirroring the composer ContextMeter panel order. */
    const BREAKDOWN_ROWS = [
      { key: "systemTokens", label: "panel.system", tone: "system" },
      { key: "toolsTokens", label: "panel.tools", tone: "tools" },
      { key: "messageTokens", label: "panel.messages", tone: "messages" },
    ];

    /**
     * The expanded panel: exact remaining figure followed by the heuristic
     * composition of what is currently occupying the context.
     * @param props - headroom, optional breakdown, and the framework translate seat.
     * @returns the panel element.
     */
    function ContextGaugePanel({ headroom, breakdown, t }) {
      const { remainingTokens, contextWindow, remainingPercent } = headroom;
      const breakdownTotal =
        breakdown === undefined
          ? 0
          : breakdown.systemTokens + breakdown.toolsTokens + breakdown.messageTokens;
      return jsxs("div", {
        className: "dsh-context-gauge__panel",
        role: "dialog",
        "aria-label": t("panel.aria"),
        children: [
          jsxs("div", {
            className: "dsh-context-gauge__head",
            children: [
              jsx("span", {
                className: "dsh-context-gauge__headline",
                children: t("gauge.remaining", { percent: remainingPercent }),
              }),
              jsx("span", {
                className: "dsh-context-gauge__figures",
                children: `${formatTokens(remainingTokens)} / ${formatTokens(contextWindow)}`,
              }),
            ],
          }),
          jsx("div", {
            className: "dsh-context-gauge__caption",
            children: t("panel.inUse", { tokens: formatTokens(headroom.usedTokens) }),
          }),
          breakdown !== undefined &&
            breakdownTotal > 0 &&
            jsxs("ul", {
              className: "dsh-context-gauge__rows",
              children: BREAKDOWN_ROWS.map((row) =>
                jsxs(
                  "li",
                  {
                    className: "dsh-context-gauge__row",
                    children: [
                      jsxs("span", {
                        children: [
                          jsx("span", {
                            className: `dsh-context-gauge__swatch dsh-context-gauge__swatch--${row.tone}`,
                            "aria-hidden": true,
                          }),
                          t(row.label),
                        ],
                      }),
                      jsx("strong", { children: `~${formatTokens(breakdown[row.key])}` }),
                    ],
                  },
                  row.key,
                ),
              ),
            }),
          jsx("div", {
            className: "dsh-context-gauge__caption",
            children: t("panel.approximate"),
          }),
        ],
      });
    }

    /**
     * Header badge: gauge glyph, remaining percentage, a small headroom bar, and
     * a click-open panel. Renders nothing until a provider reports both a prompt
     * size and a route capacity.
     * @param props - session projection reader and framework translate seat.
     * @returns the badge element, or null while the reading is unavailable.
     */
    function ContextGauge({ useProjection, t }) {
      const pressure = useProjection("contextPressure");
      const breakdown = useProjection("contextBreakdown");
      const [open, setOpen] = react.useState(false);
      const rootRef = react.useRef(null);
      const headroom = contextHeadroom(pressure);
      const available = headroom !== null;

      react.useEffect(() => {
        if (!available && open) setOpen(false);
      }, [available, open]);

      react.useEffect(() => {
        if (!open || !available) return undefined;
        const onPointerDown = (event) => {
          if (event.target instanceof Node && rootRef.current?.contains(event.target) === true) return;
          setOpen(false);
        };
        const onKeyDown = (event) => {
          if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
          document.removeEventListener("pointerdown", onPointerDown);
          document.removeEventListener("keydown", onKeyDown);
        };
      }, [available, open]);

      if (headroom === null) return null;

      const severity = severityOf(headroom.remainingPercent);
      const label = t("gauge.aria", {
        percent: headroom.remainingPercent,
        remaining: formatTokens(headroom.remainingTokens),
        window: formatTokens(headroom.contextWindow),
      });
      const rootClass =
        severity === "" ? "dsh-context-gauge" : `dsh-context-gauge dsh-context-gauge--${severity}`;

      return jsxs("span", {
        ref: rootRef,
        className: rootClass,
        "data-context-gauge": severity === "" ? "ok" : severity,
        children: [
          jsx(Tooltip, {
            label,
            side: "bottom",
            delayMs: 300,
            disabled: open,
            children: jsxs("button", {
              type: "button",
              className: "dsh-context-gauge__trigger",
              "aria-label": label,
              "aria-haspopup": "dialog",
              "aria-expanded": open,
              onClick: () => {
                setOpen((value) => !value);
              },
              children: [
                jsx("span", { className: "dsh-context-gauge__glyph", children: jsx(GaugeGlyph, {}) }),
                jsx("span", {
                  className: "dsh-context-gauge__value",
                  children: `${String(headroom.remainingPercent)}%`,
                }),
                jsx("span", {
                  className: "dsh-context-gauge__track",
                  role: "img",
                  "aria-label": t("gauge.track", { percent: headroom.remainingPercent }),
                  children: jsx("span", {
                    className: "dsh-context-gauge__fill",
                    style: { width: `${String(headroom.remainingPercent)}%` },
                  }),
                }),
              ],
            }),
          }),
          open &&
            jsx(ContextGaugePanel, {
              headroom,
              t,
              ...(breakdown === undefined ? {} : { breakdown }),
            }),
        ],
      });
    }

    // ── plugin body ──────────────────────────────────────────────────────────
    /** Required services: the slot registry and the locale dictionary registry. */
    const inject = ["slots", "locale"];

    /**
     * Client plugin body: register this plugin's copy and the header-utilities
     * occupant.
     * @param ctx - client root context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "context-gauge: dictionaries");
      ctx.slots.inject("conversation.session.header.utilities", () =>
        ctx.slots.register(
          {
            name: "conversation.session.header.utilities",
            id: "context-gauge",
            order: 5,
            locale: NS,
          },
          ContextGauge,
        ),
      );
    }

    exports.ContextGauge = ContextGauge;
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
