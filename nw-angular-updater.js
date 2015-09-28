(function() {
  var GUI, UpdateService, UpdateServiceProvider, child_process, fs, http, path;

  GUI = require('nw.gui');

  fs = require('fs');

  http = require('https');

  path = require('path');

  child_process = require('child_process');

  UpdateService = (function() {
    var __DIR;

    __DIR = path.dirname(process.execPath);

    function UpdateService(q1, http1, arg, auto) {
      this.q = q1;
      this.http = http1;
      this.infoUrl = arg.infoUrl, this.downloadUrl = arg.downloadUrl, this.filename = arg.filename, this.currentVersion = arg.currentVersion;
      this.auto = auto != null ? auto : true;
      if (!this.infoUrl || !this.downloadUrl || !this.filename || !this.currentVersion) {
        throw new Error('Not Configured');
      }
      if (this.auto) {
        this.checkAndUpdate();
      } else {
        this.check;
      }
    }

    UpdateService.prototype.check = function() {
      var deferred;
      deferred = this.q.defer();
      this.updateRequired = false;
      this.checking = true;
      this.http.get(this.infoUrl).success((function(_this) {
        return function(data) {
          _this.checking = false;
          //_this.updateRequired = data.version > _this.currentVersion;
          _this.latestVersion = _this.currentVersion;
          var latestVersion = data.version.split(".");
          var currentVersion = _this.currentVersion.split(".");
          for (var i = 0; i < latestVersion.length; i++) {
            if (!currentVersion[i]) {
              currentVersion[i] = "0";
            }
            if (latestVersion[i] > currentVersion[i]) {
              _this.updateRequired = true;
              _this.latestVersion = data.version;
              break;
            }
          }
          return deferred.resolve(_this.updateRequired);
        };
      })(this));
      return deferred.promise;
    };

    UpdateService.prototype.download = function() {
      var deferred, file;
      deferred = this.q.defer();
      this.downloading = true;
      file = fs.createWriteStream(path.join(__DIR, this.filename + ".download"));
      http.get(this.downloadUrl, (function(_this) {
        return function(response) {
          response.pipe(file);
          return response.on('end', function() {
            _this.downloading = false;
            _this.restartRequired = true;
            return deferred.resolve(true);
          });
        };
      })(this)).on('error', function(err) {
        this.downloading = false;
        this.restartRequired = false;
        return deferred.reject(err);
      });
      return deferred.promise;
    };

    UpdateService.prototype.unlink = function() {
      var deferred;
      deferred = this.q.defer();
      fs.unlink(path.join(__DIR, this.filename), function(err) {
        if (err) {
          return deferred.reject(err);
        } else {
          return deferred.resolve(true);
        }
      });
      return deferred.promise;
    };

    UpdateService.prototype.rename = function() {
      var deferred;
      deferred = this.q.defer();
      fs.rename(path.join(__DIR, this.filename + ".download"), path.join(__DIR, this.filename), function(err) {
        if (err) {
          return deferred.reject(err);
        } else {
          return deferred.resolve(true);
        }
      });
      return deferred.promise;
    };

    UpdateService.prototype.checkAndUpdate = function() {
      return this.check().then((function(_this) {
        return function() {
          if (!_this.updateRequired) {
            return _this.q.reject();
          }
        };
      })(this)).then((function(_this) {
        return function() {
          return _this.download();
        };
      })(this)).then((function(_this) {
        return function() {
          return _this.unlink();
        };
      })(this)).then((function(_this) {
        return function() {
          return _this.rename();
        };
      })(this))["catch"]((function(_this) {
        return function(err) {
          console.log('error', err);
          return _this.checking = _this.downloading = _this.restartRequired = false;
        };
      })(this));
    };

    UpdateService.prototype.restart = function() {
      var child;
      child = child_process.spawn(process.execPath, [], {
        detached: true
      });
      child.unref();
      return GUI.App.quit();
    };

    return UpdateService;

  })();

  UpdateServiceProvider = (function() {
    function UpdateServiceProvider() {}

    UpdateServiceProvider.prototype.setInfoUrl = function(infoUrl) {
      this.infoUrl = infoUrl;
      return this;
    };

    UpdateServiceProvider.prototype.setDownloadUrl = function(downloadUrl) {
      this.downloadUrl = downloadUrl;
      return this;
    };

    UpdateServiceProvider.prototype.setFilename = function(filename) {
      this.filename = filename;
      return this;
    };

    UpdateServiceProvider.prototype.setCurrentVersion = function(currentVersion) {
      this.currentVersion = currentVersion;
      return this;
    };

    UpdateServiceProvider.prototype.setAuto = function(auto) {
      this.auto = auto;
      return this;
    };

    UpdateServiceProvider.prototype.$get = [
      '$q', '$http', function(q, http) {
        return new UpdateService(q, http, {
          infoUrl: this.infoUrl,
          downloadUrl: this.downloadUrl,
          filename: this.filename,
          currentVersion: this.currentVersion
        }, this.auto);
      }
    ];

    return UpdateServiceProvider;

  })();

  angular.module('nwUpdater', []).provider('nwUpdate', UpdateServiceProvider);

}).call(this);
