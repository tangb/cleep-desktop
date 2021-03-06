var rpcService = function($http, $q, $rootScope, $location, toast) {

    var self = this;
    self.devicesWs = null;

    //get port from url
    var urlValues = $location.search();
    self.port = 5610;
    if( urlValues && urlValues.port )
    {
        self.port = urlValues.port;
    }
    
    //configure url
    self.uriCommand = window.location.protocol + '//localhost:' + self.port + '/command';
    self.uriUi = window.location.protocol + '//localhost:' + self.port + '/ui';
    self.uriConfig = window.location.protocol + '//localhost:' + self.port + '/config';
    self.uriBack = window.location.protocol + '//localhost:' + self.port + '/back';
    self.uriDevices = window.location.protocol + '//localhost:' + self.port + '/devices';

    /**
     * Base function to send data to rpcserver
     */
    self.send = function(url, command, params, method) {
        var d = $q.defer();

        //prepare method
        if( !method )
        {
            method = 'POST';
        }

        //prepare data
        if( params===undefined || params===null )
        {
            params = {};
        }
        var data = {
            command: command,
            params: params
        };

		$http({
            method: method,
            url: url,
            data: data,
            responseType:'json'
        })
        .then(function(resp) {
            if( resp && resp.data && resp.data.error!==undefined && resp.data.error!==null && resp.data.error==true )
            {
                toast.error(resp.data.message);
                d.reject(resp.data.message);
            }
            else
            {
                d.resolve(resp.data);
            }
        }, function(err) {
            console.error('Request failed: '+err);
            d.reject(err.statusText);
        });

        return d.promise;
    };

    /**
     * Send command to rpcserver
     */
    self.sendCommand = function(command, params) {
        return self.send(self.uriCommand, command, params);
    };

    /**
     * Send command to ui
     */
    self.sendUi = function(command, params) {
        return self.send(self.uriUi, command, params);
    };

    /**
     * Get CleepDesktop config
     */
    self.getConfig = function() {
        return self.send(self.uriConfig);
    };

    /**
     * Set CleepDesktop config
     */
    self.setConfig = function(config) {
        return self.send(self.uriConfig, null, {config:config}, 'PUT');
    };

    /**
     * Go back in history. Works only once
     */
    self.back = function() {
        return self.send(self.uriBack);
    };

    /**
     * Get devices
     */
    self.getDevices = function() {
        return self.send(self.uriDevices);
    };

    /**
     * Start devices websocket
     */
    self.devicesWebSocket = function(receive_callback) {
        if( !self.devicesWs )
        {
            self.devicesWs = new WebSocket('ws://localhost:'+self.port+'/devicesws');
            //define receive callback
            self.devicesWs.onmessage = function(event) {
                if( event && typeof(event.data)==='string' )
                {
                    var data = JSON.parse(event.data);
                    receive_callback(data);
                }
            };
        }

    };

};

var Cleep = angular.module('Cleep');
Cleep.service('rpcService', ['$http', '$q', '$rootScope', '$location', 'toastService', rpcService]);

