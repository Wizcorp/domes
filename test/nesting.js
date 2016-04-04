var test = require('tape');
var dome = require('..');

test('Can set/has/get nested structures of all types', function (t) {
	var d = dome({});

	var path = 'hello.world.foo[3].bar';

	function attempt(value, type) {
		var w = d.write(path);

		t.equal(w.exists(), false, type + ': does not exist');
		t.deepEqual(w.set(value), value, type + ': can set');
		t.equal(w.exists(), true, type + ': exists');
		t.deepEqual(w.get(), value, type + ': can get');
		t.deepEqual(w.copy(), value, type + ': can copy');
		t.deepEqual(w.del(), value, type + ': can del');
		t.deepEqual(d.write('hello').del(), { world: { foo: [,,, {} ] } }, type + ': can del its parent property');
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
