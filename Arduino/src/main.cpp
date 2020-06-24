#include <Arduino.h>

#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>
#include <WiFiUdp.h>
#include <ArduinoOTA.h>
#include <ESP8266WebServer.h>

const char* ssid = "......";
const char* password = "......";

String responseString = "";        // Serial response data
boolean responseComplete = false;  // Serial response complete

ESP8266WebServer server( 80 );

// Basic Auth username/password
const char* www_username = "admin";
const char* www_password = "esp8266";

void sendSerialCommand( String command, String data ) {
    responseComplete = false;
    responseString = "";
    String commandString = command + " 01 " + data + "\r";
    Serial.print( commandString );
}

void getSerialResponse() {
    while ( Serial.available() ) {
        delay( 1 );
        char inChar = Serial.read();
        if ( inChar < 32 || inChar > 126 || inChar == '\n' || inChar == '\r' || inChar == 'x' ) {
            responseComplete = true;
        } else {
            responseString += inChar;
        }
    }
}

void setup() {
    // LG TV supports either 9600 or 115200, but in my case it only worked on 115200
    Serial.begin( 115200 );

    // Swap to alternative Rx/Tx pins
    Serial.swap();
    
    WiFi.mode( WIFI_STA );
    WiFi.begin( ssid, password );
    while ( WiFi.waitForConnectResult() != WL_CONNECTED ) {
        delay( 1000 );
        ESP.restart();
    }

    ArduinoOTA.onStart( []() {} );
    ArduinoOTA.onEnd( []() {} );
    ArduinoOTA.onProgress( []( unsigned int progress, unsigned int total ) {} );
    ArduinoOTA.onError( []( ota_error_t error ) {} );
    ArduinoOTA.begin();
    
    // Reserve memory for the response string
    responseString.reserve( 256 );

    server.on( "/", [](){
        if ( ! server.authenticate( www_username, www_password ) ) {
            return server.requestAuthentication();
        }
        server.send( 200, "text/plain", "LG TV Remote Control" );
    });
    
    server.on( "/lgtvrc", [](){
        if( ! server.authenticate( www_username, www_password )) {
            return server.requestAuthentication();
        }

        if ( server.args() != 2 ) {
            server.send( 500, "text/plain", "Wrong number of arguments" );
            return;
        }

        String command = "";
        String commandData = "";

        for ( uint8_t i = 0; i < server.args(); i++ ) {
            if ( server.argName ( i ) == "command" ) {
                command = server.arg ( i );
            }
            else if ( server.argName ( i ) == "commandData" ) {
                commandData = server.arg ( i );
            }
        }   
        
        sendSerialCommand( command, commandData );
        long startMillis = millis();
        while ( ! responseComplete && ( millis() - startMillis < 10000 ) )  {
            yield();
            getSerialResponse();
        }

        server.send( 200, "text/plain", responseString );
    });

    server.begin();
}

void loop() {
    ArduinoOTA.handle();
    server.handleClient();
}
