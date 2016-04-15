'use strict';


function Children() {
	this.readers = undefined;
	this.writers = undefined;
	this.domes = undefined;
}

module.exports = Children;


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
