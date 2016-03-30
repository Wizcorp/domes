// Data Object Management E..something

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
	splice: function (obj, key, args) {
		var arr = obj[key];
		if (!Array.isArray(arr)) {
			throw new TypeError('Can only splice arrays');
		}

		return arr.splice.apply(arr, args);
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

		var fn = args[0];
		if (!fn) {
			return arr.sort();
		}

		if (typeof fn !== 'function') {
			throw new TypeError('The given sort function is type: "' + (typeof fn) + '"');
		}

		return arr.sort(fn);
	},
	del: function (obj, key) {
		var value = obj[key];

		if (Array.isArray(obj)) {
			obj.splice(key, 1);
		} else {
			delete obj[key];
		}

		return value;
	}
};


function parsePath(path) {
	var index, chunks = [];

	// TODO: drop path.slice, and use offsets with substrings

	while (path) {
		var index = path.search(/[\.\[\]]/);
		if (index === -1) {
			// last chunk reached

			chunks.push(path);
			break;
		}

		if (path[index] === ']') {
			chunks.push(parseInt(path.substr(0, index)));
		} else {
			chunks.push(path.substr(0, index));
		}

		path = path.slice(index + 1);
	}

	return chunks;
}


function traverse(dome, opName, path, args, options) {
	var opFn = ops[opName];
	if (!opFn) {
		throw new Error('Operation not implemented: ' + opName);
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

	var result = opFn(obj, chunk, args);

	if ((options & OPT_ADD_DIFF) !== 0) {
		dome.addDiff(opName, path, args);
	}

	if ((options & OPT_EMIT_CHANGE) !== 0) {
		// emits: full path, new value at path, { op: opName, result: opResult }
		dome.emit('change', path, obj[chunk], { op: opName, result: result });
	}

	return result;
}


function Dome(target) {
	this.target = target || {};
	this.snapshots = [];
	this.diff = [];
}

inherits(Dome, EventEmitter);


module.exports = function (obj) {
	return new Dome(obj);
};


Dome.prototype.toJSON = function () {
	return this.target;
};


Dome.prototype.destroy = function () {
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


Dome.prototype.addDiff = function (opName, path, args) {
	var diff = [opName, path, args];
	this.diff.push(diff);
	this.emit('diff', diff);
};


Dome.prototype.applyDiff = function (diff) {
	for (var i = 0; i < diff.length; i += 1) {
		var item = diff[i];  // op-name, path, args

		traverse(this, item[0], item[1], item[2], OPT_EMIT_CHANGE);
	}
};


Dome.prototype.snapshot = function () {
	this.snapshots.push({
		target: clone(this.target),
		diff: clone(this.diff)
	});
};


Dome.prototype.rollback = function () {
	var snapshot = this.snapshots.pop();
	this.target = snapshot.target;
	this.diff = snapshot.diff;
	this.emit('rollback');
};


Dome.prototype.createClient = function (path) {
	var client = new Dome(this.get(path));
	client.on('diff', function (diff) {
		this.addDiff(diff[0], path + diff[1], diff[2]);
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
	return traverse(this, 'set', path, [value], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.inc = function (path, value) {
	return traverse(this, 'inc', path, [value], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.dec = function (path, value) {
	return traverse(this, 'dec', path, [value], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.fill = function (path) {
	var args = new Array(arguments.length - 1);
	for (var i = 1; i < arguments.length; i += 1) {
		args[i - 1] = arguments[i];
	}

	return traverse(this, 'fill', path, args, OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.push = function (path, value) {
	return traverse(this, 'push', path, [value], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.pop = function (path) {
	return traverse(this, 'pop', path, [], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.splice = function (path) {
	var args = new Array(arguments.length - 1);
	for (var i = 1; i < arguments.length; i += 1) {
		args[i - 1] = arguments[i];
	}

	return traverse(this, 'splice', path, args, OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.shift = function (path) {
	return traverse(this, 'shift', path, [], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.unshift = function (path) {
	var args = new Array(arguments.length - 1);
	for (var i = 1; i < arguments.length; i += 1) {
		args[i - 1] = arguments[i];
	}

	return traverse(this, 'shift', path, args, OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.reverse = function (path) {
	return traverse(this, 'reverse', path, [], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.sort = function (path, fn) {
	return traverse(this, 'sort', path, [fn], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};

Dome.prototype.del = function (path) {
	return traverse(this, 'del', path, [], OPT_ADD_DIFF | OPT_EMIT_CHANGE);
};
