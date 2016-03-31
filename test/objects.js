var test = require('tape');
var dome = require('..');

test('Object operations', function (t) {
	var d = dome({ foo: { hello: 1, world: 2 } });

	t.deepEqual(d.clear('foo'), {}, 'Object cleared');

	t.end();
});
