angular.module('starter.services')

.factory('Store', function ($q) {
	  
	var store=[];
	 
	return {
	    'saveData': function(data){
	      store = data;
	      return store;
	    },
	    'getData': function(){
	    	var defer = $q.defer();
	    	defer.resolve(store);
		   return defer.promise;
	    }
	};
});