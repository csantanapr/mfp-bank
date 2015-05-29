# MobileFirst Platform Demo 2Q2015
## Demo requirements:

### Demo Scenario

- Take an existing custom application and walk through the questionnaire, showing how your solution works with the application.
- You should be able to show how data is exposed by the platform as services and how a client mobile app makes use of it.  
- Prepare to show how you manage a customer’s user identity and information that is specific to their account and current user journey, even when the customer goes offline during the journey.
- We want to see how you add notifications through engagement services and watch/analyze what the customers are doing, both at an individual and aggregate level.
- Finally we’ll want to see how you manage the application, deploy updates to services, and what options for managing and deploying the full solution you have.
- Your demo should show how your solution meets the criteria we have laid out within the questionnaire. - This is meant to be free-form and allow you to highlight your solution as best you can but it must also flow and be engaging. You will have two hours to demo your solution.

### If practical, organize demonstration of your capabilities in the following order:

1. Enterprise Integration Connectors (connecting to existing data)
2. Business Logic (aggregating data from multiple sources and making it mobile/customer ready)
3. Client-side deployment capabilities (making client side SDKs available for developer use)
4. Identity (connecting an individual customer and giving them the data they need)
5. Data Synchronization/Offline Data Sync/ (persisting it on devices)
6. Engagement services (Enriching the engagement)
7. Data/Analytics (Watching engagement to see what works)
8. App Management (Updating apps and services)
9. Deployment
10. Quality Life-Cycle Management

#### TLDR; Running the Demo
- [MFPBankDemoScript.pptx](MFPBankDemoScript.pptx) contains overview of 10 part demo
- [MFPBankDemoScript.md](MFPBankDemoScript.md) contains step by step of 10 part demo
- [MFPBankDemo Videos](https://www.youtube.com/playlist?list=PL3u18ntxxpFURX3EJ_DgiE4QlrEgWlvxQ)contains a 10 video playlist
<iframe width="560" height="315" src="https://www.youtube.com/embed/videoseries?list=PL3u18ntxxpFURX3EJ_DgiE4QlrEgWlvxQ" frameborder="0" allowfullscreen>
<p>Your browser does not support iframes. Or Markdown parser didn't liked iframes</p>
</iframe>

## MobileFirst Demo MobileFirst Platform Banking (MFPBank)

[MFPBank Source Code](https://hub.jazz.net/project/csantana/mfp-bank/overview) hosted on [IBM Bluemix DevOps Services](https://hub.jazz.net/)
<iframe src="https://mfpbank.mybluemix.net" width="320" height="568">
 <p>Your browser does not support iframes. Or Markdown parser didn't liked iframes</p>
</iframe>


### Mobile Web App Prototype (Before IBM MobileFirst Integration)
[MFPBank Web App](http://mfpbank.mybluemix.net) hosted on [IBM Bluemix](https://bluemix.net)
- Design with html, css, and javascript.
- It doesn't handle real data, mocked via json files
- It doesn't run offline
- It doesn't have user authentication and identification
- It doesn't have any integration to backend system for business logic
- It doesn't have any integration to systems of engagement
- It doesn't have any integration to systems of records
- It doesn't have notifications
- It doesn't have any secure network connections
- It doesn't have any type of application management and shutdown capabilty
- It doesn't include any device logging for diagnostics
- It doesn't have any type of crash reporting
- It doesn't have any way for user to report feedback for app problems
- It doesn't have any way to do analytics to gather data and do chart reporting
- It doesn't have any capabilty to deploy direct updates, fast
- It only runs on browser, can not be deploy to App Store as native application

### Mobile Native Cross Platform App (IBM MobileFirst Solution)

#### Improvements over Mobile Web App Prototype
- Uses real data
- Runs offline
- Has user authentication and identification
- Has integration to backend system for business logic
- Has integration to systems of engagement
- Has integration to systems of records
- Has push notifications
- Has secure network connections
- Has application management and shutdown capabilty
- Has device logging for diagnostics
- Has crash reporting
- Users can report feedback for app problems
- Provides analytics to gather data and do chart reporting
- Capable to deploy direct updates, faster than publishing to Store, and install new vesion
- Can be deploy to public or private App Store as native application

#### Capability Demonstration
- Enterprise Integration Connectors (connecting to existing data)
 - Use MFP Adapters to connect to Cloundant DB service on Bluemix
- Business Logic (aggregating data from multiple sources and making it mobile/customer ready)
 - Use MFP Adapters to connect to on premises SQL DB and transform data for mobile app
- Client-side deployment capabilities (making client side SDKs available for developer use)
 - Show MobileFirst Tooling on how to add and use client SDKs
- Identity (connecting an individual customer and giving them the data they need)
 - Use MFP security framework based on OAuth to authenticate users
- Data Synchronization/Offline Data Sync/ (persisting it on devices)
 - Use JSONStore and Cloudant Sync to work offline
- Engagement services (Enriching the engagement)
 - Send push notifications to user based on backend logic
- Data/Analytics (Watching engagement to see what works)
 - Add instrumentation for data anayltics and custom reporting
- App Management (Updating apps and services)
 - Using direct update to update app content, disable mobile App, and deploy adapter changes
- Deployment
 - Deploy apps and adapters on remote server running on public cloud, Use Tooling to launch Mobile IDE to run App on simulator or device
- Quality Life-Cycle Management
 - Enable crash reporting and device logging with MFP Analytics, Collect user feedback, bugs and sentiment analysis using MQA

