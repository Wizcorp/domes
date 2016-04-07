var test = require('tape');
var dome = require('..');

test('Path reading', function (t) {
	/*eslint dot-notation: 0*/
	var o = { foo: { bar: { foo: { bar: [{ foo: { bar: {} } }] } } } };

	var domes = {};
	domes[''] = dome(o);
	domes['foo'] = domes[''].wrap('foo');
	domes['foo.bar'] = domes['foo'].wrap('bar');
	domes['foo.bar.foo'] = domes['foo.bar'].wrap('foo');
	domes['foo.bar.foo.bar'] = domes['foo.bar.foo'].wrap('bar');
	domes['foo.bar.foo.bar[0]'] = domes['foo.bar.foo.bar'].wrap('[0]');
	domes['foo.bar.foo.bar[0].foo'] = domes['foo.bar.foo.bar[0]'].wrap('foo');
	domes['foo.bar.foo.bar[0].foo.bar'] = domes['foo.bar.foo.bar[0].foo'].wrap('bar');

	var paths = Object.keys(domes);
	for (var i = 0; i < paths.length; i += 1) {
		var path = paths[i];

		t.equal(domes[path].getAbsolutePath(), path, 'Path should be "' + path + '"');
	}

	t.end();
});
