function(keys, values, rereduce) {
	var w = 16,
		h = 16,
		d = 6;

	var matrices = values.map(function (value) {
		return value.split("\n").map(function (line) {
			return line.split("").map(function (char) {
				return char.charCodeAt(0);
			});
		});
	});     

	var base = matrices.shift();
	matrices.forEach(function (delta) {
		delta.forEach(function (line, y) {
			var baseLine = base[y] || (base[y] = []);
			line.forEach(function (charCode, x) {
				if (baseLine[x] == null) {
					baseLine[x] = 32;
				}
				if (charCode != 32) {
					baseLine[x] = ((baseLine[x] - 32) | (charCode - 32)) + 32;
				}
			});
		});
	}); 

	return base.map(function (line) {
		return String.fromCharCode.apply(0, line);
	}).join("\n");
}
