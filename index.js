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

var ops = {
	has: function (obj, key) {
		return obj.hasOwnProperty(key);
	},
	get: function (obj, key, args) {
		return obj.hasOwnProperty(key) ? obj[key] : args[0];
	},
	set: function (obj, key, args) {
		obj[key] = args[0];
		return args[0];
	},
	del: function (obj, key) {
		var value = obj[key];

		if (Array.isArray(obj)) {
			obj.splice(key, 1);
		} else {
			delete obj[key];
		}

		return value;
	},
	inc: function (obj, key, args) {
		if (typeof obj[key] !== 'number') {
			throw new TypeError('Cannot increment type "' + (typeof obj[key]) + '"');
		}

		var value = args[0];

		if (value === undefined) {
			value = 1;
		} else if (typeof value !== 'number') {
			throw new TypeError('Cannot increment by type "' + (typeof value) + '"');
		}

		obj[key] += value;
		return obj[key];
	},
	dec: function (obj, key, args) {
		if (typeof obj[key] !== 'number') {
			throw new TypeError('Cannot decrement a type "' + (typeof obj[key]) + '"');
		}

		var value = args[0];

		if (value === undefined) {
			value = 1;
		} else if (typeof value !== 'number') {
			throw new TypeError('Cannot decrement by type "' + (typeof value) + '"');
		}

		obj[key] -= value;
		return obj[key];
	},
	append: function (obj, key, args) {
		// appends all given args to an array or string
		var value = obj[key];

		if (typeof value === 'string') {
			value += args.join('');
		} else if (Array.isArray(value)) {
			value = value.concat(args);
		} else {
			throw new TypeError('Can only append to strings and arrays');
		}

		obj[key] = value;
		return value;
	},
	fill: function (obj, key, args) {
		var arr = obj[key];
		if (!Array.isArray(arr)) {
			throw new TypeError('Can only fill arrays');
		}

		return arr.fill.apply(arr, args);
	},
	push: function (obj, key, args) {
		var arr = obj[key];
		if (!Array.isArray(arr)) {
			throw new TypeError('Can only push onto arrays');
		}

		return arr.push.apply(arr, args);
	},
	pop: function (obj, key) {
		if (!Array.isArray(obj[key])) {
			throw new TypeError('Can only pop from arrays');
		}

		return obj[key].pop();
	},
	shift: function (obj, key) {
		var arr = obj[key];
		if (!Array.isArray(arr)) {
			throw new TypeError('Can only shift from arrays');
		}

		return arr.shift();
	},
	unshift: function (obj, key, args) {
		var arr = obj[key];
		if (!Array.isArray(arr)) {
			throw new TypeError('Can only unshift to arrays');
		}

		return arr.unshift.apply(arr, args);
	},
	splice: function (obj, key, args) {
		var arr = obj[key];
		if (!Array.isArray(arr)) {
			throw new TypeError('Can only splice arrays');
		}

		return arr.splice.apply(arr, args);
	},
	reverse: function (obj, key) {
		var arr = obj[key];
		if (!Array.isArray(arr)) {
			throw new TypeError('Can only reverse arrays');
		}

		return arr.reverse();
	},
	sort: function (obj, key, args) {
		var arr = obj[key];
		if (!Array.isArray(arr)) {
			throw new TypeError('Can only sort arrays');
		}

		return arr.sort();
	}
};


function parsePath(path) {
	if (Array.isArray(path)) {
		return path;
	}

	var index, type, chunks = [];
	var offset = 0;

	while (offset < path.length) {
		if (path[offset] === '[') {
			// array element begins here

			offset += 1;

			index = path.indexOf(']', offset);
			if (index === -1) {
				throw new Error('Could not find closing "]" in path: ' + path);
			}

			chunks.push(parseInt(path.substring(offset, index), 10));
			offset = index + 1;
		} else {
			// a period is optional at the start of the path or after an array element

			if (path[offset] === '.') {
				offset += 1;
			}

			// find "." or "["

			index = offset;
			while (index < path.length && path[index] !== '.' && path[index] !== '[') {
				index += 1;
			}

			chunks.push(path.substring(offset, index));
			offset = index;
		}
	}

	return chunks;
}


function traverse(dome, opName, path, args, options) {
	var opFn = ops[opName];
	if (!opFn) {
		throw new Error('Operation not implemented: ' + opName);
	}

	if (typeof path !== 'string') {
		throw new TypeError('Path must be a string');
	}

	path = path.trim();

	if (path.length === 0) {
		throw new Error('Empty path provided');
	}

	var obj = dome.target;
	var chunks = parsePath(path);

	for (var i = 0; i < chunks.length - 1; i += 1) {
		var chunk = chunks[i];
		var value = obj[chunk];

		if (!value || typeof value !== 'object') {
			if (opFn === ops.get) {
				return args[0]; // fallback
			}

			if (typeof chunks[i + 1] === 'number') {
				obj[chunk] = [];
			} else {
				obj[chunk] = {};
			}
		}

		obj = obj[chunk];
	}

	chunk = chunks[chunks.length - 1];

	var oldValue = obj[chunk];

	var result = opFn(obj, chunk, args);

	if ((options & OPT_ADD_DIFF) !== 0) {
		dome.addDiff(opName, path, clone(args));
	}

	if ((options & OPT_EMIT_CHANGE) !== 0) {
		// emits: path, new value at path, { op: opName, result: opResult }
		var newValue = obj[chunk];
		var opData = {
			op: opName,
			result: result
		};

		dome.emit('change', path, newValue, oldValue, opData);
		dome.emit('change:' + path, newValue, oldValue, opData);
	}

	return result;
}


function Dome(target) {
	EventEmitter.call(this);

	this.target = target || {};
	this.snapshots = [];
	this.diff = [];
}

inherits(Dome, EventEmitter);


Dome.joinPaths = function (a, b) {
	if (b.length === 0) {
		return a;
	}

	if (a.length === 0) {
		return b;
	}

	if (b[0] === '[') {
		// array notation can just be appended
		return a + b;
	}

	// b starts with a property name
	return a + '.' + b;
};


Dome.prototype.toJSON = function () {
	return this.target;
};


Dome.prototype.destroy = function () {
	this.removeAllListeners();
	this.target = null;
	this.snapshots = null;
	this.diff = null;
};


Dome.prototype.hasDiff = function () {
	return this.diff.length > 0;
};


Dome.prototype.peekDiff = function () {
	return this.diff;
};


Dome.prototype.extractDiff = function () {
	var diff = this.diff;
	this.diff = [];
	return diff;
};


Dome.prototype.applyDiff = function (diff) {
	for (var i = 0; i < diff.length; i += 1) {
		var item = diff[i];  // op-name, path, args

		traverse(this, item[0], item[1], item[2], OPT_EMIT_CHANGE);
	}

	diff.length = 0;
};


Dome.prototype.addDiff = function (opName, path, args) {
	this.diff.push([opName, path, args]);
	this.emit('diff', opName, path, args);
};


Dome.prototype.snapshot = function () {
	this.snapshots.push({
		target: clone(this.target),
		diff: clone(this.diff)
	});
	this.emit('snapshot');
};


Dome.prototype.rollback = function () {
	var snapshot = this.snapshots.pop();
	if (!snapshot) {
		throw new Error('There are no snapshots to roll back to');
	}

	this.target = snapshot.target;
	this.diff = snapshot.diff;
	this.emit('rollback');
};


Dome.prototype.wrap = function (path) {
	var client = new Dome(this.get(path));
	var parent = this;

	client.on('diff', function (opName, subPath, args) {
		parent.addDiff(opName, Dome.joinPaths(path, subPath), args);
	});

	return client;
};

Dome.prototype.has = function (path) {
	return traverse(this, 'has', path, [], OPT_NONE);
};

Dome.prototype.get = function (path, fallback) {
	return traverse(this, 'get', path, [fallback], OPT_NONE);
};

Dome.prototype.set = function (path, value) {
	return traverse(this, 'set', path, [clone(value)], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.del = function (path) {
	return traverse(this, 'del', path, [], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.inc = function (path, value) {
	return traverse(this, 'inc', path, [value], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.dec = function (path, value) {
	return traverse(this, 'dec', path, [value], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.append = function (path) {
	var args = new Array(arguments.length - 1);
	for (var i = 1; i < arguments.length; i += 1) {
		args[i - 1] = arguments[i];
	}

	return traverse(this, 'append', path, clone(args), OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.fill = function (path) {
	var args = new Array(arguments.length - 1);
	for (var i = 1; i < arguments.length; i += 1) {
		args[i - 1] = arguments[i];
	}

	return traverse(this, 'fill', path, clone(args), OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.push = function (path) {
	var args = new Array(arguments.length - 1);
	for (var i = 1; i < arguments.length; i += 1) {
		args[i - 1] = arguments[i];
	}

	return traverse(this, 'push', path, clone(args), OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.pop = function (path) {
	return traverse(this, 'pop', path, [], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.shift = function (path) {
	return traverse(this, 'shift', path, [], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.unshift = function (path) {
	var args = new Array(arguments.length - 1);
	for (var i = 1; i < arguments.length; i += 1) {
		args[i - 1] = arguments[i];
	}

	return traverse(this, 'shift', path, clone(args), OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.splice = function (path) {
	var args = new Array(arguments.length - 1);
	for (var i = 1; i < arguments.length; i += 1) {
		args[i - 1] = arguments[i];
	}

	return traverse(this, 'splice', path, clone(args), OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.reverse = function (path) {
	return traverse(this, 'reverse', path, [], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.sort = function (path) {
	return traverse(this, 'sort', path, [], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};


module.exports = function (obj) {
	return new Dome(obj);
};
