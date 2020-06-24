const {
	getPowerStatus,
	setPowerState,
	getVolumeLevel,
	setVolumeLevel,
	getInputSource,
	getInputSourceCached,
	setInputSource,
	getAllInputSources,
} = require( './lg-tv-communication' );

let Service;
let Characteristic;


module.exports = function( homebridge ) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory( 'homebridge-lg-tv', 'LGTVRemote', LGTVRemote );
};

function LGTVRemote( log, config ) {
	this.log = log;

	this.name = config.name || 'LG TV Remote';
	// this.baseUrl         = config.base_url;
	//
	// this.username        = config.username         || '';
	// this.password        = config.password         || '';
}

LGTVRemote.prototype = {
	identify: function( callback ) {
		this.log( "Identify requested!" );
		callback();
	},

	test: ( cb ) => {
		console.log( 'Called me ' );
		this.log( 'Called me' );
		cb();
	},

	getServices: () => {
		const services = [];

		const informationService = new Service.AccessoryInformation();

		informationService
			.setCharacteristic( Characteristic.Manufacturer, "Biser Perchinkov" )
			.setCharacteristic( Characteristic.Model, "LGTV Volume" )
			.setCharacteristic( Characteristic.SerialNumber, "LGTV01" )
			.setCharacteristic( Characteristic.FirmwareRevision, "1.0.0" );

		// TODO this is emulating a light bulb, needs to be updated to proper speaker when Home supports it
		const speakerService = new Service.Lightbulb( 'LGTV Volume' );
		speakerService.getCharacteristic( Characteristic.On )
			.on( 'get', ( cb ) => {
				getPowerStatus( ( status ) => {
					cb( undefined, status && status.data && parseInt( status.data, 10 ) === 1 )
				} )
			} )
			.on( 'set', ( state, cb ) => {
				setPowerState( state, getPowerStatus( ( status ) => {
					cb( undefined, status && status.data && parseInt( status.data, 10 ) === 1 )
				} ) );
			} );
		speakerService.addCharacteristic( Characteristic.Brightness )
			.on( 'get', ( cb ) => {
				getVolumeLevel( ( volumeLevel ) => {
					cb( undefined, volumeLevel )
				} );
			} )
			.on( 'set', ( state, cb ) => {
				setVolumeLevel( state, getVolumeLevel( ( volumeLevel ) => {
					cb( undefined, volumeLevel ? volumeLevel : 0 )
				} ) )
			} );

		services.push( informationService );
		services.push( speakerService );


		getAllInputSources().forEach( ( service ) => {
			const switchService = new Service.Switch( 'LG: ' + service, service );
			switchService
				.getCharacteristic( Characteristic.On )
				.on( 'get', ( cb ) => {
					getInputSourceCached( ( source ) => {
						const isServiceOn = source === switchService.subtype;
						if ( typeof cb === 'function' ) {
							cb( undefined, isServiceOn );
						}
					} );
				} )
				.on( 'set', ( state, cb ) => {
					const serviceToSwitch = switchService.subtype;
					setInputSource( serviceToSwitch, () => {
						getInputSource( ( source ) => {
							const isServiceOn = source === switchService.subtype;
							if ( typeof cb === 'function' ) {
								cb( undefined, isServiceOn );
							}
						} );
					} );
				} );

			services.push( switchService );
		} );

		return services;

	}
};
