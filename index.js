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

// operations

var readonly = {
	has: true,
	get: true,
	copy: true
};

// operations receive: parent: object/array, key: string, value: parent[key], args: array
// in the case of read-only operations, the parent and value may be undefined

var ops = {
	has: function (parent, key) {
		return parent ? parent.hasOwnProperty(key) : false;
	},
	get: function (parent, key, value, args) {
		return parent && parent.hasOwnProperty(key) ? value : args[0];
	},
	copy: function (parent, key, value) {
		return clone(value);
	},
	set: function (parent, key, value, args) {
		parent[key] = args[0];
		return args[0];
	},
	del: function (parent, key, value) {
		if (Array.isArray(parent)) {
			parent.splice(key, 1);
		} else {
			delete parent[key];
		}

		return value;
	},
	inc: function (parent, key, value, args) {
		if (typeof value !== 'number') {
			throw new TypeError('Cannot increment type "' + (typeof value) + '"');
		}

		var delta = args[0];

		if (delta === undefined) {
			delta = 1;
		} else if (typeof delta !== 'number') {
			throw new TypeError('Cannot increment by type "' + (typeof delta) + '"');
		}

		parent[key] += delta;
		return parent[key];
	},
	dec: function (parent, key, value, args) {
		if (typeof value !== 'number') {
			throw new TypeError('Cannot decrement a type "' + (typeof value) + '"');
		}

		var delta = args[0];

		if (delta === undefined) {
			delta = 1;
		} else if (typeof delta !== 'number') {
			throw new TypeError('Cannot decrement by type "' + (typeof delta) + '"');
		}

		parent[key] -= delta;
		return parent[key];
	},
	clear: function (parent, key, value) {
		if (Array.isArray(value)) {
			value.length = 0;
		} else if (value !== null && typeof value === 'object') {
			var keys = Object.keys(value);
			for (var i = 0; i < keys.length; i += 1) {
				delete value[keys[i]];
			}
		} else {
			throw new TypeError('Can only clear objects and arrays');
		}

		return value;
	},
	append: function (parent, key, value, args) {
		// appends all given args to an array or string
		if (typeof value === 'string') {
			value += args.join('');
		} else if (Array.isArray(value)) {
			value = value.concat(args);
		} else {
			throw new TypeError('Can only append to strings and arrays');
		}

		parent[key] = value;

		return value;
	},
	fill: function (parent, key, value, args) {
		if (!Array.isArray(value)) {
			throw new TypeError('Can only fill arrays');
		}

		return value.fill.apply(value, args);
	},
	push: function (parent, key, value, args) {
		if (!Array.isArray(value)) {
			throw new TypeError('Can only push onto arrays');
		}

		return value.push.apply(value, args);
	},
	pop: function (parent, key, value) {
		if (!Array.isArray(value)) {
			throw new TypeError('Can only pop from arrays');
		}

		return value.pop();
	},
	shift: function (parent, key, value) {
		if (!Array.isArray(value)) {
			throw new TypeError('Can only shift from arrays');
		}

		return value.shift();
	},
	unshift: function (parent, key, value, args) {
		if (!Array.isArray(value)) {
			throw new TypeError('Can only unshift to arrays');
		}

		return value.unshift.apply(value, args);
	},
	splice: function (parent, key, value, args) {
		if (!Array.isArray(value)) {
			throw new TypeError('Can only splice arrays');
		}

		return value.splice.apply(value, args);
	},
	reverse: function (parent, key, value) {
		if (!Array.isArray(value)) {
			throw new TypeError('Can only reverse arrays');
		}

		return value.reverse();
	},
	sort: function (parent, key, value) {
		if (!Array.isArray(value)) {
			throw new TypeError('Can only sort arrays');
		}

		return value.sort();
	}
};


function parsePath(path) {
	var index, chunks = [];
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
	var oldValue;

	var opFn = ops[opName];
	if (!opFn) {
		throw new Error('Operation not implemented: ' + opName);
	}

	if (typeof path !== 'string') {
		throw new TypeError('Path must be a string');
	}

	path = path.trim();

	var chunks = parsePath(path);
	var isReadOnly = readonly[opName] ? true : false;

	var parent = dome;
	var key = 'target';
	var value = parent[key];

	// foo.bar

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

	// check if we should emit changes or add to the diff

	var mustEmit =
		(options & OPT_EMIT_CHANGE) !== 0 &&
		(dome.listenerCount('change') !== 0 || dome.listenerCount('change:' + path) !== 0);

	var mustDiff = (options & OPT_ADD_DIFF) !== 0;

	if (mustEmit) {
		oldValue = clone(value);
	}

	// store snapshots if they were queued up

	if (!isReadOnly) {
		dome._storeSnapshotsIfNeeded();
	}

	// run the operation, passing: parent, key, parent[key], args

	var result = opFn(parent, key, value, args);

	if (mustDiff) {
		dome.addDiff(opName, path, clone(args));
	}

	// emit changes

	if (mustEmit) {
		var newValue = parent ? parent[key] : undefined;
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

	this.target = arguments.length >= 1 ? target : {};
	this.snapshots = [];
	this.lazySnapshots = 0;
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
	this.target = undefined;
	this.snapshots = undefined;
	this.diff = undefined;
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


Dome.prototype.applyDiff = function (diff, silent) {
	var options = silent ? OPT_NONE : OPT_EMIT_CHANGE;

	for (var i = 0; i < diff.length; i += 1) {
		var item = diff[i];  // op-name, path, args

		traverse(this, item[0], item[1], item[2], options);
	}

	diff.length = 0;
};


Dome.prototype.addDiff = function (opName, path, args) {
	// in the case of a child emitting diffs while the parent is destroyed, this should be a no-op

	if (this.diff) {
		this.diff.push([opName, path, args]);
		this.emit('diff', opName, path, args);
	}
};


Dome.prototype._storeSnapshotsIfNeeded = function () {
	if (this.lazySnapshots > 0) {
		var snapshot = {
			target: clone(this.target),
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

		this.target = snapshot.target;
		this.diff = snapshot.diff;
	}
};


Dome.prototype.wrap = function (path) {
	var client = new Dome(this.get(path));
	var parent = this;

	client.on('diff', function (opName, subPath, args) {
		parent.addDiff(opName, Dome.joinPaths(path, subPath), args);
	});

	client.on('change', function (subPath, newValue, oldValue, opData) {
		var fullPath = Dome.joinPaths(path, subPath);

		parent.emit('change', fullPath, newValue, oldValue, opData);
		parent.emit('change:' + fullPath, newValue, oldValue, opData);
	});

	return client;
};

Dome.prototype.has = function (path) {
	return traverse(this, 'has', path, [], OPT_NONE);
};

Dome.prototype.get = function (path, fallback) {
	return traverse(this, 'get', path, [fallback], OPT_NONE);
};

Dome.prototype.copy = function (path) {
	return traverse(this, 'copy', path, [], OPT_NONE);
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

Dome.prototype.clear = function (path) {
	return traverse(this, 'clear', path, [], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.append = function (path) {
	var args = new Array(arguments.length - 1);
	for (var i = 1; i < arguments.length; i += 1) {
		args[i - 1] = clone(arguments[i]);
	}

	return traverse(this, 'append', path, args, OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.fill = function (path) {
	var args = new Array(arguments.length - 1);
	for (var i = 1; i < arguments.length; i += 1) {
		args[i - 1] = clone(arguments[i]);
	}

	return traverse(this, 'fill', path, args, OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.push = function (path) {
	var args = new Array(arguments.length - 1);
	for (var i = 1; i < arguments.length; i += 1) {
		args[i - 1] = clone(arguments[i]);
	}

	return traverse(this, 'push', path, args, OPT_ADD_DIFF | OPT_EMIT_CHANGE);
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
		args[i - 1] = clone(arguments[i]);
	}

	return traverse(this, 'unshift', path, args, OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.splice = function (path) {
	var args = new Array(arguments.length - 1);
	for (var i = 1; i < arguments.length; i += 1) {
		args[i - 1] = clone(arguments[i]);
	}

	return traverse(this, 'splice', path, args, OPT_ADD_DIFF | OPT_EMIT_CHANGE);
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
