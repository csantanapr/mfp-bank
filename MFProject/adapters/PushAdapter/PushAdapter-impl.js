
function processTransfer(transfer) {
	
	WL.Logger.info('Processing transfer...');
	sendNotification('Transfer for $'+transfer+' successfuly processed');
	return {
        result : transfer
    };
}

function processCheck(check) {
	
	WL.Logger.info('Processing check deposit...');
	sendNotification('Check Successfuly Deposit');
	return {
        result : check
    };
}
function sendNotification(notificationText,payload) {
    var notificationOptions = {};
    notificationOptions.message = {};
    notificationOptions.message.alert = notificationText;
    notificationOptions.settings = {
    		apns:{
    			sound:'default'
    		}
    };
    WL.Server.sendMessage("MFPBank", notificationOptions);
    
    return {
        result : "Notification sent to all users."
    };
}

