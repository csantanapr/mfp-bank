angular.module('starter.services')

.factory('Camera', function ($q) {

  return {
    'getPicture': function (options) {
      var defer = $q.defer();
      
      	options = options || {};
      	options.destinationType = options.destinationType || Camera.DestinationType.DATA_URL;
        options.quality = options.quality || 30;
        options.saveToPhotoAlbum = options.saveToPhotoAlbum || false;
        options.targetWidth = options.targetWidth || 100;
        options.targetHeight = options.targetHeight || 100;
 
      navigator.camera.getPicture(function (result) {
        // Do any magic you need
        defer.resolve("data:image/jpeg;base64,"+result);
      }, function (err) {
          defer.reject(err);
        }, options);

      return defer.promise;
    }
  };

});