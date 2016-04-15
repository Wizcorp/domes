'use strict';

var EventEmitter = require('events').EventEmitter;
var clone = require('clone');
var Children = require('./Children');
var Options = require('./Options');
var Operation = require('./Operation');
var Path = require('./Path');
var Writer = require('./Writer');
var inherits = require('./inherits');

var emptyPath = Path.fromString('');


function Dome(parentDome, value, path, options) {
	Writer.call(this, parentDome, this, path || emptyPath, options);
	EventEmitter.call(this);

	this.children = new Children();  // all readers, writers and wrapped domes
	this.value = value;
	this.snapshots = [];
	this.lazySnapshots = 0;
	this.diff = this.options.addDiff ? [] : undefined;

	this.loadValue();
}

inherits(Dome, Writer);

Object.keys(EventEmitter.prototype).forEach(function (method) {
	Dome.prototype[method] = EventEmitter.prototype[method];
});

module.exports = Dome;


Dome.prototype.destroy = function () {
	this.children.destroy('domes');
	Writer.prototype.destroy.call(this);
	this.removeAllListeners();
	this.snapshots = undefined;
	this.diff = undefined;
	this.children = undefined;
};


Dome.prototype.locate = function (path, isReadOnly) {
	var chunks = path.getChunks();
	var parent = this;
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
};


Dome.prototype.wrap = function (path) {
	path = Path.fromString(path);

	var child = this.children.getDome(path);
	if (child) {
		return child;
	}

	var location = this.locate(path, true);
	if (!location.parent) {
		throw new Error('Path does not exist on dome: ' + path);
	}

	child = new Dome(this, location.parent[location.key], path, this.options.copy());

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

	this.options = Options.fromObject({ emitChange: !silent });

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

		if (this.options.emitChange) {
			oldValue = clone(this.value);
		}

		this.value = snapshot.value;
		this.diff = snapshot.diff;

		if (this.options.emitChange) {
			this.invokeChange(emptyPath, this.value, oldValue, new Operation('rollback', undefined));
		}
	}
};
