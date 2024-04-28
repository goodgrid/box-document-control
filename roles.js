import boxApi from "./boxapi.js";
import config from "./config.js";

const Roles = {
    list: async () => {
            const response = await boxApi.get(`files/${config.roleDefinitionBoxId}/content`)
            
            if (isValidDefinition(response.data)) {
                return response.data
            } else {
                console.error(`There is an error parsing the role definition in Box file ${config.roleDefinitionBoxId}`)
                return undefined
            }
    },
}

export default Roles

const isValidDefinition = object => {
    const requiredProperties = ["login"]
    let valid = true

    Object.keys(object).map(role => {
        requiredProperties.map(requiredProperty => {
            if (typeof object[role][requiredProperty] == "undefined") valid = false
        }) 
    })
    return valid
}