// Data Object Management E..something

var clone = require('clone');
var EventEmitter = require('events').EventEmitter;

function inherits(Child, Parent) {
	Child.prototype = Object.create(Parent.prototype, {
		constructor: { value: Child, enumerable: false, writable: true, configurable: true }
	});
}

function isEqual(a, b) {
	return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

function indexOf(list, value) {
	// NaN safe indexOf

	for (var i = 0; i < list.length; i += 1) {
		var elm = list[i];

		if (elm === value || (Number.isNaN(elm) && Number.isNaN(value))) {
			return i;
		}
	}

	return -1;
}


var OPT_NONE = 0;
var OPT_ADD_DIFF = 1;
var OPT_EMIT_CHANGE = 2;


function Operation(name, result) {
	this.op = name;
	this.result = result;
}


function Path(str, chunks) {
	this._str = str;
	this._chunks = chunks;
}


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

var emptyPath = Path.fromString('');


function Children() {
	this.readers = undefined;
	this.writers = undefined;
	this.domes = undefined;
}

Children.prototype.destroy = function (type) {
	if (type === undefined) {
		this.destroy('readers');
		this.destroy('writers');
		this.destroy('domes');
		return;
	}

	var obj = this[type];
	if (obj !== undefined) {
		this[type] = undefined;

		var keys = Object.keys(obj);
		for (var i = 0; i < keys.length; i += 1) {
			obj[keys[i]].destroy();
		}
	}
};

Children.prototype.getReader = function (path) {
	return this.readers && this.readers[path];
};

Children.prototype.addReader = function (path, reader) {
	if (this.readers === undefined) {
		this.readers = {};
	}

	this.readers[path] = reader;
};

Children.prototype.getWriter = function (path) {
	return this.writers && this.writers[path];
};

Children.prototype.addWriter = function (path, writer) {
	if (this.writers === undefined) {
		this.writers = {};
	}

	this.writers[path] = writer;
};

Children.prototype.getDome = function (path) {
	return this.domes && this.domes[path];
};

Children.prototype.addDome = function (path, dome) {
	if (this.domes === undefined) {
		this.domes = {};
	}

	this.domes[path] = dome;
};


function Reader(parentDome, dome, path) {
	this.parentDome = parentDome;    // the parent Dome (Dome|undefined)
	this.dome = dome;                // "this" if it is a Dome, else the parent Dome (Dome)
	this.isDome = this === dome;
	this.isReadOnly = true;          // overwritten by Writer
	this.path = path;                // the path to this value (Path) relative to the owning Dome
	this.parent = undefined;         // (Object|Array|undefined)
	this.key = undefined;            // (string)
	this.value = undefined;          // (mixed)
}

Reader.prototype.loadValue = function () {
	if (this.isDome) {
		this.parent = this;
		this.key = 'value';
	} else {
		var location = locate(this.dome, this.path, this.isReadOnly);

		this.parent = location.parent;
		this.key = location.key;
		this.value = this.parent && this.parent.hasOwnProperty(this.key) ? this.parent[this.key] : undefined;
	}
};

Reader.prototype.destroy = function () {
	this.parentDome = undefined;
	this.dome = undefined;
	this.path = undefined;
	this.parent = undefined;
	this.key = undefined;
	this.value = undefined;
};

Reader.prototype.read = function (path, fn) {
	if (typeof path === 'function') {
		fn = path;
		path = emptyPath;
	} else if (!(path instanceof Path)) {
		path = Path.fromString(path || '');
	}

	// make path relative to parent dome
	if (!this.isDome) {
		path = this.path.append(path);
	}

	var reader = this.dome.children.getReader(path);
	if (!reader) {
		var parentDome = this.isDome ? this : this.parentDome;

		reader = new Reader(parentDome, this.dome, path);
		this.dome.children.addReader(path, reader);
	}

	reader.loadValue();

	if (fn) {
		fn(reader);
	}

	return reader;
};

Reader.prototype.toJSON = function () {
	return this.value;
};

Reader.prototype.getRelativePath = function (asObject) {
	return asObject ? this.path : this.path.getString();
};

Reader.prototype.getAbsolutePath = function (asObject) {
	var result = this.parentDome ? this.parentDome.getAbsolutePath(true).append(this.path) : this.path;
	return asObject ? result : result.getString();
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


function Writer(parentDome, dome, path, options) {
	Reader.call(this, parentDome, dome, path);

	this.isReadOnly = false;
	this.oldValue = undefined; // used when emitting
	this.options = options || OPT_NONE;
}

inherits(Writer, Reader);


Writer.prototype.destroy = function () {
	this.children.destroy('writers');
	Reader.prototype.destroy.call(this);
	this.oldValue = undefined;
};


Writer.prototype._pre = function () {
	this.dome._storeSnapshotsIfNeeded();

	if ((this.options & OPT_EMIT_CHANGE) !== 0) {
		this.oldValue = clone(this.value);
	}
};

Writer.prototype._post = function (name, args, result) {
	if ((this.options & OPT_ADD_DIFF) !== 0) {
		this.addDiff(name, emptyPath, clone(args));
	}

	var newValue = this.parent[this.key];

	if ((this.options & OPT_EMIT_CHANGE) !== 0) {
		this.invokeChange(emptyPath, newValue, this.oldValue, new Operation(name, result));
	}

	this.value = newValue;

	return result;
};

Writer.prototype.addDiff = function (opName, path, args) {
	if (this.parentDome) {
		this.parentDome.addDiff(opName, this.path.append(path), args);
	}

	if (this.diff) {
		path = path.getChunks();

		this.diff.push([opName, path, args]);
		this.emit('diff', opName, path, args);
	}
};

Writer.prototype.invokeChange = function (path, newValue, oldValue, opData) {
	if (this.parentDome) {
		this.parentDome.invokeChange(this.path.append(path), newValue, oldValue, opData);
	}

	if (this.emit) {
		this.emit('change', path.getString(), newValue, oldValue, opData);

		var chunks = path.getChunks();

		for (var i = chunks.length; i > 0; i -= 1) {
			var location = Path.fromChunks(chunks.slice(0, i)).getString();
			var remainder = Path.fromChunks(chunks.slice(i)).getString();

			this.emit('change:' + location, remainder, newValue, oldValue, opData);
		}
	}
};

Writer.prototype.write = function (path, fn) {
	if (typeof path === 'function') {
		fn = path;
		path = emptyPath;
	} else if (!(path instanceof Path)) {
		path = Path.fromString(path || '');
	}

	// make path relative to parent dome
	if (!this.isDome) {
		path = this.path.append(path);
	}

	var writer = this.dome.children.getWriter(path);
	if (!writer) {
		var parentDome = this.isDome ? this : this.parentDome;

		writer = new Writer(parentDome, this.dome, path, this.options);
		this.dome.children.addWriter(path, writer);
	}

	writer.loadValue();

	if (fn) {
		fn(writer);
	}

	return writer;
};

Writer.prototype.invoke = function (eventName, data) {
	this.dome.emit(eventName, this.path.getString(), data);

	if ((this.options & OPT_ADD_DIFF) !== 0) {
		this.addDiff('invoke', emptyPath, [eventName, clone(data)]);
	}
};

Writer.prototype.set = function (value) {
	if (this.exists() && isEqual(this.value, value)) {
		return value;
	}

	this._pre();
	this.parent[this.key] = value;
	return this._post('set', [value], value);
};


Writer.prototype.del = function () {
	if (!this.parent.hasOwnProperty(this.key)) {
		return undefined;
	}

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
	if (Array.isArray(this.value)) {
		if (this.value.length === 0) {
			return this.value;
		}

		this._pre();
		this.value.length = 0;
	} else if (this.value !== null && typeof this.value === 'object') {
		var keys = Object.keys(this.value);
		if (keys.length === 0) {
			return this.value;
		}

		this._pre();
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

Writer.prototype.reposition = function (moves) {
	// positions [n, n2, n3, n4] where the index is the original position and the value is the new position index

	if (!Array.isArray(this.value)) {
		throw new TypeError('Can only reposition arrays');
	}

	if (!Array.isArray(moves)) {
		throw new TypeError('Can only reposition using a moves-array');
	}

	this._pre();

	var oldValue = this.value.slice();

	for (var i = 0; i < moves.length; i += 1) {
		this.value[i] = oldValue[moves[i]];
	}

	return this._post('reposition', [moves], this.value);
};

Writer.prototype.sort = function (fn) {
	if (!Array.isArray(this.value)) {
		throw new TypeError('Can only sort arrays');
	}

	this._pre();

	var i, len = this.value.length;

	var oldValue = new Array(len);
	var moves = new Array(len);   // the index in this array is the old index, the value is the new index

	for (i = 0; i < len; i += 1) {
		moves[i] = i;
		oldValue[i] = this.value[i];
	}

	this.value.sort(fn);

	var noValue = {};  // a unique object reference that cannot exist in this.value

	for (i = 0; i < len; i += 1) {
		// find old index for value at this.value[i]

		var index = indexOf(oldValue, this.value[i]);
		if (index === -1) {
			throw new Error('Sorting went horribly wrong');
		}

		moves[index] = i;
		oldValue[index] = noValue;
	}

	return this._post('reposition', [moves], this.value);
};


function Dome(parentDome, value, path, options) {
	Writer.call(this, parentDome, this, path, options);
	EventEmitter.call(this);

	this.children = new Children();  // all readers, writers and wrapped domes
	this.value = value;
	this.snapshots = [];
	this.lazySnapshots = 0;
	this.diff = (options & OPT_ADD_DIFF) === 0 ? undefined : [];

	this.loadValue();
}

inherits(Dome, Writer);

Object.keys(EventEmitter.prototype).forEach(function (method) {
	Dome.prototype[method] = EventEmitter.prototype[method];
});


Dome.prototype.destroy = function () {
	this.children.destroy('domes');
	Writer.prototype.destroy.call(this);
	this.removeAllListeners();
	this.snapshots = undefined;
	this.diff = undefined;
	this.children = undefined;
};


Dome.prototype.wrap = function (path) {
	path = Path.fromString(path);

	var child = this.children.getDome(path);
	if (child) {
		return child;
	}

	var location = locate(this, path, true);
	if (!location.parent) {
		throw new Error('Path does not exist on dome: ' + path);
	}

	child = new Dome(this, location.parent[location.key], path, this.options);

	this.children.addDome(path, child);

	return child;
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
	var oldOptions = this.options;

	this.options = silent ? OPT_NONE : OPT_EMIT_CHANGE;

	for (var i = 0; i < diff.length; i += 1) {
		var item = diff[i];  // op-name, path, args

		var opName = item[0];
		var path = Path.fromChunks(item[1]);
		var args = item[2];

		var writer = this.write(path);
		writer[opName].apply(writer, args);
	}

	this.options = oldOptions;

	diff.length = 0;
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

	if (this.parentDome) {
		this.parentDome._storeSnapshotsIfNeeded();
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

		var oldValue;

		if ((this.options & OPT_EMIT_CHANGE) !== 0) {
			oldValue = clone(this.value);
		}

		this.value = snapshot.value;
		this.diff = snapshot.diff;

		if ((this.options & OPT_EMIT_CHANGE) !== 0) {
			this.invokeChange(emptyPath, this.value, oldValue, new Operation('rollback', undefined));
		}
	}
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
	} else {
		opts = OPT_ADD_DIFF | OPT_EMIT_CHANGE;
	}

	return new Dome(undefined, value, emptyPath, opts);
};
