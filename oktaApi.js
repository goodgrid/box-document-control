import axios from "axios"
import config from "./config.js"

const oktaApi = axios.create({
    baseURL: "https://notarisid.okta.com/api/v1",
    headers: {
        "Authorization": `SSWS ${config.oktaApiToken}`
	}
})


export default oktaApi