# Domes

## What's a dome?

A dome is an object that wraps another object, and proxies reads and mutations to it. Those mutations are kept in a
diff-log that can be extracted, so that it can be synchronized to other domes. This way two domes can remain identical.
Imagine for example that you want to read a JSON object from your database and keep it synchronized in a browser.
You can instantiate domes both in Node and the browser, and exchange diff-logs to keep them synchronized.

You can also listen for events on changes on values, so you can update UI or do other operations based on particular
data being mutated.


## Benefits over other solutions

* Domes do not inject hidden meta data into your objects.
* Designed for crazy performance and zero side-effects.
* No more object-chaining errors (`Cannot read property 'foo' of undefined`).
* Simple API and simple design, easy to maintain.
* Ability to snapshot and rollback the data to a previous state.


## Installation

```sh
npm install domes --save
```


## Example usage

```js
var dome = require('domes');
var myObject = { hello: 'world' };

var d = dome(myObject);
d.write('hello.world.foo.bar').set({ a: { whole: { new: 'world' } } });
d.read('hello.world.foo.bar.a.whole.new').get(); // returns 'world'
d.write('list', function (w /* writer */) {
	w.set([]);
	w.push('item1', 'item2');
	console.log('Item count:', w.length);
});
```


## API reference


### Glossary

* Reader: API to read the value at a path.
* Writer: API to manipulate the value at a path. Writer inherits from Reader.
* Dome: wraps your value. Dome inherits from Writer.
* value: a value of any type wrapped by a reader, writer or dome.
* path: a string that describes the path to a sub-value (eg: `'foo.bar[2].foobar'`).
* empty path: a path that is an empty string which points to directly to the reader's, writer's or dome's value.
* diff: a list of changes that have been applied to the value.
* child: a dome that wraps a sub-value of a dome.


### Creating a dome around a value

```js
var dome = require('domes');
var myObject = { hello: 'world' };

var d = dome(myObject);
```

Keep in mind that domes inherit from writers, which inherit from readers. All the API below that applies to Reader and
Writer will therefore also directly apply to your dome instances.


#### Creation options

If you don't want to keep diffs or emit change events, you can optimize the behavior of your dome by passing in options:

```js
var d = dome(myObject, { addDiff: false, emitChanges: false });
```


### Reader

**Reader dome.read([string path[, Function runner(Reader)]])**

Returns a reader for the given path, which may be empty when you want to refer directly to the dome's value. It also
passes the reader to your optional callback if you provide it and runs this callback instantly. This can be a clean way
to use a reader for a very specific scope of tasks without leaking it. It has the following API.

#### All value types

**bool reader.exists()**

Returns `true` if the property at the reader's path exists (by means of `hasOwnProperty`), `false` otherwise.

**mixed reader.get([mixed fallback])**

Returns the value at the reader's path, or if it doesn't exist the given fallback value. If no value is found and no
fallback value is passed, `undefined` will be returned.

**mixed reader.copy()**

Returns a deep copy of the value at the reader's path. If no value is found `undefined` will be returned.

**mixed reader.toJSON()**

Returns the reader's value so that serializing the reader to JSON is the same as serializing `reader.get()` to JSON.

#### Other

**reader.destroy()**

Cleans out all data from the reader. If this reader is a child dome of another dome, writer or reader, this will have no
impact on the parent and its data. You may use this function to aid aggressive garbage collection.


### Writer

Every Writer is also a Reader, and so inherits all the API mentioned under `Reader`.

**Writer dome.write([string path[, Function runner(Writer)]])**

Returns a writer for the given path. It also passes the writer to your callback if you provide it and runs this callback
instantly. This can be a clean way to use a writer for a very specific scope of tasks without leaking it into outer
scopes. It has the following API.

#### All value types

**mixed writer.set(mixed value)**

Sets the property at the writer's path to the given value, and returns this new value.

**mixed writer.del()**

Deletes the property at the writer's path, and returns the previous value.

#### Numbers

**number writer.inc([number amount])**

Increments the number property at the writer's path by the given amount or by 1 if no amount is passed, then returns
the new value.

**number writer.dec([number amount])**

Decrements the number property at the given path by the given amount or by 1 if no amount is passed, then returns the
new value.

#### Objects and Arrays

**array|object writer.clear()**

Empties all properties or elements from the object or array at the writer's path, then returns the object or array
reference.

#### Strings and Arrays

**array|string writer.append([mixed arg1[, mixed arg2[, ...]]])**

Appends the given arguments to the array or string at the writer's path, then returns the new value.

#### Arrays

**array writer.fill(mixed value[, number start[, number end]])**

Fills the array at the writer's path with the given value. You may provide start and end positions for fill to take
place. The full array is returned. Note that you do not need browser support for this to work, as the API is emulated.
More information [at MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fill).

**number writer.push([mixed arg1[, mixed arg2[, ...]]])**

Pushes all given values to the end of the array at the writer's path, then returns the new array length.
More information [at MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push).

**mixed writer.pop()**

Pops a value from the end of the array at the writer's path, then returns it.
More information [at MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/pop).

**mixed writer.shift()**

Removes a value from the beginning of the array at the writer's path, then returns it.
More information [at MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift).

**mixed writer.unshift([mixed arg1[, mixed arg2[, ...]]])**

Adds all given values to the beginning of the array at the writer's path, then returns the new length of the array.
More information [at MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/unshift).

**array writer.splice(number start, number deleteCount, [, mixed arg1[, mixed arg2[, ...]]])**

Removes `deleteCount` items from the array at the writer's path, starting at index `start`. It then inserts all given
values at that position. An array containing all deleted elements is returned (which will be empty if `deleteCount` was
`0`).
More information [at MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice).

**array writer.reverse()**

Reverses the array at the writer's path in place, then returns the array.
More information [at MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reverse).

**array writer.sort()**

Sorts the array at the writer's path in place, then returns the array. At this time, a custom compare function cannot
be provided.
More information [at MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort).

#### Other

**writer.invoke(string eventName, mixed data)**

Emits `eventName` on the dome with `(string path, mixed data)` as arguments to listeners. The invocation will be part of
the diff structure, making it possible to use this mechanism to emit events over a serialized connection between
multiple domes. The event emission happens the moment you call `applyDiff` on your dome.

**writer.destroy()**

Cleans out all data from the writer. If this writer is a child dome of another dome or writer, this will have no
impact on the parent and its data. You may use this function to aid aggressive garbage collection.


### Dome

Every Dome is also a Writer, and so inherits all the API mentioned under `Writer` and `Reader`. It also has the
following API.


#### Synchronization

**array dome.extractDiff()**

Returns the current diff, and resets the dome's internal diff.

**array dome.peekDiff()**

Returns the current diff, but does not remove it from the dome. This can be useful when debugging, but should generally
not be needed.

**bool dome.hasDiff()**

Returns `true` if changes have been made to the dome's value since instantiation or last `dome.extractDiff()`, `false`
otherwise.

**dome.applyDiff(array diff[, bool silent])**

Applies a diff structure to the dome, making all the changes and emitting all events that go with it. If `silent` is
`true`, change-events will not be emitted.


#### Snapshots

**dome.snapshot()**

Makes a snapshot of the current dome value and diff. If you ever want to undo changes made, you will be able to roll
back to this point in time. You can make as many snapshots as you like, you are not limited to 1.

**dome.rollback()**

Rolls back to the last snapshot. You can call this method as often as you have called `snapshot()`.


#### Events

**"change" (string path, mixed newValue, mixed oldValue, object operationData)**

The value at the given path has changed, and its value has changed from `oldValue` to `newValue`. The `operationData`
object has the properties `string op` (the operation name, eg: `"set"`) and `mixed result` (the return value of the
operation).

**"change:path" (mixed newValue, mixed oldValue, object operationData)**

Here, `path` in `"change:path"` is the actual path that changed. This allows you to listen for changes at very specific
locations. The arguments you receive are the same as with the `change` event.

**"diff" (string opName, string path, array args)**

A diff entry was added because of a mutation. The operation is described by `opName`, the path on which it happened by
`path` and the arguments passed to the operation are in the `args` array.


#### Client domes

**Dome dome.wrap(string path)**

This creates a dome from a path on an existing dome. They will remain connected, so any changes that you make on the
child dome will automatically be added to the diff in the parent dome. The child will also keep its own diff state.
Changes made on the child dome will be emitted on the child as well as on the parent, with their paths normalized to
the dome you are listening on. Child domes have all the same API as normal domes.


#### Other

**dome.destroy()**

Cleans out all data and event listeners from the dome. If this dome is a child dome of another dome, this will have no
impact on the parent and its data. You may use this function to aid aggressive garbage collection.
