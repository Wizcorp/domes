'use strict';

function Path(str, chunks) {
	this._str = str;
	this._chunks = chunks;
}

module.exports = Path;


Path.fromString = function (str) {
	if (typeof str !== 'string') {
		throw new TypeError('Path must be a string');
	}

	str = str.trim();

	return new Path(str, str.length === 0 ? [] : undefined);
};


Path.fromChunks = function (chunks) {
	if (!Array.isArray(chunks)) {
		throw new TypeError('Path must be an array');
	}

	return new Path(chunks.length === 0 ? '' : undefined, chunks);
};


Path.chunksToString = function (chunks) {
	var str = '';

	for (var i = 0; i < chunks.length; i += 1) {
		var chunk = chunks[i];

		if (typeof chunk === 'string') {
			if (i === 0) {
				str += chunk;
			} else {
				str += '.' + chunk;
			}
		} else if (typeof chunk === 'number') {
			str += '[' + chunk + ']';
		}
	}

	return str;
};


Path.stringToChunks = function (str) {
	var STATE_NONE = 0, STATE_STR = 1, STATE_NUM = 2;
	var len = str.length;
	var chunks = [];

	if (len === 0) {
		return chunks;
	}

	var state = str[0] === '[' ? STATE_NUM : STATE_STR;
	var offset = str[0] === '[' ? 1 : 0;
	var index = offset;

	for (; offset < len; offset += 1) {
		var char = str[offset];
		var next = str[offset + 1];

		if (state === STATE_NONE) {
			if (char === '.') {
				state = STATE_STR;
			} else if (char === '[') {
				state = STATE_NUM;
			} else {
				throw new Error('Unexpected character "' + char + '" at offset ' + offset + ' of path "' + str + '"');
			}
			index = offset + 1;
		} else if (state === STATE_NUM) {
			if (char < '0' || char > '9') {
				throw new Error('Unexpected non-digit "' + char + '" at offset ' + offset + ' of path "' + str + '"');
			}

			if (next === ']') {
				chunks.push(parseInt(str.substring(index, offset + 1), 10));
				offset += 1;
				state = STATE_NONE;
			} else if (next === undefined) {
				throw new Error('Unexpected end-of-string of path "' + str + '"');
			}
		} else if (state === STATE_STR) {
			if (next === '.' || next === '[' || next === undefined) {
				chunks.push(str.substring(index, offset + 1));
				state = STATE_NONE;
			}
		}
	}

	return chunks;
};


Path.prototype.getChunks = function () {
	if (this._chunks === undefined) {
		this._chunks = Path.stringToChunks(this._str);
	}

	return this._chunks;
};


Path.prototype.getString = function () {
	if (this._str === undefined) {
		this._str = Path.chunksToString(this._chunks);
	}

	return this._str;
}


Path.prototype.toString = Path.prototype.getString;
Path.prototype.toJSON = Path.prototype.getChunks;


Path.prototype.isEmpty = function () {
	if (this._str !== undefined) {
		return this._str.length === 0;
	}

	return this._chunks.length === 0;
};


Path.prototype.append = function (path) {
	if (path instanceof Path) {
		if (this.isEmpty()) {
			return path;
		}

		path = path.getString();
	} else if (typeof path === 'string') {
		if (this.isEmpty()) {
			return Path.fromString(path);
		}

		path = path.trim();
	} else if (Array.isArray(path)) {
		if (this.isEmpty()) {
			return Path.fromChunks(path);
		}

		path = Path.chunksToString(path);
	} else {
		throw new TypeError('Can only append arrays and strings to paths');
	}

	// path is now a string, and "this" is not an empty path

	if (path.length === 0) {
		// nothing is being appended
		return this;
	}

	if (path[0] === '[') {
		// array notation can just be appended
		return Path.fromString(this.getString() + path);
	}

	// str starts with a property name
	return Path.fromString(this.getString() + '.' + path);
};
