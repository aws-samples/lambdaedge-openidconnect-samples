// LogLevel defines the log level and hierarchy of log levels
// Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
let LogLevel;
// eslint-disable-next-line func-names
(function(logLevel) {
	const level = logLevel;
	level[(level.OFF = 0)] = 'OFF';
	level[(level.FATAL = 1)] = 'FATAL';
	level[(level.ERROR = 2)] = 'ERROR';
	level[(level.WARN = 3)] = 'WARN';
	level[(level.INFO = 4)] = 'INFO';
	level[(level.DEBUG = 5)] = 'DEBUG';
	level[(level.ALL = 6)] = 'ALL';
})(LogLevel || (LogLevel = {}));

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
 * @param {any?} event is an event containing values which could be used as a string id, or a
 * string id.
 * if it is undefined or null, or can't be parsed, an id will be generated.
 * @param {any?} context is a lambda context, from which a request id could be harvested.  If it
 * is undefined
 * it is skipped.
 */
function log(event, context) {
	const isPrettyPrint = (process.env.PRETTY_PRINT || 'false').toLowerCase() === 'true';
	const logLevel = getLogLevel(process.env.LOG_LEVEL || 'INFO');
	const lambdaName = getLambdaName();
	const properties = {};
	const id = getId(event, context);

	// log writes the logging payload to the stdout.
	const logMessage = (possibleLevel, message, attributes, error) => {
		// using stdout so I write pure json to the cloudwatch logs.
		const write = (value) => {
			if (isPrettyPrint) {
				process.stdout.write(`${customStringify(value, undefined, 2)}\n`);
			} else {
				process.stdout.write(`${customStringify(value)}\n`);
			}
		};
		const finalLevel = getLogLevel(possibleLevel || 'INFO');
		const valueToWrite = {
			instanceId: id,
			level: LogLevel[finalLevel],
			message: isNil(message) ? undefined : message,
			attributes: isNil(attributes) ? {} : attributes,
			properties: isNil(properties) ? {} : properties,
			error: isNil(error) ? undefined : { message: error.message, stack: error.stack },
			logName: lambdaName,
			date: new Date().toISOString()
		};
		if (logLevel === LogLevel.FATAL && finalLevel <= LogLevel.FATAL) {
			write(valueToWrite);
		} else if (logLevel === LogLevel.ERROR && finalLevel <= LogLevel.ERROR) {
			write(valueToWrite);
		} else if (logLevel === LogLevel.WARN && finalLevel <= LogLevel.WARN) {
			write(valueToWrite);
		} else if (logLevel === LogLevel.INFO && finalLevel <= LogLevel.INFO) {
			write(valueToWrite);
		} else if (logLevel === LogLevel.DEBUG && finalLevel <= LogLevel.DEBUG) {
			write(valueToWrite);
		} else if (logLevel === LogLevel.ALL && finalLevel <= LogLevel.ALL) {
			write(valueToWrite);
		} else {
			// write nothing
		}
	};

	return {
		instanceId: () => id,
		// eslint-disable-next-line no-return-assign
		addProp: (key, property) => (properties[key] = property),
		rmProp: (key) => delete properties[key],
		info: (message, attributes) => logMessage('INFO', message, attributes),
		warn: (message, attributes, error) => logMessage('WARN', message, attributes, error),
		debug: (message, attributes, error) => logMessage('DEBUG', message, attributes, error),
		error: (message, attributes, error) => logMessage('ERROR', message, attributes, error)
	};
}

// getId returns the event if it is a string.  If the event is an event, it looks
// for an instanceId in it.  If the instanceId is not there, it checks the context for a
// requestId and returns that.  If none of those are available, it generates a uuid (which is
// not a time based uuid)
function getId(event, context) {
	if (typeof event === 'string') {
		return event;
	}
	if (event !== undefined && event.instanceId !== undefined) {
		return event.instanceId;
	}
	if (context !== undefined && context.awsRequestId !== undefined) {
		return context.awsRequestId;
	}
	const placeholder = '10000000-1000-4000-8000-100000000000';
	// eslint-disable-next-line no-bitwise
	return placeholder.replace(/[018]/g, () => (0 | (Math.random() * 16)).toString(16));
}

// getLogLevel sets the log level based on the environment variable that is set.
function getLogLevel(potentialLogLevel) {
	let logLevel;
	switch (potentialLogLevel.toUpperCase()) {
		case 'OFF': {
			logLevel = LogLevel.OFF;
			break;
		}
		case 'FATAL': {
			logLevel = LogLevel.FATAL;
			break;
		}
		case 'ERROR': {
			logLevel = LogLevel.ERROR;
			break;
		}
		case 'WARN': {
			logLevel = LogLevel.WARN;
			break;
		}
		case 'INFO': {
			logLevel = LogLevel.INFO;
			break;
		}
		case 'DEBUG': {
			logLevel = LogLevel.DEBUG;
			break;
		}
		default: {
			logLevel = LogLevel.INFO;
			break;
		}
	}
	return logLevel;
}

// isNil checks if a value is undefined or null.
function isNil(value) {
	return value === undefined || value === null;
}

// removeExtension removed the file extension.
function removeExtension(value) {
	const index = value.lastIndexOf('.');
	if (index === -1) return value;
	return value.substr(0, index);
}

// getFileNameSansPathAndExtension removes the path and extension from the file name.
function getFileNameSansPathAndExtension(value) {
	return removeExtension(value.split('/').slice(-1)[0]);
}

// Gets the filename of the lambda using this library.  This is overly simple and will fail... but
// until I have an example of it returning the wrong name, I am leaving it.
function getLambdaName() {
	const details = new Error().stack.split('at ')[3].trim();
	const fileName = getFileNameSansPathAndExtension(details.split(':')[0]);
	return fileName;
}

function customStringify(value, replacer, space) {
	const cache = new Set();
	return JSON.stringify(
		value,
		(_, val) => {
			if (typeof val === 'object' && val !== null) {
				if (cache.has(val)) {
					try {
						return JSON.parse(JSON.stringify(val, replacer, space));
					} catch (err) {
						// eslint-disable-next-line consistent-return
						return;
					}
				}
				cache.add(val);
			}
			return val;
		},
		space
	);
}

module.exports = log;
