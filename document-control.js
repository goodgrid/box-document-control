import { startOfMonth, endOfMonth, addWeeks, addMonths, addYears, format, differenceInWeeks } from "date-fns";
import boxApi from "./boxapi.js";
import Roles from "./roles.js";
import config from "./config.js";

const main = async () => {

	const approvalMonth = addYears(addMonths(new Date(), config.notifyNumberOfMonthsAhead), config.yearsDocumentsValidity * -1)
	const firstDay = startOfMonth(approvalMonth)
	const lastDay = endOfMonth(approvalMonth)

	const roles = await Roles.list()
	const accountable = getAccountableRole(roles)

	console.log(`Searching Box for documents approved between ${format(firstDay, "MM/dd/yyyy")} and ${format(lastDay, "MM/dd/yyyy")}`)

	// Box date metadata is stored as midnight UTC. The bounds are inclusive in Box
	// and cover the whole first and last day in UTC, independent of the container timezone.
	const response = await boxApi.get('search',{params: {
		limit: 200,
		mdfilters: JSON.stringify([
			{
				"scope": `enterprise_${config.jwt.enterpriseID}`,
				"templateKey":"documentControl",
				"filters":{
					"approvalDate": {
						"gt": `${format(firstDay, "yyyy-MM-dd")}T00:00:00Z`,
						"lt": `${format(lastDay, "yyyy-MM-dd")}T23:59:59Z`,
					}
				}
			}
		])
	}})

	if (response.data.total_count > response.data.entries.length) {
		console.warn(`Box found ${response.data.total_count} documents, but only the first ${response.data.entries.length} are processed.`)
	}

	response.data.entries.map(async document => {
		const response = await boxApi.get(`files/${document.id}/metadata`)

		const metadata = response.data.entries.find(entry => entry.$template == 'documentControl')

		if (roles && !roles[metadata.ownership]) {
			console.warn(`Role '${metadata.ownership}' of document '${document.name}' (${document.id}) is not found in the role definition. The task is not assigned to a responsible.`)
		}

		const approvalDate = new Date(metadata.approvalDate)
		const expirationDate = addYears(approvalDate, config.yearsDocumentsValidity)

		const expiringDocument = {
			id: document.id,
			name: document.name,
			approvalDate: approvalDate,
			expirationDate: expirationDate,
			ownership: metadata.ownership,
			responsible: (roles && roles[metadata.ownership]) ? roles[metadata.ownership].login : undefined,
			accountable: (accountable) ? accountable.login : undefined,
			taskDueDate: calculateTaskDueDate(expirationDate)
		}

		if (config.debug) console.log(expiringDocument)
		createAndAssignTask(expiringDocument)
	})
}

main()

const getAccountableRole = (roles) => {
	if (roles === undefined) return undefined

	const accountableRole = Object.keys(roles).find(role => {
		return roles[role].accountable
	})
	if (!accountableRole) {
		console.warn(`No role is marked as accountable in the role definition. Tasks are only assigned to the responsible.`)
		return undefined
	}
	return roles[accountableRole]
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
			message: `This document is due for updating since it's expiring at ${format(expiringDocument.expirationDate, "MM/dd/yyyy")}.\n\nPlease review and update accordingly by following the Document Control Policy guidelines. Please ensure that the approval date is updated in the metadata after re-approving the document. \n\nThe due date for this task is set to the expiration date of the document minus ${config.weeksRequiredForApproval} ${config.weeksRequiredForApproval == 1 ? "week" : "weeks"} to allow for review and approval of the updated document.`
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