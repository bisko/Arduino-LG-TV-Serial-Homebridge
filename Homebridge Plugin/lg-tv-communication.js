const request = require('request');
const { findKey } = require('lodash');
const memoize = require('timed-memoize').default;
const queue = require('async/queue');

console.log(memoize);

const requestsQueue = queue((task, next) => {
	const { command, commandData, commandCallback, retries } = task;
	console.log('Executing command [ ', command, ' ] [ ', commandData, ']');
	request({
		url: 'http://<CHANGEME-arduino-ip>/lgtvrc',
		auth: {
			user: 'admin',
			pass: 'esp8266',
			sendImmediately: true,
		},
		qs: { command, commandData }
	}, (err, resp, body) => {
		next();

		console.log('REQUEST GOT RESPONSE');
		if ((err || (body || '').trim().length === 0)) {
			if (retries < 5) {
				console.log('Command failed :( ', command, commandData);
				console.log(err);
				console.log(body);

				sendCommand(command, commandData, commandCallback, retries + 1);
			}
			else {
				if (typeof commandCallback === 'function') {
					commandCallback({});
				}
			}
		}
		else {
			console.log('[[[[[[[[[[[[[ ', body);
			const result = parseResponse(body);

			if (typeof commandCallback === 'function') {
				console.log('Going for callback with result', result);
				commandCallback(result);
			}
		}
	});
}, 1);

const sendCommand = (command, commandData, commandCallback, retries) => {
	console.log('Sending command [ ', command, ' ] [ ', commandData, ']');
	requestsQueue.push({
		command, commandData, commandCallback, retries
	});
};

const parseResponse = (body) => {
	const parts = body.match(/(\w+)\s+(\w+)\s+((OK|NG)(\w+))/);

	if (!parts || parts.length < 3) {
		console.log('Failed to match: ' + body);
		return {
			success: false,
			status: '0',
			data: ''
		};
	}
	return {
		command: parts[1],
		success: parts[4] === 'OK',
		tvID: parts[2],
		status: parts[4],
		data: parts[5],
	}
};

// https://static.bhphotovideo.com/lit_files/332136.pdf

const getPowerStatus = (cb) => {
	sendCommand('ka', 'ff', cb);
};

const setPowerState = (powerState, cb) => {
	sendCommand('ka', (powerState ? 1 : 0), cb);
};

const getVolumeLevel = (cb) => {
	sendCommand('kf', 'ff', (data) => {
		const volumeInDec = parseInt(data.data, 16);
		if (typeof cb === 'function') {
			console.log('volume back');
			cb(volumeInDec);
		}
	});
};

const setVolumeLevel = (level, cb) => {
	const volumeInHex = level.toString(16);
	console.log('Sending volume: ', volumeInHex);
	sendCommand('kf', volumeInHex, cb);
};

const inputSourceMappingTable = {
	'HDMI1': '90',
	'HDMI2': '91',
	'HDMI3': '92',
	'HDMI4': '92',
	'DTV': '00',
};

const getInputSource = (cb) => {
	sendCommand('xb', 'ff', (data) => {
		const inputInReadableForm = findKey(inputSourceMappingTable, val => val === data.data);
		if (typeof cb === 'function') {
			cb(inputInReadableForm);
		}
	});
};


// TODO this isn't working right, not using the cache
const inputSourceMemory = memoize({ timeout: 100 });
const getInputSourceCached = (cb) => {
	if (inputSourceMemory('source')) {
		console.log('------------ GOT cache: ', inputSourceMemory('source'));
		cb(inputSourceMemory('source'));
	}
	else {
		getInputSource((source) => {
			console.log('------------ setting cache: ', source);
			inputSourceMemory('source', source);
			cb(source);
		});
	}
};

const getAllInputSources = () => {
	return Object.keys(inputSourceMappingTable);
};

const setInputSource = (source, cb) => {
	const tvInputSource = inputSourceMappingTable[source.toUpperCase()];
	sendCommand('xb', tvInputSource, cb);
};

module.exports = {
	getPowerStatus,
	setPowerState,
	getVolumeLevel,
	setVolumeLevel,
	getInputSource,
	getInputSourceCached,
	setInputSource,
	getAllInputSources,
};
