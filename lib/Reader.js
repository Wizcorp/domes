'use strict';

var clone = require('clone');
var Path = require('./Path');

var emptyPath = Path.fromString('');


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

module.exports = Reader;


Reader.prototype.loadValue = function () {
	if (this.isDome) {
		this.parent = this;
		this.key = 'value';
	} else {
		var location = this.dome.locate(this.path, this.isReadOnly);

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
