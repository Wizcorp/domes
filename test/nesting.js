var test = require('tape');
var dome = require('..');

test('Can set/has/get nested structures of all types', function (t) {
	var d = dome({});

	var path = 'hello.world.foo[3].bar';

	function attempt(value, type) {
		var m = d.mutate(path);

		t.equal(m.exists(), false, type + ': does not exist');
		t.deepEqual(m.set(value), value, type + ': can set');
		t.equal(m.exists(), true, type + ': exists');
		t.deepEqual(m.get(), value, type + ': can get');
		t.deepEqual(m.copy(), value, type + ': can copy');
		t.deepEqual(m.del(), value, type + ': can del');
		t.deepEqual(d.mutate('hello').del(), { world: { foo: [,,, {} ] } }, type + ': can del its parent property');
		t.deepEqual(d.target, {}, type + ': target is an empty object');
		t.equal(d.read(path).exists(), false, type + ': no longer exists');
	}

	attempt({ test: { object: 1 } }, 'object');
	attempt([ {}, 1, 'str' ], 'array');
	attempt(null, 'null');
	attempt(undefined, 'undefined');
	attempt(5.3, 'number');
	attempt('hello world', 'string');
	attempt(false, 'boolean');

	t.throws(function () {
		d.mutate('foo[1');
	}, null, 'Bad path not accepted');

	t.end();
});
