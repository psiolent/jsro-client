'use strict';

/**
 * Creates a new poller that will long poll the server for message for the
 * identified connection.
 * @param url the base url on which to perform poll requests
 * @param context a functionality context allowing the JSRO library to operate
 * in whatever environment it is deployed in
 * @param connectionID the ID of the connection to poll for messages for
 * @param [pollTimeout] the poll timeout in milliseconds; if a poll
 * request has not received a response in this amount of time, a
 * new poll request will be issued
 * @param onPoll a callback to invoke with polled messages
 * @param onLoss a callback to invoke if the poll fails
 * @returns {Poller} a new active Poller instance
 */
module.exports.create = function(
	url,
	context,
	connectionID,
	pollTimeout,
	onPoll,
	onLoss) {
	return new Poller(url, context, connectionID, pollTimeout, onPoll, onLoss);
};

/**
 * constructs a new poller that will long poll the server for message for the
 * identified connection.
 * @param url the base url on which to perform poll requests
 * @param context a functionality context allowing the JSRO library to operate
 * in whatever environment it is deployed in
 * @param connectionID the ID of the connection to poll for messages for
 * @param [pollTimeout] the poll timeout in milliseconds; if a poll
 * request has not received a response in this amount of time, a
 * new poll request will be issued
 * @param onPoll a callback to invoke with polled messages
 * @param onLoss a callback to invoke if the poll fails
 * @constructor
 */
function Poller(url, context, connectionID, pollTimeout, onPoll, onLoss) {
	var self = this;

	// make sure poll timeout is legit
	pollTimeout = parseInt(pollTimeout);
	if (!pollTimeout || pollTimeout <= 0) {
		pollTimeout = 15000;
	}

	// keep track of our pending request
	var pendingRequest;

	// our poll timeout token
	var timeoutToken;

	// we're going to uniquely identify our poll requests
	var curPollID = 0;

	// keep track of the latest seen id so we can acknowledge it
	var latestID = -1;

	// keep track of when we are stopped
	var stopped = false;

	/**
	 * Causes this poller to stop polling.
	 */
	self.stop = function() {
		stopped = true;
		// abort the current pending request, if any
		if (pendingRequest) {
			context.clearTimeout(timeoutToken);
			pendingRequest.abort();
			pendingRequest = undefined;
		}
	};

	/**
	 * Long polls the server for the next message or messages.
	 */
	function poll() {
		if (stopped) {
			return;
		}

		// get an ID for this poll request so we can check it later
		var thisPollID = ++curPollID;

		// make the poll request
		pendingRequest = context.request(
			'GET',
			url + connectionID + (latestID >= 0 ? '/' + latestID : '')
		);

		// schedule our timeout
		timeoutToken = context.setTimeout(onTimeout, pollTimeout);

		// handle the result
		pendingRequest.then(function(messages) {
			if (thisPollID !== curPollID) {
				// this poll request is no longer relevant
				return;
			}

			// our request succeeded
			pendingRequest = undefined;
			context.clearTimeout(timeoutToken);

			if (stopped) {
				// we're stopped so we don't care about this
				return;
			}

			// filter out messages we've already received
			messages = messages.filter(function(message) {
				return message.id > latestID;
			});

			if (messages.length) {
				// we've got some new messages; save latest ID
				latestID = messages[messages.length - 1].id;

				// pass messages (sans ID) to client
				onPoll(messages.map(function(message) {
					return message.message;
				}));
			}

			// rinse and repeat
			poll();
		}, function(error) {
			if (thisPollID !== curPollID) {
				// this poll request is no longer relevant
				return;
			}

			// our request failed
			pendingRequest = undefined;
			context.clearTimeout(timeoutToken);

			// if we haven't already been stopped then let
			// the client know that shit's gone wrong
			if (!stopped) {
				onLoss(error);
			}
		});
	}

	/**
	 * Handles a polling timeout.
	 */
	function onTimeout() {
		// abort the current poll request and issue another one
		pendingRequest.abort();
		pendingRequest = undefined;
		poll();
	}

	// start polling
	poll();

	return this;
}
