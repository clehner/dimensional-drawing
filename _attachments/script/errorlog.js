
Couch.urlPrefix = ".";

// for dev setup
if (location.pathname.indexOf("/_attachments/") != -1) {
	Couch.urlPrefix = "/couchdb/space/_design/space/_rewrite";
}

var db = Couch.db("tiles"),
	startKey = location.search.substr(1),
	errorText,
	errorsList,
	moreLink,
	loadingErrors = false;

function init() {
	if (!window.JSON) {
		var script = document.createElement("script");
		script.onload = init;
		script.src = "script/json2.js";
		var head = document.documentElement.firstChild;
		head.insertBefore(script, head.firstChild);
		return;
	}

	errorsList = document.getElementById("errors");
	errorText = document.getElementById("error").firstChild;
	moreLink = document.getElementById("more-link");

	moreLink.addEventListener("click", function (e) {
		if (!loadingErrors) loadErrors();
		e.preventDefault();
	}, false);

	loadErrors();
}

function loadErrors() {
	loadingErrors = true;
	db.view("space/errors", {
		startkey: startKey,
		descending: true,
		include_docs: true,
		limit: 25,
		success: function (resp) {
			loadingErrors = false;
			if (!resp || !resp.rows || !resp.rows.length) return;
			resp.rows.forEach(function (row) {
				displayError(row.doc);
			});
			startKey = resp.rows[resp.rows.length-1].key;
			moreLink.href = "?" + startKey;
		},
		error: function (resp) {
			loadingErrors = false;
			error("Unable to fetch error log.");
		}
	});
}

function listenForChanges(since) {
	function refreshSoon() {
		if (savingEdits) {
			setTimeout(refreshSoon, 1000);
		} else {
			location.reload();
		}
	}

	// listen for tile and design doc changes
	var promise = db.changes(since, {
		filter: "space/errors",
		include_docs: true
	});
	promise.onChange(function (resp) {
		resp.results.forEach(function (change) {
			displayError(change.doc, true);
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
	}
});


function error(msg) {
	errorText.nodeValue = "Error: " + msg;
}

function displayError(doc, top) {
	var li = document.createElement("li");

	var time = document.createElement("time");
	var date = new Date(doc.time);
	time.appendChild(document.createTextNode(date));
	//time.setAttribute("datetime", date.toISOString());
	li.appendChild(time);

	li.appendChild(document.createTextNode(doc.message));

	var source = document.createElement("div");
	source.className = "source";

	var link = document.createElement("a");
	if (doc.url.indexOf('.') != -1) link.href = doc.url;
	link.appendChild(document.createTextNode(doc.url));
	source.appendChild(link);

	source.appendChild(document.createTextNode("#" + doc.line));
	li.appendChild(source);

	if (doc.browser) {
		var browser = document.createElement("div");
		browser.className = "browser";
		browser.appendChild(document.createTextNode(doc.browser));
		li.appendChild(browser);
	}

	if (top && errorsList.firstChild)
		errorsList.insertBefore(li, errorsList.firstChild);
	else
		errorsList.appendChild(li);
}
