'use strict'

const EventStore = require('event-store-client')

const EspPrototype = {}

module.exports = (options, defaults) => {
  const defaultDefaults = {
    timeout:        2000,
    resolveLinkTos: false,
    requireMaster:  false,
    maxCount:       4095,
  }

  return new Promise((resolve, reject) => {
    const esp = Object.create(EspPrototype)

    esp.defaults    = Object.assign({}, defaultDefaults, defaults)
    esp.credentials = options.credentials

    const connectionOptions = Object.assign({}, options)
    connectionOptions.onConnect = ()    => resolve(esp)
    connectionOptions.onError   = (err) => reject(err)

    esp.connection = new EventStore.Connection(connectionOptions)
  })
}

const Readable = require('stream').Readable
const util     = require('util')
const EventStoreStream = function() {
  Readable.call(this, {objectMode: true});
}
util.inherits(EventStoreStream, Readable)
EventStoreStream.prototype._read = (size) => {}

EspPrototype.ExpectedVersion = EventStore.ExpectedVersion
EspPrototype.OperationResult = EventStore.OperationResult

EspPrototype.close      = function() {return this.connection.close()}
EspPrototype.createGuid = () => EventStore.Connection.createGuid()

EspPrototype.sendPing   = function() {
  const self = this
  return new Promise((resolve) => self.connection.sendPing(resolve))
}

/**
 * Subscribe to future events on stream.
 *
 * Use stream.close() to unsubscribe.
 *
 * @param  streamId  Stream ID
 * @param  object    options
 *   resolveLinkTos  - Resolve Link Tos?           Default: false
 *
 * @return EventStoreStream stream  The stream of events.
 */
EspPrototype.subscribeToStream = function(streamId, params) {
  const self    = this
  const options = Object.assign({}, self.defaults, params)
  const stream  = new EventStoreStream()

  const correlationId = self.connection.subscribeToStream(
    streamId, options.resolveLinkTos,
    event     => stream.push(event),
    confirmed => stream.emit('open', confirmed),
    err       => stream.emit('error', err),
    self.credentials
  )

  stream.close = () => self.connection.unsubscribeFromStream(correlationId, self.credentials)

  return stream
}

EspPrototype.readAllEventsBackward = function() {
  return this.connection.readAllEventsBackward.apply(this, arguments)
}

EspPrototype.readAllEventsForward = function() {
  return this.connection.readAllEventsForward.apply(this, arguments)
}

EspPrototype.readStreamEventsBackward = function() {
  return this.connection.readStreamEventsBackward.apply(this, arguments)
}

/**
 * Read all existing events in a stream forward.
 *
 * @param string   streamId  Stream ID
 * @param integer  from      Start at EventNumber
 * @param object   options
 *   maxCount        - Maximum number of events    Default: 4095
 *   resolveLinkTos  - Resolve Link Tos?           Default: false
 *   requireMaster   - Require Master?             Default: false
 *
 * @return EventStoreStream stream  The stream of events.
 */
EspPrototype.readStreamEventsForward = function(streamId, from, params) {
  const self    = this
  const options = Object.assign({}, self.defaults, params)
  const stream  = new EventStoreStream()

  self.connection.readStreamEventsForward(
    streamId, from, options.maxCount, options.resolveLinkTos, options.requireMaster,
    event => stream.push(event), self.credentials,
    read  => stream.push(null)
  )

  return stream
}

/**
 * Get stream of events from `from` to `to`.
 *
 * @param string   streamId  StreamId ID
 * @param integer  from      From EventNumber
 * @param integer  to        To EventNumber (inclusive)
 * @param object   options
 *   timeout         - Timeout (in milliseconds).  Default: 2000
 *   resolveLinkTos  - Resolve Link Tos?           Default: false
 *   requireMaster   - Require Master?             Default: false
 *
 * Example (with highlandjs):
 *
 *   // Apply all states up to event 100 and get resulting state.
 *   _(es.readStreamEventsUntil(streamId, 0, 100)).reduce({}, applyEvent).pull(useResult)
 *
 * @todo Handle when an event has arrived between reading streamId and subscribing.
 * @todo Handle more than 4095 events requested.
 */
EspPrototype.readStreamEventsUntil = function(streamId, from, to, params) {
  const self    = this
  const options = Object.assign({}, self.defaults, params, {maxCount: to - from + 1})
  const stream  = new EventStoreStream()
  const timer   = setTimeout(
    () => stream.emit('error', new Error('Timeout reached')),
    options.timeout
  )

  const end = () => {
    stream.push(null)
    return clearTimeout(timer)
  }

  let lastEventNumber = -1
  const forwardStream = self.readStreamEventsForward(streamId, from, options)
  forwardStream.on('data', event => {
    lastEventNumber = event.eventNumber
    stream.push(event)
  })
  forwardStream.on('error', err => stream.emit('error', err))
  forwardStream.on('end', () => {
    if (lastEventNumber === to) return end()

    const subscribeStream = self.subscribeToStream(streamId, options)
    subscribeStream.on('data', event => {
      stream.push(event)

      if (event.eventNumber === to) {
        subscribeStream.close()
        end()
      }
    })
  })

  return stream
}

/**
 * Write events to stream.
 *
 * @param string   streamId         StreamId ID
 * @param integer  expectedversion  The expected version before this write.
 * @param boolean  requireMaster
 * @param array    events
 *
 * @return Promise
 */
EspPrototype.writeEvents = function(streamId, expectedVersion, requireMaster, events) {
  const self = this
  return new Promise((resolve, reject) => {
    self.connection.writeEvents(
      streamId, expectedVersion, requireMaster, events, self.credentials,
      (response) => {
        if (response.result === EventStore.OperationResult.Success) return resolve(response)
        reject(response)
      }
    )
  })
}
