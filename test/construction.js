var test = require('tape');
var dome = require('..');

test('Construction', function (t) {
	var o = { foo: 'bar' };
	var d = dome(o);

	t.equal(d.get('foo'), 'bar');

	o = ['foo', 'bar'];
	d = dome(o);

	t.equal(d.get('[1]'), 'bar');

	t.end();
});
