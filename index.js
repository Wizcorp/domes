// Data Object Management E..something

var clone = require('clone');
var EventEmitter = require('events').EventEmitter;

function inherits(Child, Parent) {
	Child.prototype = Object.create(Parent.prototype, {
		constructor: { value: Child, enumerable: false, writable: true, configurable: true }
	});
}


var OPT_NONE = 0;
var OPT_ADD_DIFF = 1;
var OPT_EMIT_CHANGE = 2;


function Path(path) {
	if (Array.isArray(path)) {
		this.str = Path.chunksToString(path);
		this.chunks = path;
	} else {
		if (typeof path !== 'string') {
			throw new TypeError('Path must be a string');
		}

		this.str = path.trim();
		this.chunks = this.str === '' ? [] : undefined;
	}
}


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

Path.prototype.toString = function () {
	return this.str;
};

Path.prototype.toJSON = function () {
	return this.getChunks();
};

Path.prototype.append = function (str) {
	if (Array.isArray(str)) {
		str = new Path(str);
	}

	if (str instanceof Path) {
		str = str.toString();
	} else if (typeof str !== 'string') {
		throw new TypeError('Can only append arrays and strings to paths');
	}

	str = str.trim();

	if (str.length === 0) {
		// nothing is being appended
		return this;
	}

	if (this.str.length === 0) {
		// our current path is empty
		return new Path(str);
	}

	if (str[0] === '[') {
		// array notation can just be appended
		return new Path(this.str + str);
	}

	// str starts with a property name
	return new Path(this.str + '.' + str);
};


Path.prototype.getChunks = function () {
	if (this.chunks) {
		return this.chunks;
	}

	var STATE_NONE = 0, STATE_STR = 1, STATE_NUM = 2;

	var str = this.str;
	var len = str.length;
	var chunks = [];

	if (len === 0) {
		this.chunks = chunks;
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

	// assign late, because exceptions may have been thrown
	this.chunks = chunks;

	return chunks;
};


function locate(dome, path, isReadOnly) {
	var chunks = path.getChunks();
	var parent = dome;
	var key = 'value';
	var value = parent[key];

	for (var i = 0; i < chunks.length; i += 1) {
		var chunk = chunks[i];

		// preprocess the value which will now become parent

		if (value === null || typeof value !== 'object') {
			// the value is not traverseable, so fix it so we can traverse it

			if (isReadOnly) {
				value = undefined;
			} else {
				if (typeof chunk === 'number') {
					parent[key] = value = [];
				} else {
					parent[key] = value = {};
				}
			}
		}

		// update our state to this chunk

		parent = value;
		key = chunk;

		if (parent !== undefined) {
			value = parent[key];
		}
	}

	return {
		parent: parent,
		key: key
	};
}


function Reader(dome, path, location) {
	this.dome = dome; // the owning Dome (Dome)
	this.path = path; // the path to this value (Path) relative to the owning Dome
	this.parent = location.parent;  // may be undefined (Object|Array|undefined)
	this.key = location.key;        // always defined (string)
	this.value = this.parent && this.parent.hasOwnProperty(this.key) ? this.parent[this.key] : undefined;
}

Reader.prototype.destroy = function () {
	this.dome = undefined;
	this.path = undefined;
	this.parent = undefined;
	this.key = undefined;
	this.value = undefined;
};

Reader.prototype.read = function (path, fn) {
	if (typeof path === 'function') {
		fn = path;
		path = null;
	}

	if (!(path instanceof Path)) {
		path = new Path(path || '');
	}

	// make path relative to dome
	if (this !== this.dome) {
		path = this.path.append(path);
	}

	var location = locate(this.dome, path, true);
	var reader = new Reader(this.dome, path, location);

	if (fn) {
		fn(reader);
	}

	return reader;
};

Reader.prototype.toJSON = function () {
	return this.value;
};

Reader.prototype.exists = function () {
	return this.parent ? this.parent.hasOwnProperty(this.key) : false;
};

Reader.prototype.get = function (fallback) {
	if (!this.parent || !this.parent.hasOwnProperty(this.key)) {
		return fallback;
	}

	return this.value;
};

Reader.prototype.copy = function () {
	return clone(this.get());
};


Object.defineProperty(Reader.prototype, 'length', {
	get: function () {
		if (!Array.isArray(this.value)) {
			throw new TypeError('Only arrays have length');
		}

		return this.value.length;
 	}
});


function Writer(dome, path, location, options) {
	Reader.call(this, dome, path, location);

	this.oldValue = undefined; // used when emitting
	this.options = options || OPT_NONE;

	this.mustDiff = dome.diff && (this.options & OPT_ADD_DIFF) !== 0;
	this.mustEmit = (this.options & OPT_EMIT_CHANGE) !== 0;
}

inherits(Writer, Reader);


Writer.prototype.destroy = function () {
	Reader.prototype.destroy.call(this);
	this.oldValue = undefined;
};


Writer.prototype._pre = function () {
	this.dome._storeSnapshotsIfNeeded();

	if (this.mustEmit) {
		this.oldValue = clone(this.value);
	}
};

Writer.prototype._post = function (name, args, result) {
	if (this.mustDiff) {
		this.dome.addDiff(name, this.path, clone(args));
	}

	var newValue = this.parent[this.key];

	if (this.mustEmit) {
		var opData = {
			op: name,
			result: result
		};

		this.dome.invokeChange(this.path, newValue, this.oldValue, opData);
	}

	this.value = newValue;

	return result;
};

Writer.prototype.write = function (path, fn) {
	if (typeof path === 'function') {
		fn = path;
		path = null;
	}

	if (!(path instanceof Path)) {
		path = new Path(path || '');
	}

	// make path relative to dome
	if (this !== this.dome) {
		path = this.path.append(path);
	}

	var location = locate(this.dome, path, false);
	var writer = new Writer(this.dome, path, location, this.options);

	if (fn) {
		fn(writer);
	}

	return writer;
};

Writer.prototype.set = function (value) {
	this._pre();
	this.parent[this.key] = value;
	return this._post('set', [value], value);
};


Writer.prototype.del = function () {
	this._pre();
	delete this.parent[this.key];
	return this._post('del', [], this.value);
};


Writer.prototype.inc = function (delta) {
	if (typeof this.value !== 'number') {
		throw new TypeError('Cannot increment type "' + (typeof this.value) + '"');
	}

	if (delta === undefined) {
		delta = 1;
	} else if (typeof delta !== 'number') {
		throw new TypeError('Cannot increment by type "' + (typeof delta) + '"');
	}

	this._pre();
	this.parent[this.key] = this.value + delta;
	return this._post('inc', [delta], this.value + delta);
};


Writer.prototype.dec = function (delta) {
	if (typeof this.value !== 'number') {
		throw new TypeError('Cannot decrement type "' + (typeof this.value) + '"');
	}

	if (delta === undefined) {
		delta = 1;
	} else if (typeof delta !== 'number') {
		throw new TypeError('Cannot decrement by type "' + (typeof delta) + '"');
	}

	this._pre();
	this.parent[this.key] = this.value - delta;
	return this._post('dec', [delta], this.value - delta);
};


Writer.prototype.clear = function () {
	this._pre();

	if (Array.isArray(this.value)) {
		this.value.length = 0;
	} else if (this.value !== null && typeof this.value === 'object') {
		var keys = Object.keys(this.value);
		for (var i = 0; i < keys.length; i += 1) {
			delete this.value[keys[i]];
		}
	} else {
		throw new TypeError('Can only clear objects and arrays');
	}

	return this._post('clear', [], this.value);
};


Writer.prototype.append = function () {
	// appends all given args to an array or string
	var result;

	var len = arguments.length;
	var args = new Array(len);
	for (var i = 0; i < len; i += 1) {
		args[i] = arguments[i];
	}

	this._pre();

	if (typeof this.value === 'string') {
		result = this.value + args.join('');
	} else if (Array.isArray(this.value)) {
		result = this.value.concat(args);
	} else {
		throw new TypeError('Can only append to strings and arrays');
	}

	this.parent[this.key] = result;

	return this._post('append', args, result);
};


Writer.prototype.fill = function (filler, start, end) {
	if (!Array.isArray(this.value)) {
		throw new TypeError('Can only fill arrays');
	}

	if (start === undefined) {
		start = 0;
	} else if (typeof start === 'number') {
		if (start < 0) {
			start += this.value.length;
		}

		start = Math.max(start, 0);
	} else {
		throw new TypeError('start must be a number');
	}

	if (end === undefined) {
		end = this.value.length;
	} else if (typeof end === 'number') {
		if (end < 0) {
			end += this.value.length;
		}

		end = Math.min(end, this.value.length);
	} else {
		throw new TypeError('end must be a number');
	}

	this._pre();

	for (var i = start; i < end; i += 1) {
		this.value[i] = filler;
	}

	return this._post('fill', [filler, start, end], this.value);
};


Writer.prototype.push = function () {
	if (!Array.isArray(this.value)) {
		throw new TypeError('Can only push onto arrays');
	}

	var len = arguments.length;
	var args = new Array(len);
	for (var i = 0; i < len; i += 1) {
		args[i] = arguments[i];
	}

	this._pre();
	var result = this.value.push.apply(this.value, args);
	return this._post('push', args, result);
};


Writer.prototype.pop = function () {
	if (!Array.isArray(this.value)) {
		throw new TypeError('Can only pop from arrays');
	}

	this._pre();
	var result = this.value.pop();
	return this._post('pop', [], result);
};


Writer.prototype.shift = function () {
	if (!Array.isArray(this.value)) {
		throw new TypeError('Can only shift from arrays');
	}

	this._pre();
	var result = this.value.shift();
	return this._post('shift', [], result);
};


Writer.prototype.unshift = function () {
	if (!Array.isArray(this.value)) {
		throw new TypeError('Can only unshift to arrays');
	}

	var len = arguments.length;
	var args = new Array(len);
	for (var i = 0; i < len; i += 1) {
		args[i] = arguments[i];
	}

	this._pre();
	var result = this.value.unshift.apply(this.value, args);
	return this._post('unshift', args, result);
};


Writer.prototype.splice = function () {
	if (!Array.isArray(this.value)) {
		throw new TypeError('Can only splice arrays');
	}

	var len = arguments.length;
	var args = new Array(len);
	for (var i = 0; i < len; i += 1) {
		args[i] = arguments[i];
	}

	this._pre();
	var result = this.value.splice.apply(this.value, args);
	return this._post('splice', args, result);
};


Writer.prototype.reverse = function () {
	if (!Array.isArray(this.value)) {
		throw new TypeError('Can only reverse arrays');
	}

	this._pre();
	var result = this.value.reverse();
	return this._post('reverse', [], result);
};


Writer.prototype.sort = function () {
	if (!Array.isArray(this.value)) {
		throw new TypeError('Can only sort arrays');
	}

	this._pre();
	var result = this.value.sort();
	return this._post('sort', [], result);
};


function Dome(value, path, options) {
	this.value = value;

	if (options === undefined) {
		options = OPT_ADD_DIFF | OPT_EMIT_CHANGE;
	}

	this.snapshots = [];
	this.lazySnapshots = 0;
	this.diff = (options & OPT_ADD_DIFF) === 0 ? undefined : [];

	Writer.call(this, this, path, { parent: this, key: 'value' }, options);
	EventEmitter.call(this);
}

inherits(Dome, Writer);

Object.keys(EventEmitter.prototype).forEach(function (method) {
	Dome.prototype[method] = EventEmitter.prototype[method];
});


Dome.prototype.destroy = function () {
	Writer.prototype.destroy.call(this);

	this.removeAllListeners();
	this.snapshots = undefined;
	this.diff = undefined;
};


Dome.prototype.hasDiff = function () {
	return this.diff ? this.diff.length > 0 : false;
};


Dome.prototype.peekDiff = function () {
	return this.diff || [];
};


Dome.prototype.extractDiff = function () {
	if (!this.diff) {
		return [];
	}

	var diff = this.diff;
	this.diff = [];
	return diff;
};


Dome.prototype.applyDiff = function (diff, silent) {
	var options = silent ? OPT_NONE : OPT_EMIT_CHANGE;

	for (var i = 0; i < diff.length; i += 1) {
		var item = diff[i];  // op-name, path, args

		var opName = item[0];
		var path = new Path(item[1]);
		var args = item[2];

		var location = locate(this, path, false);
		var writer = new Writer(this, path, location, options);

		writer[opName].apply(writer, args);
	}

	diff.length = 0;
};


Dome.prototype.addDiff = function (opName, path, args) {
	// in the case of a child emitting diffs while the parent is destroyed, this should be a no-op

	if (this.diff) {
		path = path.getChunks();

		this.diff.push([opName, path, args]);
		this.emit('diff', opName, path, args);
	}
};


Dome.prototype.invokeChange = function (path, newValue, oldValue, opData) {
	path = path.toString();

	this.emit('change', path, newValue, oldValue, opData);
	this.emit('change:' + path, newValue, oldValue, opData);
};


Dome.prototype._storeSnapshotsIfNeeded = function () {
	if (this.lazySnapshots > 0) {
		var snapshot = {
			value: clone(this.value),
			diff: clone(this.diff)
		};

		while (this.lazySnapshots > 0) {
			this.snapshots.push(snapshot);
			this.lazySnapshots -= 1;
		}
	}
};


Dome.prototype.snapshot = function () {
	this.lazySnapshots += 1;
};


Dome.prototype.rollback = function () {
	if (this.lazySnapshots > 0) {
		// no changes were made between snapshot and rollback
		this.lazySnapshots -= 1;
	} else {
		var snapshot = this.snapshots.pop();
		if (!snapshot) {
			throw new Error('There are no snapshots to roll back to');
		}

		this.value = snapshot.value;
		this.diff = snapshot.diff;
	}
};


Dome.prototype.wrap = function (path) {
	path = new Path(path);

	var location = locate(this, path, true);
	if (!location.parent) {
		throw new Error('Path does not exist on dome: ' + path);
	}

	var that = this;
	var child = new Dome(location.parent[location.key], path, this.options);

	child.on('change', function (path, newValue, oldValue, opData) {
		that.invokeChange(child.path.append(path), newValue, oldValue, opData);
	});

	child.on('diff', function (name, path, args) {
		that.addDiff(name, child.path.append(path), args);
	});

	return child;
};


module.exports = function (value, options) {
	var opts;

	if (options) {
		opts = OPT_NONE;

		if (options.hasOwnProperty('addDiff') && options.addDiff) {
			opts |= OPT_ADD_DIFF;
		}

		if (options.hasOwnProperty('emitChanges') && options.emitChanges) {
			opts |= OPT_EMIT_CHANGE;
		}
	}

	return new Dome(value, new Path(''), opts);
};
