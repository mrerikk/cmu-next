# Application lifecycle core 0.1

`src/apps/runtime.js` implements the first host-side component of the custom application environment: registration, opening/replacement, input delivery, teardown and validation of speed samples. It is written in ES5 syntax. It is not yet connected to the native CMU framework, the USB package manager or a real vehicle speed source. The new speedometer and its visual design are not implemented by this component.

This work prepares an independent component while vehicle validation of the earlier phases is pending. It does not close or reorder the six-stage roadmap. Native integration still follows verification of the visual modules and installation/recovery path.

## Host contract

Construct `CmuAppRuntime` with `window`, `document`, an explicitly owned application `root`, a `host`, optional `now()` and `onError(error)`. The runtime creates and removes its own child container; existing children of the supplied root are retained.

Register an author-controlled application with `{id, title, version, requiredCapabilities}` and a synchronous factory. IDs use lowercase letters, digits and hyphens; versions use three numeric components. `requiredCapabilities` currently recognizes `vehicle-speed` and gates opening. This metadata is not a security sandbox or a permission system for untrusted code. There is no downloaded-code loader, generic shell bridge or automatic vehicle hook.

The host may provide:

- `hasCapability(name)`: returns exactly true only when the named source is available.
- `inputEnabled()`: returns false while input must remain with the native system.
- `subscribeInput(callback)`: returns an unsubscribe function. The callback returns true only for a consumed event; false must be delegated by the future native bridge. `goBack` closes an app unless it consumes the event itself.
- `subscribeSpeed(callback)`: returns an unsubscribe function. It supplies a fresh sample or an unavailable value; it does not fabricate speed.

Every subscription must return a disposer. The host adapter must still implement actual native event ownership, modal/projection/camera transitions and restoration; constructed host fixtures do not prove those native behaviors.

## Application contract

The factory receives a context with its owned `view`, `document`, `now()`, `close()`, `listen(node, event, callback)`, `interval(callback, milliseconds)`, `subscribeSpeed(callback)` and `normalizeSpeed(sample)` methods. Resources created through these methods are tracked. The factory may return `onInput(event)` and `onClose(reason)` handlers.

On replacement, close, Back or a caught app callback error, the runtime marks the session inactive before removing resources. Late callbacks become inert. Teardown continues after a disposer error, and repeated close/destroy calls do not repeat app teardown. An immediate close during factory initialization is also finalized after the factory returns.

Applications remain responsible for any resources they create outside the context. The lifecycle core does not isolate global JavaScript access or grant permission to alter native DOM. Only trusted, project-controlled factories should be registered.

## Speed data boundary

A speed sample uses `{value, unit: 'km/h', source: 'vehicle' | 'demo', timestamp}`. The timestamp and host `now()` must share a millisecond clock. Values must be finite and between 0 and 400; samples older than two seconds or more than 250 ms in the future are rejected. Accepted samples are copied to a normalized object; invalid samples yield null. A valid zero is retained as zero.

These bounds are an initial interface contract, not a vehicle accuracy claim. A future display must re-check sample age as time passes and visibly distinguish demo input, no data and a verified native vehicle source. The lifecycle core alone does not schedule such display updates or determine the native telemetry source. It must not be described as a working CMU speedometer.

## Evidence and remaining work

Eight synthetic lifecycle groups run in the normal test suite. They verify resource ownership, capability failure, input locks/delegation, late callbacks, factory/callback failures, synchronous close, speed validity and idempotent disposal. These are host tests with constructed DOM and host objects.

Remaining required work: a native framework bridge, lifecycle behavior through native modal/voice/camera/projection changes, app discovery/installation/rollback, a verified read-only vehicle speed source, freshness/disconnection presentation, the actual speedometer interface and native performance/resource checks. No app runtime files are added to the current USB candidate or the 82-target visual module by this change.
