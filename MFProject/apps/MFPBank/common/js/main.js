function wlCommonInit() {
	if(isMFP()){ 
		WL.Client.connect({onSuccess: connectSuccess, onFailure: connectFailure});
	} else {
		loadAngularApp();
	}
	
}
function connectSuccess() {
	WL.Logger.debug ("Successfully connected to MobileFirst Server.");
	loadAngularApp();
}

function loadAngularApp(){
	//mfp MBS
	if(isMFP()){ setupMBSForIonic();}
	angular.bootstrap(document.body, ['starter']);
}

function setupMBSForIonic(){
	console.log('running setupMBSForIonic');
	var platform;
	if(WL.Client.getEnvironment() === WL.Environment.PREVIEW){
		//running from preview
		if(window.cordova && navigator.device && navigator.device.platform && navigator.device.platform.toLowerCase){
			//running on MBS
			platform = navigator.device.platform.toLowerCase();
		} else {
			//running on Browser
			platform = window.location.href;
		}
		if(platform.indexOf('android')>=0){
			document.body.classList.add('platform-android');
			if(ionic && ionic.Platform){
				ionic.Platform.setPlatform("android");
			}
		}else if (platform.indexOf('iphone')>=0 || platform.indexOf('ipad')>=0){
			document.body.classList.add('platform-ios');
			if(ionic && ionic.Platform){
				ionic.Platform.setPlatform("ios");
			}
		}else if (platform.indexOf('Win32NT')>=0 || platform.indexOf('windowsphone8')>=0){
			document.body.classList.add('windowsphone');
			if(ionic && ionic.Platform){
				ionic.Platform.setPlatform("windowsphone");
			}
		}
	}
	
	if(typeof setupMQA === 'function'){
      setupMQA();
    }
}








function isMFP(){
	return typeof WL !== 'undefined';
	
}

function connectFailure() {
	loadAngularApp();
	WL.Logger.debug ("Failed connecting to MobileFirst Server.");
	WL.SimpleDialog.show("Push Notifications", "Failed connecting to MobileFirst Server. Try again later.", 
			[{
				text : 'Reload',
				handler : WL.Client.reloadapp
			},
			{
				text: 'Close',
				handler : function() {}
			}]
		);
}



//---------------------------- Set up push notifications -------------------------------
if (isMFP() && WL.Client.Push) {	
	WL.Client.Push.onReadyToSubscribe = function() {
		WL.App.getServerUrl(function(url){
			WL.SimpleDialog.show("Notifications", "Subscribed to "+url, [ {
			    text : 'Close',
			    handler : function() {
			    	//loadAngularApp();
			    }
			  }
			  ]);
		}, function(){
			WL.SimpleDialog.show("Notifications", "Not Subscribed to "+url, [ {
			    text : 'Close',
			    handler : function() {
			    	//loadAngularApp();
			    }
			  }
			  ]);
			
		});
		
	};
	//------------------------------- Handle received notification ---------------------------------------
	WL.Client.Push.onMessage = function (props, payload) {
		var msg;
		if(typeof props.alert === 'string'){
			msg =  props.alert;
		}else {
			msg = props.alert.body;
		}
		WL.SimpleDialog.show("Notification",msg, [ {
		    text : 'Close',
		    handler : function() {  	
		    }
		}]);
	};
}






