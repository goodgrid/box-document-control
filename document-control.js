import { startOfMonth, endOfMonth, addWeeks, addMonths, addYears, format, formatISO, differenceInWeeks } from "date-fns";
import boxApi from "./boxapi.js";
import Roles from "./roles.js";
import config from "./config.js";

const main = async () => {

	const firstDay = addYears(startOfMonth(addMonths(new Date(), Number(config.notifyNumberOfMonthsAhead))), config.yearsDocumentsValidity * -1)		//new Date(date.getFullYear()-1, date.getMonth() + Number(config.notifyNumberOfMonthsAhead), 1, 0, date.getHours() + (offSet * -1),0);
	const lastDay = addYears(endOfMonth(addMonths(new Date(), Number(config.notifyNumberOfMonthsAhead))), config.yearsDocumentsValidity * -1)  //new Date(date.getFullYear()-1, date.getMonth() + (Number(config.notifyNumberOfMonthsAhead) + 1), 0, 0, date.getHours() + (offSet * -1), 0);

	const roles = await Roles.list()
	const accountable = getAccountableRole(roles)

	console.log(`Searching Box for documents approved between ${format(firstDay, "MM/dd/yyyy")} and ${format(lastDay, "MM/dd/yyyy")}`)
	
	const response = await boxApi.get('search',{params: {
		mdfilters: JSON.stringify([
			{
				"scope": `enterprise_${config.jwt.enterpriseID}`,
				"templateKey":"documentControl",
				"filters":{
					"approvalDate": {
						"gt": `${formatISO(firstDay)}`,
						"lt": `${formatISO(lastDay)}`,
					}
				}
			}
		])
	}})

	response.data.entries.map(async document => {
		const response = await boxApi.get(`files/${document.id}/metadata`)

		const metadata = response.data.entries.find(entry => entry.$template == 'documentControl')
		
		const expiringDocument = {
			id: document.id,
			name: document.name,
			approvalDate: new Date(metadata.approvalDate),
			expirationDate: addYears(metadata.approvalDate, +1),
			ownership: metadata.ownership,
			responsible: (roles && roles[metadata.ownership]) ? roles[metadata.ownership].login : undefined,
			accountable: (accountable) ? accountable.login : undefined,
			taskDueDate: calculateTaskDueDate(addYears(metadata.approvalDate, +1))
		}

		if (config.debug) console.log(expiringDocument)
		createAndAssignTask(expiringDocument)
	})
}

main()

const getAccountableRole = (roles) => {
	if (roles === undefined) return undefined

	return roles[Object.keys(roles).find(role => {
		return roles[role].accountable
	})]
}

const createAndAssignTask = async (expiringDocument) => {
	try {
		const { data : { id : taskId }} = await boxApi.post(`tasks`,{
			action: "complete",
			completion_rule: "any_assignee",
			due_at: expiringDocument.taskDueDate,
			item: {
				id: expiringDocument.id,
				type: "file"
			},
			message: `This document is due for updating since it's expiring at ${format(expiringDocument.expirationDate, "MM/dd/yyyy")}.\n\nPlease review and update accordingly by following the Document Control Policy guidelines.\n\nThe due date for this task is set to the expiration date of the document minus one week to allow for review and approval of the updated document.`
		})
		if (config.debug) console.log(`A task was created for document '${expiringDocument.name}' (${expiringDocument.id}).`)

		if (expiringDocument.responsible) {
			await boxApi.post(`task_assignments`, {
				task: { 
					id: taskId,
					type: "task"
				},
				assign_to: {
					login: expiringDocument.responsible
				}
			})
			if (config.debug) console.log(`The task was assigned to ${expiringDocument.responsible} as responsible for the specific document.`) 
		}

		if (expiringDocument.accountable && expiringDocument.accountable !== expiringDocument.responsible) {
			await boxApi.post(`task_assignments`, {
				task: { 
					id: taskId,
					type: "task"
				},
				assign_to: {
					login: expiringDocument.accountable
				}
			})	
			if (config.debug) console.log(`The task was also assigned to ${expiringDocument.accountable} as accountable for documentation in general.`) 
		}
	} catch(error) {
		console.log((error.response !== undefined) ? error.response.data : error)
	}
}

const calculateTaskDueDate = (expirationDate) => {
	if (differenceInWeeks(addWeeks(expirationDate, config.weeksRequiredForApproval * -1), new Date()) < config.minimumWeeksRequiredForUpdating) {
		return addWeeks(new Date(), config.minimumWeeksRequiredForUpdating)
	}
	return addWeeks(expirationDate, config.weeksRequiredForApproval * -1)
}