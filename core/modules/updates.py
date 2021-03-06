#!/usr/bin/env python
# -*- coding: utf-8 -*

import logging
from threading import Thread
import time
import os
import platform
import json
import datetime
from distutils.dir_util import copy_tree
from core.libs.download import Download
from core.libs.console import Console
from core.libs.github import Github
from core.utils import CleepDesktopModule
from core.modules.install import Install


class UpdateInfos():
    """
    Update structure
    """

    def __init__(self):
        self.update_available = False
        self.error = False
        self.filename = None
        self.url = None
        self.version = None
        self.size = 0

    def __str__(self):
        return 'UpdateInfos {update_available=%s error=%s filename=%s url=%s version=%s size=%d}' % (self.update_available, self.error, self.filename, self.url, self.version, self.size)


class Updates(CleepDesktopModule):
    """
    Updates manager: it can update balena-cli and CleepDesktop files
    """

    ETCHER_REPO = {
        'owner': 'tangb',
        'repo': 'etcher-cli'
    }

    INSTALL_ETCHER_COMMAND_LINUX = '%s/tools/install-etcher.linux.sh "%s" "%s" "%s"'
    INSTALL_ETCHER_COMMAND_WINDOWS = '%s\\tools\\install-etcher.windows.bat "%s" "%s" "%s"'
    INSTALL_ETCHER_COMMAND_MAC = '%s/tools/install-etcher.mac.sh "%s" "%s" "%s"'

    STATUS_IDLE = 0
    STATUS_DOWNLOADING = 1
    STATUS_INSTALLING = 2
    STATUS_DONE = 3
    STATUS_ERROR = 4

    #ETCHER_VERSION_FORCED = "v1.2.0"
    ETCHER_VERSION_FORCED = None

    def __init__(self, context, debug_enabled):
        """
        Constructor

        Args:
            context (AppContext): application context
            debug_enabled (bool): True if debug is enabled
        """
        CleepDesktopModule.__init__(self, context, debug_enabled)

        #members
        self.__download_etcher = None
        self.__current_download = None
        self.etcher_status = self.STATUS_IDLE
        self.etcher_download_status = Download.STATUS_IDLE
        self.etcher_download_percent = 0
        self.last_check = 0
        
        #running env
        self.env = platform.system().lower()

        self.last_update = 0

    def _custom_stop(self):
        """
        Stop process
        """
        self.logger.debug('Stop update')
        self.cancel_download()

    def cancel_download(self):
        """
        Cancel current download
        """
        self.logger.debug('Cancel download')
        #reset update flags
        self.__download_etcher = None

        #and cancel current download
        if self.__current_download:
            self.__current_download.cancel()

    def get_status(self):
        """
        Return current update status

        Returns:
            dict: current update status informations::
                {
                    etcherstatus (dict): etcher update status ::
                        {
                            version (int),
                            status (int),
                            downloadstatus (int),
                            downloadpercent (int)
                        }
                    lastcheck (int): timestamp of last check
                }
        """
        config = self.context.config.get_config()
        return {
            'etcherstatus': {
                'version': config['config']['etcher']['version'],
                'status': self.etcher_status,
                'downloadstatus': self.etcher_download_status,
                'downloadpercent': self.etcher_download_percent
            },
            'lastcheck': self.last_check
        }

    def __download_callback(self, status, size, percent):
        """
        Download callback

        Args:
            status (int): status from Download class
            size (int): current downloaded bytes
            percent (int): current progress
        """
        #save download status
        if self.etcher_status==self.STATUS_DOWNLOADING:
            self.etcher_download_status = status
            self.etcher_download_percent = percent
        
        #update ui
        self.context.update_ui('updates', self.get_status())

    def run(self):
        """
        Start update process. Does nothing until check_updates is called and trigger update if necessary
        """
        self.logger.debug('Updates thread started')

        #copy cmdlogger to config folder
        self.__copy_cmdlogger()

        #endless loop
        while self.running:

            if self.__download_etcher:
                try:
                    self.logger.info('Downloading Etcher archive %s (%s)' % (self.__download_etcher.filename, self.__download_etcher.url))
                    #update etcher status
                    self.etcher_status = self.STATUS_DOWNLOADING
                    #new etcher update available
                    self.__current_download = Download(None, self.__download_callback)
                    #download it with no checksum (call is blocking)
                    filepath = self.__current_download.download_from_url(self.__download_etcher.url)
                    #end of dowload, trigger callback and reset member
                    self.__current_download = None
                    #update etcher status
                    if self.etcher_download_status==Download.STATUS_DONE:
                        self.etcher_status = self.STATUS_INSTALLING
                    else:
                        self.etcher_status = self.STATUS_ERROR
                    self.context.update_ui('updates', self.get_status())

                    if filepath:
                        self.logger.debug('Etcher archive downloaded')
                        #process downloaded archive
                        if not self.__update_etcher(filepath):
                            self.etcher_status = self.STATUS_ERROR
                            self.logger.error('Etcher installation failed')
                        else:
                            self.etcher_status = self.STATUS_DONE
                            self.context.config.set_config_value('etcher.version', self.__download_etcher.version)
                            self.logger.info('Etcher installation succeed (installed version is now %s)' % self.__download_etcher.version)

                        self.context.update_ui('updates', self.get_status())

                    else:
                        #error downloading etcher archive
                        self.logger.error('Failed to download Etcher archive.')
                        self.etcher_status = self.STATUS_ERROR
                        self.context.update_ui('updates', self.get_status())

                except:
                    #exception during update
                    self.logger.exception('Exception during balena-cli update:')
                    self.etcher_status = self.STATUS_ERROR
                    self.context.update_ui('updates', self.get_status())

                finally:
                    #end of etcher update process, reset variables
                    self.__download_etcher = None

            #release CPU
            time.sleep(1.0)

        self.logger.debug('Updates thread stopped')

    def __copy_cmdlogger(self):
        """
        Workaround for this issue on linux only (AppImage) https://github.com/AppImage/AppImageKit/issues/146
        Fastest way is to copy full cmdlogger folder to CleepDesktop directory like etcher
        """
        #check OS
        if self.env!='linux':
            #problem appears only under linux with AppImage
            return

        #always perform a copy to make sure last version is copied
        try:
            #prepare paths
            src = os.path.join(self.context.paths.app, 'tools', 'cmdlogger-linux')
            dst = os.path.join(self.context.paths.config, 'cmdlogger-linux')

            #make sure dirs exist
            os.makedirs(dst, exist_ok=True)

            #copy full cmdlogger folder content
            copy_tree(src, dst)

        except:
            self.logger.exception('Unable to copy cmdlogger from "%s" to "%s"' % (src, dst))

    def __get_etcher_version_infos(self, assets):
        """
        Search for file to download for current user environment

        Args:
            asset (dict): release assets

        Returns:
            tuple (string, string, int): release filename, release url (ready to download) and filesize (in bytes)
        """
        #get environment and architecture
        pattern = None
        if self.env=='linux':
            pattern = 'linux-x64'
        elif self.env=='darwin':
            pattern = 'macos-x64'
        elif self.env=='windows':
            pattern = 'windows-x64'
        self.logger.debug('Search release using pattern: %s' % pattern)

        #search for release
        for asset in assets:
            if 'browser_download_url' and 'size' and 'name' in asset.keys():
                name = asset['name'].lower()
                if name.find('balena-cli')>=0 and name.find(pattern)>=0:
                    #version found, return infos
                    self.logger.debug('Found release: %s' % asset)
                    return asset['name'], asset['browser_download_url'], asset['size']

        #nothing found
        raise Exception('No release info found')

    def __check_etcher_updates(self, etcher_version):
        """
        Check if etcher updates are available

        Args:
            etcher_version (string): current installed etcher version

        Returns:
            UpdateInfos: UpdateInfos instance
        """
        infos = UpdateInfos()
        github = Github(self.ETCHER_REPO['owner'], self.ETCHER_REPO['repo'])

        #balena-cli path for test it is installed
        if self.env=='linux':
            balenacli_script_path = Install.FLASH_LINUX
        elif self.env=='darwin':
            balenacli_script_path = Install.FLASH_MAC
        elif self.env=='windows':
            balenacli_script_path = Install.FLASH_WINDOWS

        #handle forced version
        if self.ETCHER_VERSION_FORCED is not None and self.ETCHER_VERSION_FORCED!=etcher_version:
            #force balena-cli installation to specific version
            self.logger.debug('Force balena-cli installation (forced version=%s, installed version=%s)' % (self.ETCHER_VERSION_FORCED, etcher_version))

            try:
                #get forced release
                release = github.get_release(self.ETCHER_VERSION_FORCED)

                #get download url
                (infos.filename, infos.url, infos.size) = self.__get_etcher_version_infos(release['assets'])
                infos.version = self.ETCHER_VERSION_FORCED
                infos.update_available = True

            except:
                self.logger.exception('Forced balena-cli release not found:')

            return infos

        elif self.ETCHER_VERSION_FORCED is not None:
            #forced version already installed, stop statement
            return infos

        #handle latest release
        try:
            latest = github.get_latest_release()

            if latest is None:
                #probably unable to join github (no internet connection?)
                self.logger.warning('Unable to check etcher updates (no internet connection?)')

            elif not os.path.exists(os.path.join(self.context.paths.config, 'balena-cli')) or not os.path.exists(os.path.join(self.context.paths.config, balenacli_script_path)):
                #balena-cli is not installed
                self.logger.debug('No balena-cli found. Installation is necessary')
                infos.version = latest['tag_name']
                infos.update_available = True
                (infos.filename, infos.url, infos.size) = self.__get_etcher_version_infos(latest['assets'])

            elif latest['tag_name']>etcher_version:
                #new version available, find cli version for current user platform
                self.logger.debug('Update available (online version=%s, installed version=%s)' % (latest['tag_name'], etcher_version))
                infos.version = latest['tag_name']
                infos.update_available = True
                (infos.filename, infos.url, infos.size) = self.__get_etcher_version_infos(latest['assets'])

            else:
                self.logger.debug('No new balena-etcher version available')

        except:
            self.logger.exception('Latest balena-cli release not found:')
            infos.error = True

        return infos

    def check_updates(self):
        """
        Check for available updates

        Returns:
            dict: check output::
                {
                    updateavailable (bool): True if update is available
                    lastcheck (int): timestamp of last check
                }
        """
        #update last check timestamp and versions
        self.last_check = int(time.time())

        #check etcher
        config = self.context.config.get_config()
        infos = self.__check_etcher_updates(config['config']['etcher']['version'])
        self.logger.debug('Check balena-cli version: %s' % infos)
        if infos.update_available and not infos.error:
            #set member to trigger download in run function
            self.__download_etcher = infos

        #prepare output
        update_available = False
        if self.__download_etcher is not None:
            update_available = True

        return {
            'updateavailable': update_available,
            'lastcheck': self.last_check
        }

    def __update_etcher(self, archive_path):
        """
        Update balena-cli software

        Args:
            archive_path (string): etcher archive file path

        Returns:
            bool: True if install succeed, False otherwise
        """
        #prepare command
        command = None
        if self.env=='linux':
            command = self.INSTALL_ETCHER_COMMAND_LINUX % (self.context.paths.app, archive_path, self.context.paths.app, self.context.paths.config)
        elif self.env=='darwin':
            command = self.INSTALL_ETCHER_COMMAND_MAC % (self.context.paths.app, archive_path, self.context.paths.app, self.context.paths.config)
        elif self.env=='windows':
            command = self.INSTALL_ETCHER_COMMAND_WINDOWS % (self.context.paths.app, archive_path, self.context.paths.app, self.context.paths.config)
        self.logger.debug('Command executed to install balena-cli: %s' % command)

        #execute command
        c = Console()
        resp = c.command(command, 20.0)
        if resp['error'] or resp['killed']:
            self.logger.error('Unable to install balena-cli: stdout: %s' % resp)
            return False

        return True
