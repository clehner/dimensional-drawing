if (!window.console) {
	var console = window.console = {
		log: function () {}
	};
}

// Utils

var Canvases = {
	_canvases: [],

	get: function (width, height) {
		var canvas = this._canvases.pop() || document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		return canvas;
	},

	recycle: function (canvas) {
		if (canvas) {
			this._canvases.push(canvas);
		}
	}
};

function line(x0, y0, x1, y1, point) {
	var x = Math.floor(x0);
	var y = Math.floor(y0);
	
	if (point(x, y) === false) {
		return;
	}
	
	var xFloor1 = Math.floor(x1);
	var yFloor1 = Math.floor(y1);
	
	if (x == xFloor1 && y == yFloor1) {
		// single pixel
		return;
	}
	
	var yStep = y0 < y1 ? 1 : -1;
	var xStep = x0 < x1 ? 1 : -1;
	var xBorderStep = x0 < x1 ? 1 : 0;
	var slope = (y1 - y0) / (x1 - x0);
	var yInt = y0 - slope * x0;
	
	var j = 0;
	
	do {
		// check y of left or right border
		var x2 = x + xBorderStep;
		var y2 = Math.floor(slope * x2 + yInt);
		if (y2 == y) {
			// move to the right
			x += xStep;
			y = y2;
		} else {
			// move vertically
			y += yStep;
		}
		if (point(x, y) === false) { return; }
	
		if (j++ > 1000) throw new Error("Too much iteration.");
	} while (x != xFloor1 || y != yFloor1);
}

function DragController(element, options) {
	if (!element) return null;
	if (!options) options = 0;
	var onDragStart = options.onDragStart;
	var onDrag = options.onDrag;
	var onDragEnd = options.onDragEnd;
	var context = options;
	options.onActivate && options.onActivate();

	var lastX, lastY;
	var offsetX, offsetY;
	function calculateOffsets() {
		var x = 0, y = 0;
		for (var el = element; el; el = el.offsetParent) {
			x += el.offsetLeft - el.scrollLeft;
			y += el.offsetTop - el.scrollTop;
		}
		offsetX = x;
		offsetY = y;
	}

	// Add coords relative to element
	function correctEvent(e) {
		lastX = e._x = e.pageX - offsetX;
		lastY = e._y = e.pageY - offsetY;
	}

	function onMouseMove(e) {
		correctEvent(e);
		onDrag && onDrag.call(context, e);
	}

	function onMouseUp(e) {
		document.removeEventListener("mouseup", onMouseUp, false);
		document.removeEventListener("mousemove", onMouseMove, true);
		correctEvent(e);
		onDragEnd && onDragEnd.call(context, e);
	}

	function onTouchEnd(e) {
		if (e.touches.length > 0) return;
		document.removeEventListener("touchend", onTouchEnd, false);
		document.removeEventListener("touchcancel", onTouchEnd, false);
		document.removeEventListener("touchmove", onMouseMove, true);
		e._x = lastX;
		e._y = lastY;
		onDragEnd && onDragEnd.call(context, e);
	}

	function onMouseDown(e) {
		if (e.touches) {
			e.preventDefault();
			document.addEventListener("touchmove", onMouseMove, true);
			document.addEventListener("touchend", onTouchEnd, false);
			document.addEventListener("touchcancel", onTouchEnd, false);
		} else {
			document.addEventListener("mousemove", onMouseMove, true);
			document.addEventListener("mouseup", onMouseUp, false);
		}

		// ignore right click
		document.addEventListener("contextmenu", onMouseUp, false);
		calculateOffsets();
		correctEvent(e);
		onDragStart && onDragStart.call(context, e);
	}
	element.addEventListener("touchstart", onMouseDown, false);
	element.addEventListener("mousedown", onMouseDown, false);

	this.setBehavior = function (opt) {
		onDragStart = opt.onDragStart;
		onDrag = opt.onDrag;
		onDragEnd = opt.onDragEnd;
		context = opt;
		opt.onActivate && opt.onActivate();
	};
}

function pref(key, val) {
	if (pref.arguments.length == 1) {
		return (window.sessionStorage && sessionStorage[key]) ||
			(window.localStorage && localStorage[key]);
	} else {
		if (window.localStorage) localStorage[key] = val;
		if (window.sessionStorage) sessionStorage[key] = val;
	}
}
// draw ellipse
// r = radius of base circle
// w,h = ratio of ellipse width,height to r
// a = angle of rotation (radians) clockwise from orthogonal
/*
function ellipse(ctx, x, y, r, w, h, a) {
	ctx.beginPath();
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(a);
	ctx.scale(w, h);
	ctx.arc(0, 0, r, 0, Math.PI * 2);
	ctx.restore(); 
}
*/
