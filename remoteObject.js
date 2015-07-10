'use strict';

/**
 * Creates a new remote object instance.
 * @param methods the names of available methods
 * @param invoke a function that will be used to invoke remote methods
 * @param onDestroy a function to invoke when the object is destroyed
 * @param control an object to attach control functions to, allowing the
 * creator to have internal control over this remote object not available to
 * other clients
 * @returns {RemoteObject}
 */
module.exports.create = function(methods, invoke, onDestroy, control) {
	return new RemoteObject(methods, invoke, onDestroy, control);
};

/**
 * An instance of a remote object.
 * @param methods the names of available methods
 * @param invoke a function that will be used to invoke remote methods
 * @param onDestroy a function to invoke when this object is destroyed
 * @param control an object to attach control functions to, allowing the
 * creator to have internal control over this remote object not available to
 * other clients
 * @returns {RemoteObject}
 * @constructor
 */
function RemoteObject(methods, invoke, onDestroy, control) {
	var self = this;

	var destroyed = false;

	// add provided methods
	methods.forEach(function(method) {
		self[method] = function() {
			// invoke via provided invoke function
			var args = Array.prototype.slice.call(arguments, 0);
			return invoke(method, args);
		};
	});

	// add event triggers
	var trigger = require('./trigger.js').create();

	/**
	 * Registers a listener for a type of event.
	 * @param {string} event the event type
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
	 * Causes this remote object to be destroyed. Following invocation of this
	 * method, no events will be received and method invocation will fail.
	 */
	self.destroy = function() {
		if (destroyed) {
			throw new Error('already destroyed');
		}
		destroyed = true;
		onDestroy();
		trigger.fire('destroy');
	};

	// add fire function to control object
	control.fire = trigger.fire;

	// add loss handler to control object
	control.onLoss = function() {
		destroyed = true;
		trigger.fire('loss');
		onDestroy();
		trigger.fire('destroy');
	};

	return this;
}
