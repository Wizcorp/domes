var test = require('tape');
var dome = require('..');

test('Object operations', function (t) {
	var m = dome({ foo: { hello: 1, world: 2 } }).mutate('foo');

	t.deepEqual(m.clear(), {}, 'Object cleared');

	t.end();
});
