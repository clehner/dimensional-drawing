function(doc) {
	if (doc.type == "error")
		emit(doc.time, doc);
}
