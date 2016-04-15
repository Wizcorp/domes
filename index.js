// Data Object Management E..something

var Options = require('./lib/Options');
var Dome = require('./lib/Dome');

var defaultOptions = {
	addDiff: true,
	emitChange: true
};


module.exports = function (value, options) {
	return new Dome(undefined, value, undefined, Options.fromObject(options || defaultOptions));
};
