var Cleep = angular.module('Cleep')

/**
 * Devices controller
 */
var devicesController = function($rootScope, $scope, $timeout, cleepService, $state)
{
    var self = this;
    self.unconfigured = 0;
    self.configured = 0;
    self.loading = true;
    self.devices = [];

    //synchronize devices updating existing devices and adding new ones to avoir ui flickering
    self.syncDevices = function(devices)
    {
        if( devices )
        {
            var found = false;
            for( var i=0; i<devices.length; i++ )
            {
                found = false;
                for( var j=0; j<self.devices.length; j++ )
                {
                    if( self.devices[j].uuid===devices[i].uuid )
                    {
                        //device found
                        found = true;

                        //update device infos
                        self.devices[j].configured = devices[i].configured;
                        self.devices[j].hostname = devices[i].hostname;
                        self.devices[j].ip = devices[i].ip;
                        self.devices[j].online = devices[i].online;
                        self.devices[j].port = devices[i].port;
                        self.devices[j].ssl = devices[i].ssl;
                        self.devices[j].version = devices[i].version;

                        break;
                    }
                }

                //add new device
                if( !found )
                {
                    //save entry
                    self.devices.push(devices[i]);
                }
            }
        }
    };

    //open device page
    self.openDevicePage = function(device)
    {
        if( device && device.online )
        {
            //prepare device url
            var url = device.ip + ':' + device.port;
            if( device.ssl )
                url = 'https://' + url;
            else
                url = 'http://' + url;

            //open device page on right panel
            $state.go('device', {url:url, hostname:device.hostname});
        }
        else if( device && !device.online )
        {
            toast.info('You can\'t connect to offline devices');
        }
    };

    //update devices list
    self.updateDevices = function(data) 
    {
        $timeout(function() {
            //sync devices
            self.syncDevices(data.devices);

            //update some controller members value
            self.unconfigured = data.unconfigured;
            self.configured = self.devices.length - self.unconfigured;
            self.loading = false;
        }, 0);
    };

    //watch for devices event to refresh devices list
    $rootScope.$on('devices', function(event, data)
    {
        self.updateDevices(data);
    });

};
Cleep.controller('devicesController', ['$rootScope', '$scope', '$timeout', 'cleepService', '$state', devicesController]);

