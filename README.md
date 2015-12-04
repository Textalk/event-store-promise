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

const esp   = require('../event-store-promise/esp.js')
const async = require('asyncawait/async')
const await = require('asyncawait/await')
const _     = require('highland')

// A convenient wrapper to await the result of a highland stream.  Always gives an array though.
const await_  = stream => await(new Promise((res, rej) => stream.errors(rej).toArray(res)))

// A stub applyEvent that justs take the event object and boils down the latest value of each key.
const applyEvent = (state, event) => Object.assign({}, state, event)

// Stream to boil down.
const streamId   =  'testStream'

async(() => {
  // Connect to EventStore.
  const es = await(esp({
    host:        '0.0.0.0',
    port:        1113,
    credentials: {username: 'admin', password: 'changeit'},
  }))

  // Try adding some events asynchronously.
  setInterval(async(() => {
    const event = {foo: 'bar', date: Date()}
    console.log('Adding event in stream', streamId)
    await(es.writeEvents(streamId, es.ExpectedVersion.Any, false,
                         [{eventId: es.createGuid(), eventType: 'test', data: event}]))
    console.log('Event is now added asynchronously and awaited.')
  }), 400)

  try {
    // Read all events up until event 10.  This will wait for events to come in.
    const result = await_(_(es.readStreamEventsUntil(streamId, 0, 10)).reduce(0, applyEvent))
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

Coming soon…
