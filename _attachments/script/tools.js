function ToolSet(app, mouseController, container) {
	var viewerEl = app.viewerEl,
		loc = app.location,
		colorTools = document.getElementById("color-tools"),
		colorPicker = new ColorPicker(document.getElementById("color-picker")),
		colorSelection = document.getElementById("color-selection-inner"),
		cursorCircle = document.getElementById("cursor-circle"),
		brushColor = "black",
		brushOpaqueColor = "black";
		brushAlpha = 1,
		brushSize = 4;

	colorPicker.onChange = function (rgba, rgb, alpha, size) {
		brushColor = rgba;
		brushOpaqueColor = rgb;
		brushAlpha = alpha;
		brushSize = size;
		colorSelection.style.backgroundColor = rgba;
	};

	colorSelection.addEventListener("click", function (e) {
		colorPicker.toggle();
	}, false);

	// execute a function for each tile in a rectangle on the current plane
	function inRect(x0, y0, x1, y1, padding, cb, context) {
		var x, y, w, h;
		if (x0 < x1) {
			x = x0;
			w = x1 - x0;
		} else {
			x = x1;
			w = x0 - x1;
		}
		if (y0 < y1) {
			y = y0;
			h = y1 - y0;
		} else {
			y = y1;
			h = y0 - y1;
		}
		var plane = app.getCurrentPlane();
		var tiles = plane.getTilesInRect(
			x - plane.x - padding, y - plane.y - padding,
			w + 2*padding, h + 2*padding);
		//if (tiles.length == 2) debugger;
		tiles.forEach(function (tile) {
			// pass offset of tile from viewer
			cb.call(context, tile, tile.x * plane.tileWidth + plane.x,
				tile.y * plane.tileHeight + plane.y);
		});
	}

	// copy temp canvases to queue canvases and queue tile saves
	// i.e. stage the current brush strokes for saving
	function copySaveTiles(touchedTiles, blending) {
		touchedTiles.forEach(function (tile) {
			var tempCtx = tile.getTempContext();
			var tempCanvas = tempCtx.canvas;
			var ctx = tile.getQueueContext();
			ctx.globalAlpha = brushAlpha;
			if (blending) ctx.globalCompositeOperation = blending;
			ctx.drawImage(tempCanvas, 0, 0);
			if (blending) ctx.globalCompositeOperation = "source-over";
			tile.removeTempContext(tempCtx);
			app.queueTileSave(tile);
			tile.touched = false;
			tile.draw();
		});
		touchedTiles.length = 0;
	}

	var tools = {
		scroll: {
			onActivate: function () {
				viewerEl.className = "cursor-scroll";
				colorTools.className = "hidden";
				colorPicker.hide();
				cursorCircle.className = "hidden";
			},
			onDragStart: function (e) {
				viewerEl.className = "cursor-scrolling";
				this.startMouse = {x: e._x, y: e._y};
				this.startPos = {x: loc.x, y: loc.y};
			},
			onDrag: function (e) {
				app.setPosition(
					this.startPos.x + e._x - this.startMouse.x,
					this.startPos.y + e._y - this.startMouse.y,
					loc.z);
			},
			onDragEnd: function (e) {
				viewerEl.className = "cursor-scroll";
			}
		},

		draw: {
			touchedTiles: [],
			onActivate: function () {
				viewerEl.className = "cursor-draw";
				colorTools.className = "";
				cursorCircle.className = "";
			},
			onDragStart: function (e) {
				this.x = this.x0 = this.x1 = this.x2 = e._x - .01;
				this.y = this.y0 = this.y1 = this.y2 = e._y - .01;
				this.onDrag(e);
			},
			onDrag: function (e) {
				this.x2 = this.x1;
				this.y2 = this.y1;
				this.x1 = this.x0;
				this.y1 = this.y0;
				this.x0 = e._x;
				this.y0 = e._y;
				this.xx = this.x;
				this.yy = this.y;
				this.x = (this.x1 + this.x0) / 2;
				this.y = (this.y1 + this.y0) / 2;

				inRect(this.x0, this.y0, this.x2, this.y2,
					brushSize, this.onDragInRect, this);
			},
			onDragInRect: function (tile, offsetX, offsetY) {
				if (!tile.isLoaded) return;

				var ctx = tile.getTempContext();
				ctx.canvas.style.opacity = brushAlpha;
				ctx.strokeStyle = brushOpaqueColor;
				ctx.lineWidth = brushSize;
				ctx.lineCap = "round";
				ctx.beginPath();
				ctx.moveTo(this.xx, this.yy);
				ctx.quadraticCurveTo(this.x1, this.y1, this.x, this.y);
				ctx.stroke();

				if (!tile.touched) {
					this.touchedTiles.push(tile);
					tile.touched = true;
				}
			},
			onDragInRectLast: function (tile, offsetX, offsetY) {
				if (!tile.isLoaded) return;

				var ctx = tile.getTempContext();
				ctx.canvas.style.opacity = brushAlpha;
				ctx.strokeStyle = brushOpaqueColor;
				ctx.lineWidth = brushSize;
				ctx.lineCap = "round";
				ctx.beginPath();
				ctx.moveTo(this.x, this.y);
				ctx.quadraticCurveTo(this.x1, this.y1, this.x0, this.y0);
				ctx.stroke();

				if (!tile.touched) {
					this.touchedTiles.push(tile);
					tile.touched = true;
				}
			},
			onDragEnd: function (e) {
				this.x2 = this.x1;
				this.y2 = this.y1;
				this.x1 = this.x0;
				this.y1 = this.y0;
				this.x0 = e._x;
				this.y0 = e._y;
				inRect(this.x0, this.y0, this.x2, this.y2,
					brushSize, this.onDragInRectLast, this);
				copySaveTiles(this.touchedTiles);
			}
		},

		line: {
			onActivate: function () {
				colorTools.className = "";
				viewerEl.className = "cursor-crosshair";
				cursorCircle.className = "";
			},
			onDragStart: function (e) {
			},
			onDrag: function (e) {
			},
			onDragEnd: function (e) {
			}
		},

		curve: {
			onActivate: function () {
				colorTools.className = "";
				viewerEl.className = "cursor-crosshair";
				cursorCircle.className = "";
			},
			onDragStart: function (e) {
			},
			onDrag: function (e) {
			},
			onDragEnd: function (e) {
			}
		},

		erase: {
			onActivate: function () {
				viewerEl.className = "cursor-eraser";
				colorTools.className = ""; //"semi-hidden";
				cursorCircle.className = "";
			},
			onDragStart: function (e) {
				this.x = e._x - .01;
				this.y = e._y - .01;
				this.onDrag(e);
			},
			onDrag: function (e) {
				var prevX = this.x,
					prevY = this.y,
					x = this.x = e._x,
					y = this.y = e._y;

				inRect(x, y, prevX, prevY, brushSize,
					function (tile, offsetX, offsetY) {

					if (!tile.isLoaded || !tile.exists) return;

					// erase in the erase layer (to erase the underlying img)
					var ctx = tile.getEraseQueueContext();
					ctx.lineWidth = brushSize;
					ctx.globalAlpha = brushAlpha;
					ctx.lineCap = "round";
					ctx.beginPath();
					ctx.moveTo(prevX - offsetX - .5, prevY - offsetY - .5);
					ctx.lineTo(x - offsetX - .5, y - offsetY - .5);
					ctx.stroke();
					
					// also erase in the main drawing queue layer
					ctx = tile.getQueueContext();
					ctx.globalCompositeOperation = 'destination-out';
					ctx.lineWidth = brushSize;
					ctx.lineCap = "round";
					ctx.beginPath();
					ctx.moveTo(prevX - offsetX - .5, prevY - offsetY - .5);
					ctx.lineTo(x - offsetX - .5, y - offsetY - .5);
					ctx.stroke();
					tile.draw();
					ctx.globalCompositeOperation = 'source-over';

					app.queueTileSave(tile);
				});
			}
		},

		eyedropper: {
			onActivate: function () {
				viewerEl.className = "cursor-eyedropper";
				colorTools.className = "";
				cursorCircle.className = "hidden";
			},
			onDragStart: function (e) {
				this.plane = app.getCurrentPlane();
				this.onDrag(e);
			},
			onDrag: function (e) {
				var pixel = this.plane.getPixel(e._x, e._y);
				var rgba = Array.prototype.slice.call(pixel.data);
				if (rgba[3] == 0)
					rgba = [255, 255, 255, 0];
				else
					rgba[3] /= 255;
				colorPicker.setColor(rgba);
			}
		}

		/*
		: {
			onActivate: function () {
				viewerEl.className = "cursor-";
			},
			onDragStart: function (e) {
			},
			onDrag: function (e) {
			},
			onDragEnd: function (e) {
			}
		},
		*/
	};

	var activeToolEl;
	function selectTool(name, el) {
		if (!el) {
			el = document.getElementById(name + "-tool");
		}
		var tool = tools[name];
		if (!tool || !el) {
			throw new Error("Unknown tool \"" + name + '"');
		}
		mouseController.setBehavior(tool);
		if (activeToolEl) {
			activeToolEl.className = "";
		}
		activeToolEl = el;
		el.className = "active";
	}
	this.selectTool = selectTool;

	container.addEventListener("click", function (e) {
		for (var el = e.target; el != container; el = el.parentNode) {
			var m = el.id.match(/(.*?)-tool/);
			if (m) {
				selectTool(m[1], el);
				return;
			}
		}
	}, false);

/*
var aBehavior = {
	onEnable: function () {
	},
	onDisable: function () {
	}
	onDragStart: function (e) {
	},
	onDrag: function (e) {
	},
	onDragEnd: function (e) {
	}
};
*/


}

function ColorPicker(el) {
	var self = this,
		hue = 0,
		sat = 0,
		val = 0,
		alpha = 1,
		size = 4,
		storageKey = "colorpicker",

		hueSquare = document.getElementById("hue-square"),
		satValCanvas = document.getElementById("sat-val-canvas"),
		satValCtx = satValCanvas.getContext("2d"),
		satValCursor = document.getElementById("sat-val-cursor"),
		satValWidth = satValCanvas.width,
		satValHeight = satValCanvas.height,

		hueSlider = document.getElementById("hue-slider"),
		hueCanvas = document.getElementById("hue-canvas"),
		hueCursor = document.getElementById("hue-cursor"),
		hueCtx = hueCanvas.getContext("2d");
		hueHeight = hueCanvas.height,

		alphaSlider = document.getElementById("alpha-slider"),
		alphaCanvas = document.getElementById("alpha-canvas"),
		alphaCursor = document.getElementById("alpha-cursor"),
		alphaCtx = alphaCanvas.getContext("2d"),
		alphaWidth = alphaCanvas.width,
		alphaHeight = alphaCanvas.height,
		
		sizeSlider = document.getElementById("size-slider"),
		sizeCanvas = document.getElementById("size-canvas"),
		sizeCursor = document.getElementById("size-cursor"),
		sizeCtx = sizeCanvas.getContext("2d"),
		sizeWidth = sizeCanvas.width,
		sizeHeight = sizeCanvas.height,
		maxSize = sizeHeight,
		minSize = 1,
		
		dotPreviewCanvas = document.getElementById("dot-preview"),
		dotPreviewCtx = dotPreviewCanvas.getContext("2d"),
		dotPreviewWidth = dotPreviewCanvas.width,
		dotPreviewHeight = dotPreviewCanvas.height,
		
		cursorCircle = document.getElementById("cursor-circle"),
		cursorCircleCtx = cursorCircle.getContext("2d");

	// http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
	function hsvToRgb(h, s, v){
		var r, g, b;

		var i = Math.floor(h * 6);
		var f = h * 6 - i;
		var p = v * (1 - s);
		var q = v * (1 - f * s);
		var t = v * (1 - (1 - f) * s);

		switch(i % 6) {
			case 0: r = v, g = t, b = p; break;
			case 1: r = q, g = v, b = p; break;
			case 2: r = p, g = v, b = t; break;
			case 3: r = p, g = q, b = v; break;
			case 4: r = t, g = p, b = v; break;
			case 5: r = v, g = p, b = q; break;
		}

		return [r * 255, g * 255, b * 255];
	}

	function rgbToHsv(r, g, b) {
		r = r/255, g = g/255, b = b/255;
		var max = Math.max(r, g, b), min = Math.min(r, g, b);
		var h, s, v = max;

		var d = max - min;
		s = max == 0 ? 0 : d / max;

		if (max == min) {
			h = 0; // achromatic
		} else {
			switch(max) {
				case r: h = (g - b) / d + (g < b ? 6 : 0); break;
				case g: h = (b - r) / d + 2; break;
				case b: h = (r - g) / d + 4; break;
			}
			h /= 6;
		}

		return [h, s, v];
	}

	// Prepare canvases
	var grad = hueCtx.createLinearGradient(0, 0, 0, hueHeight);
	grad.addColorStop(0/6, "#f00");
	grad.addColorStop(1/6, "#ff0");
	grad.addColorStop(2/6, "#0f0");
	grad.addColorStop(3/6, "#0ff");
	grad.addColorStop(4/6, "#00f");
	grad.addColorStop(5/6, "#f0f");
	grad.addColorStop(6/6, "#f00");
	hueCtx.fillStyle = grad;
	hueCtx.fillRect(0, 0, 1, hueHeight);

	var transparent = "rgba(255, 255, 255, 0)";
	grad = satValCtx.createLinearGradient(0, 0, satValWidth, 0);
	grad.addColorStop(0, "white");
	grad.addColorStop(1, "rgba(255, 255, 255, 0)");
	satValCtx.fillStyle = grad;
	satValCtx.fillRect(0, 0, satValWidth, satValHeight);

	grad = satValCtx.createLinearGradient(0, 0, 0, satValHeight);
	grad.addColorStop(0, "rgba(0, 0, 0, 0)");
	grad.addColorStop(1, "black");
	satValCtx.fillStyle = grad;
	satValCtx.fillRect(0, 0, satValWidth, satValHeight);

	grad = alphaCtx.createLinearGradient(0, 0, alphaWidth, 0);
	grad.addColorStop(0, "rgba(255, 255, 255, 1)");
	grad.addColorStop(1, "rgba(255, 255, 255, 0)");
	alphaCtx.fillStyle = grad;
	alphaCtx.fillRect(0, 0, alphaWidth, alphaHeight);

	var transImg = new Image();
	transImg.src = "images/transparent.png";
	transImg.onload = function () {
		alphaCtx.globalCompositeOperation = "source-atop";
		alphaCtx.fillStyle = alphaCtx.createPattern(transImg, "repeat");
		alphaCtx.fillRect(0, 0, alphaWidth, alphaHeight);
	};

	sizeCtx.beginPath();
	sizeCtx.moveTo(0, (sizeHeight - 1)/2);
	sizeCtx.moveTo(0, (sizeHeight + 1)/2);
	sizeCtx.lineTo(sizeWidth, 0);
	sizeCtx.lineTo(sizeWidth, sizeHeight);
	sizeCtx.closePath();
	sizeCtx.strokeStyle = "white";

	function update() {
		var rgb = hsvToRgb(hue, sat, val).map(Math.round);
		var rgba = "rgba(" + rgb.join(", ") + ", " + alpha + ")";
		rgb = "rgb(" + rgb.join(", ") + ")";

		alphaSlider.style.backgroundColor = rgb;
		sizeCtx.clearRect(0, 0, sizeWidth, sizeHeight);
		sizeCtx.fillStyle = rgba;
		sizeCtx.stroke();
		sizeCtx.fill();

		//dotPreviewCtx.fillStyle = "white";
		//dotPreviewCtx.fillRect(0, 0, dotPreviewWidth, dotPreviewHeight);
		dotPreviewCtx.clearRect(0, 0, dotPreviewWidth, dotPreviewHeight);
		dotPreviewCtx.fillStyle = rgba;
		dotPreviewCtx.beginPath();
		dotPreviewCtx.arc(dotPreviewWidth/2, dotPreviewHeight/2,
			size/2, 0, 2*Math.PI, false);
		dotPreviewCtx.fill();

		var colorStr = [hue, sat, val, alpha, size].join(",");
		if (window.localStorage) localStorage[storageKey] = colorStr;
		if (window.sessionStorage) sessionStorage[storageKey] = colorStr;

		if (self.onChange) self.onChange(rgba, rgb, alpha, size);
	}

	function updateSatVal() {
		satValCursor.style.left = (100 * sat).toFixed(1) + "%";
		satValCursor.style.top = 100 - (100 * val).toFixed(1) + "%";
	}

	function updateHue() {
		hueCursor.style.top = hue * 100 + "%";
		hueSquare.style.backgroundColor = "hsl(" + hue * 360 + ", 100%, 50%)";
	}

	function updateAlpha() {
		alphaCursor.style.left = alpha * 100 + "%";
	}

	function updateSize() {
		sizeCursor.style.left = (size - minSize) /
			(maxSize - minSize) * 100 + "%";

		cursorCircleCtx.clearRect(0, 0, 20, 20);
		cursorCircleCtx.strokeStyle = "rgba(255, 255, 255, .66)";
		cursorCircleCtx.beginPath();
		cursorCircleCtx.arc(10, 10, (size-1)/2, 0, 2*Math.PI, false);
		cursorCircleCtx.stroke();
		cursorCircleCtx.strokeStyle = "rgba(0, 0, 0, .33)";
		cursorCircleCtx.beginPath();
		cursorCircleCtx.arc(10, 10, size/2, 0, 2*Math.PI, false);
		cursorCircleCtx.stroke();
	}

	function updateAll() {
		updateHue();
		updateSatVal();
		updateAlpha();
		updateSize();
		update();
	}

	function drag(e) {
		this.onDrag(e);
	}

	new DragController(hueSquare, {onDragStart: drag, onDrag: function (e) {
		sat = Math.max(0, Math.min(1, e._x / satValWidth)),
		val = 1 - Math.max(0, Math.min(1, e._y / satValHeight)),
		updateSatVal();
		update();
	}});

	new DragController(hueSlider, {onDragStart: drag, onDrag: function (e) {
		hue = Math.max(0, Math.min(1, e._y / hueHeight));
		updateHue();
		update();
	}});

	new DragController(alphaSlider, {onDragStart: drag, onDrag: function (e) {
		alpha = Math.max(0, Math.min(1, e._x / alphaWidth));
		updateAlpha();
		update();
	}});

	new DragController(sizeSlider, {onDragStart: drag, onDrag: function (e) {
		size = Math.max(0, Math.min(1, e._x / sizeWidth)) *
			(maxSize - minSize) + minSize;
		updateSize();
		update();
	}});

	var colorStr = (window.sessionStorage && sessionStorage[storageKey]) ||
		(window.localStorage && localStorage[storageKey]);
	if (colorStr) {
		var hsva = colorStr.split(",");
		hue = +hsva[0] || 0;
		sat = +hsva[1] || 0;
		val = +hsva[2] || 0;
		alpha = +hsva[3] || 1;
		size = +hsva[4] || size;
		updateAll();
		setTimeout(update, 1);
	}

	var visible = false;
	this.hide = function () {
		visible = false;
		el.className = "hidden";
	};
	this.show = function () {
		visible = true;
		el.className = "";
	};
	this.toggle = function () {
		if (visible) this.hide();
		else this.show();
	};
	this.onChange = null;
	this.setColor = function (rgba) {
		var hsl = rgbToHsv(rgba[0], rgba[1], rgba[2]);
		hue = hsl[0];
		sat = hsl[1];
		val = hsl[2];
		alpha = rgba[3];
		updateAll();
	};
}
