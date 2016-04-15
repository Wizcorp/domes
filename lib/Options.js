'use strict';

var OPT_NONE = 0;
var OPT_ADD_DIFF = 1;
var OPT_EMIT_CHANGE = 2;


function Options(opts) {
	this.addDiff = (opts & OPT_ADD_DIFF) !== 0;
	this.emitChange = (opts & OPT_EMIT_CHANGE) !== 0;
}

module.exports = Options;


Options.prototype.copy = function () {
	return Options.fromObject(this);
};


Options.fromObject = function (opts) {
	var options = OPT_NONE;
	if (opts) {
		if (opts.addDiff) {
			options |= OPT_ADD_DIFF;
		}

		if (opts.emitChange) {
			options |= OPT_EMIT_CHANGE;
		}
	}

	return new Options(options);
};
