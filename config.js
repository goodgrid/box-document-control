let config = {};

config.setTasksOnDayOfMonth=process.env.setTasksOnDayOfMonth
config.yearsDocumentsValidity = Number(process.env.yearsDocumentsValidity)
config.notifyNumberOfMonthsAhead = Number(process.env.notifyNumberOfMonthsAhead)
config.weeksRequiredForApproval = Number(process.env.weeksRequiredForApproval)
config.minimumWeeksRequiredForUpdating = Number(process.env.minimumWeeksRequiredForUpdating)
config.debug = (process.env.debug.toLowerCase()=="true")
config.roleDefinitionBoxId = process.env.roleDefinitionBoxId
config.boxDefaultBaseUrl = process.env.boxDefaultBaseUrl;
config.boxTokenUrl = process.env.boxTokenUrl;
config.jwt = {
    "boxAppSettings": {
        "clientID": process.env.jwtClientID,
        "clientSecret": process.env.jwtClientSecret,
        "appAuth": {
            "publicKeyID": process.env.jwtPublicKeyID,
            "privateKey": Buffer.from(process.env.jwtPrivateKeyBase64, 'base64').toString('utf-8'),
            "passphrase": process.env.jwtPassphrase
        }
    },
    "enterpriseID": process.env.jwtEnterpriseID
}
export default config;