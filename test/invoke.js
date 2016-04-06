var test = require('tape');
var dome = require('..');

test('Event invocation', function (t) {
	var o = { foo: { hello: false, world: [] } };
	var d = dome(o);

	var path, data;

	d.on('hello', function (_path, _data) {
		path = _path;
		data = _data;
	});

	d.write('foo.hello').invoke('hello', { foo: 'bar' });

	t.equal(path, 'foo.hello', 'Path received');
	t.deepEqual(data, { foo: 'bar' }, 'Data received');

	t.end();
});
