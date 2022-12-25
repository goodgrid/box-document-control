import boxApi from "./boxapi.js";
import oktaApi from "./oktaApi.js";
import config from "./config.js";

const main = async () => {

	// Because dates are converted to ISO8601 strings which is in UTC, they need correction with an timezone offset
	const date = new Date()
	const offSet = date.getTimezoneOffset()
	const firstDayUTC = new Date(date.getFullYear()-1, date.getMonth() + Number(config.notifyNumberOfMonthsAhead), 1, 0, date.getHours() + (offSet * -1),0);
	const lastDayUTC = new Date(date.getFullYear()-1, date.getMonth() + (Number(config.notifyNumberOfMonthsAhead) + 1), 0, 0, date.getHours() + (offSet * -1), 0);


	const mdfilters = JSON.stringify([
		{
			"scope": `enterprise_${config.jwt.enterpriseID}`,
			"templateKey":"documentControl",
			"filters":{
				"approvalDate": {
					"gt": `${firstDayUTC.toISOString()}`,
					"lt": `${lastDayUTC.toISOString()}`,
				}
			}
		}
	])

	const response = await boxApi.get('search',{params: {
		mdfilters: mdfilters
	}})

	console.log(`Searching Box for documents approved between ${getReadableDate(firstDayUTC)} and ${getReadableDate(lastDayUTC)}`)

	const result = await Promise.all(response.data.entries.map(async doc => {

		const boxResponse = await boxApi.get(`files/${doc.id}/metadata`)

		const mdInstance = boxResponse.data.entries.find(entry => entry.$template == 'documentControl')
		
		const oktaResponse = await oktaApi.get('users',{params: {
			search: `profile.${config.oktaRolePropertyName} eq \"${mdInstance.ownership}\"`
		}})


		return {
			id: doc.id,
			name: doc.name,
			approvalDate: mdInstance.approvalDate,
			expirationDate: mdInstance.expirationDate,
			ownership: mdInstance.ownership,
			users: oktaResponse.data.map(user => {
				return user.profile.email
			})
		}	 
	}))

	result.map(async doc => {
		try {
			
			const { data : { id : taskId }} = await boxApi.post(`tasks`,{
				action: "complete",
				completion_rule: "any_assignee",
				due_at: doc.expirationDate, //new Date(doc.expirationDate).setHours(new Date(doc.expirationDate).getHours + offSet).toISOString(),
				item: {
					id: doc.id,
					type: "file"
				},
				message: `This document is due for updating since it's expiring at ${getReadableDate(doc.expirationDate)}. \n\nPlease review and update accordingly by following the Document Control Policy guidelines.`
				
			})
			
			doc.users.map(async user => {
				const {data} = await boxApi.post(`task_assignments`, {
					task: { 
						id: taskId,
						type: "task"
					},
					assign_to: {
						login: user
					}
				})
		
			})

			console.log(`A task was created for document ${doc.id} and was assigned to ${doc.users.join(", ")}`)

		} catch(error) {
			console.log((error.data !== undefined) ? error.data : error)
		}
	})

}


const getReadableDate = (dt) => {
	const date = new Date(dt)
	return `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()}`
}

main()