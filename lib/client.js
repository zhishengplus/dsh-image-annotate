/**
 * dsh-image-annotate — 浏览器半区（client half）。
 *
 * 给 DSH Web 的图片预览（ImageLightbox，body 级 portal 的
 * `div[role="dialog"][aria-modal="true"] > img`）加一支画笔：
 *
 *   1. 预览打开时，右下角出现「标注」按钮；
 *   2. 点它进入标注模式：画笔 / 箭头 / 方框 / 圆圈 / 文字 / 擦除，
 *      可选颜色与粗细，支持撤销、重做、清空；
 *   3. 「加入输入框」把原图与标注合成一张 PNG，塞进当前会话的输入框
 *      （优先合成 paste 事件，失败退回拖放、剪贴板、下载三条路），
 *      关掉预览，用户接着打字发送即可——模型看到的就是标注后的图。
 *
 * 设计取舍：
 *   - 不依赖任何 dsh 内部包/服务：整包就是一个 `window.__ModuleLoader__.load`
 *     工厂，手写、无构建步骤，改动即被 client-modules 的 HMR 按 mtime 感知。
 *   - 不注册 slot、不接管原有 lightbox：只在预览 DOM 上叠加一层，
 *     预览关闭即整体消失，宿主 React 重渲染也不会被我们改坏。
 *   - 所有笔迹都以「原图像素坐标」存储，因此叠加显示、导出、
 *     窗口缩放三者永远一致。
 */
window.__ModuleLoader__.load({
	id: "@dsh-plugin/dsh-image-annotate",
	factory: (require) => {
		'use strict';

		var module = { exports: {} };
		var exports = module.exports;

		/* ==================================================================
		 * 常量与基础工具
		 * ================================================================== */

		var PKG_ID = '@dsh-plugin/dsh-image-annotate';
		var LOG_PREFIX = '[image-annotate]';

		/** 调试开关：localStorage['@dsh-plugin/dsh-image-annotate.debug'] = '1' */
		function debugEnabled() {
			try {
				return localStorage.getItem(PKG_ID + '.debug') === '1';
			} catch (error) {
				return false;
			}
		}

		function log() {
			if (!debugEnabled()) return;
			var args = Array.prototype.slice.call(arguments);
			args.unshift(LOG_PREFIX);
			console.log.apply(console, args);
		}

		function warn() {
			var args = Array.prototype.slice.call(arguments);
			args.unshift(LOG_PREFIX);
			console.warn.apply(console, args);
		}

		function clamp(value, min, max) {
			return Math.max(min, Math.min(max, value));
		}

		function stamp() {
			var d = new Date();
			function pad(n) {
				return n < 10 ? '0' + n : String(n);
			}
			return (
				String(d.getFullYear()) +
				pad(d.getMonth() + 1) +
				pad(d.getDate()) +
				'-' +
				pad(d.getHours()) +
				pad(d.getMinutes()) +
				pad(d.getSeconds())
			);
		}

		function svgIcon(pathData) {
			var NS = 'http://www.w3.org/2000/svg';
			var svg = document.createElementNS(NS, 'svg');
			svg.setAttribute('viewBox', '0 0 24 24');
			svg.setAttribute('width', '16');
			svg.setAttribute('height', '16');
			svg.setAttribute('fill', 'none');
			svg.setAttribute('stroke', 'currentColor');
			svg.setAttribute('stroke-width', '1.7');
			svg.setAttribute('stroke-linecap', 'round');
			svg.setAttribute('stroke-linejoin', 'round');
			svg.setAttribute('aria-hidden', 'true');
			var path = document.createElementNS(NS, 'path');
			path.setAttribute('d', pathData);
			svg.appendChild(path);
			return svg;
		}

		function iconButton(iconPath, label, extraClass) {
			var button = document.createElement('button');
			button.type = 'button';
			button.className = 'dsa-btn' + (extraClass ? ' ' + extraClass : '');
			button.title = label;
			button.setAttribute('aria-label', label);
			button.appendChild(svgIcon(iconPath));
			return button;
		}

		/* ==================================================================
		 * 文案（中英双语，跟随界面语言）
		 * ================================================================== */

		var DICT = {
			zh: {
				annotate: '标注',
				annotateTitle: '标注图片：圈画后把标注图发给 DSH',
				select: '选择 / 移动 (V)',
				pen: '画笔',
				arrow: '箭头',
				rect: '方框',
				ellipse: '圆圈',
				text: '文字',
				eraser: '擦除',
				undo: '撤销 (Ctrl+Z)',
				redo: '重做 (Ctrl+Shift+Z)',
				clear: '清空全部',
				deleteSelected: '删除选中 (Delete)',
				attach: '加入输入框',
				attachTitle: '把标注后的图片放进输入框',
				download: '下载标注图 PNG',
				exit: '退出标注',
				textPlaceholder: '打字后回车',
				empty: '先画点什么再发送吧',
				working: '正在生成标注图…',
				attached: '已加入输入框，输入文字后发送即可',
				uncertain: '已复制到剪贴板，按 Ctrl+V 贴进输入框',
				downloaded: '标注图已下载',
				exportFailed: '导出标注图失败',
				noEditor: '没找到输入框：请先打开一个会话再标注',
				selected: '已选中：拖动移动，双击文字改字，Delete 删除',
				color_red: '红色',
				color_amber: '橙色',
				color_yellow: '黄色',
				color_green: '绿色',
				color_blue: '蓝色',
				color_brand: '品牌蓝',
				color_ink: '黑色',
				color_paper: '白色'
			},
			en: {
				annotate: 'Annotate',
				annotateTitle: 'Annotate the image, then send the marked copy to DSH',
				select: 'Select / move (V)',
				pen: 'Pen',
				arrow: 'Arrow',
				rect: 'Box',
				ellipse: 'Circle',
				text: 'Text',
				eraser: 'Erase',
				undo: 'Undo (Ctrl+Z)',
				redo: 'Redo (Ctrl+Shift+Z)',
				clear: 'Clear all',
				deleteSelected: 'Delete selection (Delete)',
				attach: 'Add to composer',
				attachTitle: 'Put the annotated image into the composer',
				download: 'Download annotated PNG',
				exit: 'Exit annotation',
				textPlaceholder: 'Type, then Enter',
				empty: 'Draw something first',
				working: 'Rendering annotated image…',
				attached: 'Added to the composer — type your message and send',
				uncertain: 'Copied to clipboard — press Ctrl+V in the composer',
				downloaded: 'Annotated PNG downloaded',
				exportFailed: 'Failed to export the annotated image',
				noEditor: 'No composer found — open a session first',
				selected: 'Selected: drag to move, double-click text to edit, Delete to remove',
				color_red: 'Red',
				color_amber: 'Amber',
				color_yellow: 'Yellow',
				color_green: 'Green',
				color_blue: 'Blue',
				color_brand: 'Brand blue',
				color_ink: 'Black',
				color_paper: 'White'
			}
		};

		function detectLocale(ctx) {
			try {
				var locale = ctx && typeof ctx.get === 'function' ? ctx.get('locale') : undefined;
				var snapshot = locale && typeof locale.getLocale === 'function' ? locale.getLocale() : undefined;
				var id = snapshot && (snapshot.id || snapshot.locale || snapshot.language);
				if (typeof id === 'string' && id.length > 0) {
					return id.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
				}
			} catch (error) {
				/* 忽略：退回 navigator.language */
			}
			var nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
			return nav.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
		}

		function makeTranslator(ctx) {
			var lang = detectLocale(ctx);
			var table = DICT[lang] || DICT.en;
			return function t(key) {
				var value = table[key];
				return value === undefined ? key : value;
			};
		}

		/* ==================================================================
		 * 样式（只注入一次；用 dsh 主题 token，取不到时用暗色兜底）
		 * ================================================================== */

		var STYLE_TAG_ID = PKG_ID + '/styles.css';

		function injectStyles() {
			if (document.querySelector('style[data-plugin-css="' + STYLE_TAG_ID + '"]') !== null) return;
			var style = document.createElement('style');
			style.dataset.plugin = PKG_ID;
			style.dataset.pluginCss = STYLE_TAG_ID;
			style.textContent = [
				/* 全部走 dsh 原生设计 token（theme 包里的 --dsw-*），
				 * 取不到时退回同样的暗色近似值，保证任何主题下都不跑偏。 */
				'[data-dsa-root]{position:fixed;inset:0;pointer-events:none;z-index:2147482000;' +
					'font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",' +
					'"Hiragino Sans GB","Microsoft YaHei",sans-serif);font-size:14px;line-height:22px;' +
					'color:var(--dsw-alias-label-primary,#0f1115);-webkit-font-smoothing:antialiased}',
				'.dsa-canvas{position:fixed;pointer-events:none;touch-action:none;' +
					'border-radius:var(--dsw-radius-lg,12px);box-shadow:0 0 0 .5px var(--dsw-alias-border-l2-darkmode-thin,#0000001a)}',
				'.dsa-canvas[data-dsa-active="1"]{pointer-events:auto}',

				/* 「标注」入口 = 预览右上角关闭按钮的同款圆形按钮（右下角） */
				'.dsa-fab{position:fixed;right:20px;bottom:20px;pointer-events:auto;display:grid;place-items:center;' +
					'width:36px;height:36px;padding:0;border:.5px solid var(--dsw-alias-border-l2-darkmode-thin,#0000001a);' +
					'border-radius:999px;corner-shape:round;background:var(--dsw-specific-input-major,#fff);' +
					'color:var(--dsw-alias-label-primary,#0f1115);cursor:pointer;box-shadow:var(--dsw-elevation-panel)}',
				'.dsa-fab:hover{background:var(--dsw-alias-interactive-bg-hover-solid,#ebeef2)}',
				'.dsa-fab:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ' +
					'var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4176e6));outline-offset:3px}',

				/* 工具条 = 原生菜单浮层的材质与圆角 */
				'.dsa-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:20px;pointer-events:auto;display:flex;' +
					'align-items:center;gap:2px;padding:4px;border-radius:var(--dsw-radius-lg,12px);' +
					'background:var(--dsw-menu-surface-fill,var(--dsw-specific-input-major,#fff));' +
					'backdrop-filter:var(--dsw-menu-backdrop-filter,blur(40px) saturate(150%));' +
					'color:var(--dsw-alias-label-primary,#0f1115);box-shadow:var(--dsw-elevation-panel);' +
					/* left 已经占了 50%：不给 width:max-content 的话，盒子只按「left 右侧剩余空间」
					   收缩，稍宽就换行（原生 Toast 也踩过这个坑） */
					'width:max-content;max-width:min(96vw,940px);flex-wrap:wrap;justify-content:center}',

				'.dsa-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;' +
					'border:0;border-radius:var(--dsw-radius-md,8px);background:transparent;flex:none;' +
					'color:var(--dsw-alias-label-secondary,#545557);cursor:pointer;' +
					'transition:background .12s ease,color .12s ease}',
				'.dsa-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#2631480f);' +
					'color:var(--dsw-alias-label-primary,#0f1115)}',
				'.dsa-btn[data-dsa-on="1"]{background:var(--dsw-alias-button-tool-bar-fill,#ebeef2);' +
					'color:var(--dsw-alias-label-primary,#0f1115)}',
				'.dsa-btn[data-dsa-on="1"]:hover{background:var(--dsw-alias-button-tool-bar-hover,#e1e5ee)}',
				'.dsa-btn:disabled{opacity:.4;cursor:not-allowed}',
				'.dsa-btn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ' +
					'var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4176e6));outline-offset:-2px}',

				'.dsa-sep{width:1px;height:16px;margin:0 3px;flex:none;background:var(--dsw-alias-border-l3,#0000001f)}',

				'.dsa-swatch{width:18px;height:18px;margin:0 2px;padding:0;flex:none;border:0;border-radius:999px;' +
					'cursor:pointer;box-shadow:inset 0 0 0 1px #0000001f}',
				'.dsa-swatch[data-dsa-on="1"]{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:1px}',

				'.dsa-width{width:30px;height:30px;padding:0;flex:none;border:0;border-radius:var(--dsw-radius-md,8px);' +
					'background:transparent;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}',
				'.dsa-width:hover{background:var(--dsw-alias-interactive-bg-hover,#2631480f)}',
				'.dsa-width span{display:block;border-radius:999px;background:var(--dsw-alias-label-secondary,#545557)}',
				'.dsa-width[data-dsa-on="1"]{background:var(--dsw-alias-button-tool-bar-fill,#ebeef2)}',
				'.dsa-width[data-dsa-on="1"] span{background:var(--dsw-alias-label-primary,#0f1115)}',

				'.dsa-primary{display:inline-flex;align-items:center;gap:4px;height:30px;margin-left:3px;padding:0 12px;' +
					'border:0;border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-button-primary-fill,#4176e6);' +
					'color:var(--dsw-alias-label-primary-foreground,#fff);font-size:13px;line-height:20px;font-weight:500;' +
					'cursor:pointer;white-space:nowrap}',
				'.dsa-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#5686fe)}',
				'.dsa-primary[data-dsa-busy="1"]{opacity:.6;cursor:progress}',

				/* 提示条沿用原生 Toast 的面板：顶部居中、固定深色底 */
				'.dsa-toast{position:fixed;top:40px;left:50%;transform:translateX(-50%);pointer-events:none;' +
					'width:max-content;max-width:min(640px,calc(100vw - 48px));padding:12px 16px;text-align:center;' +
					'border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-toast-bg,#2b3244);' +
					'color:var(--dsw-alias-toast-label,#fff);font-size:14px;line-height:22px;box-shadow:var(--dsw-shadow-lv3)}',

				'.dsa-textinput{position:fixed;pointer-events:auto;min-width:160px;height:32px;padding:0 10px;' +
					'border:1px solid var(--dsw-alias-state-business-primary,#4176e6);border-radius:var(--dsw-radius-md,8px);' +
					'background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#0f1115);' +
					'font-family:inherit;font-size:14px;outline:none;box-shadow:var(--dsw-elevation-soft)}',

				'@media (prefers-reduced-motion:reduce){.dsa-btn,.dsa-fab{transition:none}}'
			].join('\n');
			document.head.appendChild(style);
		}

		/* ==================================================================
		 * 画笔定义（色板直接引用 dsh 原生色 token，随主题走）
		 * ================================================================== */

		var PALETTE = [
			{ id: 'red', token: '--dsw-static-red-500', fallback: '#e5484d' },
			{ id: 'amber', token: '--dsw-static-amber-500', fallback: '#f59e0b' },
			{ id: 'yellow', token: '--dsw-static-amber-400', fallback: '#f7ad31' },
			{ id: 'green', token: '--dsw-static-green-500', fallback: '#22c55e' },
			{ id: 'blue', token: '--dsw-static-blue-500', fallback: '#3b82f6' },
			{ id: 'brand', token: '--dsw-static-deepseek-450', fallback: '#5686fe' },
			{ id: 'ink', token: '--dsw-static-neutral-1000', fallback: '#000000' },
			{ id: 'paper', token: '--dsw-static-neutral-00', fallback: '#ffffff' }
		];

		/** 主题 token → 具体颜色值（canvas 只能吃具体值）。 */
		var colorCache = {};

		function tokenColor(entry) {
			if (Object.prototype.hasOwnProperty.call(colorCache, entry.token)) return colorCache[entry.token];
			var value = '';
			try {
				value = (getComputedStyle(document.body).getPropertyValue(entry.token) || '').trim();
			} catch (error) {
				value = '';
			}
			if (value.length === 0) value = entry.fallback;
			colorCache[entry.token] = value;
			return value;
		}

		function paletteEntry(id) {
			for (var i = 0; i < PALETTE.length; i++) {
				if (PALETTE[i].id === id) return PALETTE[i];
			}
			return PALETTE[0];
		}

		var TOOLS = [
			/* 「选择 / 移动」在最前：画完的每一笔都能再选回来拖位置 */
			{ id: 'select', icon: 'M12 3.8v16.4M3.8 12h16.4M12 3.8L9.6 6.2M12 3.8l2.4 2.4M12 20.2l-2.4-2.4M12 20.2l2.4-2.4M3.8 12l2.4-2.4M3.8 12l2.4 2.4M20.2 12l-2.4-2.4M20.2 12l-2.4 2.4' },
			{ id: 'pen', icon: 'M4.2 19.8l4.4-1L19.6 7.8a1.9 1.9 0 000-2.7l-1.6-1.6a1.9 1.9 0 00-2.7 0L4.3 14.4l-.9 4.4z' },
			{ id: 'arrow', icon: 'M5 19L19 5M19 5h-6.4M19 5v6.4' },
			{ id: 'rect', icon: 'M4.5 5.5h15v13h-15z' },
			{ id: 'ellipse', icon: 'M12 5.6c4.1 0 7.4 2.9 7.4 6.4s-3.3 6.4-7.4 6.4S4.6 15.5 4.6 12 7.9 5.6 12 5.6z' },
			{ id: 'text', icon: 'M5 6.5h14M12 6.5V19M9 19h6' },
			{ id: 'eraser', icon: 'M4.6 15.4l7-7 6.4 6.4-4 4H9.2l-4.6-3.4zM8.4 19.8h12' }
		];

		var ICONS = {
			undo: 'M9 15L4.5 10.5 9 6M4.5 10.5h9.4a5.6 5.6 0 010 11.2H9',
			redo: 'M15 15l4.5-4.5L15 6M19.5 10.5H10.1a5.6 5.6 0 000 11.2H15',
			trash: 'M5 7.5h14M9.5 7.5V5h5v2.5M7 7.5l.8 12h8.4l.8-12',
			download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 19.5h14',
			close: 'M6 6l12 12M18 6L6 18',
			check: 'M20 6.6L9.5 17.4 4 11.9',
			pen: 'M4.2 19.8l4.4-1L19.6 7.8a1.9 1.9 0 000-2.7l-1.6-1.6a1.9 1.9 0 00-2.7 0L4.3 14.4l-.9 4.4z'
		};

		/* ==================================================================
		 * 笔迹绘制：坐标全部是「原图像素」，因此缩放/导出共用同一套代码
		 * ================================================================== */

		function strokeBounds(points) {
			var minX = Infinity;
			var minY = Infinity;
			var maxX = -Infinity;
			var maxY = -Infinity;
			for (var i = 0; i < points.length; i++) {
				var point = points[i];
				if (point.x < minX) minX = point.x;
				if (point.y < minY) minY = point.y;
				if (point.x > maxX) maxX = point.x;
				if (point.y > maxY) maxY = point.y;
			}
			return { minX: minX, minY: minY, maxX: maxX, maxY: maxY, width: maxX - minX, height: maxY - minY };
		}

		function paintStroke(g, stroke) {
			var points = stroke.points || [];
			g.save();
			g.lineCap = 'round';
			g.lineJoin = 'round';
			g.strokeStyle = stroke.color;
			g.fillStyle = stroke.color;
			g.lineWidth = Math.max(0.6, stroke.width || 1);

			if (stroke.tool === 'pen') {
				if (points.length === 0) {
					/* 无点可画 */
				} else if (points.length === 1) {
					g.beginPath();
					g.arc(points[0].x, points[0].y, g.lineWidth / 2, 0, Math.PI * 2);
					g.fill();
				} else {
					g.beginPath();
					g.moveTo(points[0].x, points[0].y);
					for (var i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
					g.stroke();
				}
			} else if (stroke.tool === 'arrow') {
				var from = points[0];
				var to = points[points.length - 1];
				if (from && to) {
					var head = Math.max(g.lineWidth * 4.2, 9);
					var angle = Math.atan2(to.y - from.y, to.x - from.x);
					g.beginPath();
					g.moveTo(from.x, from.y);
					g.lineTo(to.x, to.y);
					g.stroke();
					g.beginPath();
					g.moveTo(to.x, to.y);
					g.lineTo(to.x - head * Math.cos(angle - 0.42), to.y - head * Math.sin(angle - 0.42));
					g.moveTo(to.x, to.y);
					g.lineTo(to.x - head * Math.cos(angle + 0.42), to.y - head * Math.sin(angle + 0.42));
					g.stroke();
				}
			} else if (stroke.tool === 'rect') {
				var rectBox = strokeBounds(points);
				if (rectBox.width > 0 || rectBox.height > 0) {
					g.strokeRect(rectBox.minX, rectBox.minY, rectBox.width, rectBox.height);
				}
			} else if (stroke.tool === 'ellipse') {
				/* 用整条轨迹的外接框，而不是「起点→终点」：这样手绘一圈
				 *（回到起点）与对角拖拽画椭圆都符合直觉。 */
				var ellipseBox = strokeBounds(points);
				if (ellipseBox.width > 0 || ellipseBox.height > 0) {
					g.beginPath();
					g.ellipse(
						(ellipseBox.minX + ellipseBox.maxX) / 2,
						(ellipseBox.minY + ellipseBox.maxY) / 2,
						ellipseBox.width / 2,
						ellipseBox.height / 2,
						0,
						0,
						Math.PI * 2
					);
					g.stroke();
				}
			} else if (stroke.tool === 'text') {
				var size = stroke.fontSize || g.lineWidth * 7;
				g.font = textFont(size);
				g.textBaseline = 'top';
				g.lineWidth = Math.max(1, size * 0.16);
				g.strokeStyle = 'rgba(255,255,255,.92)';
				g.strokeText(stroke.text || '', stroke.x, stroke.y);
				g.fillStyle = stroke.color;
				g.fillText(stroke.text || '', stroke.x, stroke.y);
			}
			g.restore();
		}

		function distanceToSegment(px, py, ax, ay, bx, by) {
			var dx = bx - ax;
			var dy = by - ay;
			var lengthSq = dx * dx + dy * dy;
			var t = lengthSq === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
			var x = ax + t * dx;
			var y = ay + t * dy;
			return Math.sqrt((px - x) * (px - x) + (py - y) * (py - y));
		}

		function cloneStrokes(strokes) {
			return strokes.map(cloneStroke);
		}

		function cloneStroke(stroke) {
			var copy = {};
			for (var key in stroke) if (Object.prototype.hasOwnProperty.call(stroke, key)) copy[key] = stroke[key];
			if (stroke.points) {
				copy.points = stroke.points.map(function (point) {
					return { x: point.x, y: point.y };
				});
			}
			return copy;
		}

		/* ==================================================================
		 * 选中 / 移动 / 缩放：所有笔迹都以外接框为准（坐标仍是原图像素）
		 * ================================================================== */

		function textFont(size) {
			return (
				'600 ' +
				size +
				'px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'
			);
		}

		var measureCanvas = null;

		/** 量一行文字的宽度（原图像素），用于选中框与擦除命中。 */
		function measureTextWidth(text, fontSize) {
			try {
				if (measureCanvas === null) measureCanvas = document.createElement('canvas');
				var g = measureCanvas.getContext('2d');
				g.font = textFont(fontSize);
				return g.measureText(String(text)).width;
			} catch (error) {
				return fontSize * 0.62 * String(text).length;
			}
		}

		function textWidthOf(stroke) {
			var size = stroke.fontSize || 20;
			if (typeof stroke.textWidth === 'number' && stroke.textWidth > 0) return stroke.textWidth;
			return measureTextWidth(stroke.text || '', size);
		}

		/** 一笔的外接框（原图像素坐标）；无点可框时返回 null。 */
		function strokeBox(stroke) {
			if (stroke.tool === 'text') {
				var size = stroke.fontSize || 20;
				return { x: stroke.x, y: stroke.y, w: textWidthOf(stroke), h: size * 1.25 };
			}
			var points = stroke.points || [];
			if (points.length === 0) return null;
			var bounds = strokeBounds(points);
			var pad = (stroke.width || 2) / 2;
			return { x: bounds.minX - pad, y: bounds.minY - pad, w: bounds.width + pad * 2, h: bounds.height + pad * 2 };
		}

		function translateStroke(stroke, dx, dy) {
			var copy = cloneStroke(stroke);
			if (copy.points) {
				copy.points = copy.points.map(function (point) {
					return { x: point.x + dx, y: point.y + dy };
				});
			}
			if (copy.tool === 'text') {
				copy.x = stroke.x + dx;
				copy.y = stroke.y + dy;
			}
			return copy;
		}

		/** 绕 (originX, originY) 等比缩放一笔（文字同时缩字号）。 */
		function scaleStroke(stroke, factor, originX, originY) {
			var copy = cloneStroke(stroke);
			if (copy.points) {
				copy.points = copy.points.map(function (point) {
					return { x: originX + (point.x - originX) * factor, y: originY + (point.y - originY) * factor };
				});
			}
			if (copy.tool === 'text') {
				copy.x = originX + (stroke.x - originX) * factor;
				copy.y = originY + (stroke.y - originY) * factor;
				copy.fontSize = (stroke.fontSize || 20) * factor;
				copy.textWidth = textWidthOf(stroke) * factor;
			}
			copy.width = (stroke.width || 2) * factor;
			return copy;
		}

		/* ==================================================================
		 * 取原图像素：优先 fetch(blob) → ImageBitmap，退回直接绘制 <img>
		 * ================================================================== */

		function loadImageElement(url) {
			return new Promise(function (resolve, reject) {
				var image = new Image();
				image.onload = function () {
					resolve(image);
				};
				image.onerror = function () {
					reject(new Error('image load failed'));
				};
				image.src = url;
			});
		}

		/**
		 * 取得一个可绘制、且不会污染 canvas 的图源。
		 *
		 * lightbox 的 src 可能是 blob:/data:/同源 http(s) 或 dsh 自定义协议；
		 * 直接 drawImage(<img>) 在跨源时会污染画布导致 toBlob 抛 SecurityError，
		 * 所以先尝试 fetch 成 blob 再解码（fetch 走 CORS，失败可捕获）。
		 */
		function loadSource(img) {
			var src = img.currentSrc || img.src;
			var cleanup = [];
			return fetch(src, { credentials: 'include', cache: 'force-cache' })
				.then(function (response) {
					if (!response.ok) throw new Error('HTTP ' + response.status);
					return response.blob();
				})
				.then(function (blob) {
					if (blob.size === 0) throw new Error('empty blob');
					if (typeof createImageBitmap === 'function') {
						return createImageBitmap(blob, { imageOrientation: 'from-image' }).catch(function () {
							var url = URL.createObjectURL(blob);
							cleanup.push(url);
							return loadImageElement(url);
						});
					}
					var objectUrl = URL.createObjectURL(blob);
					cleanup.push(objectUrl);
					return loadImageElement(objectUrl);
				})
				.catch(function (error) {
					log('fetch source failed, falling back to <img>', error);
					return img;
				})
				.then(function (source) {
					return {
						source: source,
						release: function () {
							cleanup.forEach(function (url) {
								try {
									URL.revokeObjectURL(url);
								} catch (ignored) {
									/* 忽略 */
								}
							});
						}
					};
				});
		}

		/* ==================================================================
		 * 输入框投递：paste → drop → 剪贴板 → 下载
		 * ================================================================== */

		function composerEditor() {
			/* 输入框就是 Lexical 的 root：`[data-composer-input]` 与
			 * `[data-lexical-editor="true"]` 是同一个 div（ui-conversation 在
			 * setRootElement 之后由 Lexical 打上后者）。优先精确命中前者。 */
			var nodes = document.querySelectorAll('[data-composer-input], [data-lexical-editor="true"], [contenteditable="true"]');
			var best = null;
			var bestScore = -1;
			for (var i = 0; i < nodes.length; i++) {
				var node = nodes[i];
				if (!node.isConnected) continue;
				var rect = node.getBoundingClientRect();
				if (rect.width < 40 || rect.height < 8) continue;
				var score = 0;
				if (node.hasAttribute('data-composer-input')) score += 6;
				if (node.closest('[data-conversation-session]') !== null) score += 2;
				if (node.getAttribute('data-lexical-editor') === 'true') score += 2;
				if (node.getAttribute('role') === 'textbox') score += 1;
				if (score >= bestScore) {
					bestScore = score;
					best = node;
				}
			}
			return best;
		}

		function countBlobImages() {
			var count = 0;
			var images = document.images;
			for (var i = 0; i < images.length; i++) {
				var url = String(images[i].currentSrc || images[i].src || '');
				if (url.indexOf('blob:') === 0) count++;
			}
			return count;
		}

		function waitFor(predicate, timeoutMs) {
			return new Promise(function (resolve) {
				var started = Date.now();
				(function poll() {
					var value;
					try {
						value = predicate();
					} catch (error) {
						value = false;
					}
					if (value) {
						resolve(true);
						return;
					}
					if (Date.now() - started >= timeoutMs) {
						resolve(false);
						return;
					}
					setTimeout(poll, 120);
				})();
			});
		}

		/**
		 * 造一个「带图片文件的 paste 事件」。
		 *
		 * composer 的入口读取 `event.clipboardData.items`（kind === 'file'），
		 * 因此先试真正的 ClipboardEvent；某些实现会静默丢弃 clipboardData
		 * init 成员，那就退回 defineProperty 挂一个同形状的假对象。
		 * 注意：Lexical 会给处理过的事件打 `_lexicalHandled`，所以每次派发
		 * 都必须新建事件，不能复用。
		 */
		function makePasteEvent(file) {
			var dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);
			var event = null;
			try {
				event = new ClipboardEvent('paste', {
					clipboardData: dataTransfer,
					bubbles: true,
					cancelable: true,
					composed: true
				});
				if (!event.clipboardData || event.clipboardData.items.length === 0) event = null;
			} catch (error) {
				event = null;
			}
			if (event === null) {
				event = new Event('paste', { bubbles: true, cancelable: true, composed: true });
				try {
					Object.defineProperty(event, 'clipboardData', {
						value: {
							items: [
								{
									kind: 'file',
									type: file.type,
									getAsFile: function () {
										return file;
									}
								}
							],
							files: [file],
							types: ['Files'],
							getData: function () {
								return '';
							}
						}
					});
				} catch (ignored) {
					/* 忽略：真走到这里只能靠下载兜底 */
				}
			}
			return event;
		}

		/** 用合成 paste 事件把文件交给 composer 的既有图片入口。返回是否命中编辑器。 */
		function attachViaPaste(file) {
			var editor = composerEditor();
			if (editor === null) return false;
			try {
				editor.focus({ preventScroll: true });
			} catch (error) {
				try {
					editor.focus();
				} catch (ignored) {
					/* 忽略 */
				}
			}
			var event = makePasteEvent(file);
			editor.dispatchEvent(event);
			log('paste dispatched; defaultPrevented =', event.defaultPrevented);
			return true;
		}

		/** 退回拖放路径：attachment 的 document 级监听接受 drop。 */
		function attachViaDrop(file) {
			var editor = composerEditor();
			var host = null;
			if (editor !== null) {
				host = editor.closest('form') || editor.parentElement || editor;
			}
			if (host === null) host = document;
			var dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);
			var rect = (editor || host).getBoundingClientRect();
			var clientX = rect.left + Math.max(10, Math.min(rect.width / 2, 60));
			var clientY = rect.top + Math.max(8, Math.min(rect.height / 2, 20));
			var types = ['dragenter', 'dragover', 'drop'];
			for (var i = 0; i < types.length; i++) {
				var event = new DragEvent(types[i], {
					dataTransfer: dataTransfer,
					bubbles: true,
					cancelable: true,
					composed: true,
					clientX: clientX,
					clientY: clientY
				});
				host.dispatchEvent(event);
			}
			log('drop dispatched');
			return true;
		}

		function copyBlobToClipboard(blob) {
			return new Promise(function (resolve) {
				try {
					if (!navigator.clipboard || typeof window.ClipboardItem !== 'function') {
						resolve(false);
						return;
					}
					navigator.clipboard
						.write([new window.ClipboardItem({ 'image/png': blob })])
						.then(function () {
							resolve(true);
						})
						.catch(function (error) {
							log('clipboard write failed', error);
							resolve(false);
						});
				} catch (error) {
					log('clipboard unavailable', error);
					resolve(false);
				}
			});
		}

		function downloadBlob(blob, filename) {
			try {
				var url = URL.createObjectURL(blob);
				var link = document.createElement('a');
				link.href = url;
				link.download = filename;
				link.style.display = 'none';
				document.body.appendChild(link);
				link.click();
				link.remove();
				setTimeout(function () {
					try {
						URL.revokeObjectURL(url);
					} catch (ignored) {
						/* 忽略 */
					}
				}, 5000);
			} catch (error) {
				warn('download failed', error);
			}
		}

		/* ==================================================================
		 * 标注器：一个 lightbox = 一个标注器
		 * ================================================================== */

		function createAnnotator(dialog, img, t) {
			var root = document.createElement('div');
			root.setAttribute('data-dsa-root', '');
			dialog.appendChild(root);

			var canvas = document.createElement('canvas');
			canvas.className = 'dsa-canvas';
			root.appendChild(canvas);

			var fab = document.createElement('button');
			fab.type = 'button';
			fab.className = 'dsa-fab';
			fab.title = t('annotateTitle');
			fab.setAttribute('aria-label', t('annotateTitle'));
			fab.appendChild(svgIcon(ICONS.pen));
			root.appendChild(fab);

			var bar = document.createElement('div');
			bar.className = 'dsa-bar';
			bar.style.display = 'none';
			root.appendChild(bar);

			var toastEl = document.createElement('div');
			toastEl.className = 'dsa-toast';
			toastEl.style.display = 'none';
			root.appendChild(toastEl);

			var state = {
				active: false,
				tool: 'pen',
				color: PALETTE[0].id,
				widthIndex: 1,
				strokes: [],
				draft: null,
				rect: null,
				natural: { w: img.naturalWidth || 0, h: img.naturalHeight || 0 },
				busy: false,
				drawing: false,
				textInput: null,
				selected: null,
				hovered: null,
				drag: null,
				past: [],
				future: [],
				rafId: 0,
				timer: 0
			};

			/* ------------------------------ 尺寸与重绘 ------------------------------ */

			function currentWidth() {
				var base = state.natural.w > 0 ? clamp(state.natural.w * 0.0035, 1.6, 9) : 2.4;
				if (state.widthIndex === 0) return base * 0.6;
				if (state.widthIndex === 2) return base * 1.9;
				return base;
			}

			function syncLayout() {
				var rect = img.getBoundingClientRect();
				if (rect.width < 4 || rect.height < 4) return;
				/* 原图尺寸可能比预览晚到（点开瞬间图还在解码），一旦可用就纠正，
				 * 否则导出会退化成「显示尺寸」。 */
				if (img.naturalWidth >= 2 && img.naturalHeight >= 2) {
					if (state.natural.w !== img.naturalWidth || state.natural.h !== img.naturalHeight) {
						state.natural = { w: img.naturalWidth, h: img.naturalHeight };
					}
				} else if (state.natural.w < 2 || state.natural.h < 2) {
					state.natural = { w: Math.round(rect.width), h: Math.round(rect.height) };
				}
				state.rect = rect;
				var dpr = window.devicePixelRatio || 1;
				var width = Math.max(1, Math.round(rect.width * dpr));
				var height = Math.max(1, Math.round(rect.height * dpr));
				if (canvas.width !== width || canvas.height !== height) {
					canvas.width = width;
					canvas.height = height;
				}
				canvas.style.left = rect.left + 'px';
				canvas.style.top = rect.top + 'px';
				canvas.style.width = rect.width + 'px';
				canvas.style.height = rect.height + 'px';
				draw();
			}

			function draw() {
				var g = canvas.getContext('2d');
				g.setTransform(1, 0, 0, 1, 0, 0);
				g.clearRect(0, 0, canvas.width, canvas.height);
				if (canvas.width < 2 || state.natural.w < 2) return;
				var scale = canvas.width / state.natural.w;
				g.setTransform(scale, 0, 0, scale, 0, 0);
				for (var i = 0; i < state.strokes.length; i++) paintStroke(g, state.strokes[i]);
				if (state.draft !== null) paintStroke(g, state.draft);
				paintChrome(g, scale);
			}

			/** 选中框 / 缩放手柄 / 悬停高亮：都画在同一层，缩放天然一致。 */
			function paintChrome(g, scale) {
				var accent = tokenColor({ token: '--dsw-alias-state-business-primary', fallback: '#4176e6' });
				var stroke = state.selected;
				if (stroke !== null && state.strokes.indexOf(stroke) >= 0) {
					var box = strokeBox(stroke);
					if (box !== null) {
						g.save();
						g.strokeStyle = accent;
						g.lineWidth = 1.4 / scale;
						g.setLineDash([6 / scale, 4 / scale]);
						g.strokeRect(box.x, box.y, box.w, box.h);
						g.setLineDash([]);
						var size = 8 / scale;
						var handles = handlePoints(box);
						for (var i = 0; i < handles.length; i++) {
							g.beginPath();
							g.rect(handles[i].x - size / 2, handles[i].y - size / 2, size, size);
							g.fillStyle = '#ffffff';
							g.fill();
							g.lineWidth = 1.4 / scale;
							g.strokeStyle = accent;
							g.stroke();
						}
						g.restore();
					}
				} else if (state.hovered !== null && state.tool === 'select') {
					var hoverBox = strokeBox(state.hovered);
					if (hoverBox !== null) {
						g.save();
						g.strokeStyle = accent;
						g.globalAlpha = 0.55;
						g.lineWidth = 1.4 / scale;
						g.strokeRect(hoverBox.x - 2 / scale, hoverBox.y - 2 / scale, hoverBox.w + 4 / scale, hoverBox.h + 4 / scale);
						g.restore();
					}
				}
			}

			/** 四角手柄（原图像素坐标）。 */
			function handlePoints(box) {
				return [
					{ x: box.x, y: box.y, corner: 'nw' },
					{ x: box.x + box.w, y: box.y, corner: 'ne' },
					{ x: box.x, y: box.y + box.h, corner: 'sw' },
					{ x: box.x + box.w, y: box.y + box.h, corner: 'se' }
				];
			}

			/** 命中哪个手柄（返回角名或 null）。 */
			function hitHandle(point) {
				if (state.selected === null) return null;
				var box = strokeBox(state.selected);
				if (box === null) return null;
				var radius = 10 / currentScale();
				var handles = handlePoints(box);
				for (var i = 0; i < handles.length; i++) {
					if (Math.abs(point.x - handles[i].x) <= radius && Math.abs(point.y - handles[i].y) <= radius) {
						return handles[i].corner;
					}
				}
				return null;
			}

			function currentScale() {
				var rect = state.rect || img.getBoundingClientRect();
				return Math.max(0.0001, rect.width / Math.max(1, state.natural.w));
			}

			/** 从最上层往下找被点中的那一笔。 */
			function pickStroke(point, threshold) {
				for (var i = state.strokes.length - 1; i >= 0; i--) {
					if (hitStroke(state.strokes[i], point, threshold)) return state.strokes[i];
				}
				return null;
			}

			/** 命中容差：屏幕上约 9px，换算回原图像素。 */
			function selectionThreshold() {
				return Math.max(currentWidth() * 0.9, 9 / Math.max(currentScale(), 0.02));
			}

			function toNatural(event) {
				var rect = state.rect || img.getBoundingClientRect();
				return {
					x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * state.natural.w,
					y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * state.natural.h
				};
			}

			/* ------------------------------ 历史 ------------------------------ */

			function snapshot() {
				return cloneStrokes(state.strokes);
			}

			function pushSnapshot(snap) {
				state.past.push(snap);
				if (state.past.length > 80) state.past.shift();
				state.future.length = 0;
				refreshButtons();
			}

			function pushHistory() {
				pushSnapshot(snapshot());
			}

			function undo() {
				if (state.past.length === 0) return;
				state.future.push(snapshot());
				state.strokes = state.past.pop();
				state.selected = null;
				draw();
				refreshButtons();
			}

			function redo() {
				if (state.future.length === 0) return;
				state.past.push(snapshot());
				state.strokes = state.future.pop();
				state.selected = null;
				draw();
				refreshButtons();
			}

			function clearAll() {
				if (state.strokes.length === 0) return;
				pushHistory();
				state.strokes = [];
				draw();
			}

			/* ------------------------------ 指针交互 ------------------------------ */

			function hitStroke(stroke, point, threshold) {
				if (stroke.tool === 'text') {
					var size = stroke.fontSize || 20;
					var width = textWidthOf(stroke);
					return (
						point.x >= stroke.x - threshold &&
						point.x <= stroke.x + width + threshold &&
						point.y >= stroke.y - threshold &&
						point.y <= stroke.y + size * 1.25 + threshold
					);
				}
				var points = stroke.points || [];
				if (stroke.tool === 'rect') {
					var rectBox = strokeBounds(points);
					var nearX = Math.min(Math.abs(point.x - rectBox.minX), Math.abs(point.x - rectBox.maxX));
					var nearY = Math.min(Math.abs(point.y - rectBox.minY), Math.abs(point.y - rectBox.maxY));
					var within =
						point.x >= rectBox.minX - threshold &&
						point.x <= rectBox.maxX + threshold &&
						point.y >= rectBox.minY - threshold &&
						point.y <= rectBox.maxY + threshold;
					return within && Math.min(nearX, nearY) <= threshold;
				}
				if (stroke.tool === 'ellipse') {
					var ellipseBox = strokeBounds(points);
					var rx = ellipseBox.width / 2;
					var ry = ellipseBox.height / 2;
					if (rx > 0.5 && ry > 0.5) {
						var nx = (point.x - (ellipseBox.minX + ellipseBox.maxX) / 2) / rx;
						var ny = (point.y - (ellipseBox.minY + ellipseBox.maxY) / 2) / ry;
						return Math.abs(Math.sqrt(nx * nx + ny * ny) - 1) * Math.min(rx, ry) <= threshold;
					}
					return false;
				}
				if (points.length === 1) {
					return Math.hypot(point.x - points[0].x, point.y - points[0].y) <= threshold;
				}
				for (var i = 1; i < points.length; i++) {
					if (distanceToSegment(point.x, point.y, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y) <= threshold) {
						return true;
					}
				}
				return false;
			}

			function eraseAt(point) {
				var threshold = Math.max(currentWidth() * 1.6, 9 / Math.max(currentScale(), 0.02));
				for (var i = state.strokes.length - 1; i >= 0; i--) {
					if (hitStroke(state.strokes[i], point, threshold)) {
						pushHistory();
						if (state.selected === state.strokes[i]) state.selected = null;
						state.strokes.splice(i, 1);
						draw();
						return true;
					}
				}
				return false;
			}

			/* ------------------------------ 选择 / 移动 / 缩放 ------------------------------ */

			function selectStroke(stroke) {
				if (state.selected === stroke) return;
				state.selected = stroke;
				draw();
			}

			function deleteSelected() {
				if (state.selected === null) return false;
				var index = state.strokes.indexOf(state.selected);
				if (index < 0) return false;
				pushHistory();
				state.strokes.splice(index, 1);
				state.selected = null;
				state.hovered = null;
				draw();
				return true;
			}

			function nudgeSelected(dx, dy) {
				if (state.selected === null) return false;
				var index = state.strokes.indexOf(state.selected);
				if (index < 0) return false;
				pushHistory();
				state.strokes[index] = translateStroke(state.selected, dx, dy);
				state.selected = state.strokes[index];
				draw();
				return true;
			}

			/** 拖动开始：记下原始笔迹，后续每帧都从原始状态重算，避免累积误差。 */
			function beginDrag(mode, point, corner) {
				if (state.selected === null) return false;
				var box = strokeBox(state.selected);
				if (box === null) return false;
				state.drag = {
					mode: mode,
					corner: corner || null,
					start: point,
					original: cloneStroke(state.selected),
					box: box,
					before: snapshot(),
					historyPushed: false
				};
				return true;
			}

			function applyDrag(point) {
				var drag = state.drag;
				if (drag === null || state.selected === null) return;
				var index = state.strokes.indexOf(state.selected);
				if (index < 0) return;
				var moved = false;
				if (drag.mode === 'move') {
					var dx = point.x - drag.start.x;
					var dy = point.y - drag.start.y;
					if (dx === 0 && dy === 0) return;
					state.strokes[index] = translateStroke(drag.original, dx, dy);
					moved = true;
				} else {
					var originX = drag.corner === 'ne' || drag.corner === 'se' ? drag.box.x : drag.box.x + drag.box.w;
					var originY = drag.corner === 'sw' || drag.corner === 'se' ? drag.box.y : drag.box.y + drag.box.h;
					var startDistance = Math.hypot(drag.start.x - originX, drag.start.y - originY);
					var nowDistance = Math.hypot(point.x - originX, point.y - originY);
					if (startDistance < 1) return;
					var factor = clamp(nowDistance / startDistance, 0.15, 12);
					if (Math.abs(factor - 1) < 0.002) return;
					state.strokes[index] = scaleStroke(drag.original, factor, originX, originY);
					moved = true;
				}
				if (!moved) return;
				/* 真正改动过才落一条历史，纯点击不会污染撤销栈 */
				if (!drag.historyPushed) {
					drag.historyPushed = true;
					pushSnapshot(drag.before);
				}
				state.selected = state.strokes[index];
				draw();
			}

			function cursorFor(point) {
				if (state.tool !== 'select') return null;
				var corner = hitHandle(point);
				if (corner === 'nw' || corner === 'se') return 'nwse-resize';
				if (corner === 'ne' || corner === 'sw') return 'nesw-resize';
				var hovered = pickStroke(point, selectionThreshold());
				state.hovered = hovered;
				return hovered !== null ? 'move' : 'default';
			}

			function onPointerDown(event) {
				if (!state.active || state.busy) return;
				if (event.button !== undefined && event.button !== 0) return;
				var point = toNatural(event);

				if (state.tool === 'text') {
					event.preventDefault();
					var existing = pickStroke(point, selectionThreshold());
					if (existing !== null && existing.tool === 'text') {
						/* 文字工具里直接拖已有的文字框：不用切工具就能挪位置 */
						selectStroke(existing);
						beginDrag('move', point, null);
						state.drawing = true;
						try {
							canvas.setPointerCapture(event.pointerId);
						} catch (ignored) {
							/* 忽略 */
						}
						return;
					}
					openTextEditor(event);
					return;
				}

				event.preventDefault();
				try {
					canvas.setPointerCapture(event.pointerId);
				} catch (ignored) {
					/* 忽略 */
				}

				if (state.tool === 'select') {
					var corner = hitHandle(point);
					if (corner !== null) {
						state.drawing = true;
						beginDrag('resize', point, corner);
						return;
					}
					var hit = pickStroke(point, selectionThreshold());
					if (hit !== null) {
						selectStroke(hit);
						state.drawing = true;
						beginDrag('move', point, null);
						return;
					}
					state.selected = null;
					state.hovered = null;
					draw();
					refreshButtons();
					return;
				}

				state.drawing = true;
				if (state.tool === 'eraser') {
					eraseAt(point);
					return;
				}
				state.draft = {
					tool: state.tool,
					color: tokenColor(paletteEntry(state.color)),
					width: currentWidth(),
					points: [point, { x: point.x, y: point.y }]
				};
				draw();
			}

			var lastCursor = '';

			function setCursor(value) {
				if (value === lastCursor) return;
				lastCursor = value;
				canvas.style.cursor = value;
			}

			function onPointerMove(event) {
				var point = toNatural(event);

				if (!state.drawing) {
					var cursor = cursorFor(point);
					setCursor(cursor === null ? (state.tool === 'select' ? 'default' : 'crosshair') : cursor);
					if (state.tool === 'select' && state.hovered !== null && state.selected === null) draw();
					return;
				}

				if (state.drag !== null) {
					applyDrag(point);
					return;
				}
				if (state.tool === 'eraser') {
					eraseAt(point);
					return;
				}
				if (state.draft === null) return;
				if (state.tool === 'pen') {
					var last = state.draft.points[state.draft.points.length - 1];
					if (Math.hypot(point.x - last.x, point.y - last.y) < state.natural.w * 0.0012) return;
					state.draft.points.push(point);
				} else if (state.tool === 'arrow') {
					state.draft.points[1] = point;
				} else {
					/* 方框 / 圆圈：累积轨迹，落笔时按外接框成形 */
					state.draft.points.push(point);
				}
				draw();
			}

			function onPointerUp(event) {
				if (!state.drawing) return;
				state.drawing = false;
				try {
					canvas.releasePointerCapture(event.pointerId);
				} catch (ignored) {
					/* 忽略 */
				}
				if (state.drag !== null) {
					state.drag = null;
					draw();
					return;
				}
				if (state.draft !== null) {
					var draft = state.draft;
					state.draft = null;
					var box = strokeBounds(draft.points);
					if (draft.tool === 'pen' ? draft.points.length > 0 : box.width > 2 || box.height > 2) {
						pushHistory();
						state.strokes.push(draft);
						/* 刚画完就选中，方便马上调位置 */
						state.selected = draft;
					}
					draw();
				}
			}

			function onDoubleClick(event) {
				if (!state.active) return;
				var point = toNatural(event);
				var hit = pickStroke(point, selectionThreshold());
				if (hit !== null && hit.tool === 'text') {
					event.preventDefault();
					selectStroke(hit);
					openTextEditor(event, hit);
				}
			}

			canvas.addEventListener('pointerdown', onPointerDown);
			canvas.addEventListener('pointermove', onPointerMove);
			canvas.addEventListener('pointerup', onPointerUp);
			canvas.addEventListener('pointercancel', onPointerUp);
			canvas.addEventListener('dblclick', onDoubleClick);

			/* ------------------------------ 文字工具 ------------------------------ */

			function closeTextEditor() {
				if (state.textInput !== null) {
					var input = state.textInput;
					state.textInput = null;
					input.remove();
				}
			}

			/**
			 * 打开文字输入框。
			 *
			 * @param event  触发事件（用来定输入框位置与落点）。
			 * @param existing 传入已有文字笔迹时是「改字」，否则是新建。
			 */
			function openTextEditor(event, existing) {
				closeTextEditor();
				var point = toNatural(event);
				var isEdit = existing !== undefined && existing !== null;
				var input = document.createElement('input');
				input.className = 'dsa-textinput';
				input.placeholder = t('textPlaceholder');
				if (isEdit) input.value = existing.text || '';
				input.style.left = clamp(event.clientX - 40, 8, Math.max(8, window.innerWidth - 240)) + 'px';
				input.style.top = clamp(event.clientY - 16, 8, Math.max(8, window.innerHeight - 52)) + 'px';
				root.appendChild(input);
				state.textInput = input;
				var settled = false;
				function finish(commit) {
					if (settled) return;
					settled = true;
					var text = input.value.trim();
					closeTextEditor();
					if (!commit || text.length === 0) {
						draw();
						return;
					}
					if (isEdit) {
						var index = state.strokes.indexOf(existing);
						if (index < 0) return;
						pushHistory();
						var updated = cloneStroke(state.strokes[index]);
						updated.text = text;
						updated.textWidth = measureTextWidth(text, updated.fontSize || 20);
						state.strokes[index] = updated;
						state.selected = updated;
						draw();
						return;
					}
					var fontSize = currentWidth() * 7;
					pushHistory();
					var stroke = {
						tool: 'text',
						color: tokenColor(paletteEntry(state.color)),
						width: currentWidth(),
						fontSize: fontSize,
						textWidth: measureTextWidth(text, fontSize),
						x: point.x,
						y: point.y,
						text: text
					};
					state.strokes.push(stroke);
					state.selected = stroke;
					draw();
				}
				input.addEventListener('keydown', function (keyEvent) {
					keyEvent.stopPropagation();
					if (keyEvent.key === 'Enter') {
						keyEvent.preventDefault();
						finish(true);
					} else if (keyEvent.key === 'Escape') {
						keyEvent.preventDefault();
						finish(false);
					}
				});
				input.addEventListener('blur', function () {
					finish(true);
				});
				try {
					input.focus({ preventScroll: true });
				} catch (ignored) {
					input.focus();
				}
			}

			/* ------------------------------ 工具栏 ------------------------------ */

			var toolButtons = {};
			var swatchButtons = [];
			var widthButtons = [];
			var undoButton = null;
			var redoButton = null;
			var trashButton = null;
			var primaryButton = null;

			function refreshButtons() {
				for (var id in toolButtons) {
					if (Object.prototype.hasOwnProperty.call(toolButtons, id)) {
						toolButtons[id].setAttribute('data-dsa-on', state.tool === id ? '1' : '0');
					}
				}
				swatchButtons.forEach(function (entry) {
					entry.el.setAttribute('data-dsa-on', entry.id === state.color ? '1' : '0');
				});
				widthButtons.forEach(function (entry, index) {
					entry.el.setAttribute('data-dsa-on', index === state.widthIndex ? '1' : '0');
				});
				if (undoButton !== null) undoButton.disabled = state.past.length === 0;
				if (redoButton !== null) redoButton.disabled = state.future.length === 0;
				if (trashButton !== null) {
					var hasSelection = state.selected !== null && state.strokes.indexOf(state.selected) >= 0;
					var label = hasSelection ? t('deleteSelected') : t('clear');
					trashButton.title = label;
					trashButton.setAttribute('aria-label', label);
					trashButton.disabled = hasSelection ? false : state.strokes.length === 0;
				}
			}

			function buildBar() {
				TOOLS.forEach(function (tool) {
					var button = iconButton(tool.icon, t(tool.id));
					button.dataset.dsaTool = tool.id;
					button.addEventListener('click', function () {
						state.tool = tool.id;
						if (tool.id !== 'select') state.hovered = null;
						closeTextEditor();
						refreshButtons();
						setCursor(tool.id === 'select' ? 'default' : 'crosshair');
						draw();
					});
					toolButtons[tool.id] = button;
					bar.appendChild(button);
				});

				var sep1 = document.createElement('span');
				sep1.className = 'dsa-sep';
				bar.appendChild(sep1);

				PALETTE.forEach(function (color) {
					var swatch = document.createElement('button');
					swatch.type = 'button';
					swatch.className = 'dsa-swatch';
					swatch.style.background = 'var(' + color.token + ',' + color.fallback + ')';
					swatch.title = t('color_' + color.id);
					swatch.setAttribute('aria-label', t('color_' + color.id));
					swatch.addEventListener('click', function () {
						state.color = color.id;
						/* 已有选中文字时换色，直接改它，符合「选中即编辑」的直觉 */
						var index = state.selected === null ? -1 : state.strokes.indexOf(state.selected);
						if (index >= 0 && state.selected.tool === 'text') {
							pushHistory();
							var updated = cloneStroke(state.strokes[index]);
							updated.color = tokenColor(color);
							state.strokes[index] = updated;
							state.selected = updated;
							draw();
						}
						refreshButtons();
					});
					swatchButtons.push({ el: swatch, id: color.id });
					bar.appendChild(swatch);
				});

				var sep2 = document.createElement('span');
				sep2.className = 'dsa-sep';
				bar.appendChild(sep2);

				[3, 5.4, 9].forEach(function (size, index) {
					var button = document.createElement('button');
					button.type = 'button';
					button.className = 'dsa-width';
					button.title = index === 0 ? '细' : index === 1 ? '中' : '粗';
					var dot = document.createElement('span');
					dot.style.width = size + 'px';
					dot.style.height = size + 'px';
					button.appendChild(dot);
					button.addEventListener('click', function () {
						state.widthIndex = index;
						refreshButtons();
					});
					widthButtons.push({ el: button });
					bar.appendChild(button);
				});

				var sep3 = document.createElement('span');
				sep3.className = 'dsa-sep';
				bar.appendChild(sep3);

				undoButton = iconButton(ICONS.undo, t('undo'));
				undoButton.addEventListener('click', undo);
				bar.appendChild(undoButton);

				redoButton = iconButton(ICONS.redo, t('redo'));
				redoButton.addEventListener('click', redo);
				bar.appendChild(redoButton);

				trashButton = iconButton(ICONS.trash, t('clear'));
				trashButton.addEventListener('click', function () {
					if (state.selected !== null && state.strokes.indexOf(state.selected) >= 0) deleteSelected();
					else clearAll();
				});
				bar.appendChild(trashButton);

				var sep4 = document.createElement('span');
				sep4.className = 'dsa-sep';
				bar.appendChild(sep4);

				primaryButton = document.createElement('button');
				primaryButton.type = 'button';
				primaryButton.className = 'dsa-primary';
				primaryButton.title = t('attachTitle');
				primaryButton.appendChild(svgIcon(ICONS.check));
				var primaryLabel = document.createElement('span');
				primaryLabel.textContent = t('attach');
				primaryButton.appendChild(primaryLabel);
				primaryButton.addEventListener('click', function () {
					commit('attach');
				});
				bar.appendChild(primaryButton);

				var downloadButton = iconButton(ICONS.download, t('download'));
				downloadButton.addEventListener('click', function () {
					commit('download');
				});
				bar.appendChild(downloadButton);

				var exitButton = iconButton(ICONS.close, t('exit'));
				exitButton.addEventListener('click', function () {
					setActive(false);
				});
				bar.appendChild(exitButton);
			}

			buildBar();
			refreshButtons();

			/* ------------------------------ 状态切换 ------------------------------ */

			function setActive(active) {
				state.active = active;
				canvas.setAttribute('data-dsa-active', active ? '1' : '0');
				bar.style.display = active ? 'flex' : 'none';
				/* fab 用 grid 布局（原生圆形按钮），隐藏要用 none */
				fab.style.display = active ? 'none' : 'grid';
				if (!active) {
					closeTextEditor();
					state.selected = null;
					state.hovered = null;
					state.drag = null;
					canvas.style.cursor = '';
				}
				if (active) {
					canvas.style.cursor = state.tool === 'select' ? 'default' : 'crosshair';
					syncLayout();
					/* 预览可能有入场动画，短时间内跟随几帧 */
					var frames = 0;
					(function follow() {
						if (!state.active || frames++ > 40) return;
						syncLayout();
						state.rafId = requestAnimationFrame(follow);
					})();
				}
			}

			fab.addEventListener('click', function () {
				setActive(true);
			});

			/* ------------------------------ 提示 ------------------------------ */

			function toast(message, duration) {
				toastEl.textContent = message;
				toastEl.style.display = 'block';
				if (state.timer) clearTimeout(state.timer);
				state.timer = setTimeout(function () {
					toastEl.style.display = 'none';
				}, duration || 3200);
			}

			/* ------------------------------ 导出与投递 ------------------------------ */

			function exportBlob() {
				return loadSource(img).then(function (loaded) {
					var width = state.natural.w || img.naturalWidth || 0;
					var height = state.natural.h || img.naturalHeight || 0;
					if (width < 2 || height < 2) throw new Error('image size unknown');
					var target = document.createElement('canvas');
					target.width = width;
					target.height = height;
					var g = target.getContext('2d');
					g.drawImage(loaded.source, 0, 0, width, height);
					for (var i = 0; i < state.strokes.length; i++) paintStroke(g, state.strokes[i]);
					loaded.release();
					return new Promise(function (resolve, reject) {
						target.toBlob(function (blob) {
							if (blob === null) reject(new Error('toBlob returned null'));
							else resolve(blob);
						}, 'image/png');
					});
				});
			}

			function setBusy(busy) {
				state.busy = busy;
				if (primaryButton !== null) {
					primaryButton.setAttribute('data-dsa-busy', busy ? '1' : '0');
					primaryButton.disabled = busy;
				}
			}

			function closeLightbox() {
				var close = dialog.querySelector(':scope > button');
				if (close !== null) {
					close.click();
					return;
				}
				window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
			}

			function commit(kind) {
				if (state.busy) return;
				if (kind === 'attach' && state.strokes.length === 0) {
					toast(t('empty'));
					return;
				}
				setBusy(true);
				var filename = 'annotated-' + stamp() + '.png';
				toast(t('working'), 60000);
				exportBlob()
					.then(function (blob) {
						if (kind === 'download') {
							downloadBlob(blob, filename);
							toast(t('downloaded'));
							return null;
						}
						var file = new File([blob], filename, { type: 'image/png' });
						var before = countBlobImages();
						var pasted = attachViaPaste(file);
						if (!pasted) {
							toast(t('noEditor'));
							return null;
						}
						return waitFor(function () {
							return countBlobImages() > before;
						}, 2200).then(function (appeared) {
							if (appeared) {
								log('attachment confirmed');
								toast(t('attached'));
								closeLightbox();
								return null;
							}
							log('attachment not confirmed; trying drop');
							attachViaDrop(file);
							return waitFor(function () {
								return countBlobImages() > before;
							}, 1200).then(function (dropped) {
								if (dropped) {
									toast(t('attached'));
									closeLightbox();
									return null;
								}
								return copyBlobToClipboard(blob).then(function (copied) {
									if (copied) {
										toast(t('uncertain'), 6000);
										closeLightbox();
									} else {
										downloadBlob(blob, filename);
										toast(t('downloaded'), 5000);
									}
									return null;
								});
							});
						});
					})
					.catch(function (error) {
						warn('export failed', error);
						toast(t('exportFailed') + (error && error.message ? '：' + error.message : ''), 5000);
					})
					.then(function () {
						setBusy(false);
					});
			}

			/* ------------------------------ 键盘快捷键 ------------------------------ */

			function onKeyDown(event) {
				if (!state.active) return;
				/* 正在输入文字时，键盘归输入框 */
				if (state.textInput !== null) return;
				var modifier = event.ctrlKey || event.metaKey;
				if (modifier && (event.key === 'z' || event.key === 'Z')) {
					event.preventDefault();
					event.stopPropagation();
					if (event.shiftKey) redo();
					else undo();
					return;
				}
				if (modifier && (event.key === 'y' || event.key === 'Y')) {
					event.preventDefault();
					event.stopPropagation();
					redo();
					return;
				}
				if (modifier || event.altKey) return;

				if (event.key === 'Delete' || event.key === 'Backspace') {
					if (deleteSelected()) {
						event.preventDefault();
						return;
					}
				}
				if (state.selected !== null && event.key.indexOf('Arrow') === 0) {
					var step = event.shiftKey ? 10 : 1;
					var dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
					var dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
					if (nudgeSelected(dx, dy)) {
						event.preventDefault();
						return;
					}
				}
				if (event.key === 'v' || event.key === 'V') {
					event.preventDefault();
					state.tool = 'select';
					refreshButtons();
					return;
				}

				var order = ['select', 'pen', 'arrow', 'rect', 'ellipse', 'text', 'eraser'];
				var next = -1;
				if (event.key >= '1' && event.key <= '7') next = Number(event.key) - 1;
				else if (event.key === 'e' || event.key === 'E') next = state.tool === 'eraser' ? 1 : 6;
				if (next >= 0 && next < order.length) {
					event.preventDefault();
					state.tool = order[next];
					if (state.tool !== 'select') state.hovered = null;
					closeTextEditor();
					refreshButtons();
					draw();
				}
			}

			window.addEventListener('keydown', onKeyDown, true);

			/* ------------------------------ 位置同步与生命周期 ------------------------------ */

			var resizeObserver = null;
			if (typeof ResizeObserver === 'function') {
				resizeObserver = new ResizeObserver(function () {
					syncLayout();
				});
				try {
					resizeObserver.observe(img);
				} catch (ignored) {
					/* 忽略 */
				}
			}
			window.addEventListener('resize', syncLayout);
			img.addEventListener('load', syncLayout);
			if (!img.complete) {
				img.addEventListener('load', syncLayout, { once: true });
			}
			syncLayout();
			setTimeout(syncLayout, 60);
			setTimeout(syncLayout, 240);

			function destroy() {
				window.removeEventListener('keydown', onKeyDown, true);
				window.removeEventListener('resize', syncLayout);
				img.removeEventListener('load', syncLayout);
				if (resizeObserver !== null) resizeObserver.disconnect();
				if (state.rafId) cancelAnimationFrame(state.rafId);
				if (state.timer) clearTimeout(state.timer);
				closeTextEditor();
				root.remove();
				var registry = window.__dshImageAnnotate;
				if (registry) {
					var index = registry.annotators.indexOf(handle);
					if (index >= 0) registry.annotators.splice(index, 1);
				}
			}

			var handle = { dialog: dialog, state: state, setActive: setActive, destroy: destroy };
			var registry = window.__dshImageAnnotate;
			if (registry) registry.annotators.push(handle);
			return handle;
		}

		/* ==================================================================
		 * lightbox 观察器
		 * ================================================================== */

		function isLightbox(dialog) {
			/* 结构（dsh-client-ui-primitives ImageLightbox）：
			 * body portal > div[role=dialog][aria-modal=true]
			 *   > div[aria-hidden=true]（遮罩）, img（原图）, button（关闭）
			 * 这里只依赖「dialog 直接子元素里有 img」这个稳定特征。 */
			if (dialog.getAttribute('role') !== 'dialog') return false;
			if (dialog.getAttribute('aria-modal') !== 'true') return false;
			var img = dialog.querySelector(':scope > img');
			return img !== null;
		}

		function startWatcher(t) {
			var annotators = [];
			var known = new WeakSet();
			var scheduled = false;
			var lastRun = 0;

			function reconcile() {
				scheduled = false;
				lastRun = Date.now();
				for (var i = annotators.length - 1; i >= 0; i--) {
					if (!annotators[i].dialog.isConnected) {
						try {
							annotators[i].destroy();
						} catch (error) {
							warn('destroy failed', error);
						}
						annotators.splice(i, 1);
					}
				}
				var dialogs = document.body.querySelectorAll(':scope > div[role="dialog"][aria-modal="true"]');
				for (var j = 0; j < dialogs.length; j++) {
					var dialog = dialogs[j];
					if (known.has(dialog)) continue;
					if (!isLightbox(dialog)) continue;
					var img = dialog.querySelector(':scope > img');
					known.add(dialog);
					try {
						annotators.push(createAnnotator(dialog, img, t));
						log('annotator attached');
					} catch (error) {
						warn('attach failed', error);
					}
				}
			}

			function schedule() {
				if (scheduled) return;
				var elapsed = Date.now() - lastRun;
				if (elapsed > 220) {
					reconcile();
					return;
				}
				scheduled = true;
				setTimeout(function () {
					if (scheduled) reconcile();
				}, 220 - elapsed);
			}

			var observer = new MutationObserver(schedule);
			observer.observe(document.body, { childList: true, subtree: true });
			reconcile();

			return function stop() {
				observer.disconnect();
				annotators.forEach(function (annotator) {
					try {
						annotator.destroy();
					} catch (error) {
						warn('destroy failed', error);
					}
				});
				annotators.length = 0;
			};
		}

		/* ==================================================================
		 * 插件入口
		 * ================================================================== */

		function apply(ctx) {
			if (typeof window === 'undefined' || typeof document === 'undefined') return;
			var t = makeTranslator(ctx);
			injectStyles();
			/* 诊断入口：控制台里 `__dshImageAnnotate.annotators[0].state` 可看实时状态 */
			if (!window.__dshImageAnnotate) {
				window.__dshImageAnnotate = { version: '1.0.0', package: PKG_ID, annotators: [] };
			}
			var stop = startWatcher(t);
			if (ctx && typeof ctx.effect === 'function') {
				ctx.effect(function () {
					return stop;
				});
			} else {
				window.addEventListener('beforeunload', stop);
			}
			log('ready (v1.0.0)');
		}

		exports.apply = apply;
		exports.inject = [];
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
