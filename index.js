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


function Operation(name, result) {
	this.op = name;
	this.result = result;
}


function Path(path) {
	// a read only class

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
		if (this.str.length === 0) {
			// our current path is empty, so just return the provided subpath
			return str;
		}

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

var emptyPath = new Path('');


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
	this.value = undefined;
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
		path = null;
	}

	if (!(path instanceof Path)) {
		path = new Path(path || '');
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
	return asObject ? this.path : this.path.toString();
};

Reader.prototype.getAbsolutePath = function (asObject) {
	var result = this.parentDome ? this.parentDome.getAbsolutePath(true).append(this.path) : this.path;
	return asObject ? result : result.toString();
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
		path = path.toString();

		this.emit('change', path, newValue, oldValue, opData);
		this.emit('change:' + path, newValue, oldValue, opData);
	}
};

Writer.prototype.write = function (path, fn) {
	if (typeof path === 'function') {
		fn = path;
		path = null;
	}

	if (!(path instanceof Path)) {
		path = new Path(path || '');
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
	this.dome.emit(eventName, this.path.toString(), data);

	if ((this.options & OPT_ADD_DIFF) !== 0) {
		this.addDiff('invoke', emptyPath, [eventName, clone(data)]);
	}
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
	path = new Path(path);

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
		var path = new Path(item[1]);
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
			this.invokeChange('', this.value, oldValue, new Operation('rollback', undefined));
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
