// Type definitions for Log
// Project: Log
// Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
export = Log;

/**
 * Log is a JSON logger for facilitating structured logging that can be correlated
 * between multiple lambda functions via CloudWatch logs.
 *
 * To use:
 * 1. Import `const Log = require('./lib/log)`
 * 2. Create an instance id
 *   a. Create instance with custom instanceId: `const log = new Log('instanceId');`
 *   b. Create instance with random uuid instanceId: `const log = new Log();`
 *   c. Create instance with id from lambda event/context: `const log = new Log(event, context);`
 * 3. Add some properties to every log message: `log.addProp('myKey', 'some js value');`
 * 3. Log some info: `log.info('Hi', {'someAttribute': 'Here is some data to pass'});`
 * 4. Log an error: `log.error('Something failed', undefined, {'message': 'Something bad'});`
 *
 * Notes:
 * You can specify the log level to log with the LOG_LEVEL environment variable.  Valid levels are
 *   off, fatal, error, warn, info, debug, all.  Default is info.
 * You can have the logs print human readable by setting the PRETTY_PRINT environment variable to
 *  true.  Default is false.
 *
 * @param event is an event containing values which could be used as a string id, or a string id.
 * if it is undefined or null, or can't be parsed, an id will be generated.
 * @param context is a lambda context, from which a request id could be harvested.  If it
 * is undefined it is skipped.
 */
export function log(event?: any, context?: any): Log;

export interface Log {
	/** instanceId returns the instance id of the logger. */
	instanceId(): string;

	/**
	 * addProp adds a property to all of the log messages
	 *
	 * @param key is the key of the property to add
	 * @param property is the value to add
	 */
	addProp(key: string, property: any): undefined;

	/**
	 * rmProp removes a property from all of the log messages
	 *
	 * @param key is the key of the property to remove
	 */
	rmProp(key: string): undefined;

	/**
	 * info logs an info message
	 *
	 * @param message message to log
	 * @param attributes additional attributes to log
	 * @param error error to log
	 */
	info(message: string, attributes?: any, error?: Error): undefined;

	/**
	 * warn logs a warn message
	 *
	 * @param message message to log
	 * @param attributes additional attributes to log
	 * @param error error to log
	 */
	warn(message: string, attributes?: any, error?: Error): undefined;

	/**
	 * debug logs a debug message
	 *
	 * @param message message to log
	 * @param attributes additional attributes to log
	 * @param error error to log
	 */
	debug(message: string, attributes?: any, error?: Error): undefined;

	/**
	 * error logs an error messages
	 *
	 * @param message message to log
	 * @param attributes additional attributes to log
	 * @param error error to log
	 */
	error(message: string, attributes?: any, error?: Error): undefined;

	/**
	 * fatal logs a fatal message
	 *
	 * @param message message to log
	 * @param attributes additional attributes to log
	 * @param error error to log
	 */
	fatal(message: string, attributes?: any, error?: Error): undefined;
}
