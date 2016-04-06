var test = require('tape');
var dome = require('..');

test('Empty path operations', function (t) {
	var o = { foo: { bar: true } };
	var r;

	dome(o).write(function (w) {
		t.equal(w.set(5), 5, 'Set dome to the number 5');
		t.equal(w.get(), 5, 'get() returned 5');
		t.equal(w.exists(), true, 'has() returned true');
		t.deepEqual(w.set({ foo: { bar: true } }), o, 'Dome reset to a full object');
	});

	dome(true).read(function (r) {
		t.equal(r.get(), true, 'New dome initialized to boolean true');
	});

	r = dome(false).read();
	t.equal(r.get(), false, 'New dome initialized to boolean false');

	r = dome('hello').read();
	t.equal(r.get(), 'hello', 'New dome initialized to string "hello"');

	r = dome('').read();
	t.equal(r.get(), '', 'New dome initialized to empty string');

	r = dome(null).read();
	t.equal(r.get(), null, 'New dome initialized to null');

	r = dome(undefined).read();
	t.equal(r.get(), undefined, 'New dome initialized to undefined');

	t.end();
});
