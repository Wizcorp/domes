var test = require('tape');
var dome = require('..');

test('Object operations', function (t) {
	var w = dome({ foo: { hello: 1, world: 2 } }).write('foo');

	t.deepEqual(w.clear(), {}, 'Object cleared');

	t.end();
});
