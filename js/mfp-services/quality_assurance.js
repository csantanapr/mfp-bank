function setupMQA(){
	if(isMFP()){ loadMQA();}
}
function loadMQA(){
	MQA.startSession({
        versionName: "1.0", // app release version
        android: {
            applicationKey: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            versionNumber: "1" // app version number
        },
        ios: {
            applicationKey: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            versionNumber: "1.0" // app version number
        },
        // or "MARKET_MODE" or "SILENT_MODE" or "QA_MODE"
        mode: "SILENT_MODE",
    
        // Enable problem reporting with a shake.
        shake: true
    },function(MQAObj) {
        // MQA is ready to work here.
    	WL.Logger.debug('MQA is ready');
    });
}

function sendBug(){
	
	if(isMFP()){ MQA.bug();}
	
}
function sendFeedBack(){
	var msg = window.prompt('Provide feedaback text');
	if(isMFP()){ MQA.feedback(msg);}
	
}