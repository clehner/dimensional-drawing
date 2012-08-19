function(doc) {
	if (doc.type == "error") return;

	// range of tiles represented by a box
	var w = 16,
		h = 16,
		d = 6;

	// position of the box
	var boxX = Math.floor(doc.x / w);
	var boxY = Math.floor(doc.y / h);
	var boxZ = Math.floor(doc.z / d);

	// offset of this tile within the box
	var offsetX = doc.x - boxX * w;
	var offsetY = doc.y - boxY * h;
	var offsetZ = doc.z - boxZ * d;
	
	// box value added by this tile
	var topPadding = new Array(offsetY + 1).join("\n");
	var leftPadding = new Array(offsetX + 1).join(" ");
	var id = String.fromCharCode(32 + (1 << offsetZ));

	emit([boxZ, boxY, boxX], topPadding + leftPadding + id);
}
