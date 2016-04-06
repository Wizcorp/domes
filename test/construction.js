var test = require('tape');
var dome = require('..');

test('Construction', function (t) {
	var o = { foo: 'bar' };
	var d = dome(o);

	t.equal(d.read('foo').get(), 'bar');

	o = ['foo', 'bar'];
	d = dome(o);

	t.equal(d.read('[1]').get(), 'bar');

	t.end();
});
