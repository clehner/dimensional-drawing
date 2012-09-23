if (!window.console) {
	var console = window.console = {
		log: function () {}
	};
}

// Utils

/*
function hasClass(element, className) {
	if (element.className) {
		return element.className.match(getClassRegex(className));
	}
}
function addClass(element, className) {
	if (!className) return;
	if (!hasClass(element, className)) {
		element.className += ' ' + className;
	}
}

function removeClass(element, className) {
	var old = element.className;
	element.className = (old == className) ? '' :
		old.replace(getClassRegex(className), ' ');
}

function toggleClass(element, className, on) {
	if (arguments.length == 2) {
		on = hasClass(element, className);
	}
	if (!on) {
		removeClass(element, className);
	} else {
		addClass(element, className);
	}
}
*/

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

/*
// by Robin W. Spencer
// http://scaledinnovation.com/analytics/splines/splines.html
function getControlPoints(x0,y0,x1,y1,x2,y2,t){
    //  x0,y0,x1,y1 are the coordinates of the end (knot) pts of this segment
    //  x2,y2 is the next knot -- not connected here but needed to calculate p2
    //  p1 is the control point calculated here, from x1 back toward x0.
    //  p2 is the next control point, calculated here and returned to become the 
    //  next segment's p1.
    //  t is the 'tension' which controls how far the control points spread.
    
    //  Scaling factors: distances from this knot to the previous and following knots.
    var d01=Math.sqrt(Math.pow(x1-x0,2)+Math.pow(y1-y0,2));
    var d12=Math.sqrt(Math.pow(x2-x1,2)+Math.pow(y2-y1,2));
   
    var fa=t*d01/(d01+d12);
    var fb=t-fa;
  
    var p1x=x1+fa*(x0-x2);
    var p1y=y1+fa*(y0-y2);

    var p2x=x1-fb*(x0-x2);
    var p2y=y1-fb*(y0-y2);  
    
    return [p1x,p1y,p2x,p2y]
}

function drawSpline(ctx,pts,t){
    ctx.save();
    var cp=[];   // array of control points, as x0,y0,x1,y1,...
    var n=pts.length;

	// Draw an open curve, not connected at the ends
	for(var i=0;i<n-4;i+=2){
		cp=cp.concat(getControlPoints(pts[i],pts[i+1],pts[i+2],pts[i+3],pts[i+4],pts[i+5],t));
	}    
	for(var i=2;i<pts.length-5;i+=2){
		ctx.beginPath();
		ctx.moveTo(pts[i],pts[i+1]);
		ctx.bezierCurveTo(cp[2*i-2],cp[2*i-1],cp[2*i],cp[2*i+1],pts[i+2],pts[i+3]);
		ctx.stroke();
		ctx.closePath();
	}
	//  For open curves the first and last arcs are simple quadratics.
	ctx.beginPath();
	ctx.moveTo(pts[0],pts[1]);
	ctx.quadraticCurveTo(cp[0],cp[1],pts[2],pts[3]);
	ctx.stroke();
	ctx.closePath();
	
	ctx.beginPath();
	ctx.moveTo(pts[n-2],pts[n-1]);
	ctx.quadraticCurveTo(cp[2*n-10],cp[2*n-9],pts[n-4],pts[n-3]);
	ctx.stroke();
	ctx.closePath();

    ctx.restore();
}
*/
