'use strict';

/**
 * Connections module establishes connections and provides an interface for
 * managing established connections.
 * @param url the base url on which to perform requests for this connection
 * @param context a functionality context allowing the JSRO library to operate
 * in whatever environment it is deployed in
 * @param [pollTimeout] the poll timeout in milliseconds; if a poll
 * request has not received a response in this amount of time, a
 * new poll request will be issued
 * @returns {promise} a promise for the established connection object
 */
module.exports.establish = function(url, context, pollTimeout) {
	return context.request('GET', url).then(function(data) {
		if (typeof data.connectionID === 'undefined') {
			throw new Error('invalid response; expected connection ID');
		}
		return new Connection(url, context, data.connectionID, pollTimeout);
	});
};

/**
 * A connection to a JSRO-capable server.
 * @param url the base url on which to perform requests for this connection
 * @param context a functionality context allowing the JSRO library to operate
 * in whatever environment it is deployed in
 * @param connectionID the ID of this connection
 * @param [pollTimeout] the poll timeout in milliseconds; if a poll
 * request has not received a response in this amount of time, a
 * new poll request will be issued
 * @constructor
 */
function Connection(url, context, connectionID, pollTimeout) {
	var self = this;

	// normalize url (i.e. add a trailing slash if it doesn't have one)
	if (url.substr(-1) !== '/') {
		url += '/';
	}

	// keep track of whether we're still connected
	var connected = true;

	// a queue to manage requests
	var requests = require('./requestQueue.js').create(context);

	// current pending send request, if any
	var pendingRequest;

	// remote object instances indexed by instance ID
	var instances = {};

	// a poller to long poll for messages from server
	var poller = require('./poller.js').create(
		url,
		context,
		connectionID,
		pollTimeout,
		onPoll,
		onLoss);

	// a trigger for connection related events
	var trigger = require('trigger-maker').create();

	// grab remoteObject module for creating remote objects
	var remoteObject = require('./remoteObject.js');

	/**
	 * Creates a remote object from the named factory.
	 * @param name the name of the server-side factory to use to create the
	 * instance
	 * @param spec the object creation spec
	 * @returns {promise} a promise for the created remote object
	 */
	self.create = function(name, spec) {
		if (!connected) {
			throw new Error('already disconnected');
		}
		return sendRequest({
			action: 'create',
			name: name,
			spec: spec
		}).then(function(result) {
			return registerRemoteObject(result.instanceID, result.methods);
		});
	};

	/**
	 * Causes this connection to disconnect.
	 */
	self.disconnect = function() {
		if (!connected) {
			throw new Error('already disconnected');
		}
		connected = false;
		trigger.fire('disconnect');

		// notify all current instances of their loss
		var instanceIDs = Object.getOwnPropertyNames(instances);
		instanceIDs.forEach(function(instanceID) {
			instances[instanceID].onLoss();
		});
		instances = {};

		// cancel pending request if we have one
		if (pendingRequest) {
			pendingRequest.abort();
		}

		// and stop our poller
		poller.stop();

		// delete connection on server side
		context.request('DELETE', url + connectionID);
	};

	/**
	 * Registers a listener for a type of event.
	 * @param {string} event the event type ('loss' or 'disconnect')
	 * @param {Function} fn the function to invoke to handle the event
	 */
	self.on = trigger.on;

	/**
	 * Unregisters one or all listeners for an event.
	 * @param event the event to unregister for ('loss' or 'disconnect')
	 * @param [fn] if provided, the listener function to unregister; if not
	 * provided, all listeners will be unregistered
	 */
	self.off = trigger.off;

	/**
	 * Invoked when this connection is lost.
	 * @param error the error describing the connection loss
	 */
	function onLoss(error) {
		trigger.fire('loss', error);
		self.disconnect();
	}

	/**
	 * Destroys a remote object instance on the server.
	 * @param instanceID the ID of the instance to destroy
	 */
	function destroy(instanceID) {
		sendRequest({
			action: 'destroy',
			instanceID: instanceID
		});
	}

	/**
	 * Queues a request to be sent to the server and sends immediately if
	 * possible.
	 * @param req the request to queue and send
	 * @returns {promise} a promise for the result of the request
	 */
	function sendRequest(req) {
		var deferredResult = requests.add(req);
		sendQueuedRequests();
		return deferredResult;
	}

	/**
	 * Sends queued requests, if any and if not already sending.
	 */
	function sendQueuedRequests() {
		if (!pendingRequest) {
			// we can send now
			var requestsToSend = requests.drain();
			if (requestsToSend.length > 0) {
				// and we have stuff to send
				pendingRequest = context.request(
					'POST',
					url + connectionID,
					requestsToSend);

				// handle request result
				pendingRequest.then(function() {
					pendingRequest = undefined;
					sendQueuedRequests();
				}, function(error) {
					pendingRequest = undefined;
					onLoss(error);
				});
			}
		}
	}

	/**
	 * Handles the receipt of polled messages.
	 * @param messages received messages
	 */
	function onPoll(messages) {
		messages.forEach(function(message) {
			if (message.requestID !== undefined) {
				// a response to a request
				requests.handleResult(message);
			} else if (message.event !== undefined) {
				// an event fired from a remote object
				var instance = instances[message.instanceID];
				if (instance) {
					// prepare args to pass to fire function
					var fireArgs = message.args || [];
					fireArgs.unshift(message.event);
					instance.fire.apply(global, fireArgs);
				}
			}
		});
	}

	/**
	 * Registers a newly created remote object with this connection.
	 * @param instanceID the ID of the remote object instance
	 * @param methods the list of methods for the remote object
	 * @returns {RemoteObject} a new remote object instance
	 */
	function registerRemoteObject(instanceID, methods) {
		if (instances[instanceID]) {
			throw 'assigned instance ID already in use: ' + instanceID;
		}

		// track whether this remote object has been destroyed
		var destroyed = false;

		// track deferred results of invocations indexed by a unique ID
		var nextResultID = 0;
		var deferredResults = {};

		// need an invoke function that the remote object instance can use to
		// invoke its methods
		function invoke(method, args) {
			if (destroyed) {
				throw new Error('remote object already destroyed');
			}

			// create an ID and a deferred result for this invocation
			var resultID = nextResultID++;
			var deferredResult = context.defer();
			deferredResults[resultID] = deferredResult;

			sendRequest({
				action: 'invoke',
				instanceID: instanceID,
				method: method,
				args: args
			}).then(function(result) {
				if (!destroyed) {
					delete deferredResults[resultID];
					deferredResult.resolve(result.result);
				}
			}, function(error) {
				if (!destroyed) {
					delete deferredResults[resultID];
					deferredResult.reject(error);
				}
			});

			return deferredResult.promise;
		}

		// need a function that can be invoked when the object is destroyed
		function onDestroy() {
			// remember, remember that we were dismembered
			destroyed = true;

			// reject all pending invocation results
			var resultIDs = Object.getOwnPropertyNames(deferredResults);
			resultIDs.forEach(function(resultID) {
				deferredResults[resultID].reject('remote object destroyed');
			});
			deferredResults = {};

			// let server side know we're done with it
			destroy(instanceID);
		}

		// need a control object that will allow us to control the remote
		// object instance
		var control = {};

		// create the remote object
		var ro = remoteObject.create(methods, invoke, onDestroy, control);

		// index it and its control functions
		instances[instanceID] = {
			instance: ro,
			fire: control.fire,
			onLoss: control.onLoss
		};

		return ro;
	}

	return this;
}
