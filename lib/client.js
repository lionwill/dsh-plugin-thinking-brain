/**
 * Thinking-effort brain seat — Client half.
 *
 * What it adds
 * ------------
 * One compact brain button in the composer tool row, immediately before the
 * shipped model selector (`conversation.input.right`, which the composer
 * renders as `[input.right …][model seat][send]`). Clicking it opens an
 * anchored card with a segmented thinking-effort slider; dragging the brain
 * thumb, clicking a stop, or pressing the arrow keys writes the same value the
 * model menu writes.
 *
 * Why it cannot drift from the shipped control
 * --------------------------------------------
 * Both surfaces read and write ONE object: `ctx.modelDirectories`
 * `directoryFor(sessionId)` → `ModelDirectory`. The seat subscribes to its
 * store (so a pick in the model menu moves this slider) and submits through
 * `directory.select()` (the exact call the model menu uses, including its
 * optimistic `pending` state, failure text, and product analytics), so this
 * feature needs no session-projection writes of its own and cannot invent an
 * effort the adapter did not advertise.
 *
 * Segments per model
 * ------------------
 * The stops are not hardcoded: they are the selected model's own
 * `reasoning.efforts` from the Host model catalog, ordered least → greatest,
 * with `defaultEffort` marked. A model with four efforts gets four segments;
 * a model that advertises no reasoning control gets a note instead of a fake
 * slider.
 *
 * Visual language
 * ---------------
 * Adapted from the reference "thinking effort slider": a recessed track whose
 * filled portion starts as the DeepSeek logo blue, grows a pixel-mosaic
 * shimmer as the level rises, and blooms into orbiting particles plus a dotted
 * starburst at the top level — with the brain thumb re-coloured along the same
 * ramp. Chrome uses theme tokens and the card listens for the body's
 * `data-ds-dark-theme` palette attribute, so light and dark both resolve
 * without preference bookkeeping. Animation respects reduced-motion.
 */

window.__ModuleLoader__.load({
	id: 'dsh-plugin-thinking-brain',
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

		const React = require('react');
		const { createPortal } = require('react-dom');
		const { Fragment, useCallback, useEffect, useMemo, useRef, useState } = React;
		const h = React.createElement;

		/** Dictionary namespace, shared by the locale registration and the slot seat. */
		const NS = 'thinking-brain';

		/* =========================================================================
		 * 1. Artwork — one brain silhouette, two renderings
		 * ========================================================================= */

		/** Left hemisphere (64-unit artwork space). */
		const BRAIN_LEFT = 'M29.5 13.5C25.5 11.2 19.5 13.4 18.2 18.2C14.2 19.4 11.8 23.6 13.2 27.9C10.5 31.1 10.9 36.2 14.1 39.1C13.6 43.8 17.2 48.2 21.8 48.7C23.8 52.1 28.4 52.4 30.2 49.5V15.5C30.2 14.6 29.9 13.9 29.5 13.5Z';
		/** Right hemisphere, mirrored by hand so both share one weight. */
		const BRAIN_RIGHT = 'M34.5 13.5C38.5 11.2 44.5 13.4 45.8 18.2C49.8 19.4 52.2 23.6 50.8 27.9C53.5 31.1 53.1 36.2 49.9 39.1C50.4 43.8 46.8 48.2 42.2 48.7C40.2 52.1 35.6 52.4 33.8 49.5V15.5C33.8 14.6 34.1 13.9 34.5 13.5Z';
		/** Six sulci, three per hemisphere. */
		const BRAIN_FOLDS = [
			'M24.2 19.5C21.8 20.8 21.2 23.8 23.3 25.5',
			'M18.4 29.2C21.2 28.4 23.8 29.8 24.4 32.4',
			'M19.5 39.4C22.4 38.4 24.8 39.9 25.2 42.6',
			'M39.8 19.5C42.2 20.8 42.8 23.8 40.7 25.5',
			'M45.6 29.2C42.8 28.4 40.2 29.8 39.6 32.4',
			'M44.5 39.4C41.6 38.4 39.2 39.9 38.8 42.6',
		];

		/** Monochrome composer glyph: inherits the button's ink. */
		function SeatBrainIcon() {
			return h('svg', {
				className: 'tb_seatIcon',
				viewBox: '0 0 36 36',
				fill: 'none',
				'aria-hidden': 'true',
				focusable: 'false',
			},
				h('g', { transform: 'translate(18 18) scale(0.5625) translate(-32 -31.7)' },
					h('path', { d: BRAIN_LEFT, fill: 'currentColor' }),
					h('path', { d: BRAIN_RIGHT, fill: 'currentColor' }),
					h('g', {
						stroke: 'rgba(255,255,255,0.58)',
						strokeWidth: '2.2',
						strokeLinecap: 'round',
						fill: 'none',
					}, BRAIN_FOLDS.map((d, index) => h('path', { key: index, d }))),
				),
			);
		}

		/**
		 * The slider's thumb: the same silhouette with a live gradient. Element
		 * refs are collected so the animation loop can re-tint stops without a
		 * React render per frame.
		 * @param props - gradient id and the mutable ref bucket.
		 */
		function BrainThumbArt(props) {
			const refs = props.refs;
			const bind = (key) => (node) => { refs[key] = node; };
			return h('svg', {
				className: 'tb_brain',
				viewBox: '7 7 50 50',
				fill: 'none',
				'aria-hidden': 'true',
				focusable: 'false',
			},
				h('defs', null,
					h('linearGradient', {
						id: props.gradientId,
						x1: '12',
						y1: '10',
						x2: '52',
						y2: '54',
						gradientUnits: 'userSpaceOnUse',
					},
						h('stop', { ref: bind('s1'), offset: '0%', stopColor: '#CFE0FF' }),
						h('stop', { ref: bind('s2'), offset: '52%', stopColor: '#5F7BFF' }),
						h('stop', { ref: bind('s3'), offset: '100%', stopColor: '#3550E8' }),
					),
				),
				h('g', {
					ref: bind('outline'),
					stroke: '#1B2A6B',
					fill: '#1B2A6B',
					strokeWidth: '3.6',
					strokeLinejoin: 'round',
					strokeLinecap: 'round',
				},
					h('path', { d: BRAIN_LEFT }),
					h('path', { d: BRAIN_RIGHT }),
				),
				h('path', { d: BRAIN_LEFT, fill: 'url(#' + props.gradientId + ')' }),
				h('path', { d: BRAIN_RIGHT, fill: 'url(#' + props.gradientId + ')' }),
				h('g', {
					ref: bind('folds'),
					stroke: '#22307F',
					strokeWidth: '1.9',
					strokeLinecap: 'round',
					opacity: '0.6',
				},
					BRAIN_FOLDS.map((d, index) => h('path', { key: index, d })),
				),
				h('path', { d: 'M23.5 15.8C21.2 16.5 19.8 18.3 19.4 20.4', stroke: 'rgba(255,255,255,0.45)', strokeWidth: '1.6', strokeLinecap: 'round' }),
				h('path', { d: 'M40.5 15.8C42.8 16.5 44.2 18.3 44.6 20.4', stroke: 'rgba(255,255,255,0.35)', strokeWidth: '1.6', strokeLinecap: 'round' }),
			);
		}

		/** Popover close glyph. */
		function CloseIcon() {
			return h('svg', { viewBox: '0 0 16 16', width: '12', height: '12', fill: 'none', 'aria-hidden': 'true', focusable: 'false' },
				h('path', { d: 'M4 4l8 8M12 4l-8 8', stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round' }),
			);
		}

		/* =========================================================================
		 * 2. Palette + animation constants
		 * ========================================================================= */

		/** Distance the FX canvas reaches beyond the slider box, in CSS px. */
		const FX_PAD = 46;
		/** Mosaic grid: five pixel rows, sixty-four columns of seeded cells. */
		const MOSAIC_ROWS = 5;
		const MOSAIC_COLS = 64;

		/** Top-end pixel palette: brand blue through cyan, orchid, and white. */
		const PIXEL_PALETTE = [
			[77, 107, 254],
			[109, 134, 255],
			[125, 211, 252],
			[165, 180, 252],
			[196, 181, 253],
			[224, 235, 255],
		];

		/** Deterministic-ish shimmer seeds, generated once per page. */
		const CELL_SEEDS = (() => {
			const seeds = [];
			for (let row = 0; row < MOSAIC_ROWS; row += 1) {
				for (let col = 0; col < MOSAIC_COLS; col += 1) {
					seeds.push({
						r: row,
						c: col,
						phase: Math.random() * Math.PI * 2,
						speed: 1.4 + Math.random() * 2.6,
						hueRoll: Math.random(),
						threshold: Math.random(),
					});
				}
			}
			return seeds;
		})();

		/** Orbiting dust around the thumb at high effort. */
		const PARTICLES = Array.from({ length: 24 }, (_, index) => ({
			angle: (index / 24) * Math.PI * 2 + Math.random() * 0.3,
			dist: 11 + Math.random() * 22,
			speed: 0.4 + Math.random() * 0.85,
			size: 1 + Math.random() * 1.5,
			phase: Math.random() * Math.PI * 2,
			color: index % 3 === 0 ? '125, 211, 252' : index % 3 === 1 ? '196, 181, 253' : '255, 255, 255',
		}));

		/** Dotted starburst rays at the top level. */
		const RAYS = Array.from({ length: 12 }, (_, index) => ({
			baseAngle: (index / 12) * Math.PI * 2 + (index % 2 === 0 ? -0.05 : 0.08),
			length: 28 + (index % 3) * 10,
			dots: 6 + (index % 3) * 2,
			phase: Math.random() * Math.PI * 2,
			color: index % 3 === 0 ? '126, 200, 255' : index % 3 === 1 ? '196, 181, 253' : '160, 190, 255',
		}));

		/** Brain tint ramp: brand blue at rest, lavender mid, iridescent at the top. */
		const BRAIN_STOPS = [
			{ at: 0.0, c1: '#D9E6FF', c2: '#5F7BFF', c3: '#3550E8', outline: '#1B2A6B', folds: '#22307F', radius: 5, alpha: 0.3 },
			{ at: 0.58, c1: '#E3EAFF', c2: '#7A93FF', c3: '#4A66F2', outline: '#26307F', folds: '#2E3A96', radius: 8, alpha: 0.46 },
			{ at: 0.86, c1: '#ECF0FF', c2: '#AAB8FF', c3: '#868FFB', outline: '#3730A3', folds: '#4338CA', radius: 12, alpha: 0.64 },
			{ at: 1.0, c1: '#F2FAFF', c2: '#B4C2FF', c3: '#9192FF', outline: '#2B2F8F', folds: '#3730A3', radius: 16, alpha: 0.84 },
		];

		/* ---------- small math helpers ---------- */

		const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);
		const lerp = (a, b, t) => a + (b - a) * t;

		/** Parse `#rrggbb` into channels. */
		function hexToRgb(hex) {
			const value = parseInt(hex.slice(1), 16);
			return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
		}

		/** Parse `#rgb`, `#rrggbb`, `rgb()` or `rgba()` into a channel triple, or null. */
		function parseColor(value) {
			const text = String(value === undefined || value === null ? '' : value).trim();
			if (text.length === 0) return null;
			let match = /^#([0-9a-f]{6})$/i.exec(text);
			if (match !== null) return hexToRgb('#' + match[1]);
			match = /^#([0-9a-f]{3})$/i.exec(text);
			if (match !== null) {
				const short = match[1];
				return [
					parseInt(short[0] + short[0], 16),
					parseInt(short[1] + short[1], 16),
					parseInt(short[2] + short[2], 16),
				];
			}
			match = /^rgba?\(([^)]+)\)$/i.exec(text);
			if (match !== null) {
				const parts = match[1].split(/[\s,\/]+/).filter((part) => part.length > 0).map(Number);
				if (parts.length >= 3 && parts.slice(0, 3).every((channel) => Number.isFinite(channel))) {
					return [parts[0], parts[1], parts[2]];
				}
			}
			return null;
		}

		/** Blend two channel triples. */
		function mixRgb(from, to, t) {
			return [
				Math.round(lerp(from[0], to[0], t)),
				Math.round(lerp(from[1], to[1], t)),
				Math.round(lerp(from[2], to[2], t)),
			];
		}

		/** Interpolate two `#rrggbb` colors. */
		function mixHex(from, to, t) {
			const a = hexToRgb(from);
			const b = hexToRgb(to);
			return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ', ' + Math.round(lerp(a[1], b[1], t)) + ', ' + Math.round(lerp(a[2], b[2], t)) + ')';
		}

		/** `rgba()` from a channel triple or an `"r, g, b"` string. */
		function rgba(color, alpha) {
			const channels = Array.isArray(color) ? color[0] + ', ' + color[1] + ', ' + color[2] : String(color);
			return 'rgba(' + channels + ', ' + clamp01(alpha).toFixed(3) + ')';
		}

		/** Interpolate the brain ramp at normalized effort. */
		function brainPalette(t) {
			const value = clamp01(t);
			let from = BRAIN_STOPS[0];
			let to = BRAIN_STOPS[BRAIN_STOPS.length - 1];
			for (let index = 0; index < BRAIN_STOPS.length - 1; index += 1) {
				if (value >= BRAIN_STOPS[index].at && value <= BRAIN_STOPS[index + 1].at) {
					from = BRAIN_STOPS[index];
					to = BRAIN_STOPS[index + 1];
					break;
				}
			}
			const span = to.at - from.at;
			const k = span <= 0 ? 0 : clamp01((value - from.at) / span);
			const radius = lerp(from.radius, to.radius, k);
			const alpha = lerp(from.alpha, to.alpha, k);
			let glow = 'drop-shadow(0 0 ' + radius.toFixed(1) + 'px rgba(77, 107, 254, ' + alpha.toFixed(2) + '))';
			if (value > 0.8) {
				const extra = clamp01((value - 0.8) / 0.2);
				glow += ' drop-shadow(0 0 ' + (radius * 1.8).toFixed(1) + 'px rgba(125, 211, 252, ' + (alpha * 0.75 * extra).toFixed(2) + '))';
			}
			return {
				c1: mixHex(from.c1, to.c1, k),
				c2: mixHex(from.c2, to.c2, k),
				c3: mixHex(from.c3, to.c3, k),
				outline: mixHex(from.outline, to.outline, k),
				folds: mixHex(from.folds, to.folds, k),
				glow,
			};
		}

		/* =========================================================================
		 * 3. Styles — theme tokens for chrome, palette variables for canvas
		 * ========================================================================= */

		const STYLE_KEY = 'dsh-plugin-thinking-brain/styles.css';

		const CSS = `
.tb_seat{--tb-seat-ink:var(--dsw-alias-label-secondary,#6b7280);--tb-seat-ink-hover:var(--dsw-alias-label-primary,#111827);--tb-seat-accent:var(--dsw-alias-brand-primary-new-colorprimary-new-color,#4d6bfe);--tb-seat-hover:var(--dsw-alias-interactive-bg-hover,rgba(15,23,42,.06));--tb-seat-open:rgba(65,118,230,.14);position:relative;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:28px;height:28px;margin:0;padding:0;border:0;border-radius:8px;background:transparent;color:var(--tb-seat-ink);cursor:pointer;flex:none;transition:background-color .16s ease,color .16s ease,opacity .16s ease,transform .16s ease}
body[data-ds-dark-theme] .tb_seat{--tb-seat-ink:var(--dsw-alias-label-secondary,#9ca3af);--tb-seat-ink-hover:var(--dsw-alias-label-primary,#f3f4f6);--tb-seat-accent:var(--dsw-alias-brand-primary-new-colorprimary-new-color,#7fa0ff);--tb-seat-hover:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.09));--tb-seat-open:rgba(127,160,255,.2)}
.tb_seat:hover{background:var(--tb-seat-hover);color:var(--tb-seat-ink-hover)}
.tb_seat:active{transform:scale(.94)}
.tb_seat:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--tb-seat-accent);outline-offset:2px}
.tb_seat[data-open="true"]{background:var(--tb-seat-open);color:var(--tb-seat-accent)}
.tb_seatIcon{display:block;width:18px;height:18px;opacity:.88;transition:opacity .16s ease}
.tb_seat:hover .tb_seatIcon,.tb_seat[data-open="true"] .tb_seatIcon{opacity:1}

.tb_card{--tb-ink:var(--dsw-alias-label-primary,#111827);--tb-ink-2:var(--dsw-alias-label-secondary,#6b7280);--tb-surface:var(--dsw-menu-surface-fill,rgba(252,253,254,.78));--tb-surface-soft:var(--dsw-alias-bg-layer-2,rgba(15,23,42,.05));--tb-line:var(--dsw-alias-border-l1,rgba(15,23,42,.1));--tb-accent:var(--dsw-alias-brand-primary-new-colorprimary-new-color,#4d6bfe);--tb-accent-soft:rgba(77,107,254,.13);--tb-hover:var(--dsw-alias-interactive-bg-hover,rgba(15,23,42,.06));--tb-track-bg:rgba(15,23,42,.065);--tb-track-edge:rgba(15,23,42,.05);--tb-marker:rgba(15,23,42,.2);--tb-marker-on:rgba(255,255,255,.62);--tb-track-shadow:inset 0 1px 2px rgba(15,23,42,.16);--tb-ring:0 0 0 0 transparent;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1,rgba(15,23,42,.1));position:fixed;z-index:1000;box-sizing:border-box;width:336px;max-width:calc(100vw - 24px);padding:13px 15px 12px;border:0;border-radius:var(--dsw-radius-lg,16px);background:var(--tb-surface);backdrop-filter:var(--dsw-menu-backdrop-filter,blur(18px) saturate(140%));color:var(--tb-ink);box-shadow:var(--tb-ring),var(--dsw-elevation-prominent,0 0 0 .5px rgba(15,23,42,.1),0 3px 8px rgba(0,0,0,.06),0 0 20px rgba(0,0,0,.05));font-family:inherit;font-size:13px;line-height:1.4;user-select:none;-webkit-user-select:none;overflow:hidden;animation:tb_cardIn .18s cubic-bezier(.22,1,.36,1)}
@keyframes tb_cardIn{from{opacity:0;transform:translateY(4px) scale(.985)}to{opacity:1;transform:none}}
.tb_card[data-tier="max"]{--tb-ring:0 0 0 .5px rgba(65,118,230,.3),0 0 26px rgba(65,118,230,.12)}
.tb_card[data-tier="galaxy"]{--tb-ring:0 0 0 .5px rgba(65,118,230,.42),0 0 32px rgba(65,118,230,.16)}
.tb_card *{box-sizing:border-box}
body[data-ds-dark-theme] .tb_card{--tb-ink:var(--dsw-alias-label-primary,#f3f4f6);--tb-ink-2:var(--dsw-alias-label-secondary,#9ca3af);--tb-surface:var(--dsw-menu-surface-fill,rgba(48,49,54,.72));--tb-surface-soft:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.07));--tb-line:var(--dsw-alias-border-l1,rgba(255,255,255,.08));--tb-accent:var(--dsw-alias-brand-primary-new-colorprimary-new-color,#7fa0ff);--tb-accent-soft:rgba(127,160,255,.18);--tb-hover:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.09));--tb-track-bg:rgba(255,255,255,.075);--tb-track-edge:rgba(255,255,255,.04);--tb-marker:rgba(255,255,255,.24);--tb-marker-on:rgba(255,255,255,.66);--tb-track-shadow:inset 0 1px 2px rgba(0,0,0,.5);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1,rgba(255,255,255,.09))}

.tb_head{display:flex;align-items:center;gap:8px;min-height:22px}
.tb_kicker{font-size:12px;font-weight:500;letter-spacing:.01em;color:var(--tb-ink-2);white-space:nowrap}
.tb_headSpacer{flex:1}
.tb_morph{display:inline-grid;align-items:center;min-width:3.4em;overflow:hidden;height:1.5em}
.tb_morphItem{grid-area:1/1;font-size:14.5px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;color:var(--tb-ink)}
.tb_morphItem[data-state="entering"]{animation:tb_morphIn .26s cubic-bezier(.22,1,.36,1) both}
.tb_morphItem[data-state="active"]{opacity:1;filter:blur(0);transform:none}
.tb_morphItem[data-state="leaving"]{opacity:0;filter:blur(8px);transform:translateY(-3px) scale(1.03);pointer-events:none;transition:opacity .22s ease,filter .26s ease,transform .26s ease}
@keyframes tb_morphIn{from{opacity:0;filter:blur(7px);transform:translateY(3px) scale(.96)}to{opacity:1;filter:blur(0);transform:none}}
.tb_close{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--tb-ink-2);cursor:pointer;flex:none;transition:background-color .15s ease,color .15s ease}
.tb_close:hover{background:var(--tb-hover);color:var(--tb-ink)}
.tb_close:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--tb-accent);outline-offset:1px}
.tb_model{display:flex;align-items:center;gap:6px;margin:3px 0 8px;min-width:0;font-size:11.5px;line-height:16px;color:var(--tb-ink-2)}
.tb_modelText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tb_chip{flex:none;padding:0 6px;border-radius:999px;font-size:10px;line-height:15px;background:var(--tb-surface-soft);border:.5px solid var(--tb-line);color:var(--tb-ink-2)}
.tb_sliderBlock{margin-top:2px}
.tb_slider{position:relative;display:flex;align-items:center;height:38px;margin:0 -2px;outline:none;cursor:pointer;touch-action:none}
.tb_slider[aria-disabled="true"]{cursor:default}
.tb_fx{position:absolute;left:-46px;top:-46px;width:calc(100% + 92px);height:calc(100% + 92px);pointer-events:none;z-index:4}
.tb_track{position:relative;width:100%;height:28px;border-radius:9px;background:var(--tb-track-bg);box-shadow:var(--tb-track-shadow),inset 0 0 0 .5px var(--tb-track-edge);overflow:hidden}
.tb_trackCanvas{position:absolute;inset:0;display:block;width:100%;height:100%;pointer-events:none}
.tb_markers{position:absolute;inset:0;pointer-events:none;z-index:2}
.tb_marker{position:absolute;top:50%;width:3px;height:3px;border-radius:999px;background:var(--tb-marker);transform:translate(-50%,-50%);transition:background-color .25s ease,height .25s ease}
.tb_marker[data-default="true"]{width:3px;height:11px;border-radius:999px}
.tb_marker[data-passed="true"]{background:var(--tb-marker-on)}
.tb_thumb{position:absolute;top:50%;left:0;width:30px;height:30px;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:5;will-change:left,filter}
.tb_thumbInner{width:29px;height:29px;display:flex;align-items:center;justify-content:center;transition:transform .18s cubic-bezier(.22,1,.36,1)}
.tb_slider[data-dragging="true"] .tb_thumbInner{transform:scale(1.09)}
.tb_slider:not([aria-disabled="true"]):hover .tb_thumbInner{transform:scale(1.04)}
.tb_slider[data-dragging="true"]:hover .tb_thumbInner{transform:scale(1.12)}
.tb_slider:focus-visible .tb_track{box-shadow:var(--tb-track-shadow),0 0 0 2px var(--tb-accent)}
.tb_brain{width:100%;height:100%;display:block;overflow:visible}
.tb_ticks{position:relative;height:17px;margin-top:1px}
.tb_tick{position:absolute;top:0;font-size:10.5px;line-height:16px;letter-spacing:.01em;color:var(--tb-ink-2);white-space:nowrap;max-width:7.6em;overflow:hidden;text-overflow:ellipsis;transition:color .22s ease,opacity .22s ease}
.tb_tick[data-active="true"]{color:var(--tb-accent);font-weight:600}
.tb_foot{margin-top:2px}
.tb_desc{display:flex;align-items:center;gap:6px;min-height:17px;font-size:11.5px;line-height:16px;color:var(--tb-ink-2);overflow:hidden}
.tb_descText{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tb_error{margin-top:3px;font-size:11px;line-height:15px;color:var(--dsw-alias-state-error-primary,#dc2626);overflow:hidden;text-overflow:ellipsis}
.tb_tickFlag{margin-left:4px;padding:0 4px;border-radius:999px;font-size:9px;line-height:13px;background:var(--tb-accent-soft);color:var(--tb-accent);vertical-align:1px}
.tb_empty{padding:10px 2px 4px;font-size:12px;line-height:18px;color:var(--tb-ink-2)}

@media (prefers-reduced-motion: reduce){.tb_card{animation:none}.tb_morphItem[data-state="entering"]{animation:none}.tb_morphItem[data-state="leaving"]{transition:none}.tb_thumbInner{transition:none}}
`;

		/** Mount the stylesheet once; removing the returned disposer cleans it up. */
		function installStyles() {
			if (typeof document === 'undefined') return () => {};
			const selector = 'style[data-plugin-css="' + STYLE_KEY + '"]';
			if (document.querySelector(selector) !== null) return () => {};
			const tag = document.createElement('style');
			tag.dataset.plugin = 'dsh-plugin-thinking-brain';
			tag.dataset.pluginCss = STYLE_KEY;
			tag.textContent = CSS;
			document.head.appendChild(tag);
			return () => { tag.remove(); };
		}

		/* =========================================================================
		 * 4. Copy
		 * ========================================================================= */

		const ZH = {
			'seat': '思考强度',
			'seatAria': '打开思考强度滑块',
			'title': '思考强度',
			'aria': '思考和推理强度',
			'close': '关闭',
			'levels': '{count} 档',
			'defaults': '默认',
			'loading': '正在读取模型…',
			'unavailable': '当前模型暂不可调节',
			'noLevels': '这个模型没有可调节的思考档位。',
			'singleLevel': '这个模型只有一个思考档位，无需调节。',
			'hint': '拖动滑块或点击轨道调节，也可用 ← → 键',
			'providerDefault': 'Default',
			'providerDefaultHint': '跟随服务商默认强度，不写入具体档位。',
			'error': '设置失败：{message}',
		};

		const EN = {
			'seat': 'Thinking effort',
			'seatAria': 'Open the thinking effort slider',
			'title': 'Thinking effort',
			'aria': 'Thinking and reasoning effort',
			'close': 'Close',
			'levels': '{count} levels',
			'defaults': 'Default',
			'loading': 'Reading the model…',
			'unavailable': 'This model cannot be adjusted right now',
			'noLevels': 'This model has no adjustable reasoning levels.',
			'singleLevel': 'This model has a single reasoning level, so there is nothing to adjust.',
			'hint': 'Drag the thumb or click the track; ← → also work',
			'providerDefault': 'Default',
			'providerDefaultHint': 'Follow the provider default; no explicit level is sent.',
			'error': 'Could not change it: {message}',
		};

		/* =========================================================================
		 * 5. Shared state helpers
		 * ========================================================================= */

		const EMPTY_STATE = Object.freeze({
			current: null,
			retainedEffort: undefined,
			routable: null,
			groups: [],
			failures: [],
			status: 'idle',
			pending: null,
			error: null,
		});

		/** Observable used only when the session's directory cannot be resolved. */
		const EMPTY_OBSERVABLE = Object.freeze({
			getSnapshot: () => EMPTY_STATE,
			subscribe: () => () => {},
		});

		/**
		 * Project one directory snapshot onto everything the card renders.
		 *
		 * The shipped model menu has one subtlety this card must mirror: a model
		 * whose adapter declares no `defaultEffort` offers a "provider default"
		 * choice that sends NO explicit effort, listed before the real levels.
		 * That is exactly the `Default` in the composer caption, so the slider
		 * carries the same stop instead of pretending the first level is selected.
		 *
		 * @param state - `ModelDirectoryState` snapshot (or undefined while unbound).
		 */
		function deriveModelInfo(state) {
			const empty = {
				status: 'loading',
				mode: 'loading',
				modelName: '',
				providerName: '',
				stops: [],
				index: 0,
				defaultIndex: -1,
				current: null,
				supported: false,
			};
			if (state === undefined || state === null) return empty;
			const current = state.current;
			if (current === null || current === undefined) {
				const failing = state.status === 'error';
				return { ...empty, status: failing ? 'error' : 'loading', mode: failing ? 'error' : 'loading' };
			}
			const groups = Array.isArray(state.groups) ? state.groups : [];
			const group = groups.find((entry) => entry.id === current.provider);
			const model = group !== undefined && Array.isArray(group.models)
				? group.models.find((entry) => entry.id === current.model)
				: undefined;
			if (model === undefined) {
				// A saved selection kept out of the catalog is not the same thing as a
				// model without reasoning levels; say so instead of offering a fake note.
				const unavailable = state.status === 'ready' || state.status === 'error' || state.routable === false;
				return {
					...empty,
					status: unavailable ? 'unavailable' : 'loading',
					mode: unavailable ? 'unavailable' : 'loading',
					modelName: current.model,
					current,
				};
			}
			const reasoning = model.reasoning;
			const efforts = reasoning !== undefined && Array.isArray(reasoning.efforts) ? reasoning.efforts : [];
			const defaultEffort = reasoning !== undefined ? reasoning.defaultEffort : undefined;
			// No declared default + advertised levels = the provider-default choice.
			const providerDefault = efforts.length > 0 && defaultEffort === undefined;
			const stopOf = (entry) => ({
				id: entry.id,
				name: entry.name,
				description: entry.description,
				providerDefault: false,
			});
			const stops = providerDefault
				? [{ id: undefined, name: undefined, description: undefined, providerDefault: true }, ...efforts.map(stopOf)]
				: efforts.map(stopOf);
			let index = 0;
			if (providerDefault) {
				const found = current.reasoningEffort === undefined
					? -1
					: efforts.findIndex((entry) => entry.id === current.reasoningEffort);
				index = found < 0 ? 0 : found + 1;
			} else {
				const effective = current.reasoningEffort === undefined ? defaultEffort : current.reasoningEffort;
				let found = stops.findIndex((entry) => entry.id === effective);
				if (found < 0) found = stops.findIndex((entry) => entry.id === defaultEffort);
				index = found < 0 ? 0 : found;
			}
			const defaultIndex = defaultEffort === undefined ? -1 : stops.findIndex((entry) => entry.id === defaultEffort);
			return {
				status: 'ready',
				mode: stops.length > 1 ? 'levels' : stops.length === 1 ? 'single' : 'no-levels',
				modelName: typeof model.name === 'string' ? model.name : current.model,
				providerName: typeof group.name === 'string' ? group.name : current.provider,
				stops,
				index,
				defaultIndex,
				current,
				supported: stops.length > 1,
			};
		}

		/* =========================================================================
		 * 6. Small display pieces
		 * ========================================================================= */

		/**
		 * One line of the blur-morph label. Mounts hidden, then flips to active on
		 * the next pair of frames so the CSS transition actually runs.
		 */
		function MorphItem(props) {
			const leaving = props.leaving === true;
			const [settled, setSettled] = useState(leaving);
			useEffect(() => {
				if (leaving) return undefined;
				// The entrance is a CSS animation (so a starved frame budget can never
				// leave the label invisible); the timer only retires the animation class.
				const timer = setTimeout(() => setSettled(true), 280);
				return () => clearTimeout(timer);
			}, [leaving]);
			const phase = leaving ? 'leaving' : settled ? 'active' : 'entering';
			return h('span', { className: 'tb_morphItem', 'data-state': phase }, props.text);
		}

		/**
		 * Blur-morph value label: the outgoing text blurs up, the incoming one
		 * blurs in from below, mirroring the reference animation.
		 */
		function MorphLabel(props) {
			const text = props.text === undefined || props.text === null ? '' : String(props.text);
			const [pair, setPair] = useState(() => ({ current: text, previous: null }));
			const last = useRef(text);
			useEffect(() => {
				if (text === last.current) return undefined;
				const previous = last.current;
				last.current = text;
				setPair({ current: text, previous });
				const timer = setTimeout(() => {
					setPair((now) => (now.current === text ? { current: now.current, previous: null } : now));
				}, 340);
				return () => clearTimeout(timer);
			}, [text]);
			return h('span', { className: 'tb_morph' },
				pair.previous === null ? null : h(MorphItem, { key: 'prev', text: pair.previous, leaving: true }),
				h(MorphItem, { key: pair.current, text: pair.current }),
			);
		}

		/* =========================================================================
		 * 7. The segmented effort slider
		 * ========================================================================= */

		/**
		 * Recessed segmented track + canvas engine + draggable brain thumb.
		 *
		 * The component keeps its own drag preview locally (`dragIndex`) and
		 * reports it upward so the header label follows the thumb before the
		 * selection round-trips. Key repeats stage locally and commit once the
		 * user stops moving, so a held arrow key cannot flood the Host with
		 * selections. Everything that must survive an async Host selection
		 * lives in the parent; this component only renders and calls back.
		 *
		 * @param props - stops, committed index, callbacks, copy.
		 */
		function EffortSlider(props) {
			const { t, stops, index, committedIndex, onPreview, onCommit } = props;
			const count = stops.length;
			const maxIndex = Math.max(0, count - 1);
			const disabled = maxIndex <= 0;

			const stageRef = useRef(null);
			const trackRef = useRef(null);
			const trackCanvasRef = useRef(null);
			const fxCanvasRef = useRef(null);
			const thumbRef = useRef(null);
			const thumbInnerRef = useRef(null);
			const brainRef = useRef({});
			const gradientIdRef = useRef(null);
			if (gradientIdRef.current === null) gradientIdRef.current = 'tbBrainGrad' + Math.round(Math.random() * 1e6);

			const metricsRef = useRef({ w: 300, h: 28, pad: 14, usable: 272, stageW: 300, stageH: 38 });
			const paletteRef = useRef(null);
			const animRef = useRef({ targetT: 0, visualT: 0, dragging: false, drawnT: -1 });
			const dragRef = useRef(null);
			const keyTimerRef = useRef(0);
			const keyTargetRef = useRef(null);
			const maxIndexRef = useRef(maxIndex);
			maxIndexRef.current = maxIndex;

			const [metrics, setMetrics] = useState({ w: 300, h: 28, pad: 14, usable: 272 });
			const [dragIndex, setDragIndex] = useState(null);
			const [dragging, setDragging] = useState(false);

			/** Normalized position of one stop. */
			const tOf = useCallback((value) => (maxIndex <= 0 ? 0 : clamp01(value / maxIndex)), [maxIndex]);
			/** Display name: the provider-default stop has no catalog name. */
			const labelOf = useCallback((stop) => {
				if (stop === undefined) return '';
				if (stop.providerDefault === true) return t('providerDefault');
				return typeof stop.name === 'string' && stop.name.length > 0 ? stop.name : String(stop.id);
			}, [t]);

			const shown = dragIndex === null ? index : dragIndex;
			const activeStop = stops[shown];

			/* ---------- animation engine (one mount-scoped loop) ---------- */

			useEffect(() => {
				const stage = stageRef.current;
				const track = trackRef.current;
				const trackCanvas = trackCanvasRef.current;
				const fxCanvas = fxCanvasRef.current;
				if (stage === null || track === null || trackCanvas === null || fxCanvas === null) return undefined;

				let alive = true;
				let raf = 0;
				const reduced = typeof window.matchMedia === 'function'
					&& window.matchMedia('(prefers-reduced-motion: reduce)').matches;

				const readPalette = () => {
					const card = stage.closest('.tb_card');
					const computed = getComputedStyle(card === null ? stage : card);
					const read = (name, fallback) => {
						const value = computed.getPropertyValue(name).trim();
						return value.length > 0 ? value : fallback;
					};
					const dark = document.body.hasAttribute('data-ds-dark-theme');
					// The whole fill is derived from the product accent, so the track
					// reads as DeepSeek blue in every theme and follows a theme override.
					const blue = parseColor(read('--tb-accent', '#4d6bfe')) ?? [77, 107, 254];
					paletteRef.current = {
						dark,
						fill1: mixRgb(blue, dark ? [16, 24, 74] : [30, 44, 132], dark ? 0.3 : 0.42),
						fill2: blue,
						fill3: mixRgb(blue, dark ? [176, 210, 255] : [190, 216, 255], dark ? 0.55 : 0.42),
					};
				};

				const measure = () => {
					const width = Math.max(1, track.clientWidth);
					const height = Math.max(1, track.clientHeight);
					const pad = Math.min(14, width * 0.06);
					const next = {
						w: width,
						h: height,
						pad,
						usable: Math.max(1, width - pad * 2),
						stageW: Math.max(1, stage.clientWidth),
						stageH: Math.max(1, stage.clientHeight),
					};
					const previous = metricsRef.current;
					metricsRef.current = next;
					if (previous.w !== next.w || previous.h !== next.h || Math.abs(previous.pad - next.pad) > 0.01) {
						setMetrics({ w: next.w, h: next.h, pad: next.pad, usable: next.usable });
					}
				};

				const sizeCanvases = () => {
					const dpr = Math.min(window.devicePixelRatio || 1, 2);
					const { w, h, stageW, stageH } = metricsRef.current;
					const trackW = Math.max(1, Math.round(w * dpr));
					const trackH = Math.max(1, Math.round(h * dpr));
					if (trackCanvas.width !== trackW) trackCanvas.width = trackW;
					if (trackCanvas.height !== trackH) trackCanvas.height = trackH;
					const fxW = Math.max(1, Math.round((stageW + FX_PAD * 2) * dpr));
					const fxH = Math.max(1, Math.round((stageH + FX_PAD * 2) * dpr));
					if (fxCanvas.width !== fxW) fxCanvas.width = fxW;
					if (fxCanvas.height !== fxH) fxCanvas.height = fxH;
				};

				const drawTrack = (t, now) => {
					const context = trackCanvas.getContext('2d');
					if (context === null) return;
					const { w, h, pad, usable } = metricsRef.current;
					const palette = paletteRef.current;
					if (palette === null) return;
					const dpr = trackCanvas.width / Math.max(1, w);
					context.setTransform(dpr, 0, 0, dpr, 0, 0);
					context.clearRect(0, 0, w, h);
					const thumbX = pad + t * usable;
					if (thumbX <= 0.5) return;

					// 1) Brand-blue fill: solid DeepSeek blue growing into a lighter edge.
					const fill = context.createLinearGradient(0, 0, thumbX, 0);
					fill.addColorStop(0, rgba(palette.fill1, 0.32 + t * 0.28));
					fill.addColorStop(0.5, rgba(palette.fill2, 0.58 + t * 0.26));
					fill.addColorStop(1, rgba(palette.fill3, 0.86 + t * 0.12));
					context.fillStyle = fill;
					context.fillRect(0, 0, thumbX, h);
					context.fillStyle = rgba(palette.fill3, 0.92);
					context.fillRect(Math.max(0, thumbX - 1.4), 0, 1.4, h);

					// 2) Pixel mosaic shimmer, only once the effort is high enough.
					const mosaic = clamp01((t - 0.55) / 0.3);
					if (mosaic < 0.01) return;
					const cell = 4.2;
					const gap = 1.4;
					const pitch = cell + gap;
					const rows = MOSAIC_ROWS;
					const yOffset = (h - (rows * pitch - gap)) * 0.5;
					const columns = Math.ceil(thumbX / pitch);
					const time = now * 0.001;
					for (let seedIndex = 0; seedIndex < CELL_SEEDS.length; seedIndex += 1) {
						const seed = CELL_SEEDS[seedIndex];
						if (seed.c >= columns) continue;
						const x = 2 + seed.c * pitch;
						if (x > thumbX - 2) continue;
						const progress = clamp01(x / Math.max(1, thumbX));
						const density = Math.pow(progress, 1.6);
						const twinkle = 0.5 + 0.5 * Math.sin(time * seed.speed + seed.phase);
						if (seed.threshold > density * 0.92 + twinkle * 0.28) continue;
						const y = yOffset + seed.r * pitch;
						const paletteIndex = Math.min(
							PIXEL_PALETTE.length - 1,
							Math.floor(((seed.hueRoll + progress * 0.45 + twinkle * 0.22) % 1) * PIXEL_PALETTE.length),
						);
						const color = PIXEL_PALETTE[paletteIndex];
						const alpha = clamp01((0.16 + density * 0.7) * (0.4 + twinkle * 0.7) * mosaic);
						context.fillStyle = 'rgba(' + color[0] + ', ' + color[1] + ', ' + color[2] + ', ' + alpha.toFixed(3) + ')';
						context.fillRect(x, y, cell, cell);
					}
				};

				const drawFx = (t, now) => {
					const context = fxCanvas.getContext('2d');
					if (context === null) return;
					const { stageW, stageH, pad, usable } = metricsRef.current;
					const palette = paletteRef.current;
					if (palette === null) return;
					const dpr = fxCanvas.width / Math.max(1, stageW + FX_PAD * 2);
					context.setTransform(dpr, 0, 0, dpr, 0, 0);
					const width = stageW + FX_PAD * 2;
					const height = stageH + FX_PAD * 2;
					context.clearRect(0, 0, width, height);

					const thumbX = pad + t * usable;
					const cx = FX_PAD + thumbX;
					const cy = FX_PAD + stageH / 2;
					const glow = clamp01((t - 0.58) / 0.24);
					const galaxy = clamp01((t - 0.88) / 0.12);
					const time = now * 0.001;
					// Light surfaces wash out under a big halo, so it stays lower there.
					const strength = palette.dark ? 1 : 0.66;

					if (glow > 0.01) {
						const radius = 24 + glow * 12 + Math.sin(time * 2.4) * 2.5;
						const halo = context.createRadialGradient(cx, cy, 3, cx, cy, radius);
						if (galaxy > 0.2) {
							halo.addColorStop(0, 'rgba(186, 230, 253, ' + (0.4 * glow * strength).toFixed(3) + ')');
							halo.addColorStop(0.45, 'rgba(109, 134, 255, ' + (0.28 * glow * strength).toFixed(3) + ')');
							halo.addColorStop(1, 'rgba(77, 107, 254, 0)');
						} else {
							halo.addColorStop(0, 'rgba(206, 219, 255, ' + (0.38 * glow * strength).toFixed(3) + ')');
							halo.addColorStop(0.5, 'rgba(109, 134, 255, ' + (0.22 * glow * strength).toFixed(3) + ')');
							halo.addColorStop(1, 'rgba(77, 107, 254, 0)');
						}
						context.fillStyle = halo;
						context.beginPath();
						context.arc(cx, cy, radius, 0, Math.PI * 2);
						context.fill();

						for (let particleIndex = 0; particleIndex < PARTICLES.length; particleIndex += 1) {
							const particle = PARTICLES[particleIndex];
							const cycle = (time * particle.speed + particle.phase) % 1;
							const radiusNow = 12 + cycle * (21 + galaxy * 12);
							const px = cx + Math.cos(particle.angle + time * 0.25) * radiusNow;
							const py = cy + Math.sin(particle.angle + time * 0.25) * radiusNow;
							const alpha = Math.sin(cycle * Math.PI) * glow * 0.85;
							if (alpha <= 0.02) continue;
							context.globalAlpha = alpha;
							context.fillStyle = 'rgb(' + particle.color + ')';
							context.beginPath();
							context.arc(px, py, particle.size * (0.7 + 0.3 * galaxy), 0, Math.PI * 2);
							context.fill();
						}
						context.globalAlpha = 1;
					}

					if (galaxy > 0.02) {
						for (let rayIndex = 0; rayIndex < RAYS.length; rayIndex += 1) {
							const ray = RAYS[rayIndex];
							const angle = ray.baseAngle + Math.sin(time * 0.6 + ray.phase) * 0.03;
							const pulse = 0.65 + 0.35 * Math.sin(time * 2.8 + ray.phase);
							for (let dot = 0; dot < ray.dots; dot += 1) {
								const frac = (dot + 1) / ray.dots;
								const distance = 15 + frac * ray.length * (0.85 + 0.15 * galaxy);
								const rx = cx + Math.cos(angle) * distance;
								const ry = cy + Math.sin(angle) * distance;
								const alpha = (1 - frac * 0.82) * pulse * galaxy * 0.85 * strength;
								const radius = lerp(1.35, 0.55, frac);
								context.fillStyle = 'rgba(' + ray.color + ', ' + alpha.toFixed(3) + ')';
								context.beginPath();
								context.arc(rx, ry, radius, 0, Math.PI * 2);
								context.fill();
							}
						}
					}
				};

				const applyBrain = (t) => {
					const refs = brainRef.current;
					const tint = brainPalette(t);
					if (refs.s1 !== undefined && refs.s1 !== null) refs.s1.setAttribute('stop-color', tint.c1);
					if (refs.s2 !== undefined && refs.s2 !== null) refs.s2.setAttribute('stop-color', tint.c2);
					if (refs.s3 !== undefined && refs.s3 !== null) refs.s3.setAttribute('stop-color', tint.c3);
					if (refs.outline !== undefined && refs.outline !== null) {
						refs.outline.setAttribute('stroke', tint.outline);
						refs.outline.setAttribute('fill', tint.outline);
					}
					if (refs.folds !== undefined && refs.folds !== null) refs.folds.setAttribute('stroke', tint.folds);
					if (thumbInnerRef.current !== null) thumbInnerRef.current.style.filter = tint.glow;
				};

				const draw = (now) => {
					const anim = animRef.current;
					const t = clamp01(anim.visualT);
					const { pad, usable } = metricsRef.current;
					if (thumbRef.current !== null) thumbRef.current.style.left = (pad + t * usable).toFixed(2) + 'px';
					applyBrain(t);
					drawTrack(t, now);
					drawFx(t, now);
					anim.drawnT = t;
				};

				const sync = () => {
					measure();
					sizeCanvases();
					readPalette();
					animRef.current.drawnT = -1;
				};

				sync();

				const onResize = () => { sync(); };
				const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null;
				if (resizeObserver !== null) {
					resizeObserver.observe(stage);
					resizeObserver.observe(track);
				}
				window.addEventListener('resize', onResize);

				const attributeObserver = typeof MutationObserver === 'function' ? new MutationObserver((records) => {
					if (records.some((record) => record.attributeName === 'data-ds-dark-theme')) {
						readPalette();
						animRef.current.drawnT = -1;
					}
				}) : null;
				if (attributeObserver !== null) {
					attributeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] });
				}

				const loop = (now) => {
					if (!alive) return;
					const anim = animRef.current;
					const target = anim.targetT;
					if (reduced) {
						anim.visualT = target;
					} else {
						const diff = target - anim.visualT;
						if (Math.abs(diff) > 0.0004) {
							anim.visualT += diff * (anim.dragging ? 0.42 : 0.22);
							if (Math.abs(target - anim.visualT) < 0.0008) anim.visualT = target;
						} else {
							anim.visualT = target;
						}
					}
					// Below the mosaic threshold nothing animates once settled; the
					// loop keeps running so a later change (or a theme switch, which
					// resets drawnT) still repaints immediately.
					const settled = anim.visualT === target && !anim.dragging;
					const animating = !settled || anim.visualT > 0.55;
					if (!reduced && !animating && anim.drawnT === anim.visualT) {
						raf = requestAnimationFrame(loop);
						return;
					}
					if (!reduced || anim.drawnT !== anim.visualT) draw(now);
					raf = requestAnimationFrame(loop);
				};
				raf = requestAnimationFrame(loop);

				return () => {
					alive = false;
					cancelAnimationFrame(raf);
					window.removeEventListener('resize', onResize);
					if (resizeObserver !== null) resizeObserver.disconnect();
					if (attributeObserver !== null) attributeObserver.disconnect();
				};
			}, []);

			/* ---------- follow the committed index ---------- */

			useEffect(() => {
				animRef.current.targetT = tOf(index);
			}, [index, tOf]);

			/* ---------- pointer + keyboard ---------- */

			const indexFromClientX = useCallback((clientX) => {
				const track = trackRef.current;
				if (track === null) return 0;
				const rect = track.getBoundingClientRect();
				const { pad, usable } = metricsRef.current;
				const raw = (clientX - rect.left - pad) / Math.max(1, usable);
				return Math.round(clamp01(raw) * maxIndexRef.current);
			}, []);

			const startDrag = useCallback((event) => {
				if (disabled) return;
				if (event.button !== undefined && event.button !== 0) return;
				event.preventDefault();
				animRef.current.dragging = true;
				setDragging(true);
				const next = indexFromClientX(event.clientX);
				animRef.current.targetT = tOf(next);
				dragRef.current = next;
				setDragIndex(next);
				onPreview(next);
				try {
					event.currentTarget.setPointerCapture(event.pointerId);
				} catch (error) {
					/* capture is an optimization; the handlers still work */
				}
			}, [disabled, indexFromClientX, onPreview, tOf]);

			const moveDrag = useCallback((event) => {
				if (!animRef.current.dragging) return;
				const next = indexFromClientX(event.clientX);
				if (dragRef.current === next) return;
				dragRef.current = next;
				setDragIndex(next);
				onPreview(next);
				animRef.current.targetT = tOf(next);
			}, [indexFromClientX, onPreview, tOf]);

			const endDrag = useCallback((cancelled) => {
				if (!animRef.current.dragging) return;
				animRef.current.dragging = false;
				setDragging(false);
				const finalIndex = dragRef.current;
				dragRef.current = null;
				setDragIndex(null);
				onPreview(null);
				// Compare against the CONFIRMED index: `index` is the preview-inclusive
				// display value, so comparing it here would always look unchanged.
				if (!cancelled && finalIndex !== null && finalIndex !== committedIndex) onCommit(finalIndex);
			}, [committedIndex, onCommit, onPreview]);

			// Key repeats stage locally; the trailing commit keeps one gesture to one
			// selection instead of one per repeat.
			const flushKeyCommit = useCallback(() => {
				keyTimerRef.current = 0;
				const target = keyTargetRef.current;
				keyTargetRef.current = null;
				if (target === null || target === committedIndex) {
					onPreview(null);
					return;
				}
				onCommit(target);
				onPreview(null);
			}, [committedIndex, onCommit, onPreview]);

			const onKeyDown = useCallback((event) => {
				if (disabled) return;
				const current = keyTargetRef.current !== null ? keyTargetRef.current : dragIndex === null ? index : dragIndex;
				let next = null;
				if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(maxIndex, current + 1);
				else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(0, current - 1);
				else if (event.key === 'Home') next = 0;
				else if (event.key === 'End') next = maxIndex;
				if (next === null) return;
				event.preventDefault();
				if (next === current) return;
				keyTargetRef.current = next;
				onPreview(next);
				window.clearTimeout(keyTimerRef.current);
				keyTimerRef.current = window.setTimeout(flushKeyCommit, 180);
			}, [disabled, dragIndex, flushKeyCommit, index, maxIndex, onPreview]);

			useEffect(() => () => { window.clearTimeout(keyTimerRef.current); }, []);

			/* ---------- rendering ---------- */

			const markerItems = useMemo(() => {
				const width = Math.max(1, metrics.w);
				return stops.map((stop, stopIndex) => {
					const position = (metrics.pad + tOf(stopIndex) * metrics.usable) / width * 100;
					return h('span', {
						key: 'marker-' + String(stop.id === undefined ? 'default' : stop.id),
						className: 'tb_marker',
						'data-default': stopIndex === props.defaultIndex ? 'true' : 'false',
						'data-passed': stopIndex <= shown ? 'true' : 'false',
						style: { left: position + '%' },
					});
				});
			}, [metrics, props.defaultIndex, shown, stops, tOf]);

			// Long effort lists (a pi-ai model can advertise seven levels plus the
			// provider default) would collide, so only the reached stop keeps a
			// caption; the header already carries the value.
			const tickItems = useMemo(() => {
				const width = Math.max(1, metrics.w);
				const crowded = stops.length > 5;
				const indexes = crowded ? (stops.length === 0 ? [] : [shown]) : stops.map((stop, stopIndex) => stopIndex);
				return indexes.map((stopIndex) => {
					const stop = stops[stopIndex];
					const position = (metrics.pad + tOf(stopIndex) * metrics.usable) / width * 100;
					let alignment = 'translateX(-50%)';
					if (!crowded) {
						if (stopIndex === 0) alignment = 'none';
						else if (stopIndex === stops.length - 1) alignment = 'translateX(-100%)';
					} else if (position < 12) alignment = 'none';
					else if (position > 88) alignment = 'translateX(-100%)';
					return h('span', {
						key: 'tick-' + String(stop.id === undefined ? 'default' : stop.id),
						className: 'tb_tick',
						'data-active': stopIndex === shown ? 'true' : 'false',
						style: { left: position + '%', transform: alignment },
					},
						labelOf(stop),
						// The tall marker means "the model's declared default"; label it
						// where it is instead of spending a second text line on it.
						stopIndex === props.defaultIndex ? h('span', { className: 'tb_tickFlag' }, t('defaults')) : null,
					);
				});
			}, [labelOf, metrics, props.defaultIndex, shown, stops, t, tOf]);

			return h('div', { className: 'tb_sliderBlock' },
				h('div', {
					ref: stageRef,
					className: 'tb_slider',
					role: 'slider',
					tabIndex: disabled ? -1 : 0,
					'aria-label': t('aria'),
					'aria-valuemin': '0',
					'aria-valuemax': String(maxIndex),
					'aria-valuenow': String(shown),
					'aria-valuetext': labelOf(activeStop),
					'aria-disabled': disabled ? 'true' : undefined,
					'data-dragging': dragging ? 'true' : 'false',
					onPointerDown: startDrag,
					onPointerMove: moveDrag,
					onPointerUp: () => endDrag(false),
					onPointerCancel: () => endDrag(true),
					onKeyDown,
				},
					h('canvas', { ref: fxCanvasRef, className: 'tb_fx', 'aria-hidden': 'true' }),
					h('div', { ref: trackRef, className: 'tb_track', 'aria-hidden': 'true' },
						h('canvas', { ref: trackCanvasRef, className: 'tb_trackCanvas' }),
						h('div', { className: 'tb_markers' }, markerItems),
					),
					h('div', { ref: thumbRef, className: 'tb_thumb', 'aria-hidden': 'true' },
						h('div', { ref: thumbInnerRef, className: 'tb_thumbInner' },
							h(BrainThumbArt, { gradientId: gradientIdRef.current, refs: brainRef.current }),
						),
					),
				),
				h('div', { className: 'tb_ticks', 'aria-hidden': 'true' }, tickItems),
			);
		}

		/* =========================================================================
		 * 8. The anchored card
		 * ========================================================================= */

		/**
		 * The popover: header with the morphing level name, the model context,
		 * the slider, and the level description. It owns the optimistic index so
		 * the UI moves on the same frame the user acts, then reconciles with the
		 * shared directory snapshot (and surfaces a failed selection instead of
		 * silently snapping back).
		 *
		 * @param props - copy, projected model info, anchor rect, close/select.
		 */
		function EffortPopover(props) {
			const { t, info, anchor, anchorRef, onClose, select, error } = props;
			const cardRef = useRef(null);
			const [optimistic, setOptimistic] = useState(null);
			const [preview, setPreview] = useState(null);
			const settleTimer = useRef(0);
			const stops = info.stops;
			const index = info.index;

			const labelOf = useCallback((stop) => {
				if (stop === undefined) return '';
				if (stop.providerDefault === true) return t('providerDefault');
				return typeof stop.name === 'string' && stop.name.length > 0 ? stop.name : String(stop.id);
			}, [t]);

			// A store-driven change settles whatever we predicted locally.
			useEffect(() => {
				setOptimistic(null);
				window.clearTimeout(settleTimer.current);
			}, [index]);

			// A refused selection clears the prediction at once; the message is shown
			// from the store's own error text.
			useEffect(() => {
				if (error === undefined || error === null || error === '') return;
				setOptimistic(null);
				window.clearTimeout(settleTimer.current);
			}, [error]);

			useEffect(() => () => { window.clearTimeout(settleTimer.current); }, []);

			const commit = useCallback((nextIndex) => {
				const stop = stops[nextIndex];
				const current = info.current;
				if (stop === undefined || current === null) return;
				if (nextIndex === info.index) return;
				setOptimistic(nextIndex);
				window.clearTimeout(settleTimer.current);
				settleTimer.current = window.setTimeout(() => setOptimistic(null), 1800);
				const selection = { provider: current.provider, model: current.model };
				// The provider-default stop must OMIT the field, not send a level.
				if (stop.id !== undefined) selection.reasoningEffort = stop.id;
				try {
					const outcome = select(selection);
					if (outcome !== undefined && outcome !== null && typeof outcome.catch === 'function') outcome.catch(() => {});
				} catch (selectionError) {
					setOptimistic(null);
				}
			}, [info, select, stops]);

			// Dismiss on outside press / Escape; keep the trigger's own click working.
			useEffect(() => {
				const onPointerDown = (event) => {
					const card = cardRef.current;
					const target = event.target;
					if (card !== null && target instanceof Node && card.contains(target)) return;
					const trigger = anchorRef !== undefined && anchorRef !== null ? anchorRef.current : null;
					if (trigger !== null && target instanceof Node && trigger.contains(target)) return;
					// Do not pull focus back: the user is clicking somewhere else on purpose.
					onClose(false);
				};
				const onKeyDown = (event) => {
					if (event.key !== 'Escape') return;
					event.preventDefault();
					event.stopPropagation();
					onClose(true);
				};
				document.addEventListener('pointerdown', onPointerDown, true);
				document.addEventListener('keydown', onKeyDown, true);
				return () => {
					document.removeEventListener('pointerdown', onPointerDown, true);
					document.removeEventListener('keydown', onKeyDown, true);
				};
			}, [anchorRef, onClose]);

			// Move focus into the card so the keyboard reaches the slider at once.
			useEffect(() => {
				const frame = requestAnimationFrame(() => {
					const slider = cardRef.current === null ? null : cardRef.current.querySelector('.tb_slider');
					if (slider instanceof HTMLElement) slider.focus();
				});
				return () => cancelAnimationFrame(frame);
			}, []);

			const displayIndex = preview !== null ? preview : optimistic !== null ? optimistic : index;
			const safeIndex = stops.length === 0 ? 0 : Math.max(0, Math.min(displayIndex, stops.length - 1));
			const activeStop = stops[safeIndex];
			const level = stops.length <= 1 ? 0 : safeIndex / (stops.length - 1);

			const cardWidth = Math.min(336, Math.max(240, window.innerWidth - 24));
			const left = Math.max(12, Math.min(anchor.left + anchor.width / 2 - cardWidth / 2, window.innerWidth - cardWidth - 12));
			const bottom = Math.max(12, window.innerHeight - anchor.top + 10);
			const tier = activeStop !== undefined && activeStop.providerDefault === true
				? 'normal'
				: level > 0.9 ? 'galaxy' : level > 0.6 ? 'max' : 'normal';

			let body;
			if (info.mode === 'levels') {
				const described = activeStop !== undefined && typeof activeStop.description === 'string'
					? activeStop.description.trim()
					: '';
				const description = activeStop !== undefined && activeStop.providerDefault === true
					? t('providerDefaultHint')
					: described.length > 0 ? described : t('hint');
				body = h(Fragment, null,
					h(EffortSlider, {
						t,
						stops,
						index: safeIndex,
						committedIndex: index,
						defaultIndex: info.defaultIndex,
						onPreview: setPreview,
						onCommit: commit,
					}),
					h('div', { className: 'tb_foot' },
						h('div', { className: 'tb_desc' },
							h('span', { className: 'tb_descText' }, description),
						),
						error !== undefined && error !== null && error !== ''
							? h('div', { className: 'tb_error', role: 'status' }, t('error', { message: error }))
							: null,
					),
				);
			} else if (info.mode === 'single') {
				body = h('div', { className: 'tb_empty' }, t('singleLevel'));
			} else if (info.mode === 'no-levels') {
				body = h('div', { className: 'tb_empty' }, t('noLevels'));
			} else if (info.mode === 'error' || info.mode === 'unavailable') {
				body = h('div', { className: 'tb_empty' }, t('unavailable'));
			} else {
				body = h('div', { className: 'tb_empty' }, t('loading'));
			}

			return h('div', {
				ref: cardRef,
				className: 'tb_card',
				role: 'dialog',
				'aria-modal': 'false',
				'aria-label': t('title'),
				'data-tier': tier,
				style: { left: left + 'px', bottom: bottom + 'px' },
			},
				h('div', { className: 'tb_head' },
					h('span', { className: 'tb_kicker' }, t('title')),
					h(MorphLabel, { text: activeStop !== undefined ? labelOf(activeStop) : '' }),
					h('span', { className: 'tb_headSpacer' }),
					h('button', {
						type: 'button',
						className: 'tb_close',
						onClick: () => onClose(true),
						title: t('close'),
						'aria-label': t('close'),
					}, h(CloseIcon)),
				),
				h('div', { className: 'tb_model' },
					h('span', { className: 'tb_modelText' }, info.modelName.length > 0 ? info.modelName : t('loading')),
					stops.length > 1 ? h('span', { className: 'tb_chip' }, t('levels', { count: stops.length })) : null,
				),
				body,
			);
		}

		/* =========================================================================
		 * 9. The composer seat
		 * ========================================================================= */

		/**
		 * Composer seat: brain button plus its portal card. It resolves nothing
		 * itself — the registration injects the session's shared directory store
		 * and select call, so this component stays a pure view of that store.
		 *
		 * @param props - injected face + locale seat.
		 */
		function ThinkingBrain(props) {
			const { t, useModelState, select, load } = props;
			const state = useModelState((snapshot) => snapshot);
			const [open, setOpen] = useState(false);
			const [anchor, setAnchor] = useState(null);
			const seatRef = useRef(null);
			const info = useMemo(() => deriveModelInfo(state), [state]);
			const error = state === undefined || state === null || state.error === undefined ? null : state.error;

			// The model menu owns the catalog load; ask once anyway so a seat
			// rendered before that menu still resolves its own data.
			useEffect(() => {
				if (typeof load !== 'function') return;
				try {
					const outcome = load();
					if (outcome !== undefined && outcome !== null && typeof outcome.catch === 'function') outcome.catch(() => {});
				} catch (loadError) {
					/* unavailable sessions surface through the store instead */
				}
			}, [load]);

			const readAnchor = useCallback(() => {
				const element = seatRef.current;
				if (element === null || element.isConnected === false) return null;
				const rect = element.getBoundingClientRect();
				// A hidden composer collapses the trigger; keep the card from jumping.
				if (rect.width <= 0 && rect.height <= 0) return null;
				return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
			}, []);

			const close = useCallback((restoreFocus = true) => {
				setOpen(false);
				if (restoreFocus !== true) return;
				const element = seatRef.current;
				if (element !== null) requestAnimationFrame(() => element.focus());
			}, []);

			// The composer can grow or the card move while the popover is open;
			// poll the trigger's own rect so the card keeps hugging it.
			useEffect(() => {
				if (!open) return undefined;
				let timer = 0;
				let last = '';
				setAnchor(readAnchor());
				const tick = () => {
					const next = readAnchor();
					if (next === null) {
						close(false);
						return;
					}
					const key = Math.round(next.left * 2) + ':' + Math.round(next.top * 2) + ':' + Math.round(next.width * 2);
					if (key !== last) {
						last = key;
						setAnchor(next);
					}
					timer = window.setTimeout(tick, 180);
				};
				timer = window.setTimeout(tick, 180);
				const onResize = () => {
					const next = readAnchor();
					if (next === null) close(false);
					else setAnchor(next);
				};
				window.addEventListener('resize', onResize);
				return () => {
					window.clearTimeout(timer);
					window.removeEventListener('resize', onResize);
				};
			}, [close, open, readAnchor]);

			return h(Fragment, null,
				h('button', {
					ref: seatRef,
					type: 'button',
					className: 'tb_seat',
					'data-open': open ? 'true' : 'false',
					'aria-label': t('seatAria'),
					'aria-haspopup': 'dialog',
					'aria-expanded': open ? 'true' : 'false',
					title: t('seat'),
					onClick: () => { setOpen((value) => !value); },
				}, h(SeatBrainIcon)),
				open && anchor !== null
					? createPortal(
						h(EffortPopover, {
							t,
							info,
							anchor,
							anchorRef: seatRef,
							onClose: close,
							select,
							error,
						}),
						document.body,
					)
					: null,
			);
		}

		/* =========================================================================
		 * 10. Registration
		 * ========================================================================= */

		const inject = ['slots', 'locale'];

		/**
		 * @param ctx - Client cordis context.
		 */
		function apply(ctx) {
			ctx.effect(() => installStyles(), 'thinking-brain: stylesheet');
			ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'thinking-brain: dictionaries');

			// The seat rides on the model-selection service: without it there is no
			// shared directory to control, so the whole seat stays absent instead of
			// rendering a control that cannot work.
			ctx.inject(['slots', 'modelDirectories'], (scope) => {
				const seats = scope.slots;
				const directories = scope.modelDirectories;
				seats.inject('conversation.input.right', () => seats.register({
					name: 'conversation.input.right',
					id: 'thinking-brain',
					order: 40,
					locale: NS,
					inject: (sessionId) => {
						try {
							const directory = directories.directoryFor(sessionId);
							return {
								hooks: { modelState: directory.store },
								load: () => directory.load(),
								select: (selection) => directory.select(selection),
							};
						} catch (error) {
							return { hooks: { modelState: EMPTY_OBSERVABLE } };
						}
					},
				}, ThinkingBrain));
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.ThinkingBrain = ThinkingBrain;
		return module.exports;
	},
});
