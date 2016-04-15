'use strict';

var clone = require('clone');
var inherits = require('./inherits');
var Operation = require('./Operation');
var Reader = require('./Reader');
var Path = require('./Path');

var emptyPath = Path.fromString('');


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


function Writer(parentDome, dome, path, options) {
	Reader.call(this, parentDome, dome, path);

	this.isReadOnly = false;
	this.oldValue = undefined; // used when emitting
	this.options = options;
}

inherits(Writer, Reader);

module.exports = Writer;


Writer.prototype.destroy = function () {
	this.children.destroy('writers');
	Reader.prototype.destroy.call(this);
	this.oldValue = undefined;
};


Writer.prototype._pre = function () {
	this.dome._storeSnapshotsIfNeeded();

	if (this.options.emitChange) {
		this.oldValue = clone(this.value);
	}
};


Writer.prototype._post = function (name, args, result) {
	if (this.options.addDiff) {
		this.addDiff(name, emptyPath, clone(args));
	}

	var newValue = this.parent[this.key];

	if (this.options.emitChange) {
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

		writer = new Writer(parentDome, this.dome, path, this.options.copy());
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

	if (this.options.addDiff) {
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
