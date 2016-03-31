var test = require('tape');
var dome = require('..');

test('Can set/has/get nested structures of all types', function (t) {
	var d = dome({});
	var path = 'hello.world.foo[3].bar';

	function attempt(value, type) {
		t.equal(d.has(path), false, type + ': does not exist');
		t.deepEqual(d.set(path, value), value, type + ': can set');
		t.equal(d.has(path), true, type + ': exists');
		t.deepEqual(d.get(path), value, type + ': can get');
		t.deepEqual(d.del(path), value, type + ': can del');
		t.deepEqual(d.del('hello'), { world: { foo: [,,, {} ] } }, type + ': can del its parent property');
		t.deepEqual(d.target, {}, type + ': target is an empty object');
		t.equal(d.has(path), false, type + ': no longer exists');
	}

	attempt({ test: { object: 1 } }, 'object');
	attempt([ {}, 1, 'str' ], 'array');
	attempt(null, 'null');
	attempt(undefined, 'undefined');
	attempt(5.3, 'number');
	attempt('hello world', 'string');
	attempt(false, 'boolean');

	t.end();
});
