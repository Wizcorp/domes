var test = require('tape');
var dome = require('..');

test('JSON serialization', function (t) {
	var o = { hello: 'world' };
	var d = dome(o);

	t.equal(JSON.stringify(d), JSON.stringify(o));
	t.end();
});
