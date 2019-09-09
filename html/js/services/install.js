/**
 * Install service handles data useful to install module
 */
var installService = function($rootScope, logger, cleepService)
{
    var self = this;
    self.status = {
        percent: 0,
        total_percent: 0,
        status: 0,
        eta: ''
    };
    self.isos = {
        isos: [],
        cleepisos: 0,
        raspbianisos: 0,
        withraspbianisos: false,
        withlocalisos: false
    };
    self.drives = [];
    self.wifi = {
        networks: [],
        adapter: false
    }
    //save flash config in service for data persistence
    self.flashConfig = {
        drive: null,
        iso: null,
        wifiChoice: 0,
        wifi: null
    };

    /**
     * Return current install status
     */
    self.getStatus = function()
    {
        return cleepService.sendCommand('get_status', 'install')
            .then(function(resp) {
                self.status = resp.data;
            });
    };

    /**
     * Return wifi adapter infos
     */
    self.refreshWifiAdapter = function()
    {
        return cleepService.sendCommand('get_wifi_adapter', 'install')
            .then(function(resp) {
                self.wifi.adapter = resp.data.adapter;
            });
    };

    /**
     * Refresh available wifi networks
     */
    self.refreshWifiNetworks = function()
    {
        return cleepService.sendCommand('get_wifi_networks', 'install')
            .then(function(resp) {
                self.wifi.networks = resp.data.networks;
            });
    };

    /**
     * Refresh list of available drives
     */
    self.refreshDrives = function()
    {
        return cleepService.sendCommand('get_flashable_drives', 'install')
            .then(function(resp) {
                //clear existing drives
                self.drives.splice(0, self.drives.length);

                //fill with new values
                for( var i=0; i<resp.data.length; i++)
                {
                    self.drives.push(resp.data[i]);
                }
            });
    };

    /**
     * Refresh isos list
     */
    self.refreshIsos = function()
    {
        return cleepService.sendCommand('get_isos', 'install')
            .then(function(resp) {
                self.isos.isos = resp.data.isos;
                self.isos.cleepisos = resp.data.cleepisos;
                self.isos.raspbianisos = resp.data.raspbianisos;
                self.isos.withraspbianisos = resp.data.withraspbianisos;
                self.isos.withlocalisos = resp.data.withlocalisos;
            });
    };

    /**
     * Start flash
     * @data: flash data (drive, iso, wifi...)
     */
    self.startFlash = function(data)
    {
        return cleepService.sendCommand('start_flash', 'install', data);
    };

    /**
     * Cancel flash
     */
    self.cancelFlash = function()
    {
        return cleepService.sendCommand('cancel_flash', 'install')
            .then(function() {
                toast.info('Installation canceled');
            });
    };

    /**
     * Init service values
     */
    self.init = function()
    {
        //refresh all internal values
        self.refreshWifiAdapter();
        self.refreshWifiNetworks();
        //do not refresh isos at startup to reduce number of request on github.com (limited to few requests per day per ip)
        //self.refreshIsos();
        self.refreshDrives();
    };

    /**
     * Handle config changed to update internal values automatically
     */
    $rootScope.$on('configchanged', function(config) {
        logger.debug('Configuration changed, refresh install service values');
        self.init();
    });

};

var Cleep = angular.module('Cleep');
Cleep.service('installService', ['$rootScope', 'logger', 'cleepService', installService]);
