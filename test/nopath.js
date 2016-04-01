var test = require('tape');
var dome = require('..');

test('Empty path operations', function (t) {
	var o = { foo: { bar: true } };
	var d = dome(o);

	t.equal(d.set('', 5), 5, 'Set dome to the number 5');
	t.equal(d.get(''), 5, 'get() returned 5');
	t.equal(d.has(''), true, 'has() returned true');
	t.deepEqual(d.set('', { foo: { bar: true } }), o, 'Dome reset to a full object');

	d = dome(true);
	t.equal(d.get(''), true, 'New dome initialized to boolean true');

	d = dome(false);
	t.equal(d.get(''), false, 'New dome initialized to boolean false');

	d = dome('hello');
	t.equal(d.get(''), 'hello', 'New dome initialized to string "hello"');

	d = dome('');
	t.equal(d.get(''), '', 'New dome initialized to empty string');

	d = dome(null);
	t.equal(d.get(''), null, 'New dome initialized to null');

	d = dome(undefined);
	t.equal(d.get(''), undefined, 'New dome initialized to undefined');

	t.end();
});
