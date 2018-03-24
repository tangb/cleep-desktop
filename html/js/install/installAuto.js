var Cleep = angular.module('Cleep');
const {dialog} = require('electron').remote;
var path = require('path');

/**
 * Auto install controller
 */
var autoInstallController = function($rootScope, $scope, cleepService, $timeout, toast, confirm, $filter, logger, updateService)
{
    var self = this;
    self.status = {
        percent: 0,
        total_percent: 0,
        status: 0,
        eta: ''
    };
    self.flashing = false;
    self.refreshingIsos = false;
    self.drives = [];
    self.selectedDrive = null;
    self.isos = [];
    self.selectedIso = null;
    self.noCleepIso = true;
    self.noRaspbianIso = true;
    self.isoraspbian = false
    self.isolocal = false
    self.noDrive = true;
    self.localIso = {
        url: null,
        label: 'Select file'
    };
    self.wifiNetworks = [];
    self.noWifiNetwork = false;
    self.noWifiAdapter = false;
    self.wifiPassword = null;
    self.selectedWifiNetwork = {
        network: null,
        interface: null,
        encryption: null,
        signallevel: 0
    };
    self.wifiNetworkName = '';
    self.wifiNetworkEncryption = 'wpa2';
    self.disableCancel = true;

    //return current flash status
    self.getStatus = function(init)
    {
        return cleepService.sendCommand('getflashstatus')
            .then(function(resp) {
                self.status = resp.data;
            });
    };

    //Return etcher availability
    self.isEtcherAvailable = function()
    {
        return updateService.isEtcherAvailable();
    }

    //get wifi networks
    self.refreshWifiNetworks = function()
    {
        return cleepService.sendCommand('getwifinetworks')
            .then(function(resp) {
                self.wifiNetworks = resp.data.networks;
                self.noWifiNetwork = (resp.data.networks.length===0 ? true : false);
            });
    };

    //get wifi adapter
    self.getWifiAdapter = function()
    {
        return cleepService.sendCommand('getwifiadapter')
            .then(function(resp) {
                self.noWifiAdapter = !resp.data.adapter;
            });
    };

    //get flashable drives
    self.refreshDrives = function()
    {
        return cleepService.sendCommand('getflashdrives')
            .then(function(resp) {
                self.drives = resp.data;
                self.noDrive = self.drives.length===0;
            });
    };

    //get isos
    self.refreshIsos = function()
    {
        self.refreshingIsos = true;
        return cleepService.sendCommand('getisos')
            .then(function(resp) {
                self.isos = resp.data.isos;
                self.noCleepIso = resp.data.cleepisos===0;
                self.noRaspbianIso = resp.data.raspbianisos===0;
                self.isoraspbian = resp.data.withraspbianiso;
                self.isolocal = resp.data.withlocaliso;
                
                //append new item for local iso
                if( self.isolocal )
                {
                    //select file entry
                    self.isos.push({
                        category: 'local',
                        label: 'Select file',
                        sha1: null,
                        timestamp: 0,
                        url: null,
                        selector: true
                    });

                    //selected file entry
                    var url = null;
                    var label = '-- no file selected --';
                    if( self.localIso.url ) {
                        url = self.localIso.url;
                        label = self.localIso.label;
                    }
                    self.isos.push({
                        category: 'local',
                        label: label,
                        sha1: null,
                        timestamp: 0,
                        url: url,
                        selector: false
                    });
                }

                //append item id to allow easier selection
                var id = 0;
                for( id=0; id<self.isos.length; id++ )
                {
                    self.isos[id].id = id;
                }
            })
            .finally(function() {
                self.refreshingIsos = false;
            });
    };

    //select local iso
    self.selectLocalIso = function(item)
    {
        if( !item.selector )
        {
            return;
        }

        var options = {
            title: 'Select local iso',
            filters: [
                {name: 'Iso file', extensions: ['zip', 'iso', 'img', 'dmg', 'raw']}
            ]
        };
        dialog.showOpenDialog(options, function(filenames) {
            if( filenames===undefined )
            {
                //no file selected
                self.selectedIso = null;
                return;
            }

            //save selected file infos
            self.localIso.url = 'file://' + filenames[0];
            self.localIso.label = path.parse(filenames[0]).base;
            selectedIso = null;
            for( var i=0; i<self.isos.length; i++ )
            {
                if( self.isos[i].category==='local' && self.isos[i].selector===false )
                {
                    self.isos[i].url = self.localIso.url;
                    self.isos[i].label = self.localIso.label;
                    selectedIso = self.isos[i];
                    break;
                }
            }

            //and select entry in md-select
            $timeout(function() {
                self.selectedIso = selectedIso;
            }, 250);

        }); 
    };

    //start flash process
    self.startFlash = function()
    {
        //check values
        if( !self.selectedIso || !self.selectedDrive )
        {
            toast.error('Please select a Cleep version and a drive');
            return;
        }
        if( self.noWifiAdapter && self.wifiNetworkName && self.wifiNetworkEncryption!='unsecured' && !self.wifiPassword )
        {
            toast.error('Please specify wifi password');
            return;
        }
        if( !self.noWifiAdapter && self.selectedWifiNetwork.network && self.selectedWifiNetwork.encryption!='unsecured' && !self.wifiPassword )
        {
            toast.error('Please specify wifi password');
            return;
        }

        //wifi config
        wifiConfig = {
            network: null,
            encryption: null,
            password: null
        }
        if( self.noWifiAdapter && self.wifiNetworkName && self.wifiNetworkEncryption )
        {
            //fill wifi config from manual values
            wifiConfig.network = self.wifiNetworkName;
            wifiConfig.encryption = self.wifiNetworkEncryption;
            wifiConfig.password = self.wifiPassword;
        }
        else if( !self.noWifiAdapter && self.selectedWifiNetwork.network )
        {
            //fill wifi config from automatic values
            wifiConfig.network = self.selectedWifiNetwork.network;
            wifiConfig.encryption = self.selectedWifiNetwork.encryption;
            wifiConfig.password = self.wifiPassword;
        }
        logger.debug('url=' + self.selectedIso.url);
        logger.debug('drive=' + self.selectedDrive);
        logger.debug('wifi=' + JSON.stringify(wifiConfig));
        
        confirm.open('Confirm installation?', 'Installation will erase all drive content. This operation cannot be reversed!<br/>Please note that admin permissions may be requested after file download.', 'Yes, install', 'No')
            .then(function() {
                self.flashing = true;
                var data = {
                    url: self.selectedIso.url,
                    drive: self.selectedDrive,
                    wifi: {
                        network: wifiConfig.network,
                        password: wifiConfig.password,
                        encryption: wifiConfig.encryption
                    }
                };
                logger.debug('Flash data:', data);
                cleepService.sendCommand('startflash', data)
                    .then(function() {
                        toast.info('Installation started');
                    }, function(err) {
                        //no toast here, if error occured with command, it should return an exception that is catched
                        //and toasted by cleepService
                        self.flashing = false;
                    });
            });
    };

    //cancel flash process
    self.cancelFlash = function()
    {
        //check if process is running
        if( self.status && self.status.status>=5 )
        {
            self.logger.debug('CancelFlash: invalid status (' + self.status.status + ') do nothing');
            return;
        }

        if( self.status && (self.status.status===1 || self.status.status===2) )
        {
            confirm.open('Cancel installation?', null, 'Yes', 'No')
                .then(function() {
                    cleepService.sendCommand('cancelflash')
                        .then(function() {
                            toast.info('Installation canceled');
                        });
                });
        }
        else if( self.status && (self.status.status===3 || self.status.status===4) )
        {
            confirm.open('Cancel installation?', 'Canceling installation during this step of process makes your removable media unusable until next installation.', 'Yes, cancel', 'No, continue')
                .then(function() {
                    cleepService.sendCommand('cancelflash')
                        .then(function() {
                            toast.info('Installation canceled');
                        });
                });
        }
        else
        {
            logger.debug('Nothing to do with status (' + self.status.status + ')'); 
        }
    };

    //initialize
    self.init = function()
    {
        //get flash status
        self.getStatus();
        //get wifi networks
        self.getWifiAdapter();
    };

    //flash update recevied
    $rootScope.$on('flash', function(event, data) {
        if( !data )
            return;

        //save status
        self.status = data;

        //enable flash button
        if( self.status.status==0 || self.status.status>=5 )
        {
            self.flashing = false;
        }
        else
        {
            self.flashing = true;
        }

        //disable cancel button when really flashing sdcard
        //no way to cancel process because launched with root privileges while
        //CleepDesktop is running only with user ones
        if( self.status.status==1 || self.status.status==2 )
        {
            self.disableCancel = false;
        }
        else
        {
            self.disableCancel = true;
        }

    });

    //init controller
    self.init();

};

Cleep.controller('autoInstallController', ['$rootScope', '$scope', 'cleepService', '$timeout', 'toastService', 'confirmService', '$filter', 'logger', 
                                            'updateService', autoInstallController]);


