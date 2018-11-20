# Q API wrapper around native Promises

This is an implementation of the [Q](/kriskowal/q) Promise API,
based on existing Promises (either native to the Browser/... or
polyfilled with some other library).

It can be used to migrate from Q to native Promises or as a helper
library to extend native Promises with many useful functions.

## API Documentation

See [kriskowal/q](/kriskowal/q) for tbhe API reference

## Limitations

A few functions of the original API are not easily implementable or
don't make sense for the wrapper. They should be documented here.

## Acknowledgements

The code is derived from the original Q implementation,
this repository is based on a fork of [kriskowal/q](/kriskowal/q).
