Event Store Promises
====================

An interface to [Event Store](https://geteventstore.com/) using
[Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
and [Streams](https://nodejs.org/api/stream.html).

Programming for event sourcing fits perfectly with javascripts asynchronous handling of Promises
and Streams.  This lib puts a layer on top of the protocol implementation
[event-store-client](https://github.com/x-cubed/event-store-client).


Install
-------

```bash
npm install --save event-store-promise
```

Example usage
-------------

An example using [Highland](http://highlandjs.org/) and
[asyncawait](https://github.com/yortus/asyncawait) to reduce an eventstream to a state.

It also pushes new events to the stream to have something to pull, ans waits for 10 events, but
times out after 2 seconds.

```javascript
'use strict'

const EventStorePromise = require('event-store-promise')
const async             = require('asyncawait/async')
const await             = require('asyncawait/await')
const _                 = require('highland')

// A convenient wrapper to await the result of a highland stream.  Always gives an array though.
const await_  = stream => await(new Promise((res, rej) => stream.errors(rej).toArray(res)))

// A stub applyEvent that justs take the event object and boils down the latest value of each key.
const applyEvent = (state, event) => Object.assign({}, state, event)

// Stream to boil down.
const streamId   =  'testStream'

async(() => {
  // Connect to EventStore.
  const esp = await(EventStorePromise({
    host:        '0.0.0.0',
    port:        1113,
    credentials: {username: 'admin', password: 'changeit'},
  }))

  // Try adding some events asynchronously.
  setInterval(async(() => {
    const event = {foo: 'bar', date: Date()}
    console.log('Adding event in stream', streamId)
    await(esp.writeEvents(streamId, esp.ExpectedVersion.Any, false,
                          [{eventId: esp.createGuid(), eventType: 'test', data: event}]))
    console.log('Event is now added asynchronously and awaited.')
  }), 400)

  try {
    // Read all events up until event 10.  This will wait for events to come in.
    const result = await_(_(esp.readStreamEventsUntil(streamId, 0, 10)).reduce(0, applyEvent))
    console.log('Got result', result)
  } catch (err) {
    // Catching errors, probably timeout for too few events.
    console.log('Caught error', err)
  }
  console.log('\nAll done.')
  process.exit()
})().done()
```

API Documentation
-----------------

Generic parameters:

* `streamId`: The string identifier of an eventstore stream.
* `params`: Object with `timeout` (seconds), `resolveLinkTos` (boolean), `requireMaster` (boolean),
  `maxCount` (integer)
* `from`, `to`, and `expectedVersion`: Refers to eventNumber, order nr in event stream.


## const esp = EventStorePromise(options)

Returns a promise of an esp object.

Options are passed to EventStore.Connection.

* `host`
* `port`
* `credentials` - an object with `username` and `password`.

## esp.close() → void

Closes the connection.


## esp.createGuid() → string (uuid)

## esp.sendPing() → Promise (of a pong)

## esp.subscribeToStream(streamId, params) → stream

The returned `stream` emits `open`, `data`, `close`, and `error`.

Call `stream.close()` to stop subscription.


## esp.readStreamEventsForward(streamId, from, params) → stream

The returned `stream` emits `open`, `data`, `close`, and `error`.


## esp.readStreamEventsUntil(streamId, from, to, params) → stream

Returns a stream of all events from `from` to `to`.  If the eventstore isn't yet up to `to`, it
will subscribe and continue emitting events until `to` is reached, or `params.timeout` is reached.

The returned `stream` emits `open`, `data`, `close`, and `error`.


## esp.writeEvents(streamId, expectedVersion, requireMaster, events) → Promise (of written)

* `events`: An array of event objects.  Each event object needs `eventId` (should be a uuid),
  `eventType` (string), and `data` (free object).

Return: A Promise of `written`, an object with:

* `result`: integer, corresponding to esp.OperationResult values.  Should be 0.
* `message`
* `firstEventNumber`
* `lastEventNumber`: Last written event number.
* `preparePosition`
* `commitPosition`


## esp.OperationResult / esp.OperationResult.getName(result)

Object with values of `written` result.  Use `esp.OperationResult.getName(result)` to get the name
of the result.


## esp.readAllEventsBackward(…)

Not yet implemented.


## esp.readAllEventsForward(…)

Not yet implemented.
