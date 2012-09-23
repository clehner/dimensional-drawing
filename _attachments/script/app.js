function Tile(x, y, z, plane) {
	this.x = x;
	this.y = y;
	this.z = z;
	this.plane = plane;
}
Tile.prototype = {
	x: NaN,
	y: NaN,
	z: NaN,

	img: null,
	temp: null,
	tempCtx: null,
	queue: null,
	queueCtx: null,
	eraseQueue: null,
	eraseQueueCtx: null,
	mergedCanvas: null,
	onImgLoad: null,
	onSaved: null,

	exists: null,
	isLoaded: false,
	isLoading: false,
	hasEdits: false,
	savingEdits: false,
	savedEdits: false,
	touched: false,
	saving: false,

	unloadedCanvas: (function () {
		var canvas = Canvases.get(1, 1);
		var ctx = canvas.getContext("2d");
		ctx.fillStyle = 'rgba(192, 192, 192, 0.5)';
		ctx.fillRect(0, 0, 1, 1);
		return canvas;
	}()),

	getId: function () {
		return this.z + "_" + this.y + "_" + this.x;
	},

	addOnLoad: function (cb) {
		(this.onImgLoad || (this.onImgLoad = [])).push(cb);
	},

	addOnSaved: function (cb) {
		(this.onSaved || (this.onSaved = [])).push(cb);
	},

	loadImage: function (noCache) {
		var self = this;
		var img = new Image();
		img.onload = function (e) {
			self.img = img;
			self.isLoaded = true;
			self.isLoading = false;
			self.clearSavedEdits();
			self.draw();
			if (self.onImgLoad) {
				self.onImgLoad.forEach(function (cb) { cb() });
				self.onImgLoad.length = 0;
			}
		};
		img.onerror = function () {
			// todo: do something better here.
			self.exists = false;
			img.onload();
			delete self.img;
		};
		var suffix = noCache ? "?" + Math.random() : "";
		img.src = Couch.urlPrefix + "/tiles/"
			+ this.getId() + "/tile.png" + suffix;
		this.isLoading = true;
	},

	// draw this tile onto a canvas context
	drawTo: function (dest, x, y, w, h, redraw) {
		if (redraw) {
			dest.clearRect(x, y, w, h);
		}
		if (!this.isLoaded) {
			dest.drawImage(this.unloadedCanvas, x, y, w, h);
			if (this.exists && !this.img) {
				// probably came through a change listener
				this.loadImage();
			}
			return;
		}
		if (this.img && this.isLoaded && this.exists) {
			dest.drawImage(this.img, x, y, w, h);
		}
		if (this.eraseQueue) {
			dest.globalCompositeOperation = 'destination-out';
			dest.drawImage(this.eraseQueue, x, y, w, h);
			dest.globalCompositeOperation = 'source-over';
		}
		if (this.queue) dest.drawImage(this.queue, x, y, w, h);
	},

	draw: function () {
		this.plane.drawTile(this, true);
	},

	erase: function () {
		this.isLoaded = true;
		this.plane.drawTile(this, true);
		this.exists = false;
	},

	// flatten the image with any changes
	getMergedCanvas: function () {
		var merged = this.mergedCanvas;
		var redraw = true;
		if (!merged) {
			merged = this.mergedCanvas = Canvases.get(
				this.plane.tileWidth, this.plane.tileHeight);
			redraw = false;
		}
		if (!this.isLoaded) {
			throw new Error("Cannot merge canvas because not loaded.");
		}
		var ctx = merged.getContext("2d");
		this.drawTo(ctx, 0, 0, merged.width, merged.height, redraw);
		return merged;
	},

	exportPNG: function () {
		var merged = this.getMergedCanvas();
		var dataURL = merged.toDataURL("image/png");
		var imageData = dataURL.substr('data:image/png;base64,'.length);
		return imageData;
	},

	getTempContext: function () {
		if (!this.tempCtx) {
			var plane = this.plane;
			var w = plane.tileWidth;
			var h = plane.tileHeight;
			var left = this.x * w + plane.x;
			var top = this.y * h + plane.y;

			this.temp = Canvases.get(w, h);
			this.tempCtx = this.temp.getContext("2d");
			this.tempCtx.translate(-left, -top);

			this.temp.className = "temp-canvas";
			var s = this.temp.style;
			s.left = left + "px";
			s.top = top + "px";

			if (!plane.container) {
				throw new Error("No container for temp canvas");
			}
			plane.container.appendChild(this.temp);
		}
		return this.tempCtx;
	},

	removeTempContext: function () {
		if (this.tempCtx) {
			this.temp.parentNode.removeChild(this.temp);
			Canvases.recycle(this.temp);
			delete this.tempCtx, this.tmp;
		}
	},

	getQueueContext: function () {
		if (!this.queueCtx) {
			this.queue = Canvases.get(
				this.plane.tileWidth, this.plane.tileHeight);
			this.queueCtx = this.queue.getContext("2d");
		}
		return this.queueCtx;
	},

	getEraseQueueContext: function () {
		if (!this.eraseQueueCtx) {
			this.eraseQueue = Canvases.get(
				this.plane.tileWidth, this.plane.tileHeight);
			this.eraseQueueCtx = this.eraseQueue.getContext("2d");
		}
		return this.eraseQueueCtx;
	},

	createDoc: function () {
		return {
			_id: this.getId(),
			x: this.x,
			y: this.y,
			z: this.z
		};
	},

	getDoc: function (db, success, error) {
		if (this.exists) {
			db.openDoc(this.getId(), {
				error: error,
				success: success
			});
		} else {
			success(this.createDoc());
		}
	},

	save: function (db) {
		var self = this;
		if (this.saving) {
			console.log("defering saving");
			this.addOnSaved(function () {
				console.log("defer complete");
				self.save(db);
			});
			return;
		}
		this.saving = true;
		var app = this.plane.app;
		function onError(status, error, reason) {
			this.saving = false;
			if (error == "conflict") {
				// get updated doc and try again
				self.save(db);
			} else {
				alert("Error saving your drawing! :( " + error + ", " + reason);
				throw new Error("Error saving edits. " + error + ", " + reason);
			}
		}
		this.getDoc(db, function save2(doc) {
			if (!self.isLoaded) {
				// defer save
				self.addOnLoad(function () { save2(doc) });
				return;
			}

			this.hasEdits = false;
			doc.modified_at = +new Date();
			doc._attachments = {
				"tile.png": {
					content_type: "image/png",
					data: self.exportPNG()
				}
			};
			self.savingEdits = true;
			db.saveDoc(doc, {
				error: onError,
				success: function () {
					self.saving = false;
					if (self.onSaved) {
						self.onSaved.forEach(function (cb) { cb() });
						self.onSaved.length = 0;
					}
					app.onSaveEnd(self);
					self.hasEdits = false;
					self.savingEdits = false;
					self.savedEdits = true;
				}
			});
		}, onError);
	},

	// when our own edits have been received back in the updated image,
	// they can be erased from the queues.
	clearSavedEdits: function () {
		if (this.savedEdits) {
			this.clearEdits();
		}
	},

	clearEdits: function () {
		this.savedEdits = false;
		if (this.queue) {
			Canvases.recycle(this.queue);
			delete this.queue;
			delete this.queueCtx;
		}
		if (this.eraseQueue) {
			Canvases.recycle(this.eraseQueue);
			delete this.eraseQueue;
			delete this.eraseQueueCtx;
		}
	},

	clearAllEdits: function() {
		this.hasEdits = false;
		this.clearEdits();
		this.removeTempContext();
		this.draw();
	},

	isVisible: function () {
		return this.plane.visibleTiles &&
			(this.plane.visibleTiles.indexOf(this) != -1);
	}
};

function TileMaps(db) {
	// associate these with tile_map view
	var w = 16,
		h = 16,
		d = 6,
		boxes = {};

	function Box(coords) {
		this.coords = coords;
		this.tilesSubscribed = [];
	}
	Box.prototype = {
		coords: null,
		tilesSubscribed: null,
		lines: [],
		loadedLines: false,

		subscribeTile: function (tile, redraw) {
			if (this.loadedLines) {
				this.executeForTile(tile, redraw);
			} else {
				this.tilesSubscribed.push(tile);
			}
		},

		execute: function () {
			var self = this;
			this.tilesSubscribed.forEach(function (tile) {
				self.executeForTile(tile, true);
			});
			this.tilesSubscribed.length = 0;
		},

		executeForTile: function (tile, redraw) {
			// if we couldn't load the lines, assume the tile exists
			var exists = true;
			if (this.loadedLines) {
				// coords relative to box
				var z = tile.z - this.coords[0] * d,
					y = tile.y - this.coords[1] * h,
					x = tile.x - this.coords[2] * w,
					ids = this.lines[y] && this.lines[y].charCodeAt(x) - 32,
					id = 1 << z;
				exists = id ? ((ids & id) == id) : false;
				if (!exists) {
					tile.isLoaded = true;
				}
			}
			tile.exists = exists;
			if (exists) {
				tile.loadImage();
			} else {
				tile.plane.drawTile(tile, redraw);
			}
		},

		load: function () {
			var self = this;
			db.view("space/tile_map", {
				key: this.coords,
				group_level: 3,
				success: function (resp) {
					var value =
						resp && resp.rows && resp.rows[0] && resp.rows[0].value;
					if (value) self.lines = value.split("\n");
					self.loadedLines = true;
					self.execute();
				},
				error: function (a, b, c) {
					self.execute();
				}
			});
		}
	};

	function loadForTile(tile, redraw) {
		var key = [
			Math.floor(tile.z/d),
			Math.floor(tile.y/h),
			Math.floor(tile.x/w)];
		var box = boxes[key];
		if (!box) {
			box = boxes[key] = new Box(key);
			box.load();
		}
		box.subscribeTile(tile, redraw);
	}

	this.loadForTile = loadForTile;
}

function Plane(z, app) {
	this.app = app;
	this.z = z;
	this.el = Canvases.get(1, 1);
	this.el.className = "plane";
	this.ctx = this.el.getContext("2d");
	this.allTiles = {};
}
Plane.prototype = {
	app: null,
	x: NaN,
	y: NaN,
	z: NaN,
	width: NaN,
	height: NaN,
	bufferX: 0,
	bufferY: 0,
	mouseX: 0,
	mouseY: 0,
	zoom: 1,
	isVisible: false,
	isEmpty: true,
	container: null,
	el: null,
	ctx: null,
	tileWidth: 256,
	tileHeight: 256,
	tileWidthZoomed: NaN,
	tileHeightZoomed: NaN,
	allTiles: null,
	visibleTiles: null,

	show: function (container) {
		this.container = container;
		container.appendChild(this.el);
		if (!this.isVisible) {
			this.isVisible = true;
		}
	},

	hide: function () {
		if (!this.isVisible) return;
		this.isVisible = false;
		this.container.removeChild(this.el);
		delete this.visibleTiles;
	},

	setZoom: function (zoom) {
		this.zoom = zoom;
		this.tileWidthZoomed = this.tileWidth * zoom;
		this.tileHeightZoomed = this.tileHeight * zoom;
		this.resize();
		this.updateBuffer();
		this.updateOffset();
	},

	setPosition: function (x, y) {
		this.x = x;
		this.y = y;
		this.draw();
	},

	setMouse: function (x, y) {
		this.mouseX = x;
		this.mouseY = y;
		// zoom=1 layer is stationary
		if (this.zoom != 1)
			this.updateOffset();
	},

	setAlpha: function (a) {
		this.el.style.opacity = a.toFixed(3);
	},

	resize: function () {
		var zoom = this.zoom < 1 ? 1/this.zoom : this.zoom * this.zoom;
		this.width = this.container.clientWidth * zoom;
		this.height = this.container.clientHeight * zoom;
		this.el.width = this.width;
		this.el.height = this.height;
		this.isEmpty = true;
		this.updateBuffer();
	},

	updateOffset: function () {
		var zoom = 1 - this.zoom;
		var s = this.el.style;
		s.left = (zoom * this.mouseX - this.bufferX).toFixed(0) + "px";
		s.top = (zoom * this.mouseY - this.bufferY).toFixed(0) + "px";
	},

	updateBuffer: function () {
		var zoom = this.zoom < 1 ? 1/this.zoom : this.zoom;
		this.bufferX = (zoom - 1) * this.width;
		this.bufferY = (zoom - 1) * this.height;
	},

	draw: function () {
		if (this.isEmpty) {
			this.isEmpty = false;
		} else {
			this.ctx.clearRect(0, 0, this.width, this.height);
		}

		// get the visible tiles
		var zoom = this.zoom < 1 ? 1/this.zoom : this.zoom;
		var visibleTiles = this.visibleTiles = this.getTilesInRect(
			-this.x - this.bufferX,
			-this.y - this.bufferY,
			this.width * zoom,
			this.height * zoom);
		// draw the tiles.
		for (var i = 0; i < visibleTiles.length; i++) {
			this.drawTile(visibleTiles[i], false);
		}
	},

	drawTile: function (tile, redraw) {
		if (tile.exists == null) {
			this.app.tileMaps.loadForTile(tile, redraw);
			//return;
		}
		var w = this.tileWidthZoomed,
			h = this.tileHeightZoomed,
			x2 = this.x * this.zoom,
			y2 = this.y * this.zoom,
			x = Math.floor(x2 + tile.x * w) + this.bufferX,
			y = Math.floor(y2 + tile.y * h) + this.bufferY;

		tile.drawTo(this.ctx,
			x, y,
			Math.floor((1+tile.x)*w + x2) - Math.floor(tile.x*w + x2),
			Math.floor((1+tile.y)*h + y2) - Math.floor(tile.y*h + y2),
			redraw);
	},

	getTilesInRect: function (x0, y0, w, h) {
		var tiles = [];
		var left   = Math.floor(x0 / this.tileWidth);
		var top    = Math.floor(y0 / this.tileHeight);
		var right  = Math.ceil((x0 + w) / this.tileWidth);
		var bottom = Math.ceil((y0 + h) / this.tileHeight);

		for (var x = left; x < right; x++) {
			for (var y = top; y < bottom; y++) {
				tiles.push(this.getTile(x, y));
			}
		}
		return tiles;
	},

	getTile: function (x, y) {
		return (this.allTiles[x] || (this.allTiles[x] = {}))[y] ||
			(this.allTiles[x][y] = new Tile(x, y, this.z, this));
	},

	// for eyedropper tool
	getPixel: function (x, y) {
		return this.ctx.getImageData(x + this.bufferX, y + this.bufferY, 1, 1);
	}
};

function App() {

var app = this,
	viewerEl,
	zRadius = 3,
	planes = [],
	loc = {x: NaN, y: NaN, z: NaN},
	zoomStep = 1.04,
	alphaStep = 1.33,
	mouseX = 0,
	mouseY = 0,
	coordsLink,
	savingEdits = 0,
	dev = (location.pathname.indexOf("/_attachments/") != -1),
	undefined;

Couch.urlPrefix = ".";

// for dev setup
if (dev) {
	Couch.urlPrefix = "/couchdb/space/_design/space/_rewrite";
}

var db = Couch.db("tiles");

// Error logging
if (!dev) window.onerror = function (message, url, line) {
	db.saveDoc({
		type: "error",
		time: +new Date(),
		message: message,
		url: url,
		browser: navigator.appVersion,
		line: line
	}, {
		error: function () {}
	});
};

function listenForChanges(since) {
	function refreshSoon() {
		if (savingEdits) {
			setTimeout(refreshSoon, 1000);
		} else {
			location.reload();
		}
	}

	// listen for tile and design doc changes
	var promise = db.changes(since);
	promise.onChange(function (resp) {
		resp.results.forEach(function perChange(change) {
			if (change.id == "_design/space") {
				// updated design doc
				refreshSoon();
			} else {
				// a new, updated, or deleted tile doc
				var coords = change.id.split("_");
				if (coords.some(isNaN)) {
					// not a tile doc
					return;
				}
				var plane = getPlane(coords[0]);
				var tile = plane.getTile(coords[2], coords[1]);
				if (change.deleted) {
					tile.erase();
				} else {
					tile.exists = true;
					tile.isLoaded = false;
					//tile.setRev(change.changes[change.changes.length-1].rev);
					if (tile.img || tile.isVisible()) {
						// reload
						tile.loadImage(true);
					}
				}
			}
		});
	});
	window.addEventListener("online", promise.start, false);
	window.addEventListener("offline", promise.stop, false);
}
db.info({
	success: function (info) {
		var since = info.update_seq;
		setTimeout(function () {
			listenForChanges(since);
		}, 4000);
	},
	error: function (status, error, reason) {
		throw new Error("Error getting db info. " + error);
	}
});

this.tileMaps = new TileMaps(db);

var allPlanes = {};
function getPlane(z) {
	return allPlanes[z] || (allPlanes[z] = new Plane(z, app));
};

function updatePlanes() {
	// hide planes now out of view.
	var plane;
	for (var i = 0; i < planes.length; i++) {
		plane = planes[i];
		if (plane && (plane.z < loc.z - zRadius || plane.z > loc.z)) {
			plane.hide();
		}
	}
	// update and show visible planes
	for (var z = -zRadius; z <= 0; z++) {
		plane = getPlane(loc.z + z);
		planes[zRadius + z] = plane;
		if (plane) {
			plane.setAlpha(Math.pow(alphaStep, -z*z));
			var zoom = Math.pow(zoomStep, z);
			plane.show(viewerEl);
			plane.setZoom(zoom);
			plane.setPosition(loc.x, loc.y);
			plane.setMouse(mouseX, mouseY);
		}
	}
}

var coordNodes = {
	x: document.getElementById("x-coord").firstChild,
	y: document.getElementById("y-coord").firstChild,
	z: document.getElementById("z-coord").firstChild
};

function setPosition(x, y, z, dragged) {
	var prevZ = loc.z;
	loc.x = x;
	loc.y = y;
	loc.z = z;
	if (z != prevZ) {
		updatePlanes();
	} else {
		for (var i = 0; i < planes.length; i++) {
			if (planes[i]) planes[i].setPosition(x, y);
		}
	}
	coordNodes.x.nodeValue = Math.round(x/-256);
	coordNodes.y.nodeValue = Math.round(y/256);
	coordNodes.z.nodeValue = z;
	coordsLink.href = getLocationURL();

	pref("space-position", x + "," + y + "," + z);

	// remove the hash when the user moves the page,
	// so that if the page is refreshed it won't go back to
	// the location in the hash
	if (dragged && location.hash) {
		location.hash = "";
	}
}

function setZRadius(r) {
	if (zRadius == r) return;
	zRadius = Math.ceil(r);
	alphaStep = (r + 1)/r;
	updatePlanes();
}

function onResize(e) {
	for (var i = 0; i < planes.length; i++) {
		var plane = planes[i];
		if (plane) {
			plane.resize();
			plane.draw();
		}
	}
}

var cursorCircle = document.getElementById("cursor-circle");
function onMouseMove(e) {
	mouseX = e.pageX;
	mouseY = e.pageY;
	for (var i = 0; i < planes.length; i++) {
		var plane = planes[i];
		if (plane) {
			plane.setMouse(mouseX, mouseY);
		}
	}
	cursorCircle.style.left = mouseX - 10 + "px";
	cursorCircle.style.top = mouseY - 10 + "px";
}

function onMouseOver(e) {
	viewerEl.appendChild(cursorCircle);
}

function onMouseOut(e) {
	var to = e.relatedTarget || e.toElement;
	if (to && (to == cursorCircle)) return;
	viewerEl.removeChild(cursorCircle);
}

function onScroll(e) {
	var delta = e.wheelDelta || e.detail*-120;
	if (!delta) return;
	var z = loc.z + (delta > 0 ? 1 : -1);
	setPosition(loc.x, loc.y, z, true);
}

viewerEl = document.getElementById("viewer");
mouseX = viewerEl.clientWidth/2;
mouseY = viewerEl.clientHeight/2;

function getLocationURL() {
	var path = (location.href.match(/^.*?(?=\?|#)/) || [location.href])[0];
	return path + "#" +
		loc.x + "," + loc.y + "," + loc.z;
}

coordsLink = document.getElementById("coords");
coordsLink.addEventListener("click", function (e) {
	if (!prompt("This location's URL:",
			getLocationURL())) {
		e.preventDefault();
		e.cancelBubble = true;
	}
}, false);

window.addEventListener("resize", onResize, false);

viewerEl.addEventListener("mousemove", onMouseMove, false);
viewerEl.addEventListener("touchstart", onMouseMove, false);
viewerEl.addEventListener("touchmove", onMouseMove, false);
viewerEl.addEventListener("mouseover", onMouseOver, false);
viewerEl.addEventListener("mouseout", onMouseOut, false);
viewerEl.addEventListener("DOMMouseScroll", onScroll, false);
viewerEl.addEventListener("mousewheel", onScroll, false);

// allow zooming with touch gestures
var zStart;
viewerEl.addEventListener("gesturestart", function (e) {
	zStart = loc.z;
}, false);
viewerEl.addEventListener("gesturechange", function (e) {
	var z = zStart + Math.round(Math.E * Math.log(e.scale));
	setPosition(loc.x, loc.y, z);
}, false);

// prevent viewport dragging in mobile safari
document.body.addEventListener("touchmove", function (e) {
	e.preventDefault();
}, false);

// Keyboard stuff
window.addEventListener("keydown", function (e) {
	if (e.which == 27) { // escape
		if (pref("knows escape")) {
			clearAllEdits();
		} else {
			pref("knows escape", true);
			alert("Press escape to undo " +
				"whatever you drew in the last few seconds");
		}
	}
}, false);

// Navigation
var posStr = location.hash.substr(1) || pref("space-position");
var s = posStr ? posStr.split(",") : '000';
setPosition(+s[0] || 0, +s[1] || 0, +s[2] || 0);

var introEl = document.getElementById("intro");
if (pref("space-intro") == "hide") {
	introEl.className = "hidden";
}
document.getElementById("intro-close").addEventListener("click", function (e) {
	introEl.className = "hidden";
	pref("space-intro", "hide");
	e.preventDefault();
}, false);

window.addEventListener("hashchange", function () {
	var hash = location.hash.substr(1);
	if (!hash) return;
	var s = hash.split(",");
	setPosition(+s[0] || 0, +s[1] || 0, +s[2] || 0);
}, false);

// Saving Edits

var saveTimer;
var saveTime = 3000; // delay after drawing stops to save edits
var saveQueue = []; // tiles with edits, awaiting save

function saveEdits() {
	saveQueue.forEach(function (tile) {
		tile.save(db);
	});
	saveQueue.length = 0;
}
function queueTileSave(tile) {
	if (!tile.hasEdits || tile.savingEdits) {
		tile.hasEdits = true;
		saveQueue.push(tile);
		savingEdits++;
	}
	clearTimeout(saveTimer);
	saveTimer = setTimeout(saveEdits, saveTime);
}
function clearAllEdits() {
	saveQueue.forEach(function (tile) {
		tile.clearAllEdits();
		savingEdits--;
	});
	saveQueue.length = 0;
}

// Public API

this.setPosition = setPosition;
this.setZRadius = setZRadius;
this.planes = planes;
this.location = loc;
this.viewerEl = viewerEl;
this.getCurrentPlane = function () {
	return getPlane(loc.z);
};
this.queueTileSave = queueTileSave;
this.getPlane = getPlane;
this.onSaveEnd = function (tile) {
	savingEdits--;
};

// Tools

var dragger = new DragController(viewerEl);
var toolset = new ToolSet(this, dragger, document.getElementById("tools"));
toolset.selectTool("scroll");

}

function init() {
	if (!window.JSON) {
		var script = document.createElement("script");
		script.onload = init;
		script.src = "script/json2.js";
		var head = document.documentElement.firstChild;
		head.insertBefore(script, head.firstChild);
		return;
	}
	window.app = new App();
}

// Google Analytics
if (location.hostname != "localhost") {
	var _gaq = [['_setAccount', 'UA-11963387-6'], ['_trackPageview']];
	(function(d, t) {
		var g = d.createElement(t),
			s = d.getElementsByTagName(t)[0];
		g.src = ('https:' == location.protocol ? '//ssl' : '//www') + '.google-analytics.com/ga.js';
		s.parentNode.insertBefore(g, s);
	}(document, 'script'));
}

function shiftHeader(){
    $(function(){
        $('#header').css('top', '25px');
    })
}
