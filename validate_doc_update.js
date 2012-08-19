function (doc, oldDoc, userCtx) {
	var isAdmin = userCtx.roles.indexOf('_admin') != -1;

	if (isAdmin) {
		// admin can do anything
		return true;
	}

	if (doc._deleted) {
		throw {unauthorized: "only admin may delete docs"};
	}

	if (doc.type == "error") {
		return true;
	}

	if (!(doc._attachments && doc._attachments['tile.png'])) {
		throw {forbidden: "doc must have a tile image"};
	}

	if (doc._attachments['tile.png'].content_type != 'image/png') {
		throw {forbidden: "tile image must be png"};
	}

	if (typeof doc.x != "number"
		|| typeof doc.y != "number"
		|| typeof doc.z != "number") {
		throw {forbidden: "tile must have numeric coords x,y,z"};
	}

	if (doc._id != doc.z + "_" + doc.y + "_" + doc.x) {
		throw {forbidden: "id must be in format z_y_x"};
	}
}
